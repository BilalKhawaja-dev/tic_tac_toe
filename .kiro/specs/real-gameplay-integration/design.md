# Real Gameplay Integration - Design

## Architecture Overview

### Current Architecture
```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────────────────────────────┐
│   Application Load Balancer (ALB)  │
└──────┬──────────────────────────────┘
       │
       ├─────────────────┬──────────────┬─────────────────┐
       ▼                 ▼              ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend   │  │ Game Engine  │  │ Leaderboard  │  │ Auth Service │
│   Service    │  │   Service    │  │   Service    │  │  (scaled=0)  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                         │                  │
                         └──────┬───────────┘
                                ▼
                    ┌──────────────────────┐
                    │   RDS PostgreSQL     │
                    │   ElastiCache Redis  │
                    └──────────────────────┘
```

**Issues**:
- No WebSocket support in ALB
- Services don't communicate
- Auth service not running
- Frontend hardcoded to localhost

### Target Architecture
```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       ├─── HTTP ────┐
       │             │
       └─ WebSocket ─┤
                     ▼
┌─────────────────────────────────────┐
│   Application Load Balancer (ALB)  │
│   - HTTP/HTTPS routing              │
│   - WebSocket upgrade support       │
│   - Sticky sessions enabled         │
└──────┬──────────────────────────────┘
       │
       ├─────────────────┬──────────────┬─────────────────┐
       ▼                 ▼              ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Frontend   │  │ Game Engine  │  │ Leaderboard  │  │ Auth Service │
│   (Nginx)    │  │  + WebSocket │  │   Service    │  │  (scaled=2)  │
│              │  │   Server     │  │              │  │              │
└──────────────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                         │                  │                 │
                         │                  │                 │
                         └──────────────────┴─────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────┐
                    │   RDS PostgreSQL (shared)            │
                    │   - users, games, leaderboard, chat  │
                    └──────────────────────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────┐
                    │   ElastiCache Redis (shared)         │
                    │   - sessions, cache, pub/sub         │
                    └──────────────────────────────────────┘
                                            │
                                            ▼
                    ┌──────────────────────────────────────┐
                    │   AWS Secrets Manager                │
                    │   - JWT key, DB creds, Redis auth    │
                    └──────────────────────────────────────┘
```

## Phase 0: Codebase Cleanup

### Cleanup Strategy

#### 0.1 Documentation Consolidation
**Problem**: 90+ markdown files in root directory

**Solution**: Consolidate into organized structure
```
docs/
├── README.md                    # Main project documentation
├── DEPLOYMENT.md                # Deployment guide (consolidated)
├── ARCHITECTURE.md              # System architecture
├── SECURITY.md                  # Security practices
└── TROUBLESHOOTING.md           # Common issues

.kiro/specs/
├── global-gaming-platform/      # Original spec (keep)
└── real-gameplay-integration/   # This spec (new)
```

**Files to DELETE** (examples):
- All `*_STATUS.md`, `*_SUMMARY.md`, `*_COMPLETE.md` files
- Duplicate deployment guides
- Session handoff documents
- Temporary fix documentation
- Test result snapshots

**Files to KEEP**:
- README.md (update with current state)
- .gitignore
- docker-compose.yml
- Any files referenced by active code

#### 0.2 Script Consolidation
**Problem**: 46+ shell scripts, many obsolete

**Solution**: Keep only essential scripts
```
scripts/
├── deploy/
│   ├── deploy-all.sh           # Main deployment
│   ├── deploy-service.sh       # Single service deploy
│   └── rollback.sh             # Rollback script
├── setup/
│   ├── init-secrets.sh         # Initialize secrets
│   └── init-database.sh        # Database setup
├── test/
│   ├── test-services.sh        # Service health checks
│   └── test-e2e.sh             # End-to-end tests
└── utils/
    ├── cleanup-aws.sh          # AWS resource cleanup
    └── check-status.sh         # Status checker
```

