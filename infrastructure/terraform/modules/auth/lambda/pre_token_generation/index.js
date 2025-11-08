// Pre Token Generation Lambda Trigger
// Customizes JWT tokens with additional claims

const AWS = require('aws-sdk');

exports.handler = async (event, context) => {
    console.log('Pre Token Generation trigger event:', JSON.stringify(event, null, 2));
    
    try {
        const { 
            request: { userAttributes, groupConfiguration },
            response: { claimsOverrideDetails }
        } = event;
        
        // Initialize claims override
        event.response.claimsOverrideDetails = {
            claimsToAddOrOverride: {},
            claimsToSuppress: [],
            groupOverrideDetails: null
        };
        
        // Add custom claims to the token
        const customClaims = {};
        
        // Add player ID to token
        if (userAttributes['custom:player_id']) {
            customClaims.player_id = userAttributes['custom:player_id'];
        }
        
        // Add game statistics to token
        if (userAttributes['custom:games_played']) {
            customClaims.games_played = parseInt(userAttributes['custom:games_played']) || 0;
        }
        
        if (userAttributes['custom:games_won']) {
            customClaims.games_won = parseInt(userAttributes['custom:games_won']) || 0;
        }
        
        // Calculate win rate
        const gamesPlayed = customClaims.games_played || 0;
        const gamesWon = customClaims.games_won || 0;
        customClaims.win_rate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
        
        // Add user role/permissions
        customClaims.role = 'player'; // Default role
        customClaims.permissions = ['play_game', 'view_leaderboard', 'manage_profile'];
        
        // Add account status
        customClaims.account_status = 'active';
        customClaims.email_verified = userAttributes.email_verified === 'true';
        
        // Add display name
        const givenName = userAttributes.given_name || '';
        const familyName = userAttributes.family_name || '';
        if (givenName || familyName) {
            customClaims.display_name = `${givenName} ${familyName}`.trim();
        }
        
        // Add profile picture
        if (userAttributes.picture) {
            customClaims.picture = userAttributes.picture;
        }
        
        // Add authentication provider
        customClaims.auth_provider = getAuthProvider(event);
        
        // Add token metadata
        customClaims.token_version = '1.0';
        customClaims.issued_at = Math.floor(Date.now() / 1000);
        
        // Set the custom claims
        event.response.claimsOverrideDetails.claimsToAddOrOverride = customClaims;
        
        // Suppress sensitive attributes from token
        event.response.claimsOverrideDetails.claimsToSuppress = [
            'email_verified',
            'phone_number_verified'
        ];
        
        console.log(`Token customized for user: ${event.userName} with claims:`, customClaims);
        
        return event;
        
    } catch (error) {
        console.error('Error in pre token generation trigger:', error);
        
        // Don't throw error to avoid blocking token generation
        // Return event as-is if customization fails
        return event;
    }
};

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