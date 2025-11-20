# Real Gameplay Integration - Implementation Tasks

## Phase 0: Codebase Cleanup

### Task 0.1: Audit and Categorize Files
**Estimated Time**: 30 minutes  
**Priority**: HIGH

**Steps**:
1. List all markdown files in root: `ls -1 *.md | wc -l`
2. Categorize files:
   - Keep: README.md, essential docs
   - Archive: Historical summaries, session handoffs
   - Delete: Duplicate status files, temporary fixes
3. List all scripts: `ls -1 scripts/*.sh`
4. Categorize scripts:
   - Keep: Active deployment, testing scripts
   - Consolidate: Multiple similar scripts
   - Delete: One-off fixes, debugging scripts

**Acceptance Criteria**:
- [ ] Complete inventory of files created
- [ ] Categorization documented
- [ ] Deletion list approved

### Task 0.2: Delete Obsolete Documentation
**Estimated Time**: 20 minutes  
**Priority**: HIGH

**Files to Delete**:
```bash
# Status and summary files
rm -f *_STATUS.md *_SUMMARY.md *_COMPLETE.md *_SUCCESS.md
rm -f DEPLOYMENT_*.md (except DEPLOYMENT_GUIDE.md if keeping)
rm -f SESSION_*.md HANDOFF_*.md START_HERE*.md
rm -f FIXING_*.md WHATS_BROKEN.md
rm -f CURRENT_*.md FINAL_*.md
rm -f AUDIT_*.md TEST_*.md
rm -f QUICK_*.md VALIDATION_*.md
```

**Steps**:
1. Create git branch: `git checkout -b cleanup/documentation`
2. Review each file before deletion
3. Delete obsolete files
4. Commit: `git commit -m "chore: remove obsolete documentation"`

**Acceptance Criteria**:
- [ ] < 20 markdown files in root directory
- [ ] All deletions committed to git
- [ ] No active references to deleted files

### Task 0.3: Consolidate Scripts
**Estimated Time**: 45 minutes  
**Priority**: HIGH

**Scripts to Delete**:
```bash
# Fix and rebuild scripts (one-off)
rm -f scripts/fix-*.sh
rm -f scripts/quick-fix-*.sh
rm -f scripts/rebuild-*.sh
rm -f scripts/redeploy-*.sh
rm -f scripts/apply-*-fixes.sh

# Duplicate deployment scripts
rm -f scripts/deploy-routing-fixes.sh
rm -f scripts/deploy-terraform.sh (keep quick-start-terraform.sh)
rm -f scripts/import-ecr-repos.sh
```

**Scripts to Consolidate**:
1. Merge all service deployment scripts into `scripts/deploy/deploy-service.sh`
2. Merge status checks into `scripts/utils/check-status.sh`
3. Merge test scripts into `scripts/test/test-services.sh`

**New Script Structure**:
```
scripts/
├── deploy/
│   ├── deploy-all.sh
│   ├── deploy-service.sh
│   └── rollback.sh
├── setup/
│   ├── init-secrets.sh
│   └── init-database.sh
├── test/
│   ├── test-services.sh
│   └── test-e2e.sh
└── utils/
    ├── cleanup-aws.sh
    └── check-status.sh
```

**Steps**:
1. Create new directory structure
2. Consolidate script logic
3. Update script references in documentation
4. Delete old scripts
5. Test new scripts
6. Commit changes

**Acceptance Criteria**:
- [ ] < 15 scripts total
- [ ] All scripts in organized directories
- [ ] Scripts tested and working
- [ ] Documentation updated

### Task 0.4: Clean Up Terraform Code
**Estimated Time**: 30 minutes  
**Priority**: MEDIUM

**Steps**:
1. Review all Terraform modules for:
   - Commented-out resources
   - Unused variables
   - Duplicate module definitions
2. Remove unused code
3. Update module documentation
4. Run `terraform fmt` on all files
5. Run `terraform validate`

