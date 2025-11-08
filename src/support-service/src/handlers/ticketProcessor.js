// Ticket Processor Lambda
// Processes tickets from SQS queue for async operations

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient({});

const TICKETS_TABLE = process.env.TICKETS_TABLE || 'support_tickets';
const TICKET_TOPIC_ARN = process.env.TICKET_TOPIC_ARN;

/**
 * Auto-assign ticket to available agent
 */
async function autoAssignTicket(ticketId, priority, category) {
  // In a real system, this would query available agents
  // For now, we'll use a simple round-robin or priority-based assignment
  
  const agents = {
    technical: ['agent-tech-1', 'agent-tech-2'],
    gameplay: ['agent-game-1', 'agent-game-2'],
    account: ['agent-account-1'],
    billing: ['agent-billing-1'],
    other: ['agent-general-1']
  };
  
  const availableAgents = agents[category] || agents.other;
  const assignedAgent = availableAgents[Math.floor(Math.random() * availableAgents.length)];
  
  await docClient.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId },
    UpdateExpression: 'SET assignedTo = :agent, #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':agent': assignedAgent,
      ':status': 'in_progress',
      ':updatedAt': Date.now()
    }
  }));
  
  return assignedAgent;
}

/**
 * Check SLA and escalate if needed
 */
async function checkSLA(ticketId) {
  const result = await docClient.send(new GetCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId }
  }));
  
  if (!result.Item) {
    return;
  }
  
  const ticket = result.Item;
  const now = Date.now();
  
  // Check if SLA is breached
  if (ticket.slaDeadline < now && ticket.status !== 'resolved' && ticket.status !== 'closed') {
    // Escalate ticket
    await docClient.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression: 'SET priority = :priority, escalated = :escalated, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':priority': 'urgent',
        ':escalated': true,
        ':updatedAt': now
      }
    }));
    
    // Send escalation notification
    if (TICKET_TOPIC_ARN) {
      await snsClient.send(new PublishCommand({
        TopicArn: TICKET_TOPIC_ARN,
        Subject: `SLA BREACH - Ticket Escalated: ${ticketId}`,
        Message: JSON.stringify({
          ticketId,
          originalPriority: ticket.priority,
          newPriority: 'urgent',
          slaDeadline: new Date(ticket.slaDeadline).toISOString(),
          breachedBy: Math.floor((now - ticket.slaDeadline) / (60 * 1000)) + ' minutes'
        })
      }));
    }
  }
}

/**
 * Generate automated response suggestions
 */
function generateResponseSuggestions(ticket) {
  const suggestions = [];
  
  // Common responses based on category
  const templates = {
    technical: [
      'Thank you for reporting this issue. Our technical team is investigating.',
      'Have you tried clearing your browser cache and cookies?',
      'Please provide your browser version and operating system.'
    ],
    gameplay: [
      'Thank you for your feedback. We\'re reviewing the game session.',
      'Can you provide the Game ID for us to investigate?',
      'Our team will review the match replay and get back to you.'
    ],
    account: [
      'For security reasons, please verify your email address.',
      'We\'ve sent a password reset link to your registered email.',
      'Your account has been reviewed and is now active.'
    ],
    billing: [
      'We\'ve processed your refund request. Please allow 3-5 business days.',
      'Your payment method has been updated successfully.',
      'Please provide your transaction ID for us to investigate.'
    ]
  };
  
  const categoryTemplates = templates[ticket.category] || [];
  
  // Add relevant suggestions based on ticket content
  const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
  
  if (text.includes('refund')) {
    suggestions.push('We\'ve initiated a refund. It will appear in your account within 3-5 business days.');
  }
  
  if (text.includes('bug') || text.includes('error')) {
    suggestions.push('Thank you for reporting this bug. Our development team has been notified.');
  }
  
  if (text.includes('cannot login') || text.includes('password')) {
    suggestions.push('We\'ve sent a password reset link to your registered email address.');
  }
  
  return [...new Set([...suggestions, ...categoryTemplates])].slice(0, 3);
}

/**
 * Main SQS handler
 */
exports.handler = async (event) => {
  console.log('Processing tickets from SQS:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const { action, ticketId, priority, category } = message;
      
      switch (action) {
        case 'new_ticket':
          // Auto-assign ticket
          const assignedAgent = await autoAssignTicket(ticketId, priority, category);
          console.log(`Ticket ${ticketId} assigned to ${assignedAgent}`);
          
          // Get ticket details for suggestions
          const ticketResult = await docClient.send(new GetCommand({
            TableName: TICKETS_TABLE,
            Key: { ticketId }
          }));
          
          if (ticketResult.Item) {
            // Generate response suggestions
            const suggestions = generateResponseSuggestions(ticketResult.Item);
            
            // Store suggestions
            await docClient.send(new UpdateCommand({
              TableName: TICKETS_TABLE,
              Key: { ticketId },
              UpdateExpression: 'SET responseSuggestions = :suggestions',
              ExpressionAttributeValues: {
                ':suggestions': suggestions
              }
            }));
          }
          break;
          
        case 'check_sla':
          await checkSLA(ticketId);
          break;
          
        default:
          console.log(`Unknown action: ${action}`);
      }
      
    } catch (error) {
      console.error('Error processing ticket:', error);
      // In production, you might want to send to DLQ
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Tickets processed successfully' })
  };
};

/**
 * Scheduled SLA checker
 * Runs periodically to check all open tickets for SLA breaches
 */
exports.slaChecker = async (event) => {
  console.log('Running SLA checker...');
  
  try {
    // Get all open tickets
    const result = await docClient.send(new ScanCommand({
      TableName: TICKETS_TABLE,
      FilterExpression: '#status IN (:open, :in_progress, :waiting)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':open': 'open',
        ':in_progress': 'in_progress',
        ':waiting': 'waiting_customer'
      }
    }));
    
    const now = Date.now();
    let escalatedCount = 0;
    
    for (const ticket of result.Items) {
      if (ticket.slaDeadline < now && !ticket.escalated) {
        await checkSLA(ticket.ticketId);
        escalatedCount++;
      }
    }
    
    console.log(`SLA check complete. Escalated ${escalatedCount} tickets.`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'SLA check complete',
        escalatedCount
      })
    };
    
  } catch (error) {
    console.error('Error in SLA checker:', error);
    throw error;
  }
};
