// Pre Authentication Lambda Trigger
// Validates user before authentication

exports.handler = async (event, context) => {
    console.log('Pre Authentication trigger event:', JSON.stringify(event, null, 2));
    
    try {
        const { 
            request: { userAttributes, validationData },
            triggerSource
        } = event;
        
        // Check if user account is active
        // This could check a database flag or external service
        
        // For now, allow all authenticated users
        // In production, you might want to:
        // 1. Check if user is banned
        // 2. Verify account status
        // 3. Check for suspicious activity
        // 4. Implement rate limiting per user
        
        console.log(`Pre authentication check passed for user: ${event.userName}`);
        
        return event;
        
    } catch (error) {
        console.error('Pre authentication check failed:', error);
        
        // Throw error to prevent authentication
        throw new Error(`Authentication blocked: ${error.message}`);
    }
};