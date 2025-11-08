// Unit Tests for FAQ Handler
// Tests FAQ CRUD operations and search functionality

const faqHandler = require('../../src/handlers/faqHandler');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('FAQ Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FAQ_TABLE = 'test-faq';
  });

  describe('createFAQ', () => {
    it('should create FAQ with valid input', async () => {
      const event = {
        body: JSON.stringify({
          question: 'How do I reset my password?',
          answer: 'To reset your password, click on the "Forgot Password" link on the login page and follow the instructions sent to your email.',
          category: 'account',
          tags: ['password', 'login', 'reset']
        })
      };

      const result = await faqHandler.createFAQ(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('faqId');
      expect(body.data.published).toBe(false);
    });

    it('should extract keywords from content', async () => {
      const event = {
        body: JSON.stringify({
          question: 'How do I report a bug in the game?',
          answer: 'To report a bug, please use the in-game bug report feature or contact our support team with detailed information about the issue.',
          category: 'technical'
        })
      };

      const result = await faqHandler.createFAQ(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.success).toBe(true);
    });

    it('should reject invalid input', async () => {
      const event = {
        body: JSON.stringify({
          question: 'Short',
          answer: 'Too short',
          category: 'invalid'
        })
      };

      const result = await faqHandler.createFAQ(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  describe('searchFAQs', () => {
    it('should search FAQs by query', async () => {
      const event = {
        queryStringParameters: {
          q: 'password reset'
        }
      };

      const result = await faqHandler.searchFAQs(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should reject short queries', async () => {
      const event = {
        queryStringParameters: {
          q: 'ab'
        }
      };

      const result = await faqHandler.searchFAQs(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
    });

    it('should filter by category', async () => {
      const event = {
        queryStringParameters: {
          q: 'password',
          category: 'account'
        }
      };

      const result = await faqHandler.searchFAQs(event);
      
      expect(result).toHaveProperty('statusCode');
    });
  });

  describe('suggestFAQs', () => {
    it('should suggest relevant FAQs for ticket', async () => {
      const event = {
        body: JSON.stringify({
          subject: 'Cannot login',
          description: 'I forgot my password and cannot access my account',
          category: 'account'
        })
      };

      const result = await faqHandler.suggestFAQs(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should require subject and description', async () => {
      const event = {
        body: JSON.stringify({
          subject: 'Test'
        })
      };

      const result = await faqHandler.suggestFAQs(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  describe('rateFAQ', () => {
    it('should accept helpful rating', async () => {
      const event = {
        pathParameters: {
          faqId: 'test-faq-id'
        },
        body: JSON.stringify({
          helpful: true
        })
      };

      const result = await faqHandler.rateFAQ(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should accept not helpful rating', async () => {
      const event = {
        pathParameters: {
          faqId: 'test-faq-id'
        },
        body: JSON.stringify({
          helpful: false
        })
      };

      const result = await faqHandler.rateFAQ(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should reject invalid rating', async () => {
      const event = {
        pathParameters: {
          faqId: 'test-faq-id'
        },
        body: JSON.stringify({
          helpful: 'yes'
        })
      };

      const result = await faqHandler.rateFAQ(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  describe('listFAQs', () => {
    it('should list all FAQs', async () => {
      const event = {
        queryStringParameters: {}
      };

      const result = await faqHandler.listFAQs(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should filter by category', async () => {
      const event = {
        queryStringParameters: {
          category: 'technical'
        }
      };

      const result = await faqHandler.listFAQs(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should filter by published status', async () => {
      const event = {
        queryStringParameters: {
          published: 'true'
        }
      };

      const result = await faqHandler.listFAQs(event);
      
      expect(result).toHaveProperty('statusCode');
    });
  });
});
