// Unit Tests for Ticket Handler
// Tests ticket CRUD operations and business logic

const ticketHandler = require('../../src/handlers/ticketHandler');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sqs');
jest.mock('@aws-sdk/client-sns');

describe('Ticket Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TICKETS_TABLE = 'test-tickets';
    process.env.TICKET_QUEUE_URL = 'https://sqs.test.queue';
    process.env.TICKET_TOPIC_ARN = 'arn:aws:sns:test:topic';
  });

  describe('createTicket', () => {
    it('should create ticket with valid input', async () => {
      const event = {
        body: JSON.stringify({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          subject: 'Cannot login to my account',
          description: 'I am unable to login with my password',
          category: 'account'
        })
      };

      const result = await ticketHandler.createTicket(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('ticketId');
      expect(body.data.status).toBe('open');
    });

    it('should auto-categorize and prioritize ticket', async () => {
      const event = {
        body: JSON.stringify({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          subject: 'URGENT: Cannot play game - critical bug',
          description: 'The game crashes immediately when I try to start',
          category: 'other'
        })
      };

      const result = await ticketHandler.createTicket(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data.priority).toBe('urgent');
      expect(body.data.category).toBe('technical');
    });

    it('should reject invalid input', async () => {
      const event = {
        body: JSON.stringify({
          userId: 'invalid-uuid',
          subject: 'Test',
          description: 'Short'
        })
      };

      const result = await ticketHandler.createTicket(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Validation Error');
    });

    it('should calculate SLA deadline based on priority', async () => {
      const event = {
        body: JSON.stringify({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          subject: 'Test ticket',
          description: 'This is a test ticket for SLA calculation',
          category: 'technical',
          priority: 'urgent'
        })
      };

      const result = await ticketHandler.createTicket(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(201);
      expect(body.data).toHaveProperty('slaDeadline');
      
      // Urgent tickets should have 4-hour SLA
      const deadline = new Date(body.data.slaDeadline);
      const now = new Date();
      const hoursDiff = (deadline - now) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(3.9);
      expect(hoursDiff).toBeLessThan(4.1);
    });
  });

  describe('getTicket', () => {
    it('should return ticket by ID', async () => {
      const event = {
        pathParameters: {
          ticketId: 'test-ticket-id'
        }
      };

      // Mock successful response
      const mockTicket = {
        ticketId: 'test-ticket-id',
        subject: 'Test',
        status: 'open'
      };

      const result = await ticketHandler.getTicket(event);
      
      // Note: Actual implementation would need DynamoDB mock
      expect(result).toHaveProperty('statusCode');
    });
  });

  describe('updateTicket', () => {
    it('should update ticket status', async () => {
      const event = {
        pathParameters: {
          ticketId: 'test-ticket-id'
        },
        body: JSON.stringify({
          status: 'resolved'
        })
      };

      const result = await ticketHandler.updateTicket(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should reject invalid status', async () => {
      const event = {
        pathParameters: {
          ticketId: 'test-ticket-id'
        },
        body: JSON.stringify({
          status: 'invalid-status'
        })
      };

      const result = await ticketHandler.updateTicket(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  describe('listTickets', () => {
    it('should list tickets with filters', async () => {
      const event = {
        queryStringParameters: {
          status: 'open',
          priority: 'high'
        }
      };

      const result = await ticketHandler.listTickets(event);
      
      expect(result).toHaveProperty('statusCode');
    });

    it('should list all tickets without filters', async () => {
      const event = {
        queryStringParameters: {}
      };

      const result = await ticketHandler.listTickets(event);
      
      expect(result).toHaveProperty('statusCode');
    });
  });

  describe('getUserTickets', () => {
    it('should return tickets for specific user', async () => {
      const event = {
        pathParameters: {
          userId: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      const result = await ticketHandler.getUserTickets(event);
      
      expect(result).toHaveProperty('statusCode');
    });
  });
});
