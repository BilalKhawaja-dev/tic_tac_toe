// FAQ Management Lambda Handler
// CRUD operations for FAQ content and search

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const FAQ_TABLE = process.env.FAQ_TABLE || 'support_faq';

// Validation schemas
const createFAQSchema = Joi.object({
  question: Joi.string().min(10).max(500).required(),
  answer: Joi.string().min(20).max(5000).required(),
  category: Joi.string().valid('technical', 'gameplay', 'account', 'billing', 'general').required(),
  tags: Joi.array().items(Joi.string()).max(10).optional(),
  relatedArticles: Joi.array().items(Joi.string().uuid()).max(5).optional()
});

const updateFAQSchema = Joi.object({
  question: Joi.string().min(10).max(500).optional(),
  answer: Joi.string().min(20).max(5000).optional(),
  category: Joi.string().valid('technical', 'gameplay', 'account', 'billing', 'general').optional(),
  tags: Joi.array().items(Joi.string()).max(10).optional(),
  relatedArticles: Joi.array().items(Joi.string().uuid()).max(5).optional(),
  published: Joi.boolean().optional()
});

/**
 * Calculate relevance score for search
 */
function calculateRelevance(faq, searchTerms) {
  const text = `${faq.question} ${faq.answer} ${(faq.tags || []).join(' ')}`.toLowerCase();
  let score = 0;
  
  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    
    // Question match (highest weight)
    if (faq.question.toLowerCase().includes(termLower)) {
      score += 10;
    }
    
    // Answer match
    if (faq.answer.toLowerCase().includes(termLower)) {
      score += 5;
    }
    
    // Tag match
    if ((faq.tags || []).some(tag => tag.toLowerCase().includes(termLower))) {
      score += 7;
    }
    
    // Exact match bonus
    if (faq.question.toLowerCase() === termLower) {
      score += 20;
    }
  }
  
  // Boost by view count and helpfulness
  score += Math.log(faq.viewCount + 1);
  score += (faq.helpfulCount / Math.max(faq.viewCount, 1)) * 5;
  
  return score;
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'how', 'what', 'when', 'where', 'why', 'who']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Count frequency
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Return top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Create new FAQ article
 */
exports.createFAQ = async (event) => {
  try {
    const body = JSON.parse(event.body);
    
    // Validate input
    const { error, value } = createFAQSchema.validate(body);
    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        })
      };
    }
    
    const { question, answer, category, tags, relatedArticles } = value;
    
    // Extract keywords for search
    const keywords = extractKeywords(`${question} ${answer}`);
    
    // Create FAQ
    const faqId = uuidv4();
    const now = Date.now();
    
    const faq = {
      faqId,
      question,
      answer,
      category,
      tags: tags || [],
      keywords,
      relatedArticles: relatedArticles || [],
      published: false,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: event.requestContext?.authorizer?.userId || 'system'
    };
    
    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: FAQ_TABLE,
      Item: faq
    }));
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        data: { faqId, published: false },
        message: 'FAQ created successfully'
      })
    };
    
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Get FAQ by ID
 */
exports.getFAQ = async (event) => {
  try {
    const { faqId } = event.pathParameters;
    
    const result = await docClient.send(new GetCommand({
      TableName: FAQ_TABLE,
      Key: { faqId }
    }));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Not Found',
          message: 'FAQ not found'
        })
      };
    }
    
    // Increment view count
    await docClient.send(new UpdateCommand({
      TableName: FAQ_TABLE,
      Key: { faqId },
      UpdateExpression: 'SET viewCount = viewCount + :inc',
      ExpressionAttributeValues: {
        ':inc': 1
      }
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.Item
      })
    };
    
  } catch (error) {
    console.error('Error getting FAQ:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Update FAQ
 */
exports.updateFAQ = async (event) => {
  try {
    const { faqId } = event.pathParameters;
    const body = JSON.parse(event.body);
    
    // Validate input
    const { error, value } = updateFAQSchema.validate(body);
    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation Error',
          details: error.details.map(d => d.message)
        })
      };
    }
    
    // Build update expression
    const updates = [];
    const expressionAttributeValues = {};
    
    if (value.question) {
      updates.push('question = :question');
      expressionAttributeValues[':question'] = value.question;
    }
    
    if (value.answer) {
      updates.push('answer = :answer');
      expressionAttributeValues[':answer'] = value.answer;
    }
    
    if (value.category) {
      updates.push('category = :category');
      expressionAttributeValues[':category'] = value.category;
    }
    
    if (value.tags) {
      updates.push('tags = :tags');
      expressionAttributeValues[':tags'] = value.tags;
    }
    
    if (value.relatedArticles) {
      updates.push('relatedArticles = :relatedArticles');
      expressionAttributeValues[':relatedArticles'] = value.relatedArticles;
    }
    
    if (value.published !== undefined) {
      updates.push('published = :published');
      expressionAttributeValues[':published'] = value.published;
    }
    
    // Re-extract keywords if question or answer changed
    if (value.question || value.answer) {
      const text = `${value.question || ''} ${value.answer || ''}`;
      const keywords = extractKeywords(text);
      updates.push('keywords = :keywords');
      expressionAttributeValues[':keywords'] = keywords;
    }
    
    updates.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = Date.now();
    
    const result = await docClient.send(new UpdateCommand({
      TableName: FAQ_TABLE,
      Key: { faqId },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: result.Attributes,
        message: 'FAQ updated successfully'
      })
    };
    
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Delete FAQ
 */