**Acceptance Criteria**:
- [ ] No commented-out resources
- [ ] All variables used
- [ ] No duplicate modules
- [ ] Terraform validate passes

### Task 0.5: Update Main Documentation
**Estimated Time**: 30 minutes  
**Priority**: HIGH

**Files to Update**:
1. `README.md` - Current project state
2. `docs/DEPLOYMENT.md` - Consolidated deployment guide
3. `docs/ARCHITECTURE.md` - Current architecture
4. `.gitignore` - Add patterns for temp files

**Steps**:
1. Update README with current status
2. Consolidate deployment documentation
3. Document current architecture
4. Update .gitignore
5. Commit changes

**Acceptance Criteria**:
- [ ] README reflects current state
- [ ] Single source of truth for deployment
- [ ] Architecture documented
- [ ] .gitignore updated

---

## Phase 1: Security Hardening

### Task 1.1: Create Secrets in AWS Secrets Manager
**Estimated Time**: 45 minutes  
**Priority**: CRITICAL

**Steps**:
1. Generate secure JWT signing key:
   ```bash
   openssl rand -base64 64
   ```

2. Create JWT secret:
   ```bash
   aws secretsmanager create-secret \
     --name global-gaming-platform/jwt/signing-key \
     --description "JWT signing key for token generation" \
     --secret-string '{"secret":"<generated-key>","algorithm":"HS256"}' \
     --region eu-west-2
   ```

3. Get Redis password from ElastiCache:
   ```bash
   aws elasticache describe-cache-clusters \
     --cache-cluster-id <cluster-id> \
     --show-cache-node-info \
     --region eu-west-2
   ```

4. Create Redis secret:
   ```bash
   aws secretsmanager create-secret \
     --name global-gaming-platform/redis/auth \
     --description "Redis authentication token" \
     --secret-string '{"password":"<redis-password>"}' \
     --region eu-west-2
   ```

5. Get Cognito client secret from Cognito console

6. Create Cognito secret:
   ```bash
   aws secretsmanager create-secret \
     --name global-gaming-platform/cognito/client-secret \
     --description "Cognito client credentials" \
     --secret-string '{"clientId":"<id>","clientSecret":"<secret>"}' \
     --region eu-west-2
   ```

7. Create OAuth secret (if needed):
   ```bash
   aws secretsmanager create-secret \
     --name global-gaming-platform/oauth/credentials \
     --description "OAuth client credentials" \
     --secret-string '{"clientId":"<id>","clientSecret":"<secret>"}' \
     --region eu-west-2
   ```

**Acceptance Criteria**:
- [ ] JWT secret created and verified
- [ ] Redis secret created and verified
- [ ] Cognito secret created and verified
- [ ] All secrets encrypted with KMS
- [ ] Secret ARNs documented

### Task 1.2: Create Shared Secret Manager Module
**Estimated Time**: 1 hour  
**Priority**: CRITICAL

**Steps**:
1. Create `src/shared/secrets/SecretManager.js`
2. Implement secret loading logic
3. Implement secret validation
4. Implement secret caching
5. Add rotation listener
6. Write unit tests
7. Document usage

**Acceptance Criteria**:
- [ ] SecretManager class implemented
- [ ] Loads secrets from Secrets Manager
- [ ] Validates required secrets present
- [ ] Fails fast on missing secrets
- [ ] Unit tests pass
- [ ] Documentation complete

### Task 1.3: Update Auth Service Configuration
**Estimated Time**: 30 minutes  
**Priority**: CRITICAL

**Steps**:
1. Update `src/auth-service/src/config/index.js`
2. Remove hardcoded JWT secret fallback
3. Integrate SecretManager
4. Update service startup to load secrets
5. Add secret validation on startup
6. Update environment variables in ECS task definition

**Code Changes**:
```javascript
// Remove this:
jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production'

// Replace with:
const secretManager = new SecretManager(process.env.SECRET_ARN);
await secretManager.initialize();
const jwtSecret = secretManager.get('jwtSecret');
```

