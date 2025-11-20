#!/bin/bash

# Run schema update via ECS Exec on a running leaderboard service task

set -e

echo "Finding a running leaderboard service task..."

TASK_ARN=$(aws ecs list-tasks \
  --cluster global-gaming-platform-cluster \
  --service-name global-gaming-platform-leaderboard-service \
  --region eu-west-2 \
  --query 'taskArns[0]' \
  --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
  echo "No running tasks found!"
  exit 1
fi

echo "Found task: $TASK_ARN"

# Copy schema file to the task
echo "Copying schema file..."
cat src/leaderboard-service/sql/schema.sql | aws ecs execute-command \
  --cluster global-gaming-platform-cluster \
  --task "$TASK_ARN" \
  --container leaderboard-service \
  --region eu-west-2 \
  --interactive \
  --command "cat > /tmp/schema.sql"

# Run the schema
echo "Applying schema..."
aws ecs execute-command \
  --cluster global-gaming-platform-cluster \
  --task "$TASK_ARN" \
  --container leaderboard-service \
  --region eu-west-2 \
  --interactive \
  --command "node -e \"
const { Pool } = require('pg');
const fs = require('fs');
const config = require('./src/config');

async function applySchema() {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: String(config.database.password),
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false
  });
  
  const schema = fs.readFileSync('/tmp/schema.sql', 'utf8');
  await pool.query(schema);
  console.log('Schema applied successfully!');
  await pool.end();
}

applySchema().catch(console.error);
\""

echo "Done!"
