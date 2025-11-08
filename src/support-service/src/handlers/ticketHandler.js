// Ticket Management Lambda Handler
// CRUD operations for support tickets

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});
const snsClient = new SNSClient({});

const TICKETS_TABLE = process.env.TICKETS_TABLE || 'support_tickets';
const TICKET_QUEUE_URL = process.env.TICKET_QUEUE_URL;
const TICKET_TOPIC_ARN = process.env.TICKET_TOPIC_ARN;

// Validation schemas
const createTicketSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  subject: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(10).max(5000).required(),
  category: Joi.string().valid('technical', 'gameplay', 'account', 'billing', 'other').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional()
});

const updateTicketSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'waiting_customer', 'resolved', 'closed').optional(),
  assignedTo: Joi.string().optional(),
  response: Joi.string().max(5000).optional(),
  internalNotes: Joi.string().max(2000).optional()
});

/**
 * Categorize and assign priority to ticket
 */
function categorizeTicket(subject, description, category) {
  const text = `${subject} ${description}`.toLowerCase();
  
  // Priority keywords
  const urgentKeywords = ['urgent', 'critical', 'cannot play', 'lost money', 'hacked', 'security'];
  const highKeywords = ['bug', 'error', 'crash', 'not working', 'broken'];
  const mediumKeywords = ['slow', 'issue', 'problem', 'help'];
  
  // Determine priority
  let priority = 'low';
  if (urgentKeywords.some(keyword => text.includes(keyword))) {
    priority = 'urgent';
  } else if (highKeywords.some(keyword => text.includes(keyword))) {
    priority = 'high';
  } else if (mediumKeywords.some(keyword => text.includes(keyword))) {
    priority = 'medium';
  }
  
  // Auto-categorize if not specified
  if (!category || category === 'other') {
    if (text.includes('payment') || text.includes('billing') || text.includes('charge')) {
      category = 'billing';
    } else if (text.includes('account') || text.includes('login') || text.includes('password')) {
      category = 'account';
    } else if (text.includes('game') || text.includes('match') || text.includes('opponent')) {
      category = 'gameplay';
    } else if (text.includes('bug') || text.includes('error') || text.includes('crash')) {
      category = 'technical';
    }
  }
  
  return { category, priority };
}

/**
 * Calculate SLA deadline based on priority
 */
function calculateSLA(priority) {
  const now = Date.now();
  const slaHours = {
    urgent: 4,
    high: 24,
    medium: 48,
    low: 72
  };
  
  return now + (slaHours[priority] * 60 * 60 * 1000);
}

/**
 * Create new support ticket
 */