**Acceptance Criteria**:
- [ ] No hardcoded secrets
- [ ] SecretManager integrated
- [ ] Service fails fast if secrets missing
- [ ] Local testing passes
- [ ] ECS task definition updated

### Task 1.4: Update Game Engine Configuration
**Estimated Time**: 30 minutes  
**Priority**: CRITICAL

**Steps**:
1. Update `src/game-engine/src/config/index.js`
2. Remove hardcoded JWT secret fallback
3. Integrate SecretManager
4. Update service startup
5. Update ECS task definition

**Acceptance Criteria**:
- [ ] No hardcoded secrets
- [ ] SecretManager integrated
- [ ] Service fails fast if secrets missing
- [ ] Local testing passes
- [ ] ECS task definition updated

### Task 1.5: Update Leaderboard Service Configuration
**Estimated Time**: 20 minutes  
**Priority**: HIGH

**Steps**:
1. Update `src/leaderboard-service/src/config/index.js`
2. Integrate SecretManager for Redis password
3. Update service startup
4. Update ECS task definition

**Acceptance Criteria**:
- [ ] SecretManager integrated
- [ ] Redis password from Secrets Manager
- [ ] Local testing passes
- [ ] ECS task definition updated

### Task 1.6: Configure Secret Rotation
**Estimated Time**: 45 minutes  
**Priority**: MEDIUM

**Steps**:
1. Update Terraform security module
2. Add secret rotation configuration
3. Configure rotation Lambda (already exists)
4. Set rotation schedule (90 days)
5. Apply Terraform changes
6. Test rotation (manual trigger)

**Acceptance Criteria**:
- [ ] Rotation configured for JWT secret
- [ ] Rotation configured for Redis password
- [ ] Rotation Lambda deployed
- [ ] Manual rotation test successful
- [ ] Services handle rotation gracefully

### Task 1.7: Deploy Security Updates
**Estimated Time**: 1 hour  
**Priority**: CRITICAL

**Steps**:
1. Build new service images with SecretManager
2. Push images to ECR
3. Update ECS task definitions with secret ARNs
4. Deploy auth service (test first)
5. Verify auth service starts correctly
6. Deploy game engine
7. Deploy leaderboard service
8. Verify all services healthy
9. Test end-to-end functionality

**Acceptance Criteria**:
- [ ] All services deployed successfully
- [ ] All services healthy in ECS
- [ ] Services load secrets correctly
- [ ] No hardcoded secrets in logs
- [ ] Health checks passing

---

## Phase 2: Authentication Integration

### Task 2.1: Scale Up Auth Service
**Estimated Time**: 15 minutes  
**Priority**: HIGH

**Steps**:
1. Update Terraform: `desired_count = 2`
2. Apply Terraform changes
3. Verify 2 tasks running
4. Test auth service health endpoint
5. Verify ALB routing to auth service

**Acceptance Criteria**:
- [ ] Auth service scaled to 2 tasks
- [ ] Both tasks healthy
- [ ] ALB routing correctly
- [ ] Health checks passing


### Task 2.2: Create Frontend Auth Context
**Estimated Time**: 1 hour  
**Priority**: HIGH

**Steps**:
1. Create `src/frontend/src/contexts/AuthContext.jsx`
2. Implement auth state management
3. Add login/logout/register functions
4. Add token refresh logic
5. Add user info storage
6. Wrap App with AuthProvider

**Acceptance Criteria**:
- [ ] AuthContext created
- [ ] Auth state managed globally
- [ ] Token refresh automatic
- [ ] User info persisted
- [ ] Context accessible in all components

### Task 2.3: Create Login Page
**Estimated Time**: 1.5 hours  
**Priority**: HIGH

**Steps**:
1. Create `src/frontend/src/pages/LoginPage.jsx`
2. Create login form UI
3. Add form validation
4. Integrate with AuthContext
5. Add error handling
6. Add loading states
7. Add "Forgot Password" link
8. Add "Register" link
9. Style with CSS

