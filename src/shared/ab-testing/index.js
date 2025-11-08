// A/B Testing Framework for Feature Rollouts
const crypto = require('crypto');
const ConfigurationManager = require('../config-manager');

class ABTestingFramework {
    constructor(configManager) {
        this.configManager = configManager;
        this.experiments = new Map();
        this.userAssignments = new Map();
        
        // Listen for configuration changes
        this.configManager.on('configurationChanged', (event) => {
            if (event.profileType === 'featureFlags') {
                this.updateExperiments(event.newConfig);
            }
        });
    }
    
    /**
     * Initialize A/B testing framework
     */
    async initialize() {
        // Load initial experiments from feature flags
        const featureFlags = this.configManager.getConfiguration(this.configManager.profiles.featureFlags);
        if (featureFlags) {
            this.updateExperiments(featureFlags);
        }
    }
    
    /**
     * Update experiments from configuration
     */
    updateExperiments(config) {
        if (!config.experiments) {
            return;
        }
        
        for (const [experimentName, experimentConfig] of Object.entries(config.experiments)) {
            this.experiments.set(experimentName, {
                name: experimentName,
                enabled: experimentConfig.enabled || false,
                variants: experimentConfig.variants || {},
                trafficAllocation: experimentConfig.trafficAllocation || {},
                targetingRules: experimentConfig.targetingRules || [],
                metrics: experimentConfig.metrics || [],
                startDate: experimentConfig.startDate ? new Date(experimentConfig.startDate) : null,
                endDate: experimentConfig.endDate ? new Date(experimentConfig.endDate) : null
            });
        }
        
        console.log(`Updated ${Object.keys(config.experiments).length} experiments`);
    }
    
    /**
     * Assign user to experiment variant
     */
    assignUserToVariant(experimentName, userId, userContext = {}) {
        const experiment = this.experiments.get(experimentName);
        
        if (!experiment || !experiment.enabled) {
            return { variant: 'control', reason: 'experiment_disabled' };
        }
        
        // Check if experiment is within date range
        const now = new Date();
        if (experiment.startDate && now < experiment.startDate) {
            return { variant: 'control', reason: 'experiment_not_started' };
        }
        
        if (experiment.endDate && now > experiment.endDate) {
            return { variant: 'control', reason: 'experiment_ended' };
        }
        
        // Check targeting rules
        if (!this.evaluateTargetingRules(experiment.targetingRules, userContext)) {
            return { variant: 'control', reason: 'targeting_rules_not_met' };
        }
        
        // Check if user is already assigned
        const assignmentKey = `${experimentName}:${userId}`;
        if (this.userAssignments.has(assignmentKey)) {
            const assignment = this.userAssignments.get(assignmentKey);
            return { variant: assignment.variant, reason: 'existing_assignment' };
        }
        
        // Assign user to variant based on traffic allocation
        const variant = this.calculateVariantAssignment(experimentName, userId, experiment.trafficAllocation);
        
        // Store assignment
        const assignment = {
            experimentName,
            userId,
            variant,
            assignedAt: new Date(),
            userContext: { ...userContext }
        };
        
        this.userAssignments.set(assignmentKey, assignment);
        
        // Log assignment for analytics
        this.logExperimentAssignment(assignment);
        
        return { variant, reason: 'new_assignment' };
    }
    
    /**
     * Calculate variant assignment using consistent hashing
     */
    calculateVariantAssignment(experimentName, userId, trafficAllocation) {
        // Create deterministic hash based on experiment name and user ID
        const hash = crypto.createHash('md5')
            .update(`${experimentName}:${userId}`)
            .digest('hex');
        
        // Convert first 8 characters of hash to integer
        const hashInt = parseInt(hash.substring(0, 8), 16);
        const bucket = hashInt % 100; // 0-99
        
        // Assign variant based on traffic allocation
        let cumulativePercentage = 0;
        
        for (const [variant, percentage] of Object.entries(trafficAllocation)) {
            cumulativePercentage += percentage;
            if (bucket < cumulativePercentage) {
                return variant;
            }
        }
        
        // Default to control if no allocation matches
        return 'control';
    }
    
