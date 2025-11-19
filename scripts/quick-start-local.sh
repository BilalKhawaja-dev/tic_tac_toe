#!/bin/bash

# Quick Start Local Development Script
# Starts all services and runs basic tests

set -e

echo "=========================================="
echo "🚀 Quick Start - Local Development"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Cleaning up any existing containers...${NC}"
docker-compose down -v

echo -e "\n${YELLOW}Step 2: Building and starting all services...${NC}"
docker-compose up --build -d

echo -e "\n${YELLOW}Step 3: Waiting for services to start...${NC}"
sleep 30

echo -e "\n${YELLOW}Step 4: Checking service status...${NC}"
docker-compose ps

echo -e "\n${YELLOW}Step 5: Testing services...${NC}"
if ./scripts/test-local-services.sh; then
    echo -e "\n${GREEN}🎉 SUCCESS! All services are running and healthy.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Open http://localhost:8080 in your browser"
    echo "  2. Test the application functionality"
    echo "  3. Check logs if needed: docker-compose logs -f"
    echo "  4. When ready, deploy to AWS using the deployment guides"
    echo ""
    echo "Key URLs:"
    echo "  • Frontend:     http://localhost:8080"
    echo "  • Game Engine:  http://localhost:3000/health"
    echo "  • Auth Service: http://localhost:3001/health"
    echo "  • Leaderboard:  http://localhost:3002/health"
else
    echo -e "\n${RED}❌ Some services failed to start properly.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  • Check logs: docker-compose logs -f"
    echo "  • Check specific service: docker-compose logs [service-name]"
    echo "  • Try restarting: docker-compose restart"
    echo ""
    echo "Common issues:"
    echo "  • Port conflicts: Make sure ports 3000-3002, 8080, 5432, 6379 are free"
    echo "  • Docker resources: Ensure Docker has enough memory/CPU"
    echo "  • Build issues: Check Dockerfile syntax and dependencies"
    
    echo -e "\n${YELLOW}Showing recent logs for debugging:${NC}"
    docker-compose logs --tail=20
fi

echo -e "\n=========================================="
echo "Quick Start Complete"
echo "=========================================="
