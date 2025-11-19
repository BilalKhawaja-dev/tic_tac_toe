#!/bin/bash

# Local Services Testing Script
# Tests all services running locally via Docker Compose

set -e

echo "=========================================="
echo "Local Services Testing"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test a service
test_service() {
    local service_name=$1
    local port=$2
    local expected_service=$3
    
    echo -e "\nTesting ${YELLOW}$service_name${NC} on port $port..."
    
    # Test if port is responding
    if ! curl -s --connect-timeout 5 http://localhost:$port/health > /dev/null; then
        echo -e "${RED}❌ $service_name not responding on port $port${NC}"
        return 1
    fi
    
    # Get health response
    response=$(curl -s http://localhost:$port/health)
    
    # Check if response contains expected service name
    if echo "$response" | grep -q "$expected_service"; then
        echo -e "${GREEN}✅ $service_name is healthy${NC}"
        
        # Show key info from response
        if command -v jq &> /dev/null; then
            echo "   Status: $(echo "$response" | jq -r '.status // "unknown"')"
            echo "   Version: $(echo "$response" | jq -r '.version // "unknown"')"
            if echo "$response" | jq -e '.dependencies' > /dev/null 2>&1; then
                echo "   Dependencies: $(echo "$response" | jq -c '.dependencies')"
            fi
        fi
        return 0
    else
        echo -e "${RED}❌ $service_name returned unexpected response${NC}"
        echo "Response: $response"
        return 1
    fi
}

# Function to test frontend
test_frontend() {
    echo -e "\nTesting ${YELLOW}Frontend${NC} on port 8080..."
    
    # Test if port is responding
    if ! curl -s --connect-timeout 5 http://localhost:8080 > /dev/null; then
        echo -e "${RED}❌ Frontend not responding on port 8080${NC}"
        return 1
    fi
    
    # Test health endpoint
    if curl -s --connect-timeout 5 http://localhost:8080/health > /dev/null; then
        echo -e "${GREEN}✅ Frontend is responding${NC}"
        echo "   Health endpoint: Available"
    else
        echo -e "${YELLOW}⚠️ Frontend responding but no health endpoint${NC}"
    fi
    
    # Test if it returns HTML
    response=$(curl -s http://localhost:8080)
    if echo "$response" | grep -q "<html\|<HTML"; then
        echo -e "${GREEN}✅ Frontend serving HTML content${NC}"
        return 0
    else
        echo -e "${RED}❌ Frontend not serving HTML content${NC}"
        echo "Response preview: $(echo "$response" | head -c 200)..."
        return 1
    fi
}

# Check if Docker Compose is running
echo "Checking Docker Compose status..."
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${RED}❌ No services appear to be running${NC}"
    echo "Please start services with: docker-compose up -d"
    exit 1
fi

echo -e "${GREEN}✅ Docker Compose services are running${NC}"

# Show running containers
echo -e "\n${YELLOW}Running containers:${NC}"
docker-compose ps

# Test each service
echo -e "\n${YELLOW}Testing service health endpoints...${NC}"

failed_tests=0

# Test Game Engine
if ! test_service "Game Engine" 3000 "game-engine"; then
    ((failed_tests++))
fi

# Test Auth Service
if ! test_service "Auth Service" 3001 "auth-service"; then
    ((failed_tests++))
fi

# Test Leaderboard Service
if ! test_service "Leaderboard Service" 3002 "Leaderboard"; then
    ((failed_tests++))
fi

# Test Frontend
if ! test_frontend; then
    ((failed_tests++))
fi

# Test database connectivity
echo -e "\n${YELLOW}Testing database connectivity...${NC}"
if docker-compose exec -T postgres psql -U postgres -d gaming_platform -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is accessible${NC}"
else
    echo -e "${RED}❌ PostgreSQL connection failed${NC}"
    ((failed_tests++))
fi

# Test Redis connectivity
echo -e "\n${YELLOW}Testing Redis connectivity...${NC}"
if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}✅ Redis is accessible${NC}"
else
    echo -e "${RED}❌ Redis connection failed${NC}"
    ((failed_tests++))
fi

# Summary
echo -e "\n=========================================="
if [ $failed_tests -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ All services are healthy and responding${NC}"
    echo -e "${GREEN}✅ Database and cache are accessible${NC}"
    echo ""
    echo "You can now:"
    echo "  • Open http://localhost:8080 in your browser"
    echo "  • Test the application functionality"
    echo "  • Run automated tests"
    echo "  • Proceed with AWS deployment when ready"
else
    echo -e "${RED}❌ $failed_tests test(s) failed${NC}"
    echo ""
    echo "To troubleshoot:"
    echo "  • Check logs: docker-compose logs -f"
    echo "  • Check specific service: docker-compose logs [service-name]"
    echo "  • Restart services: docker-compose restart"
    echo "  • Clean restart: docker-compose down -v && docker-compose up -d"
fi
echo "=========================================="

exit $failed_tests
