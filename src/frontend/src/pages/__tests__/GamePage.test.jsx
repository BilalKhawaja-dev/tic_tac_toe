import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GamePage from '../GamePage';

// Mock the hooks and services
jest.mock('../../hooks/useWebSocket', () => ({
  __esModule: true,
  default: () => ({
    status: 'connected',
    isConnected: true,
    sendMessage: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    reconnect: jest.fn()
  })
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ gameId: 'test-game-123' })
}));

describe('GamePage Component', () => {
  const renderGamePage = () => {
    return render(
      <BrowserRouter>
        <GamePage />
      </BrowserRouter>
    );
  };

  test('renders game page with title', () => {
    renderGamePage();
    expect(screen.getByText('Play Tic-Tac-Toe')).toBeInTheDocument();
  });

  test('renders game board', () => {
    renderGamePage();
    const cells = screen.getAllByRole('button');
    // 9 board cells + 3 control buttons
    expect(cells.length).toBeGreaterThanOrEqual(9);
  });

  test('renders game controls', () => {
    renderGamePage();
    expect(screen.getByText('New Game')).toBeInTheDocument();
    expect(screen.getByText('Forfeit')).toBeInTheDocument();
    expect(screen.getByText('View Leaderboard')).toBeInTheDocument();
  });

  test('renders WebSocket status indicator', () => {
    renderGamePage();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  test('renders player stats', () => {
    renderGamePage();
    expect(screen.getByText(/Games Played/i)).toBeInTheDocument();
  });

  test('allows making a move on empty cell', async () => {
    renderGamePage();
    
    const cells = screen.getAllByRole('button');
    const emptyCell = cells.find(cell => !cell.textContent && !cell.disabled);
    
    if (emptyCell) {
      fireEvent.click(emptyCell);
      await waitFor(() => {
        expect(emptyCell.textContent).toBeTruthy();
      });
    }
  });

  test('new game button resets the board', async () => {
    renderGamePage();
    
    // Make a move
    const cells = screen.getAllByRole('button');
    const emptyCell = cells.find(cell => !cell.textContent && !cell.disabled);
    if (emptyCell) {
      fireEvent.click(emptyCell);
    }
    
    // Click new game
    const newGameBtn = screen.getByText('New Game');
    fireEvent.click(newGameBtn);
    
    // Check board is reset
    await waitFor(() => {
      const resetCells = screen.getAllByRole('button');
      const boardCells = resetCells.slice(0, 9);
      const allEmpty = boardCells.every(cell => !cell.textContent || cell.textContent === '');
      expect(allEmpty).toBe(true);
    });
  });

  test('forfeit button shows confirmation', () => {
    window.confirm = jest.fn(() => false);
    renderGamePage();
    
    const forfeitBtn = screen.getByText('Forfeit');
    fireEvent.click(forfeitBtn);
    
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to forfeit this game?');
  });
});
