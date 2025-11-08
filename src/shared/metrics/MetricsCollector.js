/**
 * Metrics Collector for CloudWatch Custom Metrics
 * Tracks business and technical KPIs
 */

const AWS = require('aws-sdk');

class MetricsCollector {
  constructor(config = {}) {
    this.cloudwatch = new AWS.CloudWatch({
      region: config.region || process.env.AWS_REGION || 'eu-west-2'
    });
    this.namespace = config.namespace || 'GlobalGamingPlatform';
    this.environment = config.environment || process.env.ENVIRONMENT || 'development';
    this.serviceName = config.serviceName || 'unknown';
    this.batchSize = config.batchSize || 20;
    this.flushInterval = config.flushInterval || 60000; // 1 minute
    this.metricsBuffer = [];
    this.startFlushTimer();
  }

  /**
   * Record a metric
   * @param {string} metricName - Name of the metric
   * @param {number} value - Metric value
   * @param {string} unit - Metric unit (Count, Seconds, Milliseconds, etc.)
   * @param {Object} dimensions - Additional dimensions
   */
  recordMetric(metricName, value, unit = 'Count', dimensions = {}) {
    const metric = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: this.buildDimensions(dimensions)
    };

    this.metricsBuffer.push(metric);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Build dimensions array for CloudWatch
   * @param {Object} customDimensions - Custom dimensions
   * @returns {Array} Dimensions array
   */
  buildDimensions(customDimensions = {}) {
    const dimensions = [
      { Name: 'Environment', Value: this.environment },
      { Name: 'Service', Value: this.serviceName }
    ];

    Object.entries(customDimensions).forEach(([key, value]) => {
      dimensions.push({ Name: key, Value: String(value) });
    });

    return dimensions;
  }

  /**
   * Flush metrics buffer to CloudWatch
   */
  async flush() {
    if (this.metricsBuffer.length === 0) return;

    const metrics = this.metricsBuffer.splice(0, this.batchSize);

    try {
      await this.cloudwatch.putMetricData({
        Namespace: this.namespace,
        MetricData: metrics
      }).promise();

      console.log(`Flushed ${metrics.length} metrics to CloudWatch`);
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Re-add metrics to buffer for retry
      this.metricsBuffer.unshift(...metrics);
    }
  }

  /**
   * Start automatic flush timer
   */
  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop flush timer and flush remaining metrics
   */
  async stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  // Business Metrics

  /**
   * Track game completion
   * @param {string} gameId - Game ID
   * @param {string} result - Game result (win, loss, draw)
   * @param {number} duration - Game duration in seconds
   */
  trackGameCompletion(gameId, result, duration) {
    this.recordMetric('GameCompleted', 1, 'Count', { Result: result });
    this.recordMetric('GameDuration', duration, 'Seconds', { Result: result });
  }

  /**
   * Track user authentication
   * @param {string} provider - OAuth provider
   * @param {boolean} success - Authentication success
   */
  trackAuthentication(provider, success) {
    this.recordMetric('AuthenticationAttempt', 1, 'Count', {
      Provider: provider,
      Status: success ? 'Success' : 'Failure'
    });
  }

  /**
   * Track user retention
   * @param {string} userId - User ID
   * @param {number} daysSinceLastLogin - Days since last login
   */
  trackUserRetention(userId, daysSinceLastLogin) {
    this.recordMetric('UserRetention', 1, 'Count', {
      RetentionBucket: this.getRetentionBucket(daysSinceLastLogin)
    });
  }

  /**
   * Get retention bucket for user
   * @param {number} days - Days since last login
   * @returns {string} Retention bucket
   */
  getRetentionBucket(days) {
    if (days <= 1) return 'Daily';
    if (days <= 7) return 'Weekly';
    if (days <= 30) return 'Monthly';
    return 'Returning';
  }

  // Technical Metrics

  /**
   * Track API request
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {number} statusCode - Response status code
   * @param {number} duration - Request duration in milliseconds
   */
  trackApiRequest(endpoint, method, statusCode, duration) {
    this.recordMetric('ApiRequest', 1, 'Count', {
      Endpoint: endpoint,
      Method: method,
      StatusCode: String(statusCode)
    });
    this.recordMetric('ApiLatency', duration, 'Milliseconds', {
      Endpoint: endpoint,
      Method: method
    });
  }

  /**
   * Track WebSocket connection
   * @param {string} action - Connection action (connect, disconnect)
   * @param {number} connectionCount - Current connection count
   */
  trackWebSocketConnection(action, connectionCount) {
    this.recordMetric('WebSocketConnection', 1, 'Count', { Action: action });
    this.recordMetric('ActiveConnections', connectionCount, 'Count');
  }

  /**
   * Track database query
   * @param {string} operation - Database operation
   * @param {number} duration - Query duration in milliseconds
   * @param {boolean} success - Query success
   */
  trackDatabaseQuery(operation, duration, success) {
    this.recordMetric('DatabaseQuery', 1, 'Count', {
      Operation: operation,
      Status: success ? 'Success' : 'Failure'
    });
    this.recordMetric('DatabaseLatency', duration, 'Milliseconds', {
      Operation: operation
    });
  }

  /**
   * Track cache operation
   * @param {string} operation - Cache operation (hit, miss, set)
   * @param {string} cacheType - Cache type (redis, dax)
   */
  trackCacheOperation(operation, cacheType) {
    this.recordMetric('CacheOperation', 1, 'Count', {
      Operation: operation,
      CacheType: cacheType
    });
  }

  /**
   * Track error
   * @param {string} errorType - Error type
   * @param {string} errorMessage - Error message
   */
  trackError(errorType, errorMessage) {
    this.recordMetric('Error', 1, 'Count', {
      ErrorType: errorType,
      ErrorMessage: errorMessage.substring(0, 50)
    });
  }

  // User Experience Metrics

  /**
   * Track page load time
   * @param {string} page - Page name
   * @param {number} loadTime - Load time in milliseconds
   */
  trackPageLoad(page, loadTime) {
    this.recordMetric('PageLoadTime', loadTime, 'Milliseconds', { Page: page });
  }

  /**
   * Track WebSocket message latency
   * @param {string} messageType - Message type
   * @param {number} latency - Latency in milliseconds
   */
  trackWebSocketLatency(messageType, latency) {
    this.recordMetric('WebSocketLatency', latency, 'Milliseconds', {
      MessageType: messageType
    });
  }
}

// Create singleton instance
let metricsCollector = null;

/**
 * Get or create metrics collector instance
 * @param {Object} config - Configuration options
 * @returns {MetricsCollector} Metrics collector instance
 */
function getMetricsCollector(config) {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector(config);
  }
  return metricsCollector;
}

module.exports = {
  MetricsCollector,
  getMetricsCollector
};