**Scripts to DELETE**:
- All `fix-*.sh`, `quick-fix-*.sh`, `rebuild-*.sh`
- Duplicate deployment scripts
- One-off debugging scripts
- Old migration scripts

**Scripts to CONSOLIDATE**:
- Merge all deployment scripts into `deploy-all.sh`
- Merge all status checks into `check-status.sh`
- Merge all test scripts into `test-services.sh`

#### 0.3 Terraform Cleanup
**Problem**: Potential duplicate or unused Terraform code

**Solution**: Audit and remove unused modules
- Remove any commented-out resources
- Remove unused variables
- Consolidate duplicate module definitions
- Update module documentation


## Phase 1: Security Hardening

### 1.1 Secrets Management Architecture

#### Current State
```javascript
// ❌ INSECURE - Hardcoded fallback
security: {
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production'
}
```

#### Target State
```javascript
// ✅ SECURE - Fail fast if missing
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function loadSecrets() {
  const secrets = await secretsManager.getSecretValue({
    SecretId: process.env.SECRET_ARN
  }).promise();
  
  const parsed = JSON.parse(secrets.SecretString);
  
  if (!parsed.jwtSecret) {
    throw new Error('FATAL: JWT secret not found in Secrets Manager');
  }
  
  return parsed;
}
```

#### Secrets to Store in AWS Secrets Manager

1. **Database Credentials** (already exists)
   - Secret Name: `online-tic-tac-toe-aurora-master-password-development`
   - Contents: `{ "password": "..." }`

2. **JWT Signing Key** (NEW)
   - Secret Name: `global-gaming-platform/jwt/signing-key`
   - Contents: `{ "secret": "...", "algorithm": "HS256" }`
   - Rotation: Every 90 days

3. **Redis Authentication** (NEW)
   - Secret Name: `global-gaming-platform/redis/auth`
   - Contents: `{ "password": "..." }`
   - Rotation: Every 90 days

4. **Cognito Client Secret** (NEW)
   - Secret Name: `global-gaming-platform/cognito/client-secret`
   - Contents: `{ "clientId": "...", "clientSecret": "..." }`
   - Rotation: Manual (Cognito managed)

5. **OAuth Credentials** (NEW - if needed)
   - Secret Name: `global-gaming-platform/oauth/credentials`
   - Contents: `{ "clientId": "...", "clientSecret": "..." }`

### 1.2 Secret Loading Pattern

**Service Startup Sequence**:
1. Load secrets from Secrets Manager on startup
2. Validate all required secrets present
3. Fail fast if any secret missing
4. Cache secrets in memory (never log)
5. Refresh secrets on rotation signal

**Implementation**:
```javascript
// src/shared/secrets/SecretManager.js
class SecretManager {
  constructor(secretArn) {
    this.secretArn = secretArn;
    this.secrets = null;
    this.lastRefresh = null;
  }
  
  async initialize() {
    await this.refresh();
    this.setupRotationListener();
  }
  
  async refresh() {
    const data = await secretsManager.getSecretValue({
      SecretId: this.secretArn
    }).promise();
    
    this.secrets = JSON.parse(data.SecretString);
    this.lastRefresh = Date.now();
    
    this.validate();
  }
  
  validate() {
    const required = ['jwtSecret', 'dbPassword', 'redisPassword'];
    for (const key of required) {
      if (!this.secrets[key]) {
        throw new Error(`FATAL: Required secret '${key}' not found`);
      }
    }
  }
  
  get(key) {
    if (!this.secrets) {
      throw new Error('Secrets not initialized');
    }
    return this.secrets[key];
  }
}
```

### 1.3 Secret Rotation Configuration

**Terraform Configuration**:
```hcl
resource "aws_secretsmanager_secret_rotation" "jwt_rotation" {
  secret_id           = aws_secretsmanager_secret.jwt_secret.id
  rotation_lambda_arn = aws_lambda_function.rotate_secret.arn

  rotation_rules {
    automatically_after_days = 90
  }
}
```