    /**
     * Evaluate targeting rules
     */
    evaluateTargetingRules(rules, userContext) {
        if (!rules || rules.length === 0) {
            return true; // No rules means all users are eligible
        }
        
        for (const rule of rules) {
            if (!this.evaluateRule(rule, userContext)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Evaluate individual targeting rule
     */
    evaluateRule(rule, userContext) {
        const { attribute, operator, value } = rule;
        const userValue = this.getUserAttribute(attribute, userContext);
        
        switch (operator) {
            case 'equals':
                return userValue === value;
            case 'not_equals':
                return userValue !== value;
            case 'in':
                return Array.isArray(value) && value.includes(userValue);
            case 'not_in':
                return Array.isArray(value) && !value.includes(userValue);
            case 'greater_than':
                return Number(userValue) > Number(value);
            case 'less_than':
                return Number(userValue) < Number(value);
            case 'contains':
                return String(userValue).includes(String(value));
            case 'regex':
                return new RegExp(value).test(String(userValue));
            default:
                console.warn(`Unknown targeting rule operator: ${operator}`);
                return false;
        }
    }
    
    /**
     * Get user attribute value
     */
    getUserAttribute(attribute, userContext) {
        const pathParts = attribute.split('.');
        let value = userContext;
        
        for (const part of pathParts) {
            if (value && typeof value === 'object' && value[part] !== undefined) {
                value = value[part];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
    
    /**
     * Check if user is in experiment
     */
    isUserInExperiment(experimentName, userId) {
        const assignmentKey = `${experimentName}:${userId}`;
        return this.userAssignments.has(assignmentKey);
    }
    
    /**
     * Get user's variant for experiment
     */
    getUserVariant(experimentName, userId) {
        const assignmentKey = `${experimentName}:${userId}`;
        const assignment = this.userAssignments.get(assignmentKey);
        return assignment ? assignment.variant : null;
    }
    
    /**
     * Track experiment event
     */
    trackExperimentEvent(experimentName, userId, eventName, eventData = {}) {
        const assignmentKey = `${experimentName}:${userId}`;
        const assignment = this.userAssignments.get(assignmentKey);
        
        if (!assignment) {
            console.warn(`No assignment found for user ${userId} in experiment ${experimentName}`);
            return;
        }
        
        const event = {
            experimentName,
            userId,
            variant: assignment.variant,
            eventName,
            eventData,
            timestamp: new Date()
        };
        
        // Log event for analytics
        this.logExperimentEvent(event);
    }
    
    /**
     * Get experiment statistics
     */
    getExperimentStats(experimentName) {
        const assignments = Array.from(this.userAssignments.values())
            .filter(assignment => assignment.experimentName === experimentName);
        
        const variantCounts = {};
        assignments.forEach(assignment => {
            variantCounts[assignment.variant] = (variantCounts[assignment.variant] || 0) + 1;
        });
        
        return {
            experimentName,
            totalUsers: assignments.length,
            variantCounts,
            lastUpdated: new Date()
        };
    }
    
    /**
     * Log experiment assignment for analytics
     */
    logExperimentAssignment(assignment) {
        console.log('Experiment Assignment:', {
            experiment: assignment.experimentName,
            user: assignment.userId,
            variant: assignment.variant,
            timestamp: assignment.assignedAt
        });
        
        // In production, send to analytics service
        // this.analyticsService.track('experiment_assignment', assignment);
    }
    
    /**
     * Log experiment event for analytics
     */
    logExperimentEvent(event) {
        console.log('Experiment Event:', {
            experiment: event.experimentName,
            user: event.userId,
            variant: event.variant,
            event: event.eventName,
            data: event.eventData,
            timestamp: event.timestamp
        });
        
        // In production, send to analytics service
        // this.analyticsService.track('experiment_event', event);
    }
    
    /**
     * Get all active experiments
     */
    getActiveExperiments() {
        const now = new Date();
        const activeExperiments = [];
        
        for (const experiment of this.experiments.values()) {
            if (experiment.enabled &&
                (!experiment.startDate || now >= experiment.startDate) &&
                (!experiment.endDate || now <= experiment.endDate)) {
                activeExperiments.push(experiment);
            }
        }
        
        return activeExperiments;
    }
    
    /**
     * Clean up expired assignments
     */
    cleanupExpiredAssignments() {
        const now = new Date();
        const expiredKeys = [];
        
        for (const [key, assignment] of this.userAssignments.entries()) {
            const experiment = this.experiments.get(assignment.experimentName);
            
            if (!experiment || 
                !experiment.enabled || 
                (experiment.endDate && now > experiment.endDate)) {
                expiredKeys.push(key);
            }
        }
        
        expiredKeys.forEach(key => this.userAssignments.delete(key));
        
        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired experiment assignments`);
        }
    }
}

module.exports = ABTestingFramework;