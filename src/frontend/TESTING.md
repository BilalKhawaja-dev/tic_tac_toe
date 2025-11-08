# Frontend Testing Documentation

## Overview
This document describes the testing setup and strategy for the Global Gaming Platform frontend.

## Test Framework
- **Jest**: JavaScript testing framework
- **React Testing Library**: React component testing utilities
- **jsdom**: DOM implementation for Node.js

## Test Structure

### Unit Tests
Located in `__tests__` directories next to the components/services they test:

1. **WebSocketClient Tests** (`src/services/__tests__/WebSocketClient.test.js`)
   - Connection management
   - Message handling
   - Reconnection logic
   - Status tracking

2. **ApiService Tests** (`src/services/__tests__/ApiService.test.js`)
   - HTTP request methods (GET, POST, PUT, DELETE)
   - Authentication token handling
   - Error handling
   - API endpoint coverage

3. **GameBoard Tests** (`src/components/GameBoard/__tests__/GameBoard.test.jsx`)
   - Grid rendering
   - Cell click handling
   - Symbol display
   - Winning line highlighting
   - Disabled state

4. **WebSocketStatus Tests** (`src/components/WebSocketStatus/__tests__/WebSocketStatus.test.jsx`)
   - Status display for different connection states
   - Reconnect button functionality
   - CSS class application

### Integration Tests

5. **GamePage Tests** (`src/pages/__tests__/GamePage.test.jsx`)
   - Full page rendering
   - Game controls functionality
   - WebSocket integration
   - Game flow (moves, reset, forfeit)

## Running Tests

### Run all tests:
```bash
npm test
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Run tests with coverage:
```bash
npm run test:coverage
```

### Run tests using script:
```bash
./run-tests.sh
```

## Test Coverage

The test suite covers:
- ✅ Core WebSocket functionality
- ✅ API service methods
- ✅ Game board interactions
- ✅ Connection status display
- ✅ Game page integration
- ✅ User interactions (clicks, moves)
- ✅ Error handling

## Configuration Files

- `jest.config.js` - Jest configuration
- `babel.config.cjs` - Babel transpilation for tests
- `setupTests.js` - Global test setup and mocks
- `__mocks__/fileMock.js` - Static asset mocks

## Mocks

### Global Mocks (setupTests.js)
- **WebSocket**: Mocked for testing real-time features
- **fetch**: Mocked for API calls
- **Environment variables**: Set for consistent test environment

### Component Mocks
- React Router hooks (useParams, useNavigate)
- Custom hooks (useWebSocket)

## Best Practices

1. **Focus on Core Functionality**: Tests cover essential features without over-testing edge cases
2. **Minimal Test Count**: Each test validates specific, important behavior
3. **Fast Execution**: Tests run quickly with minimal setup
4. **Clear Assertions**: Each test has clear, specific expectations
5. **Isolated Tests**: Tests don't depend on each other

## Test Maintenance

- Keep tests simple and focused
- Update tests when component behavior changes
- Remove obsolete tests
- Maintain test coverage above 70% for critical paths

## Troubleshooting

### Common Issues

1. **Module not found errors**: Ensure all dependencies are installed with `npm install`
2. **Transform errors**: Check babel.config.cjs is properly configured
3. **Timeout errors**: Increase testTimeout in jest.config.js if needed
4. **Mock issues**: Verify mocks in setupTests.js match actual implementations

## Future Enhancements

- Add E2E tests with Cypress (as noted in tasks)
- Add accessibility testing
- Add visual regression testing
- Increase coverage for edge cases as needed