## Phase 2: Authentication Integration

### 2.1 Authentication Flow

```
┌─────────┐                                                      ┌─────────┐
│ Browser │                                                      │ Cognito │
└────┬────┘                                                      └────┬────┘
     │                                                                │
     │ 1. POST /api/auth/register                                    │
     ├──────────────────────────────────────────────────────────────►│
     │    { email, password }                                        │
     │                                                                │
     │ 2. User created, confirmation email sent                      │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
     │ 3. POST /api/auth/login                                       │
     ├──────────────────────────────────────────────────────────────►│
     │    { email, password }                                        │
     │                                                                │
     │ 4. JWT tokens (access + refresh)                              │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
     │ 5. Store tokens in httpOnly cookie                            │
     │    + localStorage (for client-side checks)                    │
     │                                                                │
     │ 6. All API calls include Authorization header                 │
     ├──────────────────────────────────────────────────────────────►│
     │    Authorization: Bearer <jwt_token>                          │
     │                                                                │
     │ 7. Token validated on each request                            │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
     │ 8. Token refresh before expiry                                │
     ├──────────────────────────────────────────────────────────────►│
     │    POST /api/auth/refresh                                     │
     │    { refreshToken }                                           │
     │                                                                │
     │ 9. New access token                                           │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
```

### 2.2 Frontend Authentication Components

**New Components to Create**:
1. `src/frontend/src/pages/LoginPage.jsx` - Login form
2. `src/frontend/src/pages/RegisterPage.jsx` - Registration form
3. `src/frontend/src/components/ProtectedRoute.jsx` - Route guard
4. `src/frontend/src/contexts/AuthContext.jsx` - Auth state management
5. `src/frontend/src/services/AuthService.js` - Auth API calls

**Token Storage Strategy**:
- **Access Token**: httpOnly cookie (secure, not accessible to JS)
- **User Info**: localStorage (for UI state, non-sensitive)
- **Refresh Token**: httpOnly cookie (secure)

### 2.3 Backend Authentication Middleware

**JWT Validation Middleware**:
```javascript
// src/auth-service/src/middleware/jwtAuth.js
async function validateJWT(req, res, next) {
  const token = req.cookies.accessToken || 
                req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, secretManager.get('jwtSecret'));
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 2.4 Auth Service Scaling

**Current**: Desired count = 0  
**Target**: Desired count = 2 (minimum for HA)

**Terraform Update**:
```hcl
resource "aws_ecs_service" "auth_service" {
  desired_count = 2  # Changed from 0
  
  # ... rest of configuration
}
```

## Phase 3: Real-time Multiplayer Gaming

### 3.1 WebSocket Architecture

#### ALB WebSocket Configuration

**Current ALB**: HTTP/HTTPS only  
**Target ALB**: HTTP/HTTPS + WebSocket upgrade

**Required Changes**:
1. Enable sticky sessions (required for WebSocket)
2. Add WebSocket upgrade support
3. Configure WebSocket health checks
4. Increase idle timeout for long-lived connections

**Terraform Configuration**:
```hcl
resource "aws_lb_target_group" "game_engine_ws" {
  name     = "game-engine-websocket"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
  
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400  # 24 hours
    enabled         = true
  }
  
  deregistration_delay = 30
}

resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 50
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.game_engine_ws.arn
  }
  
  condition {
    path_pattern {
      values = ["/ws", "/ws/*"]
    }
  }
  
  condition {
    http_header {
      http_header_name = "Upgrade"
      values           = ["websocket"]
    }
  }
}
```

### 3.2 WebSocket Connection Flow

```
┌─────────┐                                                    ┌──────────────┐
│ Browser │                                                    │ Game Engine  │
└────┬────┘                                                    └──────┬───────┘
     │                                                                │
     │ 1. WebSocket connection request                               │
     │    wss://alb-url/ws?token=<jwt>                               │
     ├──────────────────────────────────────────────────────────────►│
     │                                                                │
     │ 2. Validate JWT token                                         │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
     │ 3. Connection established                                     │
     │    { type: 'connection_established', connectionId: '...' }    │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
     │ 4. Authenticate player                                        │
     │    { type: 'authenticate', playerId: '...' }                  │
     ├──────────────────────────────────────────────────────────────►│
     │                                                                │
     │ 5. Authentication confirmed                                   │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
     │ 6. Create or join game                                        │
     │    { type: 'create_game' } or { type: 'join_game', gameId }   │
     ├──────────────────────────────────────────────────────────────►│
     │                                                                │
     │ 7. Game state update                                          │
     │    { type: 'game_state', game: {...} }                        │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
     │ 8. Make move                                                  │
     │    { type: 'make_move', gameId, position }                    │
     ├──────────────────────────────────────────────────────────────►│
     │                                                                │
     │ 9. Move broadcast to all players                              │
     │    { type: 'move_made', move: {...}, gameState: {...} }       │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
```

### 3.3 Game Room Management

**Data Structure**:
```javascript
class GameRoom {
  constructor(gameId) {
    this.gameId = gameId;
    this.players = new Map(); // playerId -> connectionId
    this.spectators = new Set();
    this.gameState = new GameState();
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }
  
  addPlayer(playerId, connectionId) {
    if (this.players.size >= 2) {
      throw new Error('Game room full');
    }
    this.players.set(playerId, connectionId);
  }
  
  broadcast(message, excludePlayerId = null) {
    for (const [playerId, connectionId] of this.players) {
      if (playerId !== excludePlayerId) {
        wsManager.sendMessage(connectionId, message);
      }
    }
  }
}
```

### 3.4 Frontend WebSocket Integration

**Update WebSocket URL**:
```javascript
// src/frontend/src/config.js
export const config = {
  wsUrl: import.meta.env.VITE_WS_URL || 
         `wss://${window.location.host}/ws`,
  apiUrl: import.meta.env.VITE_API_URL || 
          `https://${window.location.host}/api`
};
```

**Environment Variables** (`.env.production`):
```bash
VITE_WS_URL=wss://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/ws
VITE_API_URL=https://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/api
```


## Phase 4: Leaderboard Integration

### 4.1 Game Completion Flow

```
┌──────────────┐                                              ┌──────────────┐
│ Game Engine  │                                              │ Leaderboard  │
└──────┬───────┘                                              └──────┬───────┘
       │                                                             │
       │ 1. Game ends (winner determined)                           │
       │                                                             │
       │ 2. Persist game result to database                         │
       │    INSERT INTO games (winner_id, loser_id, ...)            │
       │                                                             │
       │ 3. Call leaderboard service                                │
       │    POST /api/leaderboard/update                            │
       ├────────────────────────────────────────────────────────────►│
       │    {                                                        │
       │      gameId, winnerId, loserId,                            │
       │      gameType, duration, moves                             │
       │    }                                                        │
       │                                                             │
       │                                                             │ 4. Update player stats
       │                                                             │    - Increment games_played
       │                                                             │    - Update win/loss count
       │                                                             │    - Recalculate ranking
       │                                                             │    - Update cache
       │                                                             │
       │ 5. Leaderboard updated                                     │
       │◄────────────────────────────────────────────────────────────┤
       │    { success: true, newRankings: {...} }                   │
       │                                                             │
       │ 6. Broadcast leaderboard update to all clients             │
       │    via WebSocket                                           │
       │                                                             │
