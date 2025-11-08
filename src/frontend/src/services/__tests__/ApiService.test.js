import ApiService from '../ApiService';

describe('ApiService', () => {
  beforeEach(() => {
    global.fetch.mockClear();
    ApiService.token = null;
  });

  test('should set authentication token', () => {
    const token = 'test-token-123';
    ApiService.setToken(token);
    expect(ApiService.token).toBe(token);
  });

  test('should include auth token in headers when set', () => {
    ApiService.setToken('test-token');
    const headers = ApiService.getHeaders();
    
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('should make GET request successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
      headers: { get: () => 'application/json' }
    });

    const result = await ApiService.get('/test');
    
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/test',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual({ data: 'test' });
  });

  test('should make POST request with data', async () => {
    const testData = { name: 'test' };
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: { get: () => 'application/json' }
    });

    await ApiService.post('/test', testData);
    
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(testData)
      })
    );
  });

  test('should handle API errors', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ message: 'Resource not found' })
    });

    await expect(ApiService.get('/test')).rejects.toThrow('Resource not found');
  });

  test('should create game via API', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ gameId: '123' }),
      headers: { get: () => 'application/json' }
    });

    const result = await ApiService.createGame();
    
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/game/games',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result).toEqual({ gameId: '123' });
  });

  test('should get leaderboard data', async () => {
    const mockLeaderboard = [
      { rank: 1, username: 'player1', score: 100 }
    ];
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockLeaderboard),
      headers: { get: () => 'application/json' }
    });

    const result = await ApiService.getGlobalLeaderboard(10, 0);
    
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/leaderboard/global?limit=10&offset=0',
      expect.any(Object)
    );
    expect(result).toEqual(mockLeaderboard);
  });
});