exports.createTicket = async (event) => {
  try {
    const body = JSON.parse(event.body);
    
    // Validate input
    const { error, value } = createTicketSchema.validate(body);
    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        })
      };
    }
    
    const { userId, subject, description, category: inputCategory, priority: inputPriority } = value;
    
    // Auto-categorize and prioritize
    const { category, priority } = categorizeTicket(subject, description, inputCategory);
    const finalPriority = inputPriority || priority;
    
    // Create ticket
    const ticketId = uuidv4();
    const now = Date.now();
    const slaDeadline = calculateSLA(finalPriority);
    
    const ticket = {
      ticketId,
      userId,
      subject,
      description,
      category,
      priority: finalPriority,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      slaDeadline,
      assignedTo: null,
      responses: [],
      internalNotes: []
    };
    
    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: TICKETS_TABLE,
      Item: ticket
    }));
    
    // Send to SQS for processing
    if (TICKET_QUEUE_URL) {
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: TICKET_QUEUE_URL,
        MessageBody: JSON.stringify({
          action: 'new_ticket',
          ticketId,
          priority: finalPriority,
          category
        })
      }));
    }
    
    // Publish SNS notification
    if (TICKET_TOPIC_ARN) {
      await snsClient.send(new PublishCommand({
        TopicArn: TICKET_TOPIC_ARN,
        Subject: `New Support Ticket: ${ticketId}`,
        Message: JSON.stringify({
          ticketId,
          userId,
          subject,
          priority: finalPriority,
          category
        })
      }));
    }
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        data: {
          ticketId,
          status: 'open',
          priority: finalPriority,
          category,
          slaDeadline: new Date(slaDeadline).toISOString()
        },
        message: 'Ticket created successfully'
      })
    };
    
  } catch (error) {
    console.error('Error creating ticket:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Get ticket by ID
 */
exports.getTicket = async (event) => {
  try {
    const { ticketId } = event.pathParameters;
    
    const result = await docClient.send(new GetCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId }
    }));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        })
      };
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.Item
      })
    };
    
  } catch (error) {
    console.error('Error getting ticket:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Update ticket
 */
exports.updateTicket = async (event) => {
  try {
    const { ticketId } = event.pathParameters;
    const body = JSON.parse(event.body);
    
    // Validate input
    const { error, value } = updateTicketSchema.validate(body);
    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        })
      };
    }
    
    // Build update expression
    const updates = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    if (value.status) {
      updates.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = value.status;
    }
    
    if (value.assignedTo) {
      updates.push('assignedTo = :assignedTo');
      expressionAttributeValues[':assignedTo'] = value.assignedTo;
    }
    
    if (value.response) {
      updates.push('responses = list_append(if_not_exists(responses, :empty_list), :response)');
      expressionAttributeValues[':empty_list'] = [];
      expressionAttributeValues[':response'] = [{
        text: value.response,
        timestamp: Date.now(),
        author: event.requestContext?.authorizer?.userId || 'system'
      }];
    }
    
    if (value.internalNotes) {
      updates.push('internalNotes = list_append(if_not_exists(internalNotes, :empty_list), :note)');
      expressionAttributeValues[':empty_list'] = [];
      expressionAttributeValues[':note'] = [{
        text: value.internalNotes,
        timestamp: Date.now(),
        author: event.requestContext?.authorizer?.userId || 'system'
      }];
    }
    
    updates.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = Date.now();
    
    const result = await docClient.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));
    
    // Notify on status change
    if (value.status && TICKET_TOPIC_ARN) {
      await snsClient.send(new PublishCommand({
        TopicArn: TICKET_TOPIC_ARN,
        Subject: `Ticket Status Updated: ${ticketId}`,
        Message: JSON.stringify({
          ticketId,
          newStatus: value.status,
          updatedAt: Date.now()
        })
      }));
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.Attributes,
        message: 'Ticket updated successfully'
      })
    };
    
  } catch (error) {
    console.error('Error updating ticket:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * List tickets with filtering
 */
exports.listTickets = async (event) => {
  try {
    const { status, priority, category, userId } = event.queryStringParameters || {};
    
    let params = {
      TableName: TICKETS_TABLE
    };
    
    // Build filter expression
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    if (status) {
      filterExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = status;
    }
    
    if (priority) {
      filterExpressions.push('priority = :priority');
      expressionAttributeValues[':priority'] = priority;
    }
    
    if (category) {
      filterExpressions.push('category = :category');
      expressionAttributeValues[':category'] = category;
    }
    
    if (userId) {
      filterExpressions.push('userId = :userId');
      expressionAttributeValues[':userId'] = userId;
    }
    
    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
      params.ExpressionAttributeNames = expressionAttributeNames;
      params.ExpressionAttributeValues = expressionAttributeValues;
    }
    
    const result = await docClient.send(new ScanCommand(params));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          tickets: result.Items,
          count: result.Count
        }
      })
    };
    
  } catch (error) {
    console.error('Error listing tickets:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Get tickets by user
 */
exports.getUserTickets = async (event) => {
  try {
    const { userId } = event.pathParameters;
    
    const result = await docClient.send(new QueryCommand({
      TableName: TICKETS_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false // Most recent first
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          tickets: result.Items,
          count: result.Count
        }
      })
    };
    
  } catch (error) {
    console.error('Error getting user tickets:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};
