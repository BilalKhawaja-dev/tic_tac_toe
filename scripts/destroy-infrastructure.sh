#!/bin/bash

# Destroy AWS Infrastructure
# WARNING: This will delete all resources created by Terraform

set -e

echo "=========================================="
echo "AWS Infrastructure Destruction"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will destroy all AWS resources!"
echo "⚠️  This action cannot be undone!"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Destruction cancelled."
    exit 0
fi

echo ""
echo "Starting infrastructure destruction..."
echo ""

cd infrastructure/terraform/environments/dev

# Run terraform destroy
echo "Running terraform destroy..."
terraform destroy -auto-approve

echo ""
echo "=========================================="
echo "Infrastructure Destroyed"
echo "=========================================="
echo ""
echo "All AWS resources have been destroyed."
echo "You can now test locally using docker-compose."
