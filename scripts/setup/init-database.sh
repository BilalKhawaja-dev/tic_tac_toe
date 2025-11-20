#!/bin/bash

# Initialize Database Schema
# Uses Docker to run psql commands against RDS

set -e

echo "=========================================="
echo "🗄️  Database Initialization Script"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get RDS endpoint from Terraform
echo -e "\n${YELLOW}Getting RDS endpoint...${NC}"
cd infrastructure/terraform/environments/dev
RDS_ENDPOINT=$(terraform output -raw database_endpoint)
cd - > /dev/null

if [ -z "$RDS_ENDPOINT" ]; then
    echo -e "${RED}❌ Could not get RDS endpoint${NC}"
    exit 1
fi

echo -e "${GREEN}✅ RDS Endpoint: $RDS_ENDPOINT${NC}"

# Database credentials
DB_NAME="gaming_platform"
DB_USER="postgres"
DB_PASSWORD="postgres"  # This should match your Terraform configuration

echo -e "\n${YELLOW}Testing database connection...${NC}"

# Test connection using Docker
if docker run --rm postgres:15-alpine psql \
    "postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}" \
    -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Please check:"
    echo "  1. RDS security group allows connections from your IP"
    echo "  2. Database credentials are correct"
    echo "  3. Database is running"
    exit 1
fi

# Create base schema
echo -e "\n${YELLOW}Creating base schema (users, user_stats)...${NC}"
docker run --rm -v $(pwd)/src/leaderboard-service/sql:/sql postgres:15-alpine \
    psql "postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}" \
    -f /sql/base-schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Base schema created${NC}"
else
    echo -e "${RED}❌ Failed to create base schema${NC}"
    exit 1
fi

# Create leaderboard schema
echo -e "\n${YELLOW}Creating leaderboard schema (views, functions)...${NC}"
docker run --rm -v $(pwd)/src/leaderboard-service/sql:/sql postgres:15-alpine \
    psql "postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}" \
    -f /sql/schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Leaderboard schema created${NC}"
else
    echo -e "${RED}❌ Failed to create leaderboard schema${NC}"
    exit 1
fi

# Verify tables were created
echo -e "\n${YELLOW}Verifying tables...${NC}"
TABLES=$(docker run --rm postgres:15-alpine \
    psql "postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo -e "${GREEN}✅ Found $TABLES tables${NC}"

# List all tables
echo -e "\n${YELLOW}Database tables:${NC}"
docker run --rm postgres:15-alpine \
    psql "postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}" \
    -c "\dt"

# List materialized views
echo -e "\n${YELLOW}Materialized views:${NC}"
docker run --rm postgres:15-alpine \
    psql "postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}" \
    -c "\dm"

echo -e "\n${GREEN}🎉 Database initialization complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Restart the leaderboard service:"
echo "   aws ecs update-service --cluster global-gaming-platform-cluster --service global-gaming-platform-leaderboard-service --force-new-deployment --region eu-west-2"
echo ""
echo "2. Wait 30 seconds and test:"
echo "   curl http://global-gaming-platform-alb-868116091.eu-west-2.elb.amazonaws.com/api/leaderboard/health"

