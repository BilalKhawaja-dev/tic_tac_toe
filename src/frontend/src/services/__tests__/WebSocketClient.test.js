import WebSocketClient from '../WebSocketClient';

describe('WebSocketClient', () => {
  let client;
  const mockUrl = 'ws://localhost:3000/ws';

  beforeEach(() => {
    client = new WebSocketClient(mockUrl);
  });

  afterEach(() => {
    if (client) {
      client.destroy();
    }
  });

  test('should initialize with correct default options', () => {
    expect(client.url).toBe(mockUrl);
    expect(client.options.reconnectInterval).toBe(3000);
    expect(client.options.maxReconnectAttempts).toBe(10);
    expect(client.connectionStatus).toBe('disconnected');
  });

  test('should connect to WebSocket server', async () => {
    await client.connect();
    expect(client.isConnected()).toBe(true);
    expect(client.getStatus()).toBe('connected');
  });

  test('should register and call message handlers', async () => {
    const mockHandler = jest.fn();
    await client.connect();
    
    client.on('test_message', mockHandler);
    
    // Simulate incoming message
    const message = { type: 'test_message', payload: { data: 'test' } };
    client.handleMessage(JSON.stringify(message));
    
    expect(mockHandler).toHaveBeenCalledWith({ data: 'test' });
  });

  test('should send messages when connected', async () => {
    await client.connect();
    const sendSpy = jest.spyOn(client.ws, 'send');
    
    const result = client.send('test_type', { data: 'test' });
    
    expect(result).toBe(true);
    expect(sendSpy).toHaveBeenCalled();
  });

  test('should not send messages when disconnected', () => {
    const result = client.send('test_type', { data: 'test' });
    expect(result).toBe(false);
  });

  test('should handle disconnection and cleanup', async () => {
    await client.connect();
    expect(client.isConnected()).toBe(true);
    
    client.disconnect();
    
    expect(client.isConnected()).toBe(false);
    expect(client.getStatus()).toBe('disconnected');
  });
});