**Acceptance Criteria**:
- [ ] Login form functional
- [ ] Form validation works
- [ ] Calls auth service API
- [ ] Stores JWT token
- [ ] Redirects on success
- [ ] Shows error messages
- [ ] Responsive design

### Task 2.4: Create Register Page
**Estimated Time**: 1.5 hours  
**Priority**: HIGH

**Steps**:
1. Create `src/frontend/src/pages/RegisterPage.jsx`
2. Create registration form UI
3. Add form validation (email, password strength)
4. Integrate with AuthContext
5. Add error handling
6. Add email confirmation message
7. Add "Login" link
8. Style with CSS

**Acceptance Criteria**:
- [ ] Registration form functional
- [ ] Password strength validation
- [ ] Email format validation
- [ ] Calls auth service API
- [ ] Shows confirmation message
- [ ] Redirects to login
- [ ] Shows error messages
- [ ] Responsive design

### Task 2.5: Create Protected Route Component
**Estimated Time**: 30 minutes  
**Priority**: HIGH

**Steps**:
1. Create `src/frontend/src/components/ProtectedRoute.jsx`
2. Check authentication status
3. Redirect to login if not authenticated
4. Allow access if authenticated
5. Update App.jsx routes

**Acceptance Criteria**:
- [ ] ProtectedRoute component created
- [ ] Checks auth status
- [ ] Redirects unauthenticated users
- [ ] Preserves intended destination
- [ ] Applied to game routes

### Task 2.6: Create Auth Service API Client
**Estimated Time**: 45 minutes  
**Priority**: HIGH

**Steps**:
1. Create `src/frontend/src/services/AuthService.js`
2. Implement login API call
3. Implement register API call
4. Implement logout API call
5. Implement token refresh API call
6. Implement get user info API call
7. Add error handling
8. Add request interceptors for JWT

**Acceptance Criteria**:
- [ ] All auth API calls implemented
- [ ] JWT token included in requests
- [ ] Error handling robust
- [ ] Token refresh automatic
- [ ] API client tested

### Task 2.7: Update Header with Auth UI
**Estimated Time**: 45 minutes  
**Priority**: MEDIUM

**Steps**:
1. Update `src/frontend/src/components/Header/Header.jsx`
2. Show login/register buttons when not authenticated
3. Show user info and logout when authenticated
4. Add user dropdown menu
5. Style updates

**Acceptance Criteria**:
- [ ] Auth status visible in header
- [ ] Login/register buttons shown
- [ ] User info displayed when logged in
- [ ] Logout button functional
- [ ] Responsive design

### Task 2.8: Integrate WebSocket Authentication
**Estimated Time**: 1 hour  
**Priority**: HIGH

**Steps**:
1. Update `src/frontend/src/services/WebSocketClient.js`
2. Include JWT token in WebSocket connection
3. Handle authentication errors
4. Reconnect with new token on refresh
5. Update game engine WebSocket handler to validate JWT

**Acceptance Criteria**:
- [ ] JWT sent with WebSocket connection
- [ ] Server validates JWT
- [ ] Unauthenticated connections rejected
- [ ] Token refresh handled
- [ ] Reconnection works

### Task 2.9: Test Authentication End-to-End
**Estimated Time**: 1 hour  
**Priority**: HIGH

**Steps**:
1. Test user registration flow
2. Test email confirmation (if enabled)
3. Test login flow
4. Test JWT token storage
5. Test protected routes
6. Test logout
7. Test token refresh
8. Test WebSocket authentication
9. Fix any bugs found

**Acceptance Criteria**:
- [ ] Registration works end-to-end
- [ ] Login works end-to-end
- [ ] Protected routes work
- [ ] Logout works
- [ ] Token refresh automatic
- [ ] WebSocket auth works
- [ ] No console errors

---

## Phase 3: Real-time Multiplayer Gaming

