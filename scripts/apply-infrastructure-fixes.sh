#!/bin/bash
# Apply Infrastructure Fixes
# This script applies the Terraform fixes to resolve deployment errors

set -e

echo "🔧 Applying Infrastructure Fixes..."
echo "=================================="
echo ""

# Change to terraform directory
cd infrastructure/terraform/environments/dev

# Check if credentials are set
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "❌ Error: AWS_ACCESS_KEY_ID not set"
    echo "Please export AWS credentials before running this script"
    exit 1
fi

echo "✅ AWS credentials detected"
echo "📋 Running terraform apply..."
echo ""

# Apply terraform changes
terraform apply -auto-approve 2>&1 | tee terraform-apply-fixes.log

# Check result
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Infrastructure fixes applied successfully!"
    echo ""
    echo "📊 Checking deployment status..."
    terraform state list | wc -l | xargs echo "Resources deployed:"
else
    echo ""
    echo "❌ Deployment failed. Check terraform-apply-fixes.log for details"
    exit 1
fi
