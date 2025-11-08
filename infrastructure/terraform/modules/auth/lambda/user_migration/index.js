// User Migration Lambda Trigger
// Handles migration of existing users from legacy systems

exports.handler = async (event, context) => {
    console.log('User Migration trigger event:', JSON.stringify(event, null, 2));
    
    try {
        const { 
            triggerSource,
            request: { password, validationData },
            userName
        } = event;
        
        if (triggerSource === 'UserMigration_Authentication') {
            // Authenticate user against legacy system
            const isValidUser = await authenticateAgainstLegacySystem(userName, password);
            
            if (isValidUser) {
                // Get user profile from legacy system
                const userProfile = await getLegacyUserProfile(userName);
                
                // Set user attributes for Cognito
                event.response.userAttributes = {
                    email: userProfile.email,
                    email_verified: 'true',
                    given_name: userProfile.firstName || '',
                    family_name: userProfile.lastName || '',
                    'custom:player_id': userProfile.playerId || '',
                    'custom:games_played': userProfile.gamesPlayed?.toString() || '0',
                    'custom:games_won': userProfile.gamesWon?.toString() || '0'
                };
                
                // Set final user password (Cognito will hash it)
                event.response.finalUserStatus = 'CONFIRMED';
                event.response.messageAction = 'SUPPRESS';
                
                console.log(`User migration successful for: ${userName}`);
            } else {
                throw new Error('Invalid credentials for migration');
            }
        }
        
        return event;
        
    } catch (error) {
        console.error('User migration failed:', error);
        throw new Error(`Migration failed: ${error.message}`);
    }
};

async function authenticateAgainstLegacySystem(username, password) {
    // Placeholder for legacy system authentication
    // In a real implementation, this would:
    // 1. Connect to legacy database/API
    // 2. Verify username/password
    // 3. Return true/false
    
    console.log(`Authenticating user ${username} against legacy system`);
    
    // For demo purposes, return false to disable migration
    // Set to true and implement actual logic when needed
    return false;
}

async function getLegacyUserProfile(username) {
    // Placeholder for legacy user profile retrieval
    // In a real implementation, this would:
    // 1. Query legacy database
    // 2. Return user profile data
    
    console.log(`Retrieving legacy profile for user ${username}`);
    
    return {
        email: `${username}@example.com`,
        firstName: 'Legacy',
        lastName: 'User',
        playerId: `legacy-${username}`,
        gamesPlayed: 0,
        gamesWon: 0
    };
}