### Task 3.1: Update ALB for WebSocket Support
**Estimated Time**: 1 hour  
**Priority**: CRITICAL

**Steps**:
1. Update `infrastructure/terraform/modules/ecs/main.tf`
2. Add WebSocket target group with sticky sessions
3. Add WebSocket listener rule
4. Configure health checks
5. Increase idle timeout
6. Apply Terraform changes
7. Verify ALB configuration

**Terraform Changes**:
```hcl
# Add sticky sessions to target group
stickiness {
  type            = "lb_cookie"
  cookie_duration = 86400
  enabled         = true
}

# Add WebSocket listener rule
condition {
  http_header {
    http_header_name = "Upgrade"
    values           = ["websocket"]
  }
}
```

**Acceptance Criteria**:
- [ ] WebSocket target group created
- [ ] Sticky sessions enabled
- [ ] WebSocket listener rule added
- [ ] Health checks configured
- [ ] Terraform apply successful
- [ ] ALB configuration verified

### Task 3.2: Update Frontend WebSocket Configuration
**Estimated Time**: 30 minutes  
**Priority**: HIGH

**Steps**:
1. Create `src/frontend/.env.production`
2. Add WebSocket URL environment variable
3. Update `src/frontend/src/config.js`
4. Update WebSocket client to use config
5. Build and test

**Environment Variables**:
```bash
VITE_WS_URL=wss://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/ws
VITE_API_URL=https://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/api
```

**Acceptance Criteria**:
- [ ] Environment variables configured
- [ ] WebSocket URL dynamic
- [ ] API URL dynamic
- [ ] Works in dev and prod
- [ ] No hardcoded URLs

### Task 3.3: Implement Game Room Creation
**Estimated Time**: 2 hours  
**Priority**: HIGH

**Steps**:
1. Update `src/game-engine/src/game/GameEngine.js`
2. Add createGame method
3. Add game room management
4. Persist game to database
5. Return game ID and state
6. Add WebSocket handler for create_game
7. Test game creation

**Acceptance Criteria**:
- [ ] Games can be created
- [ ] Game ID generated
- [ ] Game persisted to database
- [ ] Creator added as player 1
- [ ] WebSocket message handled
- [ ] Game state returned

### Task 3.4: Implement Game Room Joining
**Estimated Time**: 2 hours  
**Priority**: HIGH

**Steps**:
1. Add joinGame method to GameEngine
2. Validate game exists and not full
3. Add player 2 to game
4. Update game status to "active"
5. Add WebSocket handler for join_game
6. Broadcast game start to both players
7. Test game joining

**Acceptance Criteria**:
- [ ] Players can join games
- [ ] Game validation works
- [ ] Player 2 added correctly
- [ ] Game status updated
- [ ] Both players notified
- [ ] Game state synchronized

### Task 3.5: Implement Move Synchronization
**Estimated Time**: 2 hours  
**Priority**: CRITICAL

