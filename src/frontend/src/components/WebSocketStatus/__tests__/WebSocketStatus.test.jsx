import { render, screen, fireEvent } from '@testing-library/react';
import WebSocketStatus from '../WebSocketStatus';

describe('WebSocketStatus Component', () => {
  test('renders connected status', () => {
    render(<WebSocketStatus status="connected" />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('🟢')).toBeInTheDocument();
  });

  test('renders disconnected status with reconnect button', () => {
    const mockReconnect = jest.fn();
    render(<WebSocketStatus status="disconnected" onReconnect={mockReconnect} />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('🔴')).toBeInTheDocument();
    
    const reconnectBtn = screen.getByRole('button', { name: /reconnect/i });
    expect(reconnectBtn).toBeInTheDocument();
  });

  test('calls onReconnect when reconnect button is clicked', () => {
    const mockReconnect = jest.fn();
    render(<WebSocketStatus status="disconnected" onReconnect={mockReconnect} />);
    
    const reconnectBtn = screen.getByRole('button', { name: /reconnect/i });
    fireEvent.click(reconnectBtn);
    
    expect(mockReconnect).toHaveBeenCalledTimes(1);
  });

  test('renders connecting status without reconnect button', () => {
    render(<WebSocketStatus status="connecting" />);
    
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
    expect(screen.getByText('🟡')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('renders error status with reconnect button', () => {
    const mockReconnect = jest.fn();
    render(<WebSocketStatus status="error" onReconnect={mockReconnect} />);
    
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });

  test('applies correct CSS class for each status', () => {
    const { rerender } = render(<WebSocketStatus status="connected" />);
    expect(screen.getByText('Connected').closest('.websocket-status')).toHaveClass('status-connected');
    
    rerender(<WebSocketStatus status="disconnected" />);
    expect(screen.getByText('Disconnected').closest('.websocket-status')).toHaveClass('status-disconnected');
    
    rerender(<WebSocketStatus status="error" />);
    expect(screen.getByText('Connection Error').closest('.websocket-status')).toHaveClass('status-error');
  });
});
