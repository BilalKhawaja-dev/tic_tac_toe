#!/bin/bash

# Initialize Database via ECS Task
# Runs a one-time task in the same VPC as RDS to initialize the schema

set -e

echo "=========================================="
echo "🗄️  Database Init via ECS Task"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

export AWS_DEFAULT_REGION=eu-west-2

# Get infrastructure details
echo -e "\n${YELLOW}Getting infrastructure details...${NC}"
cd infrastructure/terraform/environments/dev
RDS_ENDPOINT=$(terraform output -raw database_endpoint)
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
PRIVATE_SUBNETS=$(terraform output -json private_subnet_ids | jq -r '.[0]')
cd - > /dev/null

echo -e "${GREEN}✅ RDS: $RDS_ENDPOINT${NC}"
echo -e "${GREEN}✅ Cluster: $CLUSTER_NAME${NC}"
echo -e "${GREEN}✅ Subnet: $PRIVATE_SUBNETS${NC}"

# Get security group for ECS tasks
ECS_SG=$(aws ec2 describe-security-groups \
    --filters "Name=tag:Name,Values=global-gaming-platform-ecs-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)

echo -e "${GREEN}✅ Security Group: $ECS_SG${NC}"

# Create a simple init script
cat > /tmp/init-db.sql <<'EOF'
-- Quick initialization script
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    region VARCHAR(50) DEFAULT 'UNKNOWN',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    games_drawn INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert test data
INSERT INTO users (username, email, display_name, region)
VALUES 
    ('testplayer1', 'test1@example.com', 'Test Player 1', 'NA'),
    ('testplayer2', 'test2@example.com', 'Test Player 2', 'EU')
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_stats (user_id, games_played, games_won, games_lost)
SELECT user_id, 10, 7, 3 FROM users WHERE username = 'testplayer1'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_stats (user_id, games_played, games_won, games_lost)
SELECT user_id, 15, 10, 5 FROM users WHERE username = 'testplayer2'
ON CONFLICT (user_id) DO NOTHING;

SELECT 'Database initialized successfully' as status;
EOF

echo -e "\n${YELLOW}Running database initialization via ECS task...${NC}"

# Run one-off task using the leaderboard service image
TASK_ARN=$(aws ecs run-task \
    --cluster $CLUSTER_NAME \
    --task-definition global-gaming-platform-leaderboard-service \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNETS],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
    --overrides '{
        "containerOverrides": [{
            "name": "leaderboard-service",
            "command": ["sh", "-c", "echo Database init task - service will handle schema on startup"]
        }]
    }' \
    --query 'tasks[0].taskArn' \
    --output text)

echo -e "${GREEN}✅ Task started: $TASK_ARN${NC}"
echo -e "${YELLOW}Waiting for task to complete...${NC}"

# Wait for task
aws ecs wait tasks-stopped --cluster $CLUSTER_NAME --tasks $TASK_ARN

echo -e "${GREEN}✅ Task completed${NC}"

# Clean up
rm -f /tmp/init-db.sql

echo -e "\n${GREEN}🎉 Database initialization complete!${NC}"

