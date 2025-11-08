# Configuration Management Guide

## Overview

The Global Gaming Platform uses AWS AppConfig for centralized configuration management, feature flags, and A/B testing. This system provides safe, gradual rollouts with automatic rollback capabilities.

## Architecture

### Components

- **AWS AppConfig**: Centralized configuration service
- **Configuration Manager SDK**: Application-level configuration client
- **A/B Testing Framework**: Experimentation and gradual rollouts
- **Emergency Rollback System**: Rapid configuration recovery

### Configuration Types

1. **Feature Flags**: Boolean toggles and variants for feature control
2. **Application Settings**: Runtime configuration parameters
3. **A/B Experiments**: Traffic splitting and variant testing

## Configuration Profiles

### Feature Flags Profile

Controls feature availability and variants:

```json
{
  "flags": {
    "enableSocialLogin": {
      "name": "enableSocialLogin",
      "enabled": true,
      "variants": {
        "google": { "enabled": true },
        "facebook": { "enabled": true },
        "twitter": { "enabled": false }
      }
    }
  },
  "values": {
    "enableSocialLogin": { "enabled": true }
  }
}
```

### Application Settings Profile

Runtime configuration parameters:

```json
{
  "database": {
    "connectionTimeout": 5000,
    "maxConnections": 100
  },
  "api": {
    "rateLimitPerMinute": 1000,
    "timeoutMs": 5000
  }
}
```

## Usage in Applications

### Initialize Configuration Manager

```javascript
const ConfigurationManager = require('@gaming-platform/config-manager');

const configManager = new ConfigurationManager({
  applicationId: process.env.APPCONFIG_APPLICATION_ID,
  environment: process.env.NODE_ENV,
  featureFlagsProfileId: process.env.APPCONFIG_FEATURE_FLAGS_PROFILE_ID,
  appSettingsProfileId: process.env.APPCONFIG_APP_SETTINGS_PROFILE_ID
});

// Initialize and start polling
await configManager.initialize();

// Listen for configuration changes
configManager.on('configurationChanged', (event) => {
  console.log('Configuration updated:', event.profileType);
});
```

### Using Feature Flags

```javascript
// Simple feature flag
if (configManager.getFeatureFlag('enableLeaderboard')) {
  // Show leaderboard feature
}

// Feature flag with variants
if (configManager.getFeatureFlagVariant('enableSocialLogin', 'google')) {
  // Enable Google OAuth
}
```

### Using Application Settings

```javascript
// Get database configuration
const dbTimeout = configManager.getAppSetting('database.connectionTimeout', 5000);
const maxConnections = configManager.getAppSetting('database.maxConnections', 100);

// Get API configuration
const rateLimit = configManager.getAppSetting('api.rateLimitPerMinute', 1000);
```

### A/B Testing

```javascript
const ABTestingFramework = require('@gaming-platform/ab-testing');

const abTesting = new ABTestingFramework(configManager);
await abTesting.initialize();

// Assign user to experiment
const assignment = abTesting.assignUserToVariant('newLeaderboardUI', userId, {
  user: { region: 'eu-west-2', premium: true }
});

if (assignment.variant === 'variant_a') {
  // Show dark theme leaderboard
} else if (assignment.variant === 'variant_b') {
  // Show light theme with animations
}

// Track experiment events
abTesting.trackExperimentEvent('newLeaderboardUI', userId, 'leaderboard_viewed');
```

## Deployment Strategies

### Gradual Rollout (Default)

- **Duration**: 10 minutes
- **Growth Factor**: 20% exponential
- **Bake Time**: 5 minutes
- **Use Case**: Production feature releases

### Immediate Rollout

- **Duration**: 0 minutes
- **Growth Factor**: 100% linear
- **Use Case**: Emergency fixes, development environments

## Deployment Scripts

### Deploy Configuration

```bash
# Deploy feature flags to development
./scripts/deploy-configuration.sh -e development -f configs/feature-flags-development.json deploy-flags

# Deploy application settings to production with gradual rollout
./scripts/deploy-configuration.sh -e production -f configs/app-settings-production.json -s gradual deploy-settings

# Validate configuration before deployment
./scripts/deploy-configuration.sh -f configs/feature-flags.json validate

# Preview current configuration
./scripts/deploy-configuration.sh -e staging preview

# Promote configuration from staging to production
./scripts/deploy-configuration.sh --from-env staging --to-env production promote
```

### Emergency Rollback

```bash
# List recent deployments
./scripts/emergency-config-rollback.sh -e production list-deployments

# Rollback to previous deployment
./scripts/emergency-config-rollback.sh -e production -p feature-flags rollback

# Stop ongoing deployment
./scripts/emergency-config-rollback.sh -e production stop-deployment

# Emergency disable all feature flags
./scripts/emergency-config-rollback.sh -e production emergency-disable

# Check deployment status
./scripts/emergency-config-rollback.sh -e production status
```

