/**
 * AWS X-Ray Tracing Configuration
 * Provides distributed tracing across services
 */

const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

class XRayTracer {
  constructor(config = {}) {
    this.serviceName = config.serviceName || 'unknown-service';
    this.enabled = config.enabled !== false && process.env.XRAY_ENABLED !== 'false';
    
    if (this.enabled) {
      this.configure();
    }
  }

  /**
   * Configure X-Ray
   */
  configure() {
    // Set service name
    AWSXRay.middleware.setSamplingRules({
      version: 2,
      rules: [
        {
          description: 'High priority endpoints',
          host: '*',
          http_method: '*',
          url_path: '/api/game/*',
          fixed_target: 1,
          rate: 1.0
        },
        {
          description: 'Default sampling',
          host: '*',
          http_method: '*',
          url_path: '*',
          fixed_target: 1,
          rate: 0.1
        }
      ],
      default: {
        fixed_target: 1,
        rate: 0.05
      }
    });

    // Enable automatic mode for Lambda
    if (process.env.AWS_EXECUTION_ENV) {
      AWSXRay.config([AWSXRay.plugins.ECSPlugin]);
    }
  }

  /**
   * Get Express middleware for X-Ray
   * @param {string} serviceName - Service name
   * @returns {Function} Express middleware
   */
  getExpressMiddleware(serviceName) {
    if (!this.enabled) {
      return (req, res, next) => next();
    }

    return AWSXRay.express.openSegment(serviceName || this.serviceName);
  }

  /**
   * Get Express close middleware
   * @returns {Function} Express middleware
   */
  getExpressCloseMiddleware() {
    if (!this.enabled) {
      return (req, res, next) => next();
    }

    return AWSXRay.express.closeSegment();
  }

  /**
   * Create a subsegment for custom tracing
   * @param {string} name - Subsegment name
   * @param {Function} callback - Function to trace
   * @returns {Promise} Result of callback
   */
  async traceAsync(name, callback) {
    if (!this.enabled) {
      return callback();
    }

    const segment = AWSXRay.getSegment();
    if (!segment) {
      return callback();
    }

    const subsegment = segment.addNewSubsegment(name);
    
    try {
      const result = await callback(subsegment);
      subsegment.close();
      return result;
    } catch (error) {
      subsegment.addError(error);
      subsegment.close();
      throw error;
    }
  }

  /**
   * Trace a synchronous function
   * @param {string} name - Subsegment name
   * @param {Function} callback - Function to trace
   * @returns {*} Result of callback
   */
  traceSync(name, callback) {
    if (!this.enabled) {
      return callback();
    }

    const segment = AWSXRay.getSegment();
    if (!segment) {
      return callback();
    }

    const subsegment = segment.addNewSubsegment(name);
    
    try {
      const result = callback(subsegment);
      subsegment.close();
      return result;
    } catch (error) {
      subsegment.addError(error);
      subsegment.close();
      throw error;
    }
  }

  /**
   * Add annotation to current segment
   * @param {string} key - Annotation key
   * @param {*} value - Annotation value
   */
  addAnnotation(key, value) {
    if (!this.enabled) return;

    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addAnnotation(key, value);
    }
  }

  /**
   * Add metadata to current segment
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   * @param {string} namespace - Metadata namespace
   */
  addMetadata(key, value, namespace = 'default') {
    if (!this.enabled) return;

    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addMetadata(key, value, namespace);
    }
  }

  /**
   * Capture AWS SDK calls
   * @param {Object} awsService - AWS service instance
   * @returns {Object} Captured AWS service
   */
  captureAWS(awsService) {
    if (!this.enabled) return awsService;
    return AWSXRay.captureAWS(awsService);
  }

  /**
   * Capture HTTP/HTTPS requests
   * @param {Object} http - HTTP module
   * @returns {Object} Captured HTTP module
   */
  captureHTTP(http) {
    if (!this.enabled) return http;
    return AWSXRay.captureHTTPs(http);
  }

  /**
   * Capture promise-based operations
   * @param {string} name - Operation name
   * @param {Function} promiseFunc - Promise function
   * @returns {Promise} Traced promise
   */
  captureAsyncFunc(name, promiseFunc) {
    if (!this.enabled) {
      return promiseFunc();
    }

    return AWSXRay.captureAsyncFunc(name, (subsegment) => {
      return promiseFunc(subsegment)
        .then(result => {
          subsegment.close();
          return result;
        })
        .catch(error => {
          subsegment.addError(error);
          subsegment.close();
          throw error;
        });
    });
  }

  /**
   * Get current trace ID
   * @returns {string|null} Trace ID
   */
  getTraceId() {
    if (!this.enabled) return null;

    const segment = AWSXRay.getSegment();
    return segment ? segment.trace_id : null;
  }

  /**
   * Create custom segment (for non-HTTP contexts)
   * @param {string} name - Segment name
   * @param {Function} callback - Function to execute
   * @returns {Promise} Result of callback
   */
  async createSegment(name, callback) {
    if (!this.enabled) {
      return callback();
    }

    const segment = new AWSXRay.Segment(name);
    
    try {
      const result = await callback(segment);
      segment.close();
      return result;
    } catch (error) {
      segment.addError(error);
      segment.close();
      throw error;
    }
  }
}

// Create singleton instance
let xrayTracer = null;

/**
 * Get or create X-Ray tracer instance
 * @param {Object} config - Configuration options
 * @returns {XRayTracer} X-Ray tracer instance
 */
function getXRayTracer(config) {
  if (!xrayTracer) {
    xrayTracer = new XRayTracer(config);
  }
  return xrayTracer;
}

module.exports = {
  XRayTracer,
  getXRayTracer,
  AWSXRay
};
