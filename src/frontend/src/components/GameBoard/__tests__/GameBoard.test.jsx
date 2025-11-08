import { render, screen, fireEvent } from '@testing-library/react';
import GameBoard from '../GameBoard';

describe('GameBoard Component', () => {
  const mockBoard = [
    ['X', 'O', null],
    [null, 'X', null],
    [null, null, 'O']
  ];

  const mockOnCellClick = jest.fn();

  beforeEach(() => {
    mockOnCellClick.mockClear();
  });

  test('renders 3x3 grid', () => {
    render(
      <GameBoard
        board={mockBoard}
        onCellClick={mockOnCellClick}
        currentPlayer="X"
      />
    );

    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(9);
  });

  test('displays correct symbols in cells', () => {
    render(
      <GameBoard
        board={mockBoard}
        onCellClick={mockOnCellClick}
        currentPlayer="X"
      />
    );

    const cells = screen.getAllByRole('button');
    expect(cells[0]).toHaveTextContent('X');
    expect(cells[1]).toHaveTextContent('O');
    expect(cells[2]).toHaveTextContent('');
  });

  test('calls onCellClick when empty cell is clicked', () => {
    render(
      <GameBoard
        board={mockBoard}
        onCellClick={mockOnCellClick}
        currentPlayer="X"
      />
    );

    const cells = screen.getAllByRole('button');
    fireEvent.click(cells[2]); // Click empty cell

    expect(mockOnCellClick).toHaveBeenCalledWith(0, 2);
  });

  test('does not call onCellClick when occupied cell is clicked', () => {
    render(
      <GameBoard
        board={mockBoard}
        onCellClick={mockOnCellClick}
        currentPlayer="X"
      />
    );

    const cells = screen.getAllByRole('button');
    fireEvent.click(cells[0]); // Click occupied cell

    expect(mockOnCellClick).not.toHaveBeenCalled();
  });

  test('disables all cells when disabled prop is true', () => {
    render(
      <GameBoard
        board={mockBoard}
        onCellClick={mockOnCellClick}
        currentPlayer="X"
        disabled={true}
      />
    );

    const cells = screen.getAllByRole('button');
    cells.forEach(cell => {
      expect(cell).toBeDisabled();
    });
  });

  test('highlights winning line', () => {
    const winningLine = [[0, 0], [1, 1], [2, 2]];
    
    render(
      <GameBoard
        board={mockBoard}
        onCellClick={mockOnCellClick}
        currentPlayer="X"
        winner="X"
        winningLine={winningLine}
      />
    );

    const cells = screen.getAllByRole('button');
    expect(cells[0]).toHaveClass('winning');
    expect(cells[4]).toHaveClass('winning');
    expect(cells[8]).toHaveClass('winning');
  });
});