exports.deleteFAQ = async (event) => {
  try {
    const { faqId } = event.pathParameters;
    
    await docClient.send(new DeleteCommand({
      TableName: FAQ_TABLE,
      Key: { faqId }
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'FAQ deleted successfully'
      })
    };
    
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Search FAQs
 */
exports.searchFAQs = async (event) => {
  try {
    const { q, category } = event.queryStringParameters || {};
    
    if (!q || q.length < 3) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation Error',
          message: 'Search query must be at least 3 characters'
        })
      };
    }
    
    // Get all published FAQs
    const params = {
      TableName: FAQ_TABLE,
      FilterExpression: 'published = :published',
      ExpressionAttributeValues: {
        ':published': true
      }
    };
    
    if (category) {
      params.FilterExpression += ' AND category = :category';
      params.ExpressionAttributeValues[':category'] = category;
    }
    
    const result = await docClient.send(new ScanCommand(params));
    
    // Calculate relevance and sort
    const searchTerms = q.toLowerCase().split(/\s+/);
    const rankedResults = result.Items
      .map(faq => ({
        ...faq,
        relevance: calculateRelevance(faq, searchTerms)
      }))
      .filter(faq => faq.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 20); // Top 20 results
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          query: q,
          results: rankedResults,
          count: rankedResults.length
        }
      })
    };
    
  } catch (error) {
    console.error('Error searching FAQs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * List FAQs by category
 */
exports.listFAQs = async (event) => {
  try {
    const { category, published } = event.queryStringParameters || {};
    
    let params = {
      TableName: FAQ_TABLE
    };
    
    const filterExpressions = [];
    const expressionAttributeValues = {};
    
    if (category) {
      filterExpressions.push('category = :category');
      expressionAttributeValues[':category'] = category;
    }
    
    if (published !== undefined) {
      filterExpressions.push('published = :published');
      expressionAttributeValues[':published'] = published === 'true';
    }
    
    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
      params.ExpressionAttributeValues = expressionAttributeValues;
    }
    
    const result = await docClient.send(new ScanCommand(params));
    
    // Sort by view count and helpfulness
    const sorted = result.Items.sort((a, b) => {
      const scoreA = a.viewCount + (a.helpfulCount * 2);
      const scoreB = b.viewCount + (b.helpfulCount * 2);
      return scoreB - scoreA;
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          faqs: sorted,
          count: sorted.length
        }
      })
    };
    
  } catch (error) {
    console.error('Error listing FAQs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Mark FAQ as helpful/not helpful
 */
exports.rateFAQ = async (event) => {
  try {
    const { faqId } = event.pathParameters;
    const body = JSON.parse(event.body);
    const { helpful } = body;
    
    if (typeof helpful !== 'boolean') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation Error',
          message: 'helpful must be a boolean'
        })
      };
    }
    
    const field = helpful ? 'helpfulCount' : 'notHelpfulCount';
    
    await docClient.send(new UpdateCommand({
      TableName: FAQ_TABLE,
      Key: { faqId },
      UpdateExpression: `SET ${field} = ${field} + :inc`,
      ExpressionAttributeValues: {
        ':inc': 1
      }
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Thank you for your feedback'
      })
    };
    
  } catch (error) {
    console.error('Error rating FAQ:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};

/**
 * Get suggested FAQs for a ticket
 */
exports.suggestFAQs = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { subject, description, category } = body;
    
    if (!subject || !description) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Validation Error',
          message: 'subject and description are required'
        })
      };
    }
    
    // Get FAQs in same category
    const params = {
      TableName: FAQ_TABLE,
      FilterExpression: 'published = :published',
      ExpressionAttributeValues: {
        ':published': true
      }
    };
    
    if (category) {
      params.FilterExpression += ' AND category = :category';
      params.ExpressionAttributeValues[':category'] = category;
    }
    
    const result = await docClient.send(new ScanCommand(params));
    
    // Calculate relevance
    const text = `${subject} ${description}`;
    const searchTerms = extractKeywords(text);
    
    const suggestions = result.Items
      .map(faq => ({
        faqId: faq.faqId,
        question: faq.question,
        answer: faq.answer.substring(0, 200) + '...',
        relevance: calculateRelevance(faq, searchTerms)
      }))
      .filter(faq => faq.relevance > 5)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          suggestions,
          count: suggestions.length
        }
      })
    };
    
  } catch (error) {
    console.error('Error suggesting FAQs:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};
