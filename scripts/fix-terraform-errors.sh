#!/bin/bash
# Script to fix Terraform deployment errors

set -e

echo "Fixing Terraform deployment errors..."

cd infrastructure/terraform/environments/dev

# 1. Import existing subnet groups
echo "Importing existing subnet groups..."
terraform import 'module.database.aws_elasticache_subnet_group.main' 'global-gaming-platform-cache-subnet-group' 2>/dev/null || echo "ElastiCache subnet group already imported or doesn't exist"
terraform import 'module.database.aws_dax_subnet_group.main' 'global-gaming-platform-dax-subnet-group' 2>/dev/null || echo "DAX subnet group already imported or doesn't exist"

echo "Fixes applied. Run terraform apply again."
