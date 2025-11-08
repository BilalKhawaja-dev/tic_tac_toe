// Configuration Manager SDK for AWS AppConfig Integration
const AWS = require('aws-sdk');
const EventEmitter = require('events');

class ConfigurationManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.applicationId = options.applicationId || process.env.APPCONFIG_APPLICATION_ID;
        this.environment = options.environment || process.env.NODE_ENV || 'development';
        this.clientId = options.clientId || `${process.env.SERVICE_NAME || 'unknown'}-${Date.now()}`;
        this.region = options.region || process.env.AWS_REGION || 'eu-west-2';
        
        // Initialize AWS AppConfig Data client
        this.appconfigData = new AWS.AppConfigData({
            region: this.region
        });
        
        // Configuration cache
        this.cache = new Map();
        this.sessions = new Map();
        
        // Polling configuration
        this.pollingInterval = options.pollingInterval || 30000; // 30 seconds
        this.pollingTimers = new Map();
        
        // Feature flag profiles
        this.profiles = {
            featureFlags: options.featureFlagsProfileId || process.env.APPCONFIG_FEATURE_FLAGS_PROFILE_ID,
            appSettings: options.appSettingsProfileId || process.env.APPCONFIG_APP_SETTINGS_PROFILE_ID
        };
        
        console.log('ConfigurationManager initialized:', {
            applicationId: this.applicationId,
            environment: this.environment,
            clientId: this.clientId,
            region: this.region
        });
    }
    
    /**
     * Start configuration session and begin polling
     */
    async startSession(profileId, profileType = 'unknown') {
        try {
            const sessionParams = {
                ApplicationIdentifier: this.applicationId,
                EnvironmentIdentifier: this.environment,
                ConfigurationProfileIdentifier: profileId,
                RequiredMinimumPollIntervalInSeconds: 15
            };
            
            const session = await this.appconfigData.startConfigurationSession(sessionParams).promise();
            
            this.sessions.set(profileId, {
                sessionToken: session.InitialConfigurationToken,
                profileType,
                lastPollTime: Date.now()
            });
            
            // Initial configuration retrieval
            await this.retrieveConfiguration(profileId);
            
            // Start polling for updates
            this.startPolling(profileId);
            
            console.log(`Configuration session started for profile: ${profileId} (${profileType})`);
            
            return session;
            
        } catch (error) {
            console.error(`Failed to start configuration session for profile ${profileId}:`, error);
            throw error;
        }
    }
    
    /**
     * Retrieve configuration from AppConfig
     */
    async retrieveConfiguration(profileId) {
        try {
            const session = this.sessions.get(profileId);
            if (!session) {
                throw new Error(`No active session for profile: ${profileId}`);
            }
            
            const params = {
                ApplicationIdentifier: this.applicationId,
                EnvironmentIdentifier: this.environment,
                ConfigurationProfileIdentifier: profileId,
                ClientId: this.clientId,
                ClientConfigurationVersion: session.sessionToken
            };
            
            const response = await this.appconfigData.getConfiguration(params).promise();
            
            // Parse configuration content
            let configuration;
            try {
                configuration = JSON.parse(response.Content.toString());
            } catch (parseError) {
                console.error('Failed to parse configuration content:', parseError);
                return null;
            }
            
            // Update cache
            const previousConfig = this.cache.get(profileId);
            this.cache.set(profileId, {
                content: configuration,
                version: response.ConfigurationVersion,
                contentType: response.ContentType,
                lastUpdated: Date.now()
            });
            
            // Update session token
            session.sessionToken = response.NextPollConfigurationToken;
            session.lastPollTime = Date.now();
            
            // Emit configuration change event if content changed
            if (previousConfig && JSON.stringify(previousConfig.content) !== JSON.stringify(configuration)) {
                this.emit('configurationChanged', {
                    profileId,
                    profileType: session.profileType,
                    previousConfig: previousConfig.content,
                    newConfig: configuration,
                    version: response.ConfigurationVersion
                });
            }
            
            console.log(`Configuration retrieved for profile ${profileId}, version: ${response.ConfigurationVersion}`);
            
            return configuration;
            
        } catch (error) {
            console.error(`Failed to retrieve configuration for profile ${profileId}:`, error);
            
            // Emit error event
            this.emit('configurationError', {
                profileId,
                error: error.message,
                timestamp: Date.now()
            });
            
            return null;
        }
    }
    
    /**
     * Start polling for configuration updates
     */
    startPolling(profileId) {
        // Clear existing timer if any
        if (this.pollingTimers.has(profileId)) {
            clearInterval(this.pollingTimers.get(profileId));
        }
        
        const timer = setInterval(async () => {
            await this.retrieveConfiguration(profileId);
        }, this.pollingInterval);
        
        this.pollingTimers.set(profileId, timer);
    }
    
    /**
     * Stop polling for a specific profile
     */
    stopPolling(profileId) {
        if (this.pollingTimers.has(profileId)) {
            clearInterval(this.pollingTimers.get(profileId));
            this.pollingTimers.delete(profileId);
        }
    }
    
    /**
     * Initialize all configuration profiles
     */
    async initialize() {
        try {
            const initPromises = [];
            
            if (this.profiles.featureFlags) {
                initPromises.push(this.startSession(this.profiles.featureFlags, 'featureFlags'));
            }
            
            if (this.profiles.appSettings) {
                initPromises.push(this.startSession(this.profiles.appSettings, 'appSettings'));
            }
            
            await Promise.all(initPromises);
            
            console.log('ConfigurationManager initialization completed');
            
        } catch (error) {
            console.error('Failed to initialize ConfigurationManager:', error);
            throw error;
        }
    }
    
    /**
     * Get feature flag value
     */
    getFeatureFlag(flagName, defaultValue = false) {
        const featureFlags = this.getConfiguration(this.profiles.featureFlags);
        
        if (!featureFlags || !featureFlags.flags || !featureFlags.flags[flagName]) {
            return defaultValue;
        }
        
        const flag = featureFlags.flags[flagName];
        return flag.enabled !== undefined ? flag.enabled : defaultValue;
    }
    
    /**
     * Get feature flag with variants
     */
    getFeatureFlagVariant(flagName, variantName, defaultValue = false) {
        const featureFlags = this.getConfiguration(this.profiles.featureFlags);
        
        if (!featureFlags || !featureFlags.flags || !featureFlags.flags[flagName]) {
            return defaultValue;
        }
        
        const flag = featureFlags.flags[flagName];
        if (!flag.variants || !flag.variants[variantName]) {
            return flag.enabled !== undefined ? flag.enabled : defaultValue;
        }
        
        return flag.variants[variantName].enabled !== undefined ? flag.variants[variantName].enabled : defaultValue;
    }
    
    /**
     * Get application setting value
     */
    getAppSetting(settingPath, defaultValue = null) {
        const appSettings = this.getConfiguration(this.profiles.appSettings);
        
        if (!appSettings) {
            return defaultValue;
        }
        
        // Support nested path like 'database.connectionTimeout'
        const pathParts = settingPath.split('.');
        let value = appSettings;
        
        for (const part of pathParts) {
            if (value && typeof value === 'object' && value[part] !== undefined) {
                value = value[part];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }
    
    /**
     * Get cached configuration for a profile
     */
    getConfiguration(profileId) {
        const cached = this.cache.get(profileId);
        return cached ? cached.content : null;
    }
    
    /**
     * Get all cached configurations
     */
    getAllConfigurations() {
        const result = {};
        for (const [profileId, cached] of this.cache.entries()) {
            result[profileId] = cached.content;
        }
        return result;
    }
    
    /**
     * Check if configuration is available
     */
    isConfigurationAvailable(profileId) {
        return this.cache.has(profileId);
    }
    
    /**
     * Get configuration metadata
     */
    getConfigurationMetadata(profileId) {
        const cached = this.cache.get(profileId);
        if (!cached) {
            return null;
        }
        
        return {
            version: cached.version,
            contentType: cached.contentType,
            lastUpdated: cached.lastUpdated
        };
    }
    
    /**
     * Graceful shutdown
     */
    shutdown() {
        console.log('Shutting down ConfigurationManager...');
        
        // Stop all polling timers
        for (const [profileId, timer] of this.pollingTimers.entries()) {
            clearInterval(timer);
        }
        
        this.pollingTimers.clear();
        this.sessions.clear();
        this.cache.clear();
        
        console.log('ConfigurationManager shutdown completed');
    }
}

module.exports = ConfigurationManager;