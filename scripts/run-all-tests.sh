#!/bin/bash

# Comprehensive Test Runner for Global Gaming Platform
# Runs all tests across all services and components

set -e

echo "=========================================="
echo "Global Gaming Platform - Comprehensive Test Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run tests for a service
run_service_tests() {
    local service_name=$1
    local service_path=$2
    
    echo "=========================================="
    echo "Testing: $service_name"
    echo "=========================================="
    
    if [ ! -d "$service_path" ]; then
        echo -e "${YELLOW}⚠ Skipping $service_name - directory not found${NC}"
        return
    fi
    
    cd "$service_path"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${YELLOW}⚠ Skipping $service_name - no package.json found${NC}"
        cd - > /dev/null
        return
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies for $service_name..."
        npm install --silent
    fi
    
    # Run tests
    if npm test -- --passWithNoTests 2>&1 | tee test-output.log; then
        echo -e "${GREEN}✓ $service_name tests passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ $service_name tests failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Clean up
    rm -f test-output.log
    cd - > /dev/null
    echo ""
}

# Function to validate Terraform files
validate_terraform() {
    local module_name=$1
    local module_path=$2
    
    echo "=========================================="
    echo "Validating Terraform: $module_name"
    echo "=========================================="
    
    if [ ! -d "$module_path" ]; then
        echo -e "${YELLOW}⚠ Skipping $module_name - directory not found${NC}"
        return
    fi
    
    cd "$module_path"
    
    # Check if Terraform files exist
    if ! ls *.tf 1> /dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Skipping $module_name - no .tf files found${NC}"
        cd - > /dev/null
        return
    fi
    
    # Initialize and validate
    if terraform init -backend=false > /dev/null 2>&1 && terraform validate > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $module_name Terraform validation passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ $module_name Terraform validation failed${NC}"
        terraform validate
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    cd - > /dev/null
    echo ""
}

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Project Root: $PROJECT_ROOT"
echo ""

# ============================================================================
# 1. MICROSERVICES TESTS
# ============================================================================

echo "=========================================="
echo "PHASE 1: Microservices Unit & Integration Tests"
echo "=========================================="
echo ""

run_service_tests "Auth Service" "src/auth-service"
run_service_tests "Game Engine" "src/game-engine"
run_service_tests "Leaderboard Service" "src/leaderboard-service"
run_service_tests "Support Service" "src/support-service"

# ============================================================================
# 2. API INTEGRATION TESTS
# ============================================================================

echo "=========================================="
echo "PHASE 2: API Integration Tests"
echo "=========================================="
echo ""

run_service_tests "API Integration Tests" "tests/api-integration"

# ============================================================================
# 3. FRONTEND TESTS
# ============================================================================

echo "=========================================="
echo "PHASE 3: Frontend Tests"
echo "=========================================="
echo ""

run_service_tests "Frontend Application" "src/frontend"

# ============================================================================
# 4. INFRASTRUCTURE VALIDATION
# ============================================================================

echo "=========================================="
echo "PHASE 4: Infrastructure Validation"
echo "=========================================="
echo ""

# Check if Terraform is installed
if command -v terraform &> /dev/null; then
    validate_terraform "Network Module" "infrastructure/terraform/modules/network"
    validate_terraform "Security Module" "infrastructure/terraform/modules/security"
    validate_terraform "Database Module" "infrastructure/terraform/modules/database"
    validate_terraform "Auth Module" "infrastructure/terraform/modules/auth"
    validate_terraform "ECS Module" "infrastructure/terraform/modules/ecs"
    validate_terraform "Monitoring Module" "infrastructure/terraform/modules/monitoring"
    validate_terraform "AppConfig Module" "infrastructure/terraform/modules/appconfig"
    validate_terraform "API Gateway Module" "infrastructure/terraform/modules/api-gateway"
else
    echo -e "${YELLOW}⚠ Terraform not installed - skipping infrastructure validation${NC}"
    echo ""
fi

# ============================================================================
# 5. CONFIGURATION VALIDATION
# ============================================================================

echo "=========================================="
echo "PHASE 5: Configuration Validation"
echo "=========================================="
echo ""

# Validate JSON configuration files
echo "Validating configuration files..."

validate_json() {
    local file=$1
    if [ -f "$file" ]; then
        if python3 -m json.tool "$file" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Valid JSON: $file${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}✗ Invalid JSON: $file${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
    fi
}

validate_json "configs/app-settings-development.json"
validate_json "configs/feature-flags-development.json"

echo ""

# ============================================================================
# 6. DOCUMENTATION VALIDATION
# ============================================================================

echo "=========================================="
echo "PHASE 6: Documentation Validation"
echo "=========================================="
echo ""

# Check for required documentation files
check_doc() {
    local file=$1
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ Found: $file${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ Missing: $file${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

check_doc "README.md"
check_doc "docs/architecture-review.md"
check_doc "docs/security-compliance-checklist.md"
check_doc "docs/development/local-setup.md"
check_doc "docs/configuration-management.md"

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}=========================================="
    echo "✓ ALL TESTS PASSED!"
    echo -e "==========================================${NC}"
    exit 0
else
    echo -e "${RED}=========================================="
    echo "✗ SOME TESTS FAILED"
    echo -e "==========================================${NC}"
    exit 1
fi
