#!/bin/bash

# Quick Validation Script - Non-failing version
# Provides comprehensive report without early exit

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

echo "========================================"
echo "QUICK VALIDATION REPORT"
echo "========================================"
echo ""

check() {
  if [ "$1" = "file" ]; then
    if [ -f "$2" ]; then
      echo -e "${GREEN}✓${NC} $3"
      ((PASSED++))
    else
      echo -e "${RED}✗${NC} $3"
      ((FAILED++))
    fi
  elif [ "$1" = "dir" ]; then
    if [ -d "$2" ]; then
      echo -e "${GREEN}✓${NC} $3"
      ((PASSED++))
    else
      echo -e "${RED}✗${NC} $3"
      ((FAILED++))
    fi
  fi
}

echo -e "${BLUE}Infrastructure Modules:${NC}"
check dir "infrastructure/terraform/modules" "Terraform modules directory"
check file "infrastructure/terraform/modules/network/main.tf" "Network module"
check file "infrastructure/terraform/modules/security/main.tf" "Security module"
check file "infrastructure/terraform/modules/database/main.tf" "Database module"
check file "infrastructure/terraform/modules/ecs/main.tf" "ECS module"
check file "infrastructure/terraform/modules/monitoring/main.tf" "Monitoring module"
check file "infrastructure/terraform/modules/auth/main.tf" "Auth module"
check file "infrastructure/terraform/modules/api-gateway/main.tf" "API Gateway module"
check file "infrastructure/terraform/modules/appconfig/main.tf" "AppConfig module"
check file "infrastructure/terraform/modules/cicd/main.tf" "CI/CD module"

echo ""
echo -e "${BLUE}Backend Services:${NC}"
check dir "src/game-engine" "Game Engine service"
check dir "src/auth-service" "Auth service"
check dir "src/leaderboard-service" "Leaderboard service"
check dir "src/support-service" "Support service"

echo ""
echo -e "${BLUE}Frontend Application:${NC}"
check dir "src/frontend/src" "Frontend source"
check file "src/frontend/package.json" "Frontend package.json"
check file "src/frontend/src/services/WebSocketClient.js" "WebSocket client"
check file "src/frontend/src/services/ApiService.js" "API service"
check file "src/frontend/src/components/GameBoard/GameBoard.jsx" "GameBoard component"

echo ""
echo -e "${BLUE}CI/CD Pipeline:${NC}"
check file "buildspec.yml" "Build specification"
check file "buildspec-test.yml" "Test specification"
check file "appspec.yml" "Deploy specification"
check file "scripts/deploy.sh" "Deploy script"
check file "scripts/rollback.sh" "Rollback script"
check file "scripts/smoke-tests.sh" "Smoke tests"

echo ""
echo -e "${BLUE}Configuration & Docs:${NC}"
check file "configs/feature-flags-development.json" "Feature flags"
check file "docs/architecture-review.md" "Architecture docs"
check file ".kiro/specs/global-gaming-platform/implementation-context.md" "Implementation context"

echo ""
echo "========================================"
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "========================================"
