/**
 * Kinesis Firehose Log Processor
 * Transforms and enriches log records before storing in S3
 */

exports.handler = async (event) => {
  const output = [];

  for (const record of event.records) {
    try {
      // Decode the base64 encoded data
      const payload = Buffer.from(record.data, 'base64').toString('utf8');
      const logData = JSON.parse(payload);

      // Enrich log data
      const enrichedLog = enrichLogData(logData);

      // Encode back to base64
      const enrichedPayload = Buffer.from(JSON.stringify(enrichedLog)).toString('base64');

      output.push({
        recordId: record.recordId,
        result: 'Ok',
        data: enrichedPayload
      });
    } catch (error) {
      console.error('Error processing record:', error);
      
      // Mark as processing failed
      output.push({
        recordId: record.recordId,
        result: 'ProcessingFailed',
        data: record.data
      });
    }
  }

  return { records: output };
};

/**
 * Enrich log data with additional fields
 * @param {Object} logData - Original log data
 * @returns {Object} Enriched log data
 */
function enrichLogData(logData) {
  const enriched = {
    ...logData,
    processed_at: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'unknown'
  };

  // Parse and extract structured data from message
  if (logData.message) {
    enriched.message_length = logData.message.length;
    
    // Extract error information
    if (logData.level === 'error' || logData.level === 'ERROR') {
      enriched.is_error = true;
      enriched.error_type = extractErrorType(logData.message);
    }

    // Extract user ID if present
    const userIdMatch = logData.message.match(/userId[:\s]+([a-zA-Z0-9-]+)/i);
    if (userIdMatch) {
      enriched.user_id = userIdMatch[1];
    }

    // Extract request ID if present
    const requestIdMatch = logData.message.match(/requestId[:\s]+([a-zA-Z0-9-]+)/i);
    if (requestIdMatch) {
      enriched.request_id = requestIdMatch[1];
    }

    // Extract trace ID if present
    const traceIdMatch = logData.message.match(/traceId[:\s]+([a-zA-Z0-9-]+)/i);
    if (traceIdMatch) {
      enriched.trace_id = traceIdMatch[1];
    }
  }

  // Add service categorization
  if (logData.service) {
    enriched.service_category = categorizeService(logData.service);
  }

  // Add severity score
  enriched.severity_score = calculateSeverityScore(logData.level);

  return enriched;
}

/**
 * Extract error type from message
 * @param {string} message - Log message
 * @returns {string} Error type
 */
function extractErrorType(message) {
  const errorPatterns = [
    /(\w+Error):/,
    /Error:\s*(\w+)/,
    /Exception:\s*(\w+)/
  ];

  for (const pattern of errorPatterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return 'UnknownError';
}

/**
 * Categorize service by name
 * @param {string} serviceName - Service name
 * @returns {string} Service category
 */
function categorizeService(serviceName) {
  const categories = {
    'game-engine': 'core',
    'auth-service': 'core',
    'user-service': 'core',
    'leaderboard-service': 'feature',
    'support-service': 'feature',
    'frontend': 'client'
  };

  return categories[serviceName] || 'unknown';
}

/**
 * Calculate severity score for log level
 * @param {string} level - Log level
 * @returns {number} Severity score (1-5)
 */
function calculateSeverityScore(level) {
  const scores = {
    'debug': 1,
    'DEBUG': 1,
    'info': 2,
    'INFO': 2,
    'warn': 3,
    'WARN': 3,
    'warning': 3,
    'WARNING': 3,
    'error': 4,
    'ERROR': 4,
    'fatal': 5,
    'FATAL': 5,
    'critical': 5,
    'CRITICAL': 5
  };

  return scores[level] || 2;
}
