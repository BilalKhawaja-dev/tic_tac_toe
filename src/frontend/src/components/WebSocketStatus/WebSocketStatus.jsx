import React from 'react';
import './WebSocketStatus.css';

/**
 * WebSocket Status Indicator Component
 * Shows connection status with visual feedback
 */
const WebSocketStatus = ({ status, onReconnect }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: '🟢',
          text: 'Connected',
          className: 'status-connected',
          showReconnect: false
        };
      case 'connecting':
        return {
          icon: '🟡',
          text: 'Connecting...',
          className: 'status-connecting',
          showReconnect: false
        };
      case 'reconnecting':
        return {
          icon: '🟠',
          text: 'Reconnecting...',
          className: 'status-reconnecting',
          showReconnect: false
        };
      case 'disconnected':
        return {
          icon: '🔴',
          text: 'Disconnected',
          className: 'status-disconnected',
          showReconnect: true
        };
      case 'error':
        return {
          icon: '❌',
          text: 'Connection Error',
          className: 'status-error',
          showReconnect: true
        };
      case 'failed':
        return {
          icon: '⛔',
          text: 'Connection Failed',
          className: 'status-failed',
          showReconnect: true
        };
      default:
        return {
          icon: '⚪',
          text: 'Unknown',
          className: 'status-unknown',
          showReconnect: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`websocket-status ${config.className}`}>
      <span className="status-icon">{config.icon}</span>
      <span className="status-text">{config.text}</span>
      {config.showReconnect && onReconnect && (
        <button 
          className="reconnect-btn secondary"
          onClick={onReconnect}
        >
          Reconnect
        </button>
      )}
    </div>
  );
};

export default WebSocketStatus;