**Steps**:
1. Update make_move WebSocket handler
2. Validate move (player's turn, valid position)
3. Update game state
4. Persist move to database
5. Check for winner
6. Broadcast move to opponent
7. Handle game completion
8. Test move synchronization

**Acceptance Criteria**:
- [ ] Moves validated correctly
- [ ] Game state updated
- [ ] Moves persisted
- [ ] Opponent receives move instantly
- [ ] Winner detection works
- [ ] Game completion handled
- [ ] < 200ms latency

### Task 3.6: Implement Matchmaking UI
**Estimated Time**: 2 hours  
**Priority**: HIGH

**Steps**:
1. Create `src/frontend/src/pages/MatchmakingPage.jsx`
2. Add "Create Game" button
3. Add "Join Game" with game ID input
4. Add "Quick Match" (find available game)
5. Show waiting room UI
6. Handle game start
7. Redirect to game page
8. Style UI

**Acceptance Criteria**:
- [ ] Users can create games
- [ ] Users can join by game ID
- [ ] Quick match finds games
- [ ] Waiting room shows status
- [ ] Redirects when game starts
- [ ] Responsive design

### Task 3.7: Update Game Page for Multiplayer
**Estimated Time**: 2 hours  
**Priority**: HIGH

**Steps**:
1. Update `src/frontend/src/pages/GamePage.jsx`
2. Remove local game logic
3. Use WebSocket for all moves
4. Show opponent info
5. Show whose turn it is
6. Handle disconnection
7. Handle reconnection
8. Show game result

**Acceptance Criteria**:
- [ ] All moves via WebSocket
- [ ] Opponent info displayed
- [ ] Turn indicator works
- [ ] Disconnection handled gracefully
- [ ] Reconnection works
- [ ] Game result shown
- [ ] No local game logic

### Task 3.8: Implement Disconnection Handling
**Estimated Time**: 1.5 hours  
**Priority**: HIGH

**Steps**:
1. Add disconnection detection in WebSocketManager
2. Start reconnection timeout (5 minutes)
3. Notify opponent of disconnection
4. Allow reconnection within timeout
5. Abandon game if timeout expires
6. Update UI to show disconnection status

**Acceptance Criteria**:
- [ ] Disconnection detected
- [ ] Opponent notified
- [ ] Reconnection allowed
- [ ] Timeout enforced
- [ ] Game abandoned if needed
- [ ] UI shows status

### Task 3.9: Test Real-time Multiplayer
**Estimated Time**: 2 hours  
**Priority**: CRITICAL

**Steps**:
1. Open two browsers (different machines if possible)
2. Login as different users
3. Create game in browser 1
4. Join game in browser 2
5. Play full game
6. Verify moves synchronized
7. Test disconnection/reconnection
8. Test game completion
9. Fix any bugs

**Acceptance Criteria**:
- [ ] Two players can play together
- [ ] Moves appear instantly
- [ ] Game state synchronized
- [ ] Disconnection handled
- [ ] Reconnection works
- [ ] Game completion works
- [ ] No errors or bugs

---

## Phase 4: Leaderboard Integration

### Task 4.1: Add Leaderboard Update Endpoint
**Estimated Time**: 1 hour  
**Priority**: HIGH

**Steps**:
1. Update `src/leaderboard-service/src/routes/leaderboard.js`
2. Add POST /update endpoint
3. Validate request data
4. Update winner stats
5. Update loser stats
6. Recalculate rankings
7. Invalidate cache
8. Return updated rankings

**Acceptance Criteria**:
- [ ] Endpoint created
- [ ] Request validation works
- [ ] Stats updated correctly
- [ ] Rankings recalculated
- [ ] Cache invalidated
- [ ] Response includes rankings

### Task 4.2: Integrate Game Engine with Leaderboard
**Estimated Time**: 1 hour  
**Priority**: HIGH

**Steps**:
1. Update `src/game-engine/src/game/GameEngine.js`
2. Add leaderboard service client
3. Call leaderboard on game completion
4. Handle leaderboard errors gracefully
5. Log leaderboard updates
6. Test integration

**Acceptance Criteria**:
- [ ] Game completion triggers leaderboard update
- [ ] API call made correctly
- [ ] Errors handled gracefully
- [ ] Logging in place
- [ ] Integration tested

### Task 4.3: Add Real-time Leaderboard Updates
**Estimated Time**: 45 minutes  
**Priority**: MEDIUM

**Steps**:
1. Update leaderboard service to broadcast updates
2. Add WebSocket event for leaderboard_updated
3. Update frontend to listen for updates
4. Update leaderboard UI without refresh
5. Test real-time updates

**Acceptance Criteria**:
- [ ] Leaderboard broadcasts updates
- [ ] Frontend receives updates
- [ ] UI updates automatically
- [ ] No page refresh needed
- [ ] Updates appear instantly

### Task 4.4: Add Player Statistics Tracking
**Estimated Time**: 1 hour  
**Priority**: MEDIUM

**Steps**:
1. Update database schema for detailed stats
2. Track games played, won, lost, drawn
3. Track win streaks
4. Track average game duration
5. Update stats on game completion
6. Display stats in UI

**Acceptance Criteria**:
- [ ] Database schema updated
- [ ] All stats tracked
- [ ] Stats updated correctly
- [ ] Stats displayed in UI
- [ ] Historical data preserved

### Task 4.5: Test Leaderboard Integration
**Estimated Time**: 1 hour  
**Priority**: HIGH

**Steps**:
1. Play complete game
2. Verify leaderboard updated
3. Check player stats updated
4. Verify rankings correct
5. Test multiple games
6. Verify real-time updates
7. Fix any bugs

**Acceptance Criteria**:
- [ ] Leaderboard updates on game completion
- [ ] Stats accurate
- [ ] Rankings correct
- [ ] Real-time updates work
- [ ] No errors

---

## Phase 5: Live Chat System

### Task 5.1: Add Chat Database Schema
**Estimated Time**: 30 minutes  
**Priority**: MEDIUM

**Steps**:
1. Create migration file
2. Add chat_messages table
3. Add indexes
4. Run migration
5. Verify schema

**Acceptance Criteria**:
- [ ] Table created
- [ ] Indexes added
- [ ] Migration successful
- [ ] Schema verified

### Task 5.2: Implement Chat Message Handlers
**Estimated Time**: 1.5 hours  
**Priority**: MEDIUM

**Steps**:
1. Update `src/game-engine/src/websocket/MessageHandler.js`
2. Add chat_message handler
3. Validate message
4. Filter profanity
5. Persist to database
6. Broadcast to game players
7. Add rate limiting

**Acceptance Criteria**:
- [ ] Chat handler implemented
- [ ] Messages validated
- [ ] Profanity filtered
- [ ] Messages persisted
- [ ] Broadcast works
- [ ] Rate limiting active

### Task 5.3: Create Chat UI Component
**Estimated Time**: 2 hours  
**Priority**: MEDIUM

**Steps**:
1. Create `src/frontend/src/components/GameChat/GameChat.jsx`
2. Create chat message list
3. Create chat input
4. Load chat history
5. Subscribe to new messages
6. Handle send message
7. Style component
8. Make responsive

**Acceptance Criteria**:
- [ ] Chat UI created
- [ ] Messages displayed
- [ ] Input functional
- [ ] History loaded
- [ ] Real-time messages work
- [ ] Styled nicely
- [ ] Responsive

### Task 5.4: Integrate Chat with Game Page
**Estimated Time**: 30 minutes  
**Priority**: MEDIUM

**Steps**:
1. Update `src/frontend/src/pages/GamePage.jsx`
2. Add GameChat component
3. Position chat appropriately
4. Pass game ID to chat
5. Test integration

**Acceptance Criteria**:
- [ ] Chat visible in game
- [ ] Positioned correctly
- [ ] Game ID passed
- [ ] Chat functional
- [ ] No layout issues

### Task 5.5: Implement Profanity Filtering
**Estimated Time**: 1 hour  
**Priority**: LOW

**Steps**:
1. Create `src/game-engine/src/utils/profanityFilter.js`
2. Load bad words list
3. Implement filtering logic
4. Mark filtered messages
5. Test filtering
6. Integrate with chat handler

**Acceptance Criteria**:
- [ ] Filter implemented
- [ ] Bad words replaced
- [ ] Filtered messages marked
- [ ] Testing complete
- [ ] Integrated with chat

### Task 5.6: Test Chat System
**Estimated Time**: 1 hour  
**Priority**: MEDIUM

**Steps**:
1. Open two browsers
2. Start game
3. Send chat messages
4. Verify messages appear
5. Test profanity filtering
6. Test chat history
7. Test rate limiting
8. Fix any bugs

**Acceptance Criteria**:
- [ ] Messages delivered instantly
- [ ] Both players see messages
- [ ] Profanity filtered
- [ ] History persists
- [ ] Rate limiting works
- [ ] No errors

---

## Final Testing & Deployment

### Task 6.1: End-to-End Testing
**Estimated Time**: 3 hours  
**Priority**: CRITICAL

**Test Scenarios**:
1. Complete user journey:
   - Register account
   - Login
   - Create game
   - Wait for opponent
   - Play game
   - Chat during game
   - Complete game
   - Check leaderboard
   - Logout

2. Multi-player scenarios:
   - Two players full game
   - Disconnection/reconnection
   - Multiple concurrent games
   - Chat between players

3. Edge cases:
   - Invalid moves
   - Network interruptions
   - Token expiry
   - Service failures

**Acceptance Criteria**:
- [ ] All scenarios pass
- [ ] No critical bugs
- [ ] Performance acceptable
- [ ] Error handling works

### Task 6.2: Performance Testing
**Estimated Time**: 2 hours  
**Priority**: HIGH

**Tests**:
1. Load test: 100 concurrent WebSocket connections
2. Stress test: 50 concurrent games
3. Latency test: Move propagation time
4. Throughput test: Messages per second

**Acceptance Criteria**:
- [ ] 100+ concurrent connections supported
- [ ] 50+ concurrent games supported
- [ ] Move latency < 200ms
- [ ] No performance degradation

### Task 6.3: Security Testing
**Estimated Time**: 2 hours  
**Priority**: HIGH

**Tests**:
1. JWT token validation
2. WebSocket authentication
3. SQL injection attempts
4. XSS attempts
5. Rate limiting
6. Secret exposure check

**Acceptance Criteria**:
- [ ] All auth checks pass
- [ ] No SQL injection possible
- [ ] No XSS vulnerabilities
- [ ] Rate limiting works
- [ ] No secrets exposed

### Task 6.4: Production Deployment
**Estimated Time**: 2 hours  
**Priority**: CRITICAL

**Steps**:
1. Create production deployment plan
2. Schedule maintenance window
3. Backup database
4. Deploy infrastructure changes (ALB)
5. Deploy service updates
6. Deploy frontend
7. Run smoke tests
8. Monitor for issues
9. Rollback if needed

**Acceptance Criteria**:
- [ ] Deployment plan approved
- [ ] Database backed up
- [ ] All services deployed
- [ ] Smoke tests pass
- [ ] No critical errors
- [ ] Monitoring active

### Task 6.5: Documentation Updates
**Estimated Time**: 2 hours  
**Priority**: MEDIUM

**Documents to Update**:
1. README.md - Current features
2. docs/DEPLOYMENT.md - New deployment steps
3. docs/ARCHITECTURE.md - Updated architecture
4. docs/API.md - New endpoints
5. docs/WEBSOCKET_API.md - WebSocket protocol
6. docs/AUTHENTICATION.md - Auth flow
7. docs/TROUBLESHOOTING.md - Common issues

**Acceptance Criteria**:
- [ ] All docs updated
- [ ] Accurate and current
- [ ] Examples included
- [ ] Troubleshooting guide complete

---

## Summary

**Total Estimated Time**: 50-60 hours

**Phase Breakdown**:
- Phase 0 (Cleanup): 2.5 hours
- Phase 1 (Security): 5 hours
- Phase 2 (Authentication): 9 hours
- Phase 3 (Real-time Gaming): 15 hours
- Phase 4 (Leaderboard): 5 hours
- Phase 5 (Chat): 7 hours
- Final Testing: 9 hours
- Documentation: 2 hours

**Critical Path**:
1. Cleanup → Security → Authentication → Real-time Gaming → Testing

**Parallel Work Possible**:
- Leaderboard integration (after Phase 3)
- Chat system (after Phase 3)
- Documentation (ongoing)

**Risk Mitigation**:
- Each phase has rollback plan
- Testing after each phase
- Git branches for each feature
- Incremental deployment
