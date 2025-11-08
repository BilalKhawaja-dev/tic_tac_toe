import { useEffect, useRef, useState, useCallback } from 'react';
import WebSocketClient from '../services/WebSocketClient';

/**
 * React Hook for WebSocket Connection
 * Provides WebSocket functionality with automatic connection management
 */
const useWebSocket = (url, options = {}) => {
  const [status, setStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const clientRef = useRef(null);
  const handlersRef = useRef(new Map());

  // Initialize WebSocket client
  useEffect(() => {
    if (!url) return;

    const client = new WebSocketClient(url, options);
    clientRef.current = client;

    // Setup status change listener
    const unsubscribeStatus = client.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Setup wildcard message listener to track last message
    const unsubscribeMessages = client.on('*', (message) => {
      setLastMessage(message);
    });

    // Connect
    client.connect().catch(error => {
      console.error('Failed to connect WebSocket:', error);
    });

    // Cleanup on unmount
    return () => {
      unsubscribeStatus();
      unsubscribeMessages();
      client.destroy();
      clientRef.current = null;
    };
  }, [url]);

  /**
   * Send message through WebSocket
   */
  const sendMessage = useCallback((type, payload) => {
    if (clientRef.current) {
      return clientRef.current.send(type, payload);
    }
    return false;
  }, []);

  /**
   * Subscribe to specific message type
   */
  const subscribe = useCallback((type, handler) => {
    if (!clientRef.current) return () => {};

    const unsubscribe = clientRef.current.on(type, handler);
    
    // Track handler for cleanup
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, []);
    }
    handlersRef.current.get(type).push({ handler, unsubscribe });

    return unsubscribe;
  }, []);

  /**
   * Unsubscribe from message type
   */
  const unsubscribe = useCallback((type, handler) => {
    if (!clientRef.current) return;

    clientRef.current.off(type, handler);

    // Remove from tracked handlers
    const handlers = handlersRef.current.get(type);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }, []);

  /**
   * Manually reconnect
   */
  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current.connect().catch(error => {
        console.error('Manual reconnect failed:', error);
      });
    }
  }, []);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe,
    reconnect,
    disconnect
  };
};

export default useWebSocket;
