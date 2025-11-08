// Pre Sign Up Lambda Trigger
// Validates and processes user registration before account creation

exports.handler = async (event, context) => {
    console.log('Pre Sign Up trigger event:', JSON.stringify(event, null, 2));
    
    try {
        const { 
            triggerSource,
            request: { userAttributes, validationData },
            response 
        } = event;
        
        // Auto-confirm users from trusted social providers
        if (triggerSource === 'PreSignUp_ExternalProvider') {
            response.autoConfirmUser = true;
            response.autoVerifyEmail = true;
            
            console.log('Auto-confirming external provider user');
        }
        
        // Validate email domain if specified
        if (userAttributes.email) {
            const email = userAttributes.email.toLowerCase();
            
            // Check for blocked domains
            const blockedDomains = [
                'tempmail.com',
                '10minutemail.com',
                'guerrillamail.com',
                'mailinator.com'
            ];
            
            const emailDomain = email.split('@')[1];
            if (blockedDomains.includes(emailDomain)) {
                throw new Error('Email domain not allowed');
            }
            
            // Normalize email
            event.request.userAttributes.email = email;
        }
        
        // Validate username format
        if (event.userName) {
            const username = event.userName;
            
            // Username validation rules
            if (username.length < 3 || username.length > 20) {
                throw new Error('Username must be between 3 and 20 characters');
            }
            
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
            }
            
            // Check for reserved usernames
            const reservedUsernames = [
                'admin', 'administrator', 'root', 'system',
                'support', 'help', 'api', 'www', 'mail',
                'test', 'demo', 'guest', 'anonymous'
            ];
            
            if (reservedUsernames.includes(username.toLowerCase())) {
                throw new Error('Username is reserved');
            }
        }
        
        // Validate display name
        if (userAttributes.given_name || userAttributes.family_name) {
            const givenName = userAttributes.given_name || '';
            const familyName = userAttributes.family_name || '';
            
            // Check for inappropriate content (basic check)
            const inappropriateWords = [
                'admin', 'moderator', 'staff', 'official'
            ];
            
            const fullName = `${givenName} ${familyName}`.toLowerCase();
            for (const word of inappropriateWords) {
                if (fullName.includes(word)) {
                    throw new Error('Display name contains inappropriate content');
                }
            }
        }
        
        // Log successful validation
        console.log(`Pre signup validation passed for user: ${event.userName}`);
        
        return event;
        
    } catch (error) {
        console.error('Pre signup validation failed:', error);
        
        // Throw error to prevent user registration
        throw new Error(`Registration validation failed: ${error.message}`);
    }
};