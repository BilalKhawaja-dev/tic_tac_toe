import '@testing-library/jest-dom';

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen({ type: 'open' });
    }, 0);
  }

  send() {}
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ type: 'close', code: 1000 });
  }
};

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    headers: { get: () => 'application/json' }
  })
);

// Mock environment variables
process.env.VITE_API_URL = 'http://localhost:3000';
process.env.VITE_WS_URL = 'ws://localhost:3000/ws';
