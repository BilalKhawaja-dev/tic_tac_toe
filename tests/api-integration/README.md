# API Integration Tests

Comprehensive integration tests for the Global Gaming Platform API Gateway and microservices.

## Test Categories

### 1. Contract Tests (`contract/`)
Tests the contracts between API Gateway and backend services using Pact.

**Purpose**: Ensure API Gateway and services maintain compatible interfaces

**Tests**:
- Auth Service contract
- Game Engine contract
- Leaderboard Service contract
- Support Service contract

### 2. End-to-End Tests (`e2e/`)
Tests complete user workflows from authentication to game completion.

**Purpose**: Validate entire user journeys work correctly

**Tests**:
- Complete game workflow (auth → create game → play → leaderboard)
- Support ticket workflow
- Error handling scenarios
- Rate limiting behavior

### 3. Security Tests (`security/`)
Tests for common security vulnerabilities and attack vectors.

**Purpose**: Ensure API is secure against common attacks

**Tests**:
- Authentication and authorization
- SQL injection prevention
- XSS prevention
- CSRF protection
- Input validation
- CORS security
- Information disclosure prevention
- DoS prevention

### 4. Performance Tests (`performance/`)
Load and stress tests using Artillery.

**Purpose**: Validate API performance under load

**Tests**:
- Sustained load (50 users/sec)
- Peak load (100 users/sec)
- Response time thresholds (P95 < 200ms, P99 < 500ms)
- Error rate < 1%

## Setup

### Prerequisites

- Node.js 18+
- Access to API Gateway endpoint
- Valid JWT secret for testing

### Installation

```bash
cd tests/api-integration
npm install
```

### Environment Variables

Create a `.env` file:

```bash
API_BASE_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-key
TEST_TOKEN=your-test-jwt-token
```

## Running Tests

### All Tests

```bash
npm test
```

### Contract Tests

```bash
npm run test:contract
```

### End-to-End Tests

```bash
npm run test:e2e
```

### Security Tests

```bash
npm run test:security
```

### Performance Tests

```bash
npm run test:performance

# Or using Artillery directly
artillery run performance/load-test.yml
```

### With Coverage

```bash
npm run test:coverage
```

### Watch Mode

```bash
npm run test:watch
```

## Test Structure

```
tests/api-integration/
├── contract/                 # Pact contract tests
│   ├── auth-service.contract.test.js
│   ├── game-service.contract.test.js
│   └── leaderboard-service.contract.test.js
├── e2e/                     # End-to-end workflow tests
│   ├── game-workflow.test.js
│   └── support-workflow.test.js
├── security/                # Security vulnerability tests
│   └── api-security.test.js
├── performance/             # Load and performance tests
│   └── load-test.yml
├── setup.js                 # Test setup and utilities
├── jest.config.js          # Jest configuration
├── package.json            # Dependencies
└── README.md               # This file
```

## Writing New Tests

### Contract Test Example

```javascript
const { Pact } = require('@pact-foundation/pact');

describe('Service Contract', () => {
  const provider = new Pact({
    consumer: 'API-Gateway',
    provider: 'Your-Service',
    port: 8080
  });

  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());

  test('should handle request', async () => {
    await provider.addInteraction({
      state: 'service is available',
      uponReceiving: 'a request',
      withRequest: {
        method: 'GET',
        path: '/endpoint'
      },
      willRespondWith: {
        status: 200,
        body: { success: true }
      }
    });

    // Make request and assert
  });
});
```

### E2E Test Example

```javascript
describe('User Flow', () => {
  let authToken;

  beforeAll(() => {
    authToken = createTestToken();
  });

  test('should complete workflow', async () => {
    // Step 1: Authenticate
    const authResponse = await authenticatedRequest('GET', '/users/me');
    expect(authResponse.status).toBe(200);

    // Step 2: Perform action
    const actionResponse = await authenticatedRequest('POST', '/action');
    expect(actionResponse.status).toBe(201);

    // Step 3: Verify result
    const verifyResponse = await authenticatedRequest('GET', '/result');
    expect(verifyResponse.data).toMatchObject({ success: true });
  });
});
```

### Security Test Example

```javascript
describe('Security Check', () => {
  test('should prevent attack', async () => {
    const maliciousPayload = '<script>alert("XSS")</script>';
    
    try {
      await axios.post('/endpoint', { data: maliciousPayload });
      fail('Should have rejected malicious input');
    } catch (error) {
      expect(error.response.status).toBe(400);
    }
  });
});
```

## Performance Thresholds

### Response Times
- **P50**: < 100ms
- **P95**: < 200ms
- **P99**: < 500ms

### Error Rates
- **Maximum**: 1%
- **Target**: < 0.1%

### Throughput
- **Baseline**: 50 requests/second
- **Peak**: 100 requests/second
- **Sustained**: 50 requests/second for 5 minutes

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Integration Tests
  run: |
    cd tests/api-integration
    npm install
    npm test
  env:
    API_BASE_URL: ${{ secrets.API_BASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Test Reports

Tests generate the following reports:
- **Coverage**: `coverage/lcov-report/index.html`
- **Pact Contracts**: `pacts/*.json`
- **Artillery Report**: `artillery-report.json`

## Troubleshooting

### Common Issues

**1. Connection Refused**
```
Error: connect ECONNREFUSED
```
Solution: Ensure API Gateway is running and `API_BASE_URL` is correct

**2. Authentication Failures**
```
Error: 401 Unauthorized
```
Solution: Check `JWT_SECRET` matches the API Gateway configuration

**3. Timeout Errors**
```
Error: Timeout of 30000ms exceeded
```
Solution: Increase timeout in jest.config.js or check API performance

**4. Rate Limiting**
```
Error: 429 Too Many Requests
```
Solution: This is expected behavior. Adjust test timing or rate limits

### Debug Mode

Run tests with debug output:

```bash
DEBUG=* npm test
```

### Verbose Logging

```bash
npm test -- --verbose
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Clean up test data after tests
3. **Realistic Data**: Use realistic test data
4. **Error Cases**: Test both success and failure scenarios
5. **Performance**: Keep tests fast (< 30s per test)
6. **Assertions**: Use specific assertions
7. **Documentation**: Document complex test scenarios

## Maintenance

### Updating Tests

When API changes:
1. Update contract tests first
2. Update E2E tests
3. Verify security tests still pass
4. Re-run performance baseline

### Adding New Endpoints

1. Add contract test
2. Add E2E test for main workflow
3. Add security tests for new endpoint
4. Update performance test scenarios

## References

- [Jest Documentation](https://jestjs.io/)
- [Pact Documentation](https://docs.pact.io/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [API Gateway Documentation](../infrastructure/terraform/modules/api-gateway/README.md)
- [OpenAPI Specification](../infrastructure/terraform/modules/api-gateway/openapi-spec.yaml)
