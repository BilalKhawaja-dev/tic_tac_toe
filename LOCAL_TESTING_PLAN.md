# Local Testing & Code Improvement Plan

## ✅ Prerequisites Complete
- All code fixes applied
- All Terraform fixes applied
- Configuration validated
- Ready for testing

---

## Phase 1: Local Environment Testing

### Step 1: Start Services
```bash
# Clean any existing containers
docker-compose down -v

# Start all services
docker-compose up --build -d

# Expected: All services build and start successfully
```

### Step 2: Monitor Startup
```bash
# Watch all logs
docker-compose logs -f

# Or watch individual services
docker-compose logs -f auth-service
docker-compose logs -f leaderboard-service
docker-compose logs -f game-engine
docker-compose logs -f frontend
```

**Look for**:
- ✅ "Server started on port X"
- ✅ "Connected to database"
- ✅ "Connected to Redis"
- ❌ Any error messages
- ❌ Crash loops

### Step 3: Test Health Endpoints
```bash
# Test each service
curl -v http://localhost:3000/health  # Game Engine
curl -v http://localhost:3001/health  # Auth Service
curl -v http://localhost:3002/health  # Leaderboard
curl -v http://localhost:8080/health  # Frontend

# Expected: All return 200 OK
```

### Step 4: Test Frontend
```bash
# Open in browser
open http://localhost:8080

# Or use curl
curl http://localhost:8080
```

**Check**:
- Homepage loads
- No console errors (F12)
- Navigation works
- Styling looks correct

---

## Phase 2: Identify Issues & Improvements

### Common Issues to Watch For

#### Issue 1: Auth Service Cognito Errors
**Symptom**: Auth service crashes with Cognito errors
**Solution**: Mock Cognito for local development

**Fix**: Update `src/auth-service/src/services/CognitoService.js` to detect local environment and use mock

#### Issue 2: Database Connection Failures
**Symptom**: Services can't connect to PostgreSQL
**Solution**: Verify PostgreSQL is healthy and credentials are correct

**Check**:
```bash
docker-compose exec postgres psql -U postgres -d gaming_platform -c "SELECT 1"
```

#### Issue 3: Redis Connection Failures
**Symptom**: Services can't connect to Redis
**Solution**: Verify Redis is healthy

**Check**:
```bash
docker-compose exec redis redis-cli ping
```

#### Issue 4: Frontend Can't Reach Backend
**Symptom**: Frontend shows errors, can't load data
**Solution**: Check API URLs in frontend config

**Verify**: `src/frontend/src/services/ApiService.js` uses correct URLs

---

## Phase 3: Code Improvements

### Improvement 1: Add Local Development Mode

**File**: `src/auth-service/src/services/CognitoService.js`

Add at the top of the class:
```javascript
constructor() {
  // Use mock Cognito in local development
  if (config.environment === 'development' && !config.cognito.userPoolId) {
    this.mockMode = true;
    logger.info('Running in mock Cognito mode for local development');
    return;
  }
  
  // Normal Cognito setup
  this.cognitoClient = new CognitoIdentityProviderClient({
    region: config.aws.region
  });
  // ... rest of constructor
}
```

### Improvement 2: Better Error Messages

**File**: `src/leaderboard-service/src/database/RankingManager.js`

Improve error logging:
```javascript
async initialize() {
  try {
    // ... connection code
  } catch (error) {
    logger.error('Failed to initialize RankingManager:', {
      error: error.message,
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      hasPassword: !!config.database.password
    });
    throw error;
  }
}
```

### Improvement 3: Health Check Enhancements

**File**: `src/auth-service/src/routes/health.js`

Add dependency checks:
```javascript
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    version: process.env.npm_package_version || '1.0.0',
    dependencies: {
      database: 'unknown',
      redis: 'unknown',
      cognito: 'unknown'
    }
  };

  // Check database
  try {
    await db.query('SELECT 1');
    health.dependencies.database = 'healthy';
  } catch (error) {
    health.dependencies.database = 'unhealthy';
    health.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    health.dependencies.redis = 'healthy';
  } catch (error) {
    health.dependencies.redis = 'unhealthy';
    health.status = 'degraded';
  }

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
```

### Improvement 4: Graceful Shutdown

**File**: `src/game-engine/src/index.js`

Add proper shutdown handling:
```javascript
// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown');
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close WebSocket connections
  await webSocketManager.closeAll();
  
  // Close database connections
  await databaseManager.close();
  
  // Close cache connections
  await cacheManager.close();
  
  process.exit(0);
});
```

### Improvement 5: Request Logging Enhancement

**File**: `src/*/src/middleware/requestLogger.js`

Add more context:
```javascript
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || uuid.v4();
  
  req.requestId = requestId;

  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });

    originalSend.call(this, data);
  };

  next();
};
```

---

## Phase 4: Testing Checklist

### Functional Testing
- [ ] All services start without errors
- [ ] Health endpoints return 200
- [ ] Frontend loads in browser
- [ ] Can navigate between pages
- [ ] Database connections work
- [ ] Redis connections work
- [ ] Logs show no errors

### Integration Testing
- [ ] Frontend can call backend APIs
- [ ] Services can communicate with each other
- [ ] Database queries work
- [ ] Cache operations work
- [ ] WebSocket connections work (if applicable)

### Performance Testing
- [ ] Services start in reasonable time (<30s)
- [ ] Health checks respond quickly (<1s)
- [ ] No memory leaks (monitor with `docker stats`)
- [ ] CPU usage is reasonable

---

## Phase 5: Document Issues Found

Create a file `TESTING_ISSUES.md` to track:

```markdown
# Testing Issues Found

## Issue 1: [Description]
- **Service**: auth-service
- **Error**: [Error message]
- **Fix**: [What you did to fix it]
- **Status**: Fixed/Pending

## Issue 2: [Description]
...
```

---

## Phase 6: Iterate and Improve

For each issue found:
1. Document it
2. Create a fix
3. Test the fix
4. Commit the change
5. Move to next issue

---

## Success Criteria

Local testing is complete when:
- ✅ All services start successfully
- ✅ No errors in logs
- ✅ All health checks pass
- ✅ Frontend loads and works
- ✅ Can perform basic operations
- ✅ All tests pass
- ✅ Code improvements applied

---

## Next Steps After Local Testing

Once local testing passes:
1. Commit all changes
2. Update Terraform if needed
3. Deploy to AWS
4. Monitor and validate
5. Complete remaining tasks from tasks.md

---

## Quick Commands Reference

```bash
# Start
docker-compose up --build -d

# Logs
docker-compose logs -f

# Stop
docker-compose down

# Clean restart
docker-compose down -v && docker-compose up --build -d

# Check status
docker-compose ps

# Test health
for port in 3000 3001 3002 8080; do
  echo "Testing port $port:"
  curl -s http://localhost:$port/health | jq .
done
```