## Configuration File Structure

### Feature Flags Configuration

```json
{
  "flags": {
    "flagName": {
      "name": "flagName",
      "enabled": true,
      "variants": {
        "variantName": { "enabled": true }
      }
    }
  },
  "values": {
    "flagName": { "enabled": true }
  },
  "experiments": {
    "experimentName": {
      "enabled": true,
      "variants": {
        "control": {},
        "variant_a": { "config": "value" }
      },
      "trafficAllocation": {
        "control": 50,
        "variant_a": 50
      },
      "targetingRules": [
        {
          "attribute": "user.region",
          "operator": "equals",
          "value": "eu-west-2"
        }
      ],
      "startDate": "2025-11-06T00:00:00Z",
      "endDate": "2025-12-06T00:00:00Z"
    }
  }
}
```

### Application Settings Configuration

```json
{
  "database": {
    "connectionTimeout": 5000,
    "maxConnections": 100
  },
  "api": {
    "rateLimitPerMinute": 1000,
    "timeoutMs": 5000
  },
  "game": {
    "maxConcurrentGames": 10000,
    "moveTimeoutSeconds": 120
  }
}
```

## Environment-Specific Configurations

### Development Environment

- All features enabled for testing
- Verbose logging and debugging
- Relaxed rate limits
- Extended timeouts for debugging

### Staging Environment

- Production-like configuration
- Limited feature flags for testing
- Moderate logging
- Production-equivalent timeouts

### Production Environment

- Conservative feature rollouts
- Minimal logging (error/warn only)
- Strict rate limits
- Optimized timeouts

## Monitoring and Alerting

### Configuration Metrics

- Configuration retrieval success/failure rates
- Deployment success/failure rates
- Feature flag usage statistics
- A/B experiment conversion rates

### Alerts

- Configuration retrieval errors > 5 per 5 minutes
- Deployment failures
- Feature flag evaluation errors
- Experiment assignment failures

### Dashboards

- Real-time configuration status
- Feature flag adoption rates
- A/B experiment performance
- Configuration change history

## Best Practices

### Configuration Design

1. **Default Values**: Always provide sensible defaults
2. **Validation**: Validate configuration on deployment
3. **Documentation**: Document all configuration options
4. **Versioning**: Use semantic versioning for configurations

### Feature Flag Management

1. **Naming**: Use descriptive, consistent naming
2. **Lifecycle**: Plan flag creation, rollout, and removal
3. **Dependencies**: Minimize flag interdependencies
4. **Cleanup**: Remove unused flags regularly

### A/B Testing

1. **Hypothesis**: Define clear hypotheses and success metrics
2. **Sample Size**: Ensure adequate sample sizes
3. **Duration**: Run experiments for statistically significant periods
4. **Analysis**: Analyze results before making decisions

### Security

1. **Sensitive Data**: Never store secrets in configuration
2. **Access Control**: Limit configuration access to authorized personnel
3. **Audit Trail**: Maintain logs of all configuration changes
4. **Encryption**: Use encryption for sensitive configuration data

## Troubleshooting

### Common Issues

1. **Configuration Not Loading**
   - Check AppConfig application and environment IDs
   - Verify IAM permissions
   - Check network connectivity

2. **Feature Flags Not Working**
   - Verify flag names and structure
   - Check configuration polling interval
   - Validate flag evaluation logic

3. **Deployment Failures**
   - Check configuration validation errors
   - Verify deployment strategy settings
   - Review CloudWatch logs

4. **A/B Test Issues**
   - Verify experiment configuration
   - Check targeting rules
   - Validate traffic allocation percentages

### Debugging

```javascript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Check configuration status
console.log('Available configurations:', configManager.getAllConfigurations());
console.log('Feature flag status:', configManager.getFeatureFlag('flagName'));
console.log('App setting:', configManager.getAppSetting('section.key'));

// Check A/B test assignment
const assignment = abTesting.assignUserToVariant('experiment', userId);
console.log('Experiment assignment:', assignment);
```

## Migration Guide

### From Environment Variables

1. Identify configuration values in environment variables
2. Create AppConfig profiles for different configuration types
3. Update application code to use Configuration Manager
4. Deploy and test configuration retrieval
5. Remove environment variable dependencies

### From Configuration Files

1. Convert existing configuration files to AppConfig format
2. Validate configuration structure and values
3. Deploy configurations to AppConfig
4. Update applications to use Configuration Manager
5. Remove local configuration file dependencies

This configuration management system provides a robust, scalable foundation for managing application settings, feature flags, and A/B experiments across all environments.