# Local Testing Guide

## Step 1: Destroy AWS Infrastructure

To avoid costs, destroy all AWS resources:

```bash
chmod +x scripts/destroy-infrastructure.sh
./scripts/destroy-infrastructure.sh
```

This will:
- Destroy all ECS services, tasks, and cluster
- Delete ALB and target groups
- Remove RDS Aurora cluster
- Delete ElastiCache Redis
- Remove all other Terraform-managed resources

**Note**: Type `yes` when prompted to confirm destruction.

## Step 2: Set Up Local Environment

### Prerequisites

Ensure you have installed:
- Docker Desktop (or Docker Engine + Docker Compose)
- Node.js 18+ (for local development without Docker)

### Start All Services

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up --build -d
```

This will start:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **Game Engine** on port 3000
- **Auth Service** on port 3001
- **Leaderboard Service** on port 3002
- **Frontend** on port 8080

### Check Service Status

```bash
# View logs
docker-compose logs -f

# Check specific service
docker-compose logs -f leaderboard-service

# Check running containers
docker-compose ps
```

## Step 3: Verify Services

### Health Checks

```bash
# Game Engine
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# Leaderboard Service
curl http://localhost:3002/health

# Frontend
curl http://localhost:8080/health
```

### Access the Application

Open your browser and navigate to:
```
http://localhost:8080
```

You should see the gaming platform homepage.

## Step 4: Test Individual Services

### Test Game Engine

```bash
# Create a game
curl -X POST http://localhost:3000/api/games \
  -H "Content-Type: application/json" \
  -d '{"playerId": "test-player-1"}'

# Get game status
curl http://localhost:3000/api/games/{gameId}
```

### Test Leaderboard

```bash
# Get global leaderboard
curl http://localhost:3002/api/leaderboard/global

# Get regional leaderboard
curl http://localhost:3002/api/leaderboard/regional/NA
```

### Test Auth Service

```bash
# Get auth config
curl http://localhost:3001/api/auth/config

# Validate token (will fail without valid token, but tests endpoint)
curl -X POST http://localhost:3001/api/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "test-token"}'
```

## Step 5: Database Access

### Connect to PostgreSQL

```bash
# Using docker exec
docker-compose exec postgres psql -U postgres -d gaming_platform

# Or using psql client
psql -h localhost -U postgres -d gaming_platform
# Password: password
```

### Useful SQL Commands

```sql
-- List tables
\dt

-- Check leaderboard data
SELECT * FROM leaderboard LIMIT 10;

-- Check user data
SELECT * FROM users LIMIT 10;
```

### Connect to Redis

```bash
# Using docker exec
docker-compose exec redis redis-cli

# Test Redis
> PING
PONG

> KEYS *
```

## Step 6: Development Workflow

### Rebuild a Single Service

```bash
# Rebuild and restart leaderboard service
docker-compose up --build -d leaderboard-service

# View logs
docker-compose logs -f leaderboard-service
```

### Run Services Locally (Without Docker)

If you want to run a service locally for faster development:

```bash
# Stop the Docker service
docker-compose stop leaderboard-service

# Run locally
cd src/leaderboard-service
npm install
npm start

# The service will connect to Docker's PostgreSQL and Redis
```

### Hot Reload for Frontend

The frontend uses Vite which supports hot reload. However, in Docker it's disabled. For development:

```bash
# Stop Docker frontend
docker-compose stop frontend

# Run locally with hot reload
cd src/frontend
npm install
npm run dev
# Opens on http://localhost:5173
```

## Step 7: Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Restart all services
docker-compose restart

# Rebuild from scratch
docker-compose down -v
docker-compose up --build
```

### Database Connection Issues

```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the port
lsof -i :3000
lsof -i :5432

# Kill the process or change ports in docker-compose.yml
```

### Clear All Data

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Start fresh
docker-compose up --build
```

## Step 8: Running Tests

### Run All Tests

```bash
# Auth service tests
docker-compose exec auth-service npm test

# Leaderboard service tests
docker-compose exec leaderboard-service npm test

# Game engine tests
docker-compose exec game-engine npm test

# Frontend tests
docker-compose exec frontend npm test
```

### Run Tests Locally

```bash
# Auth service
cd src/auth-service
npm test

# With coverage
npm run test:coverage
```

## Step 9: Stop Services

### Stop All Services

```bash
# Stop but keep containers
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

## Common Issues and Solutions

### Issue: Leaderboard Service - "password must be a string"

**Solution**: Already fixed in docker-compose.yml. The service now receives `DB_PASSWORD` as a proper environment variable.

### Issue: Auth Service - "Cannot read properties of undefined (reading 'userPoolId')"

**Solution**: Auth service now has mock Cognito configuration for local development. It won't actually authenticate users but won't crash.

### Issue: Frontend Shows 502 Error

**Solution**: 
1. Check if backend services are running: `docker-compose ps`
2. Check backend logs: `docker-compose logs game-engine`
3. Verify environment variables in docker-compose.yml

### Issue: Database Schema Not Created

**Solution**:
```bash
# Recreate database with schema
docker-compose down -v
docker-compose up -d postgres
# Wait for PostgreSQL to be ready
sleep 10
docker-compose up -d
```

## Performance Tips

### Use Docker Compose Profiles

Add profiles to docker-compose.yml for different scenarios:

```bash
# Only run backend services
docker-compose --profile backend up

# Only run frontend
docker-compose --profile frontend up
```

### Limit Resource Usage

Edit docker-compose.yml to add resource limits:

```yaml
services:
  game-engine:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## Next Steps

Once local testing is complete and services are working:

1. Fix any remaining code issues
2. Update Terraform configuration with lessons learned
3. Re-deploy to AWS with corrected configuration
4. Implement proper CI/CD pipeline for automated testing

## Quick Reference

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart leaderboard-service

# Rebuild a service
docker-compose up --build -d leaderboard-service

# Stop everything
docker-compose down

# Clean everything
docker-compose down -v
```