```

### 4.2 Leaderboard Update API

**New Endpoint**: `POST /api/leaderboard/update`

```javascript
// src/leaderboard-service/src/routes/leaderboard.js
router.post('/update', async (req, res) => {
  const { gameId, winnerId, loserId, gameType, duration } = req.body;
  
  try {
    // Update winner stats
    await db.query(`
      UPDATE user_stats 
      SET games_played = games_played + 1,
          games_won = games_won + 1,
          total_score = total_score + 10,
          last_game_at = NOW()
      WHERE user_id = $1
    `, [winnerId]);
    
    // Update loser stats
    await db.query(`
      UPDATE user_stats 
      SET games_played = games_played + 1,
          games_lost = games_lost + 1,
          last_game_at = NOW()
      WHERE user_id = $1
    `, [loserId]);
    
    // Recalculate rankings
    await rankingManager.recalculateRankings();
    
    // Invalidate cache
    await cache.del('leaderboard:global');
    
    // Get updated rankings
    const rankings = await rankingManager.getTopPlayers(10);
    
    res.json({ success: true, rankings });
  } catch (error) {
    logger.error('Failed to update leaderboard:', error);
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});
```

### 4.3 Real-time Leaderboard Updates

**WebSocket Broadcast**:
```javascript
// After leaderboard update
wsManager.broadcastServerEvent('leaderboard_updated', {
  rankings: updatedRankings,
  timestamp: Date.now()
});
```

**Frontend Listener**:
```javascript
// src/frontend/src/pages/LeaderboardPage.jsx
useEffect(() => {
  const unsubscribe = wsClient.subscribe('leaderboard_updated', (data) => {
    setLeaderboard(data.rankings);
  });
  
  return unsubscribe;
}, []);
```

## Phase 5: Live Chat System

### 5.1 Chat Architecture

**Database Schema**:
```sql
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  username VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_filtered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_game_messages (game_id, created_at),
  INDEX idx_user_messages (user_id, created_at)
);
```

### 5.2 Chat Message Flow

```
┌─────────┐                                                    ┌──────────────┐
│ Browser │                                                    │ Game Engine  │
└────┬────┘                                                    └──────┬───────┘
     │                                                                │
     │ 1. Send chat message                                          │
     │    { type: 'chat_message', gameId, message }                  │
     ├──────────────────────────────────────────────────────────────►│
     │                                                                │
     │                                                                │ 2. Validate message
     │                                                                │    - Check length
     │                                                                │    - Filter profanity
     │                                                                │    - Rate limit check
     │                                                                │
     │                                                                │ 3. Persist to database
     │                                                                │
     │ 4. Broadcast to all players in game                           │
     │    { type: 'chat_message', from, message, timestamp }         │
     │◄──────────────────────────────────────────────────────────────┤
     │                                                                │
