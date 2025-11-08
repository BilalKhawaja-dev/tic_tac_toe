/**
 * API Service for HTTP Requests
 * Handles all REST API communication with backend services
 */

class ApiService {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || '/api';
    this.token = null;
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Get authentication headers
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Make HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(error.message || 'Request failed');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ============================================================================
  // Authentication API
  // ============================================================================

  async getOAuthUrl(provider, redirectUri) {
    return this.get('/auth/oauth/url', { provider, redirect_uri: redirectUri });
  }

  async handleOAuthCallback(code, state) {
    return this.get('/auth/callback', { code, state });
  }

  async getCurrentUser() {
    return this.get('/users/me');
  }

  async updateUserProfile(data) {
    return this.put('/users/me', data);
  }

  async getUserStats() {
    return this.get('/users/me/stats');
  }

  async logout() {
    return this.post('/auth/logout');
  }

  // ============================================================================
  // Game API
  // ============================================================================

  async createGame(opponentId = null) {
    return this.post('/game/games', { opponentId });
  }

  async getGame(gameId) {
    return this.get(`/game/games/${gameId}`);
  }

  async makeMove(gameId, move) {
    return this.post(`/game/games/${gameId}/moves`, move);
  }

  async forfeitGame(gameId) {
    return this.delete(`/game/games/${gameId}`);
  }

  // ============================================================================
  // Leaderboard API
  // ============================================================================

  async getGlobalLeaderboard(limit = 100, offset = 0) {
    return this.get('/leaderboard/global', { limit, offset });
  }

  async getRegionalLeaderboard(region, limit = 100, offset = 0) {
    return this.get(`/leaderboard/regional/${region}`, { limit, offset });
  }

  async getUserRanking(userId) {
    return this.get(`/leaderboard/user/${userId}`);
  }

  // ============================================================================
  // Support API
  // ============================================================================

  async createSupportTicket(ticketData) {
    return this.post('/support/tickets', ticketData);
  }

  async getUserTickets(status = null) {
    const params = status ? { status } : {};
    return this.get('/support/tickets', params);
  }

  async getTicket(ticketId) {
    return this.get(`/support/tickets/${ticketId}`);
  }

  async searchFAQ(query) {
    return this.get('/support/faq/search', { q: query });
  }

  async getFAQ(category = null) {
    const params = category ? { category } : {};
    return this.get('/support/faq', params);
  }
}

// Export singleton instance
export default new ApiService();
