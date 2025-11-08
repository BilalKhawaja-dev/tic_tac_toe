// Lambda function to handle AppConfig configuration changes
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

exports.handler = async (event) => {
    console.log('Received AppConfig change event:', JSON.stringify(event, null, 2));
    
    try {
        const detail = event.detail;
        const applicationId = detail.applicationId;
        const environmentId = detail.environmentId;
        const configurationProfileId = detail.configurationProfileId;
        const deploymentNumber = detail.deploymentNumber;
        const deploymentStatus = detail.state;
        
        // Construct notification message
        const message = {
            timestamp: new Date().toISOString(),
            event: 'AppConfig Configuration Change',
            details: {
                applicationId,
                environmentId,
                configurationProfileId,
                deploymentNumber,
                status: deploymentStatus,
                description: detail.description || 'Configuration deployment completed'
            }
        };
        
        // Send notification to SNS topic
        const snsParams = {
            TopicArn: '${sns_topic_arn}',
            Subject: `AppConfig Deployment ${deploymentStatus}: ${applicationId}`,
            Message: JSON.stringify(message, null, 2)
        };
        
        await sns.publish(snsParams).promise();
        
        console.log('Successfully sent notification for configuration change');
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Configuration change notification sent successfully',
                deploymentNumber
            })
        };
        
    } catch (error) {
        console.error('Error processing configuration change:', error);
        
        // Send error notification
        const errorMessage = {
            timestamp: new Date().toISOString(),
            event: 'AppConfig Configuration Change Error',
            error: error.message,
            details: event
        };
        
        try {
            await sns.publish({
                TopicArn: '${sns_topic_arn}',
                Subject: 'AppConfig Configuration Change Processing Error',
                Message: JSON.stringify(errorMessage, null, 2)
            }).promise();
        } catch (snsError) {
            console.error('Failed to send error notification:', snsError);
        }
        
        throw error;
    }
};