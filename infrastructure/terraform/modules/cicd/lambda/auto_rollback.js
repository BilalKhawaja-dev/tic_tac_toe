/**
 * Automated Rollback Lambda Function
 * Triggers rollback based on CloudWatch alarm state changes
 */

const AWS = require('aws-sdk');
const codedeploy = new AWS.CodeDeploy();
const ecs = new AWS.ECS();
const sns = new AWS.SNS();

exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    // Parse CloudWatch alarm event
    const message = JSON.parse(event.Records[0].Sns.Message);
    const alarmName = message.AlarmName;
    const newState = message.NewStateValue;
    const reason = message.NewStateReason;
    
    console.log(`Alarm: ${alarmName}, State: ${newState}, Reason: ${reason}`);
    
    // Only trigger rollback on ALARM state
    if (newState !== 'ALARM') {
      console.log('Alarm not in ALARM state, skipping rollback');
      return { statusCode: 200, body: 'No action needed' };
    }
    
    // Extract service name from alarm name
    // Expected format: gaming-platform-{service}-{metric}-alarm
    const serviceMatch = alarmName.match(/gaming-platform-([^-]+)-/);
    if (!serviceMatch) {
      console.error('Could not extract service name from alarm');
      return { statusCode: 400, body: 'Invalid alarm name format' };
    }
    
    const serviceName = serviceMatch[1];
    console.log(`Service identified: ${serviceName}`);
    
    // Attempt CodeDeploy rollback
    const rollbackResult = await attemptCodeDeployRollback(serviceName);
    
    if (rollbackResult.success) {
      await sendNotification(
        'ROLLBACK_INITIATED',
        `Automatic rollback initiated for ${serviceName} due to alarm: ${alarmName}`
      );
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Rollback initiated successfully',
          service: serviceName,
          deploymentId: rollbackResult.deploymentId
        })
      };
    } else {
      // Fallback to ECS rollback
      console.log('CodeDeploy rollback failed, attempting ECS rollback');
      const ecsResult = await attemptECSRollback(serviceName);
      
      if (ecsResult.success) {
        await sendNotification(
          'ROLLBACK_INITIATED',
          `Automatic ECS rollback initiated for ${serviceName} due to alarm: ${alarmName}`
        );
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'ECS rollback initiated successfully',
            service: serviceName
          })
        };
      } else {
        await sendNotification(
          'ROLLBACK_FAILED',
          `Automatic rollback failed for ${serviceName}. Manual intervention required. Alarm: ${alarmName}`
        );
        
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: 'Rollback failed',
            service: serviceName,
            error: ecsResult.error
          })
        };
      }
    }
  } catch (error) {
    console.error('Error processing rollback:', error);
    
    await sendNotification(
      'ROLLBACK_ERROR',
      `Error during automatic rollback: ${error.message}`
    );
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing rollback',
        error: error.message
      })
    };
  }
};

/**
 * Attempt CodeDeploy rollback
 */
async function attemptCodeDeployRollback(serviceName) {
  try {
    const applicationName = `gaming-platform-${serviceName}`;
    const deploymentGroupName = `${applicationName}-dg`;
    
    // Get latest deployment
    const deployments = await codedeploy.listDeployments({
      applicationName,
      deploymentGroupName,
      includeOnlyStatuses: ['InProgress', 'Ready']
    }).promise();
    
    if (!deployments.deployments || deployments.deployments.length === 0) {
      console.log('No active deployments found');
      return { success: false, error: 'No active deployments' };
    }
    
    const deploymentId = deployments.deployments[0];
    console.log(`Stopping deployment: ${deploymentId}`);
    
    // Stop deployment (triggers automatic rollback)
    await codedeploy.stopDeployment({
      deploymentId,
      autoRollbackEnabled: true
    }).promise();
    
    console.log('Deployment stopped, rollback initiated');
    return { success: true, deploymentId };
  } catch (error) {
    console.error('CodeDeploy rollback error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Attempt ECS rollback
 */
async function attemptECSRollback(serviceName) {
  try {
    const clusterName = process.env.ECS_CLUSTER || 'gaming-platform-production';
    const ecsServiceName = `${serviceName}-service`;
    
    // Get current service
    const services = await ecs.describeServices({
      cluster: clusterName,
      services: [ecsServiceName]
    }).promise();
    
    if (!services.services || services.services.length === 0) {
      return { success: false, error: 'Service not found' };
    }
    
    const service = services.services[0];
    const currentTaskDef = service.taskDefinition;
    
    // Extract task family and revision
    const taskDefParts = currentTaskDef.split('/')[1].split(':');
    const family = taskDefParts[0];
    const currentRevision = parseInt(taskDefParts[1]);
    const previousRevision = currentRevision - 1;
    
    if (previousRevision < 1) {
      return { success: false, error: 'No previous revision available' };
    }
    
    const previousTaskDef = `${family}:${previousRevision}`;
    console.log(`Rolling back to task definition: ${previousTaskDef}`);
    
    // Update service with previous task definition
    await ecs.updateService({
      cluster: clusterName,
      service: ecsServiceName,
      taskDefinition: previousTaskDef,
      forceNewDeployment: true
    }).promise();
    
    console.log('ECS service updated with previous task definition');
    return { success: true };
  } catch (error) {
    console.error('ECS rollback error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send SNS notification
 */
async function sendNotification(status, message) {
  try {
    const topicArn = process.env.SNS_TOPIC_ARN;
    if (!topicArn) {
      console.log('SNS_TOPIC_ARN not set, skipping notification');
      return;
    }
    
    await sns.publish({
      TopicArn: topicArn,
      Subject: `Automated Rollback: ${status}`,
      Message: message
    }).promise();
    
    console.log('Notification sent');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
