// Post Authentication Lambda Trigger
// Logs user authentication events and updates last login

const AWS = require('aws-sdk');

const secretsManager = new AWS.SecretsManager();
let dbConnection = null;

exports.handler = async (event, context) => {
    console.log('Post Authentication trigger event:', JSON.stringify(event, null, 2));
    
    try {
        const { 
            userName,
            request: { userAttributes, clientMetadata }
        } = event;
        
        // Update last login timestamp
        await updateLastLogin(userName, userAttributes);
        
        // Log authentication event for security monitoring
        await logAuthenticationEvent(userName, userAttributes, event);
        
        console.log(`Post authentication processing completed for user: ${userName}`);
        
        return event;
        
    } catch (error) {
        console.error('Error in post authentication trigger:', error);
        
        // Don't throw error to avoid blocking authentication
        // Log error for monitoring
        await logError(error, event);
        
        return event;
    }
};

async function updateLastLogin(userName, userAttributes) {
    try {
        const db = await getDatabaseConnection();
        
        const query = `
            UPDATE users 
            SET 
                last_login_at = $1,
                login_count = COALESCE(login_count, 0) + 1,
                updated_at = $1
            WHERE user_id = $2
        `;
        
        const now = new Date();
        await db.query(query, [now, userName]);
        
        console.log(`Updated last login for user: ${userName}`);
        
    } catch (error) {
        console.error('Error updating last login:', error);
        // Don't throw - this is not critical
    }
}

async function logAuthenticationEvent(userName, userAttributes, event) {
    try {
        // Log to CloudWatch for monitoring
        console.log('Authentication event:', {
            userId: userName,
            email: userAttributes.email,
            timestamp: new Date().toISOString(),
            triggerSource: event.triggerSource,
            clientId: event.callerContext?.clientId,
            userAgent: event.request?.clientMetadata?.userAgent
        });
        
        // Could also send to external security monitoring service
        // await sendToSecurityMonitoring(authEvent);
        
    } catch (error) {
        console.error('Error logging authentication event:', error);
    }
}

async function getDatabaseConnection() {
    if (dbConnection) {
        return dbConnection;
    }
    
    try {
        const secretArn = process.env.DATABASE_SECRET_ARN;
        const secretResponse = await secretsManager.getSecretValue({
            SecretId: secretArn
        }).promise();
        
        const credentials = JSON.parse(secretResponse.SecretString);
        
        const { Pool } = require('pg');
        
        dbConnection = new Pool({
            host: credentials.host,
            port: credentials.port,
            database: credentials.dbname,
            user: credentials.username,
            password: credentials.password,
            ssl: {
                rejectUnauthorized: false
            },
            max: 1,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        return dbConnection;
        
    } catch (error) {
        console.error('Error connecting to database:', error);
        throw error;
    }
}

async function logError(error, event) {
    try {
        console.error('Post authentication error details:', {
            error: error.message,
            stack: error.stack,
            event: event,
            timestamp: new Date().toISOString()
        });
        
    } catch (logError) {
        console.error('Error logging error:', logError);
    }
}

process.on('beforeExit', async () => {
    if (dbConnection) {
        await dbConnection.end();
        dbConnection = null;
    }
});