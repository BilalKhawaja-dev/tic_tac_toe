// AWS Cognito Service
// Handles Cognito User Pool operations and OAuth flows

const AWS = require('aws-sdk');
const { 
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  ListUsersCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const logger = require('../utils/logger');
const config = require('../config');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

class CognitoService {
  constructor() {
    // Use mock mode in local development if Cognito is not configured
    if (config.environment === 'development' && !config.cognito.userPoolId) {
      this.mockMode = true;
      logger.info('Running in mock Cognito mode for local development');
      logger.warn('Cognito operations will be simulated - not suitable for production');
      return;
    }
    
    this.mockMode = false;
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: config.aws.region
    });
    
    this.userPoolId = config.cognito.userPoolId;
    this.clientId = config.cognito.clientId;
    this.clientSecret = config.cognito.clientSecret;
    
    logger.info('Cognito service initialized', {
      userPoolId: this.userPoolId,
      region: config.aws.region
    });
  }

  // Get user from Cognito
  async getCognitoUser(username) {
    if (this.mockMode) {
      logger.debug('Mock: getCognitoUser', { username });
      return {
        Username: username,
        UserAttributes: [
          { Name: 'sub', Value: `mock-${username}` },
          { Name: 'email', Value: `${username}@example.com` },
          { Name: 'email_verified', Value: 'true' }
        ],
        UserStatus: 'CONFIRMED'
      };
    }
    
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });

      const response = await this.cognitoClient.send(command);
      
      return {
        username: response.Username,
        userStatus: response.UserStatus,
        enabled: response.Enabled,
        userCreateDate: response.UserCreateDate,
        userLastModifiedDate: response.UserLastModifiedDate,
        attributes: this.formatUserAttributes(response.UserAttributes || [])
      };
      
    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw new NotFoundError('User not found in Cognito');
      }
      
      logger.error('Error getting Cognito user:', error);
      throw error;
    }
  }

  // Update user attributes in Cognito
  async updateCognitoUserAttributes(username, attributes) {
    try {
      const userAttributes = Object.entries(attributes).map(([name, value]) => ({
        Name: name,
        Value: String(value)
      }));

      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: userAttributes
      });

      await this.cognitoClient.send(command);
      
      logger.info(`Updated Cognito user attributes for: ${username}`);
      
    } catch (error) {
      logger.error('Error updating Cognito user attributes:', error);
      throw error;
    }
  }

  // Create user in Cognito
  async createCognitoUser(userData) {
    try {
      const {
        username,
        email,
        temporaryPassword,
        givenName,
        familyName,
        sendWelcomeEmail = true
      } = userData;

      const userAttributes = [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }
      ];

      if (givenName) {
        userAttributes.push({ Name: 'given_name', Value: givenName });
      }

      if (familyName) {
        userAttributes.push({ Name: 'family_name', Value: familyName });
      }

      const command = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: userAttributes,
        TemporaryPassword: temporaryPassword,
        MessageAction: sendWelcomeEmail ? 'SEND' : 'SUPPRESS'
      });

      const response = await this.cognitoClient.send(command);
      
      logger.info(`Created Cognito user: ${username}`);
      
      return {
        username: response.User.Username,
        userStatus: response.User.UserStatus,
        attributes: this.formatUserAttributes(response.User.Attributes || [])
      };
      
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        throw new ConflictError('Username already exists');
      }
      
      logger.error('Error creating Cognito user:', error);
      throw error;
    }
  }

  // Delete user from Cognito
  async deleteCognitoUser(username) {
    try {
      const command = new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });

      await this.cognitoClient.send(command);
      
      logger.info(`Deleted Cognito user: ${username}`);
      
    } catch (error) {
      logger.error('Error deleting Cognito user:', error);
      throw error;
    }
  }

  // Disable user in Cognito
  async disableCognitoUser(username) {
    try {
      const command = new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });

      await this.cognitoClient.send(command);
      
      logger.info(`Disabled Cognito user: ${username}`);
      
    } catch (error) {
      logger.error('Error disabling Cognito user:', error);
      throw error;
    }
  }

  // Enable user in Cognito
  async enableCognitoUser(username) {
    try {
      const command = new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });

      await this.cognitoClient.send(command);
      
      logger.info(`Enabled Cognito user: ${username}`);
      
    } catch (error) {
      logger.error('Error enabling Cognito user:', error);
      throw error;
    }
  }

  // Set user password in Cognito
  async setCognitoUserPassword(username, password, permanent = true) {
    try {
      const command = new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        Password: password,
        Permanent: permanent
      });

      await this.cognitoClient.send(command);
      
      logger.info(`Set password for Cognito user: ${username}`);
      
    } catch (error) {
      logger.error('Error setting Cognito user password:', error);
      throw error;
    }
  }

  // List users in Cognito (for admin purposes)
  async listCognitoUsers(options = {}) {
    try {
      const {
        limit = 20,
        paginationToken = null,
        filter = null
      } = options;

      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: limit,
        PaginationToken: paginationToken,
        Filter: filter
      });

      const response = await this.cognitoClient.send(command);
      
      return {
        users: response.Users.map(user => ({
          username: user.Username,
          userStatus: user.UserStatus,
          enabled: user.Enabled,
          userCreateDate: user.UserCreateDate,
          userLastModifiedDate: user.UserLastModifiedDate,
          attributes: this.formatUserAttributes(user.Attributes || [])
        })),
        paginationToken: response.PaginationToken
      };
      
    } catch (error) {
      logger.error('Error listing Cognito users:', error);
      throw error;
    }
  }

  // Handle OAuth callback
  async handleOAuthCallback(provider, callbackData) {
    try {
      const { code, state, error } = callbackData;
      
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      if (!code) {
        throw new ValidationError('Authorization code is required');
      }

      // Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      
      // Get user info from tokens
      const userInfo = await this.getUserInfoFromTokens(tokens);
      
      logger.info(`OAuth callback processed for provider: ${provider}`);
      
      return {
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        userInfo
      };
      
    } catch (error) {
      logger.error('Error handling OAuth callback:', error);
      throw error;
    }
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code) {
    try {
      const tokenEndpoint = `${config.cognito.domain}/oauth2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: code,
        redirect_uri: config.cognito.callbackUrl
      });

      if (this.clientSecret) {
        params.append('client_secret', this.clientSecret);
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
      }

      return await response.json();
      
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  // Get user info from tokens
  async getUserInfoFromTokens(tokens) {
    try {
      const userInfoEndpoint = `${config.cognito.domain}/oauth2/userInfo`;
      
      const response = await fetch(userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      return await response.json();
      
    } catch (error) {
      logger.error('Error getting user info from tokens:', error);
      throw error;
    }
  }

  // Generate OAuth authorization URL
  generateOAuthUrl(provider, state = null) {
    const baseUrl = `${config.cognito.domain}/oauth2/authorize`;
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: config.cognito.callbackUrl,
      scope: 'email openid profile aws.cognito.signin.user.admin'
    });

    if (provider && provider !== 'cognito') {
      params.append('identity_provider', provider);
    }

    if (state) {
      params.append('state', state);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  // Generate logout URL
  generateLogoutUrl(redirectUri = null) {
    const baseUrl = `${config.cognito.domain}/logout`;
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      logout_uri: redirectUri || config.cognito.logoutUrl
    });

    return `${baseUrl}?${params.toString()}`;
  }

  // Sync user stats to Cognito custom attributes
  async syncUserStatsToCognito(username, stats) {
    try {
      const attributes = {
        'custom:games_played': stats.gamesPlayed.toString(),
        'custom:games_won': stats.gamesWon.toString()
      };

      await this.updateCognitoUserAttributes(username, attributes);
      
      logger.info(`Synced user stats to Cognito for: ${username}`);
      
    } catch (error) {
      logger.error('Error syncing user stats to Cognito:', error);
      // Don't throw - this is not critical
    }
  }

  // Private helper methods

  formatUserAttributes(attributes) {
    const formatted = {};
    
    for (const attr of attributes) {
      formatted[attr.Name] = attr.Value;
    }
    
    return formatted;
  }

  validateUserData(userData) {
    const { username, email } = userData;
    
    if (!username || username.length < 3 || username.length > 128) {
      throw new ValidationError('Username must be between 3 and 128 characters');
    }

    if (!email || !this.isValidEmail(email)) {
      throw new ValidationError('Valid email address is required');
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = CognitoService;