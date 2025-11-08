// Post Confirmation Lambda Trigger
// Creates user profile in database after successful registration

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const secretsManager = new AWS.SecretsManager();
const rds = new AWS.RDS();

// Database connection pool
let dbConnection = null;

exports.handler = async (event, context) => {
    console.log('Post Confirmation trigger event:', JSON.stringify(event, null, 2));
    
    try {
        // Extract user information from Cognito event
        const { 
            userPoolId, 
            userName, 
            request: { userAttributes } 
        } = event;
        
        const userId = userName;
        const email = userAttributes.email;
        const givenName = userAttributes.given_name || '';
        const familyName = userAttributes.family_name || '';
        const picture = userAttributes.picture || '';
        
        // Generate unique player ID
        const playerId = uuidv4();
        
        // Get database connection
        const db = await getDatabaseConnection();
        
        // Create user profile in database
        await createUserProfile(db, {
            userId,
            playerId,
            email,
            givenName,
            familyName,
            picture,
            provider: getAuthProvider(event),
            createdAt: new Date()
        });
        
        // Update Cognito user attributes with player ID
        await updateCognitoUserAttributes(userPoolId, userId, {
            'custom:player_id': playerId,
            'custom:games_played': '0',
            'custom:games_won': '0'
        });
        
        console.log(`User profile created successfully for user: ${userId}, player: ${playerId}`);
        
        return event;
        
    } catch (error) {
        console.error('Error in post confirmation trigger:', error);
        
        // Don't throw error to avoid blocking user registration
        // Log error for monitoring and investigation
        await logError(error, event);
        
        return event;
    }
};

async function getDatabaseConnection() {
    if (dbConnection) {
        return dbConnection;
    }
    
    try {
        // Get database credentials from Secrets Manager
        const secretArn = process.env.DATABASE_SECRET_ARN;
        const secretResponse = await secretsManager.getSecretValue({
            SecretId: secretArn
        }).promise();
        
        const credentials = JSON.parse(secretResponse.SecretString);
        
        // Create database connection
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
            max: 1, // Lambda connection limit
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        
        return dbConnection;
        
    } catch (error) {
        console.error('Error connecting to database:', error);
        throw error;
    }
}

async function createUserProfile(db, userProfile) {
    const {
        userId,
        playerId,
        email,
        givenName,
        familyName,
        picture,
        provider,
        createdAt
    } = userProfile;
    
    const query = `
        INSERT INTO users (
            user_id,
            player_id,
            email,
            given_name,
            family_name,
            picture_url,
            auth_provider,
            created_at,
            updated_at,
            is_active,
            email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, true, true)
        ON CONFLICT (user_id) DO UPDATE SET
            email = EXCLUDED.email,
            given_name = EXCLUDED.given_name,
            family_name = EXCLUDED.family_name,
            picture_url = EXCLUDED.picture_url,
            updated_at = EXCLUDED.updated_at
    `;
    
    const values = [
        userId,
        playerId,
        email,
        givenName,
        familyName,
        picture,
        provider,
        createdAt
    ];
    
    await db.query(query, values);
    
    // Create initial user statistics record
    const statsQuery = `
        INSERT INTO user_stats (
            user_id,
            games_played,
            games_won,
            games_lost,
            games_drawn,
            total_score,
            rank_points,
            rank_tier,
            current_streak,
            best_streak,
            created_at,
            updated_at
        ) VALUES ($1, 0, 0, 0, 0, 0, 1000, 'Bronze', 0, 0, $2, $2)
        ON CONFLICT (user_id) DO NOTHING
    `;
    
    await db.query(statsQuery, [userId, createdAt]);
}

async function updateCognitoUserAttributes(userPoolId, userId, attributes) {
    const cognito = new AWS.CognitoIdentityServiceProvider();
    
    const userAttributes = Object.entries(attributes).map(([name, value]) => ({
        Name: name,
        Value: value
    }));
    
    await cognito.adminUpdateUserAttributes({
        UserPoolId: userPoolId,
        Username: userId,
        UserAttributes: userAttributes
    }).promise();
}

function getAuthProvider(event) {
    // Determine authentication provider from event
    const triggerSource = event.triggerSource;
    
    if (triggerSource.includes('Google')) {
        return 'Google';
    } else if (triggerSource.includes('Facebook')) {
        return 'Facebook';
    } else if (triggerSource.includes('Amazon')) {
        return 'Amazon';
    } else {
        return 'Cognito';
    }
}

async function logError(error, event) {
    try {
        // Log error to CloudWatch
        console.error('Post confirmation error details:', {
            error: error.message,
            stack: error.stack,
            event: event,
            timestamp: new Date().toISOString()
        });
        
        // Could also send to external monitoring service
        // await sendToMonitoring(error, event);
        
    } catch (logError) {
        console.error('Error logging error:', logError);
    }
}

// Cleanup function for Lambda container reuse
process.on('beforeExit', async () => {
    if (dbConnection) {
        await dbConnection.end();
        dbConnection = null;
    }
});