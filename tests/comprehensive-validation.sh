#!/bin/bash

# Comprehensive Validation Script
# Tests all components from infrastructure to application code

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

echo "========================================"
echo "COMPREHENSIVE VALIDATION SUITE"
echo "========================================"
echo "Started: $(date)"
echo ""

# Function to run test
run_test() {
  local test_name=$1
  local test_command=$2
  
  ((TOTAL_TESTS++))
  echo -n "Testing: $test_name... "
  
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED_TESTS++))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC}"
    ((FAILED_TESTS++))
    return 1
  fi
}

# Function to skip test
skip_test() {
  local test_name=$1
  local reason=$2
  
  ((TOTAL_TESTS++))
  ((SKIPPED_TESTS++))
  echo -e "Testing: $test_name... ${YELLOW}⊘ SKIPPED${NC} ($reason)"
}

echo -e "${BLUE}=== PHASE 1: Infrastructure Validation ===${NC}"
echo ""

# Terraform validation
run_test "Terraform modules exist" "test -d infrastructure/terraform/modules"
run_test "Network module" "test -f infrastructure/terraform/modules/network/main.tf"
run_test "Security module" "test -f infrastructure/terraform/modules/security/main.tf"
run_test "Database module" "test -f infrastructure/terraform/modules/database/main.tf"
run_test "ECS module" "test -f infrastructure/terraform/modules/ecs/main.tf"
run_test "Monitoring module" "test -f infrastructure/terraform/modules/monitoring/main.tf"
run_test "Auth module" "test -f infrastructure/terraform/modules/auth/main.tf"
run_test "API Gateway module" "test -f infrastructure/terraform/modules/api-gateway/main.tf"
run_test "AppConfig module" "test -f infrastructure/terraform/modules/appconfig/main.tf"
run_test "CI/CD module" "test -f infrastructure/terraform/modules/cicd/main.tf"

echo ""
echo -e "${BLUE}=== PHASE 2: Backend Services Validation ===${NC}"
echo ""

# Game Engine
run_test "Game Engine source exists" "test -d src/game-engine/src"
run_test "Game Engine package.json" "test -f src/game-engine/package.json"
run_test "Game Engine Dockerfile" "test -f src/game-engine/Dockerfile"
run_test "Game Engine tests" "test -d src/game-engine/tests"
run_test "GameEngine.js" "test -f src/game-engine/src/game/GameEngine.js"
run_test "GameState.js" "test -f src/game-engine/src/game/GameState.js"
run_test "GameValidator.js" "test -f src/game-engine/src/game/GameValidator.js"
run_test "WebSocketManager.js" "test -f src/game-engine/src/websocket/WebSocketManager.js"

# Auth Service
run_test "Auth Service source exists" "test -d src/auth-service/src"
run_test "Auth Service package.json" "test -f src/auth-service/package.json"
run_test "Auth Service tests" "test -d src/auth-service/tests"
run_test "UserService.js" "test -f src/auth-service/src/services/UserService.js"
run_test "JWTService.js" "test -f src/auth-service/src/services/JWTService.js"
run_test "CognitoService.js" "test -f src/auth-service/src/services/CognitoService.js"
run_test "Auth middleware" "test -f src/auth-service/src/middleware/auth.js"

# Leaderboard Service
run_test "Leaderboard Service source" "test -d src/leaderboard-service/src"
run_test "Leaderboard package.json" "test -f src/leaderboard-service/package.json"
run_test "Leaderboard tests" "test -d src/leaderboard-service/tests"
run_test "RankingManager.js" "test -f src/leaderboard-service/src/database/RankingManager.js"
run_test "LeaderboardCache.js" "test -f src/leaderboard-service/src/cache/LeaderboardCache.js"
run_test "Leaderboard SQL schema" "test -f src/leaderboard-service/sql/schema.sql"
run_test "Leaderboard SQL queries" "test -f src/leaderboard-service/sql/queries.sql"

# Support Service
run_test "Support Service source" "test -d src/support-service/src"
run_test "Support Service package.json" "test -f src/support-service/package.json"
run_test "Support Service tests" "test -d src/support-service/tests"
run_test "Ticket handler" "test -f src/support-service/src/handlers/ticketHandler.js"
run_test "FAQ handler" "test -f src/support-service/src/handlers/faqHandler.js"
run_test "Serverless config" "test -f src/support-service/serverless.yml"

echo ""
echo -e "${BLUE}=== PHASE 3: Frontend Validation ===${NC}"
echo ""

# Frontend structure
run_test "Frontend source exists" "test -d src/frontend/src"
run_test "Frontend package.json" "test -f src/frontend/package.json"
run_test "Frontend tests" "test -d src/frontend/src/__tests__ || test -f src/frontend/src/services/__tests__/WebSocketClient.test.js"
run_test "Vite config" "test -f src/frontend/vite.config.js"
run_test "Jest config" "test -f src/frontend/jest.config.js"

# Frontend components
run_test "GameBoard component" "test -f src/frontend/src/components/GameBoard/GameBoard.jsx"
run_test "PlayerStats component" "test -f src/frontend/src/components/PlayerStats/PlayerStats.jsx"
run_test "Leaderboard component" "test -f src/frontend/src/components/Leaderboard/Leaderboard.jsx"
run_test "WebSocketStatus component" "test -f src/frontend/src/components/WebSocketStatus/WebSocketStatus.jsx"
run_test "Header component" "test -f src/frontend/src/components/Header/Header.jsx"
run_test "Footer component" "test -f src/frontend/src/components/Footer/Footer.jsx"

