#!/bin/bash

# Apply full leaderboard schema to database
# This adds the materialized views and stored procedures

set -e

echo "Applying leaderboard schema to database..."

# Get database credentials from AWS Secrets Manager
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id global-gaming-platform/database/credentials \
  --region eu-west-2 \
  --query SecretString \
  --output text)

DB_HOST=$(echo $DB_SECRET | jq -r '.host')
DB_PORT=$(echo $DB_SECRET | jq -r '.port')
DB_NAME=$(echo $DB_SECRET | jq -r '.dbname')
DB_USER=$(echo $DB_SECRET | jq -r '.username')
DB_PASSWORD=$(echo $DB_SECRET | jq -r '.password')

# If host is empty, get it from RDS
if [ -z "$DB_HOST" ] || [ "$DB_HOST" = "null" ]; then
  echo "Host not in secret, fetching from RDS..."
  DB_HOST=$(aws rds describe-db-clusters \
    --db-cluster-identifier global-gaming-platform-aurora-cluster \
    --region eu-west-2 \
    --query 'DBClusters[0].Endpoint' \
    --output text)
fi

echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"

# Apply the schema using Docker
echo "Applying schema.sql..."
docker run --rm -i \
  -e PGPASSWORD="$DB_PASSWORD" \
  -v "$(pwd)/src/leaderboard-service/sql:/sql" \
  postgres:15-alpine \
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /sql/schema.sql

echo "Schema applied successfully!"

# Test the function
echo "Testing refresh_all_leaderboards function..."
docker run --rm -i \
  -e PGPASSWORD="$DB_PASSWORD" \
  postgres:15-alpine \
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT refresh_all_leaderboards();"

echo "All done!"
