# 🚀 Quick Start Guide

## One-Line Start
```bash
docker-compose up -d && sleep 10 && ./scripts/test-local-services.sh
```

## Service URLs
- **Frontend**: http://localhost:8080
- **Game Engine**: http://localhost:3000/health
- **Auth Service**: http://localhost:3001/health
- **Leaderboard**: http://localhost:3002/health

## Common Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f
```

### Test Services
```bash
./scripts/test-local-services.sh
```

### Restart a Service
```bash
docker-compose restart [service-name]
```

### Clean Restart
```bash
docker-compose down -v && docker-compose up -d
```

## Status Check
```bash
docker-compose ps
```

## Troubleshooting

### Service Won't Start
```bash
docker-compose logs [service-name]
docker-compose restart [service-name]
```

### Database Issues
```bash
docker-compose exec postgres psql -U postgres -d gaming_platform
```

### Redis Issues
```bash
docker-compose exec redis redis-cli ping
```

### Rebuild Everything
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Files Modified This Session
1. `src/auth-service/src/index.js` - Fixed session config
2. `src/leaderboard-service/src/database/RankingManager.js` - Added logger
3. `src/leaderboard-service/src/config/index.js` - Added cron config
4. `scripts/test-local-services.sh` - Updated tests

## All Services Healthy ✅
- Game Engine ✅
- Auth Service ✅
- Leaderboard ✅
- Frontend ✅
- PostgreSQL ✅
- Redis ✅

**Ready to test at http://localhost:8080!**