# Frontend pages
run_test "HomePage" "test -f src/frontend/src/pages/HomePage.jsx"
run_test "GamePage" "test -f src/frontend/src/pages/GamePage.jsx"
run_test "LeaderboardPage" "test -f src/frontend/src/pages/LeaderboardPage.jsx"
run_test "SupportPage" "test -f src/frontend/src/pages/SupportPage.jsx"

# Frontend services
run_test "WebSocketClient" "test -f src/frontend/src/services/WebSocketClient.js"
run_test "ApiService" "test -f src/frontend/src/services/ApiService.js"
run_test "useWebSocket hook" "test -f src/frontend/src/hooks/useWebSocket.js"

echo ""
echo -e "${BLUE}=== PHASE 4: CI/CD Pipeline Validation ===${NC}"
echo ""

# CI/CD files
run_test "buildspec.yml" "test -f buildspec.yml"
run_test "buildspec-test.yml" "test -f buildspec-test.yml"
run_test "appspec.yml" "test -f appspec.yml"
run_test "Deploy script" "test -f scripts/deploy.sh && test -x scripts/deploy.sh"
run_test "Rollback script" "test -f scripts/rollback.sh && test -x scripts/rollback.sh"
run_test "Smoke tests script" "test -f scripts/smoke-tests.sh && test -x scripts/smoke-tests.sh"
run_test "Auto-rollback Lambda" "test -f infrastructure/terraform/modules/cicd/lambda/auto_rollback.js"
run_test "Snyk config" "test -f .snyk"

echo ""
echo -e "${BLUE}=== PHASE 5: Configuration & Documentation ===${NC}"
echo ""

# Configuration files
run_test "Feature flags config" "test -f configs/feature-flags-development.json"
run_test "App settings config" "test -f configs/app-settings-development.json"
run_test "Config manager" "test -f src/shared/config-manager/index.js"
run_test "A/B testing framework" "test -f src/shared/ab-testing/index.js"

# Documentation
run_test "Architecture review doc" "test -f docs/architecture-review.md"
run_test "Security compliance doc" "test -f docs/security-compliance-checklist.md"
run_test "Configuration management doc" "test -f docs/configuration-management.md"
run_test "Local setup guide" "test -f docs/development/local-setup.md"
run_test "Implementation context" "test -f .kiro/specs/global-gaming-platform/implementation-context.md"

# Scripts
run_test "Setup dev environment" "test -f scripts/setup-dev-environment.sh && test -x scripts/setup-dev-environment.sh"
run_test "Deploy configuration" "test -f scripts/deploy-configuration.sh && test -x scripts/deploy-configuration.sh"
run_test "Emergency rollback" "test -f scripts/emergency-config-rollback.sh && test -x scripts/emergency-config-rollback.sh"

echo ""
echo -e "${BLUE}=== PHASE 6: Test Suite Validation ===${NC}"
echo ""

# Test files existence
run_test "Game Engine unit tests" "test -f src/game-engine/tests/unit/GameEngine.test.js"
run_test "Auth Service unit tests" "test -f src/auth-service/tests/unit/UserService.test.js"
run_test "Leaderboard unit tests" "test -f src/leaderboard-service/tests/unit/RankingManager.test.js"
run_test "Support Service unit tests" "test -f src/support-service/tests/unit/ticketHandler.test.js"
run_test "Frontend unit tests" "test -f src/frontend/src/services/__tests__/WebSocketClient.test.js"
run_test "Pipeline tests" "test -f tests/pipeline/pipeline.test.js"
run_test "API integration tests" "test -f tests/api-integration/e2e/game-workflow.test.js"

echo ""
echo -e "${BLUE}=== PHASE 7: Code Quality Checks ===${NC}"
echo ""

# Check for common issues
run_test "No TODO comments in production code" "! grep -r 'TODO' src/*/src/*.js 2>/dev/null || true"
run_test "No console.log in production" "! grep -r 'console.log' src/game-engine/src/*.js 2>/dev/null | grep -v '// console.log' || true"
run_test "All package.json files valid" "find . -name 'package.json' -exec node -e 'JSON.parse(require(\"fs\").readFileSync(\"{}\"))' \; 2>/dev/null"

echo ""
echo -e "${BLUE}=== PHASE 8: Security Checks ===${NC}"
echo ""

# Security checks
run_test "No hardcoded secrets" "! grep -r 'password.*=.*\"' src/ 2>/dev/null || true"
run_test "No AWS keys in code" "! grep -r 'AKIA[0-9A-Z]{16}' . 2>/dev/null || true"
run_test "KMS encryption configured" "grep -q 'kms' infrastructure/terraform/modules/security/main.tf"
run_test "IAM roles use least privilege" "grep -q 'least.*privilege' infrastructure/terraform/modules/security/README.md"

echo ""
echo "========================================"
echo "VALIDATION SUMMARY"
echo "========================================"
echo -e "Total Tests:   ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:        ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:        ${RED}$FAILED_TESTS${NC}"
echo -e "Skipped:       ${YELLOW}$SKIPPED_TESTS${NC}"
echo ""

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
  SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
  echo -e "Success Rate:  ${BLUE}${SUCCESS_RATE}%${NC}"
fi

echo ""
echo "Completed: $(date)"
echo "========================================"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ ALL VALIDATIONS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}✗ SOME VALIDATIONS FAILED${NC}"
  exit 1
fi