```

### 5.3 Chat UI Component

**New Component**: `src/frontend/src/components/GameChat/GameChat.jsx`

```jsx
function GameChat({ gameId }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const { sendMessage, subscribe } = useWebSocket();
  
  useEffect(() => {
    // Load chat history
    loadChatHistory(gameId).then(setMessages);
    
    // Subscribe to new messages
    const unsubscribe = subscribe('chat_message', (msg) => {
      if (msg.gameId === gameId) {
        setMessages(prev => [...prev, msg]);
      }
    });
    
    return unsubscribe;
  }, [gameId]);
  
  const handleSend = () => {
    if (!inputMessage.trim()) return;
    
    sendMessage('chat_message', {
      gameId,
      message: inputMessage
    });
    
    setInputMessage('');
  };
  
  return (
    <div className="game-chat">
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className="chat-message">
            <span className="username">{msg.username}:</span>
            <span className="message">{msg.message}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
```

### 5.4 Profanity Filtering

**Simple Implementation**:
```javascript
// src/game-engine/src/utils/profanityFilter.js
const badWords = ['word1', 'word2', 'word3']; // Load from config

function filterMessage(message) {
  let filtered = message;
  let isFiltered = false;
  
  for (const word of badWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(filtered)) {
      filtered = filtered.replace(regex, '*'.repeat(word.length));
      isFiltered = true;
    }
  }
  
  return { filtered, isFiltered };
}
```

## Testing Strategy

### Unit Tests
- Secret loading and validation
- JWT token generation and validation
- WebSocket message handling
- Game state management
- Leaderboard calculations
- Chat message filtering

### Integration Tests
- Auth service → Cognito integration
- Game engine → Leaderboard service communication
- WebSocket → Database persistence
- Frontend → Backend API calls

### End-to-End Tests
1. **User Registration Flow**
   - Register new user
   - Verify email
   - Login
   - Verify JWT token

2. **Real-time Game Flow**
   - Two users login
   - User 1 creates game
   - User 2 joins game
   - Both make moves
   - Verify moves appear on both screens
   - Game completes
   - Verify leaderboard updates

3. **Chat Flow**
   - Users in game
   - Send chat messages
   - Verify messages appear for both
   - Verify profanity filtering
   - Verify chat history persists

### Performance Tests
- 100 concurrent WebSocket connections
- 50 concurrent games
- Leaderboard update latency
- Chat message delivery time

## Deployment Strategy

### Phase 0: Cleanup
1. Create git branch: `cleanup/technical-debt`
2. Delete obsolete files
3. Consolidate scripts
4. Update documentation
5. Commit and merge

### Phase 1: Security
1. Create git branch: `feature/security-hardening`
2. Create secrets in Secrets Manager
3. Update service code to load secrets
4. Remove hardcoded fallbacks
5. Test locally
6. Deploy to dev
7. Verify services start correctly
8. Merge to main

### Phase 2: Authentication
1. Create git branch: `feature/authentication`
2. Scale up auth service
3. Build frontend auth UI
4. Implement JWT handling
5. Add protected routes
6. Test end-to-end
7. Deploy to dev
8. Verify login/register works
9. Merge to main

### Phase 3: Real-time Gaming
1. Create git branch: `feature/websocket-multiplayer`
2. Update ALB configuration (Terraform)
3. Apply Terraform changes
4. Update frontend WebSocket URL
5. Deploy game-engine with WebSocket
6. Deploy frontend
7. Test cross-browser gameplay
8. Verify move synchronization
9. Merge to main

### Phase 4: Leaderboard
1. Create git branch: `feature/leaderboard-integration`
2. Add leaderboard update endpoint
3. Integrate game-engine → leaderboard
4. Add real-time updates
5. Test game completion flow
6. Deploy services
7. Verify leaderboard updates
8. Merge to main

### Phase 5: Chat
1. Create git branch: `feature/live-chat`
2. Add chat database schema
3. Implement chat handlers
4. Build chat UI component
5. Add profanity filtering
6. Test chat functionality
7. Deploy services
8. Verify chat works
9. Merge to main

## Rollback Plan

Each phase has a rollback strategy:

**Phase 1 (Security)**: 
- Revert to previous service versions
- Secrets remain in Secrets Manager (no harm)

**Phase 2 (Auth)**:
- Scale auth service back to 0
- Frontend falls back to no-auth mode

**Phase 3 (WebSocket)**:
- Revert ALB configuration
- Frontend falls back to local game mode

**Phase 4 (Leaderboard)**:
- Disable leaderboard update calls
- Leaderboard shows cached data

**Phase 5 (Chat)**:
- Disable chat UI
- Chat messages still persisted

## Monitoring & Alerts

### Key Metrics to Track
- WebSocket connection count
- Active game count
- Authentication success/failure rate
- Leaderboard update latency
- Chat message delivery time
- Secret rotation status

### Alerts to Configure
- WebSocket connection failures > 5%
- Auth service response time > 1s
- Leaderboard update failures
- Secret rotation failures
- Database connection pool exhaustion

## Documentation Updates

### Files to Update
1. `README.md` - Add authentication setup
2. `docs/DEPLOYMENT.md` - Update deployment steps
3. `docs/ARCHITECTURE.md` - Add WebSocket architecture
4. `docs/SECURITY.md` - Document secret management
5. `docs/API.md` - Document new endpoints

### Files to Create
1. `docs/WEBSOCKET_API.md` - WebSocket message protocol
2. `docs/AUTHENTICATION.md` - Auth flow documentation
3. `docs/TROUBLESHOOTING.md` - Common issues and fixes
