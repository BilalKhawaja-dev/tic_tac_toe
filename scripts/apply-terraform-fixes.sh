#!/bin/bash

# Terraform Apply Script with Monitoring
# This script applies Terraform changes and monitors the deployment

set -e

echo "=========================================="
echo "Terraform Deployment - Applying Fixes"
echo "=========================================="
echo ""

# Change to terraform directory
cd infrastructure/terraform/environments/dev

echo "Step 1: Validating Terraform configuration..."
terraform validate
if [ $? -ne 0 ]; then
    echo "❌ Validation failed!"
    exit 1
fi
echo "✅ Validation successful"
echo ""

echo "Step 2: Running terraform plan..."
terraform plan -out=tfplan.out
if [ $? -ne 0 ]; then
    echo "❌ Plan failed!"
    exit 1
fi
echo "✅ Plan created successfully"
echo ""

echo "Step 3: Applying Terraform changes..."
echo "This may take 10-15 minutes..."
echo ""

# Apply with auto-approve and show output
terraform apply tfplan.out

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Terraform Apply Completed Successfully!"
    echo "=========================================="
    echo ""
    
    echo "Checking resource count..."
    RESOURCE_COUNT=$(terraform state list | wc -l)
    echo "Total resources in state: $RESOURCE_COUNT"
    echo ""
    
    echo "Getting outputs..."
    terraform output
    
else
    echo ""
    echo "=========================================="
    echo "❌ Terraform Apply Failed"
    echo "=========================================="
    echo ""
    echo "Check the error messages above for details."
    exit 1
fi
