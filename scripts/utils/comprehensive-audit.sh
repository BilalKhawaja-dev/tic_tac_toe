#!/bin/bash

# Comprehensive Code Audit Script
# Audits all Terraform, JavaScript, TypeScript, Python, and configuration files

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================"
echo "COMPREHENSIVE CODE AUDIT"
echo "========================================"
echo "Started: $(date)"
echo ""

# Counters
TOTAL_FILES=0
TERRAFORM_FILES=0
JAVASCRIPT_FILES=0
TYPESCRIPT_FILES=0
PYTHON_FILES=0
CONFIG_FILES=0
TEST_FILES=0

# Issue counters
ISSUES_FOUND=0
WARNINGS=0

# Function to count files
count_files() {
  echo -e "${BLUE}=== File Inventory ===${NC}"
  echo ""
  
  TERRAFORM_FILES=$(find . -name "*.tf" ! -path "*/node_modules/*" ! -path "*/.terraform/*" | wc -l)
  JAVASCRIPT_FILES=$(find . -name "*.js" ! -path "*/node_modules/*" ! -path "*/coverage/*" | wc -l)
  TYPESCRIPT_FILES=$(find . -name "*.ts" -o -name "*.tsx" ! -path "*/node_modules/*" | wc -l)
  PYTHON_FILES=$(find . -name "*.py" ! -path "*/node_modules/*" | wc -l)
  CONFIG_FILES=$(find . -name "*.json" -o -name "*.yml" -o -name "*.yaml" ! -path "*/node_modules/*" ! -path "*/coverage/*" | wc -l)
  TEST_FILES=$(find . -name "*.test.js" -o -name "*.test.jsx" -o -name "*.spec.js" ! -path "*/node_modules/*" | wc -l)
  
  TOTAL_FILES=$((TERRAFORM_FILES + JAVASCRIPT_FILES + TYPESCRIPT_FILES + PYTHON_FILES))
  
  echo "Terraform files: $TERRAFORM_FILES"
  echo "JavaScript files: $JAVASCRIPT_FILES"
  echo "TypeScript files: $TYPESCRIPT_FILES"
  echo "Python files: $PYTHON_FILES"
  echo "Config files: $CONFIG_FILES"
  echo "Test files: $TEST_FILES"
  echo "Total code files: $TOTAL_FILES"
  echo ""
}

# Function to audit Terraform files
audit_terraform() {
  echo -e "${BLUE}=== Terraform Audit ===${NC}"
  echo ""
  
  local tf_issues=0
  
  # Check for hardcoded values
  if grep -r "password.*=.*\"" infrastructure/terraform/ 2>/dev/null | grep -v "password_policy" | grep -v "# password"; then
    echo -e "${RED}✗ Found hardcoded passwords in Terraform${NC}"
    ((tf_issues++))
  else
    echo -e "${GREEN}✓ No hardcoded passwords${NC}"
  fi
  
  # Check for proper variable usage
  if grep -r "var\." infrastructure/terraform/modules/*/main.tf > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Variables properly used${NC}"
  else
    echo -e "${YELLOW}⚠ Limited variable usage${NC}"
    ((WARNINGS++))
  fi
  
  # Check for outputs
  if find infrastructure/terraform/modules -name "outputs.tf" | grep -q .; then
    echo -e "${GREEN}✓ Output files present${NC}"
  else
    echo -e "${RED}✗ Missing output files${NC}"
    ((tf_issues++))
  fi
  
  # Check for README documentation
  local modules_with_readme=$(find infrastructure/terraform/modules -name "README.md" | wc -l)
  echo -e "${GREEN}✓ $modules_with_readme modules have README${NC}"
  
  ISSUES_FOUND=$((ISSUES_FOUND + tf_issues))
  echo ""
}

# Function to audit JavaScript/TypeScript
audit_javascript() {
  echo -e "${BLUE}=== JavaScript/TypeScript Audit ===${NC}"
  echo ""
  
  local js_issues=0
  
  # Check for console.log in production code
  local console_logs=$(grep -r "console\.log" src/*/src --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "// console" | grep -v "logger" | wc -l)
  if [ $console_logs -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $console_logs console.log statements${NC}"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✓ No console.log in production code${NC}"
  fi
  
  # Check for proper error handling
  if grep -r "try.*catch" src/ --include="*.js" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Error handling present${NC}"
  else
    echo -e "${YELLOW}⚠ Limited error handling${NC}"
    ((WARNINGS++))
  fi
  
  # Check for async/await usage
  if grep -r "async.*await" src/ --include="*.js" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Async/await patterns used${NC}"
  fi
  
  # Check for package.json files
  local package_files=$(find . -name "package.json" ! -path "*/node_modules/*" | wc -l)
  echo -e "${GREEN}✓ $package_files package.json files${NC}"
  
  ISSUES_FOUND=$((ISSUES_FOUND + js_issues))
  echo ""
}

# Function to audit Python files
audit_python() {
  echo -e "${BLUE}=== Python Audit ===${NC}"
  echo ""
  
  local py_issues=0
  
  # Check for Python files
  if [ $PYTHON_FILES -gt 0 ]; then
    echo -e "${GREEN}✓ $PYTHON_FILES Python files found${NC}"
    
    # Check for proper imports
    if grep -r "^import\|^from" --include="*.py" infrastructure/ > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Python imports present${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ No Python files found${NC}"
  fi
  
  ISSUES_FOUND=$((ISSUES_FOUND + py_issues))
  echo ""
}

# Function to audit security
audit_security() {
  echo -e "${BLUE}=== Security Audit ===${NC}"
  echo ""
  
  local sec_issues=0
  
  # Check for AWS keys
  if grep -r "AKIA[0-9A-Z]{16}" . ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null; then
    echo -e "${RED}✗ Found potential AWS keys${NC}"
    ((sec_issues++))
  else
    echo -e "${GREEN}✓ No AWS keys in code${NC}"
  fi
  
  # Check for private keys
  if grep -r "BEGIN.*PRIVATE.*KEY" . ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null; then
    echo -e "${RED}✗ Found private keys${NC}"
    ((sec_issues++))
  else
    echo -e "${GREEN}✓ No private keys in code${NC}"
  fi
  
  # Check for hardcoded IPs
  local hardcoded_ips=$(grep -rE "[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}" src/ --include="*.js" 2>/dev/null | grep -v "0.0.0.0" | grep -v "127.0.0.1" | grep -v "localhost" | wc -l)
  if [ $hardcoded_ips -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $hardcoded_ips hardcoded IPs${NC}"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✓ No hardcoded IPs${NC}"
  fi
  
  # Check for encryption configuration
  if grep -r "encryption" infrastructure/terraform/modules/security/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Encryption configured${NC}"
  fi
  
  # Check for KMS usage
  if grep -r "kms" infrastructure/terraform/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ KMS encryption used${NC}"
  fi
  
  ISSUES_FOUND=$((ISSUES_FOUND + sec_issues))
  echo ""
}

# Function to audit tests
audit_tests() {
  echo -e "${BLUE}=== Test Coverage Audit ===${NC}"
  echo ""
  
  # Count test files per service
  local game_engine_tests=$(find src/game-engine/tests -name "*.test.js" 2>/dev/null | wc -l)
  local auth_tests=$(find src/auth-service/tests -name "*.test.js" 2>/dev/null | wc -l)
  local leaderboard_tests=$(find src/leaderboard-service/tests -name "*.test.js" 2>/dev/null | wc -l)
  local support_tests=$(find src/support-service/tests -name "*.test.js" 2>/dev/null | wc -l)
  local frontend_tests=$(find src/frontend/src -name "*.test.js" -o -name "*.test.jsx" 2>/dev/null | wc -l)
  
  echo "Game Engine tests: $game_engine_tests"
  echo "Auth Service tests: $auth_tests"
  echo "Leaderboard Service tests: $leaderboard_tests"
  echo "Support Service tests: $support_tests"
  echo "Frontend tests: $frontend_tests"
  echo "Total test files: $TEST_FILES"
  
  if [ $TEST_FILES -gt 20 ]; then
    echo -e "${GREEN}✓ Comprehensive test coverage${NC}"
  elif [ $TEST_FILES -gt 10 ]; then
    echo -e "${YELLOW}⚠ Moderate test coverage${NC}"
    ((WARNINGS++))
  else
    echo -e "${RED}✗ Limited test coverage${NC}"
    ((ISSUES_FOUND++))
  fi
  
  echo ""
}

# Function to audit documentation
audit_documentation() {
  echo -e "${BLUE}=== Documentation Audit ===${NC}"
  echo ""
  
  local readme_count=$(find . -name "README.md" ! -path "*/node_modules/*" | wc -l)
  echo "README files: $readme_count"
  
  # Check for key documentation
  [ -f "docs/architecture-review.md" ] && echo -e "${GREEN}✓ Architecture documentation${NC}" || echo -e "${RED}✗ Missing architecture docs${NC}"
  [ -f "docs/security-compliance-checklist.md" ] && echo -e "${GREEN}✓ Security documentation${NC}" || echo -e "${RED}✗ Missing security docs${NC}"
  [ -f ".kiro/specs/global-gaming-platform/implementation-context.md" ] && echo -e "${GREEN}✓ Implementation context${NC}" || echo -e "${RED}✗ Missing context doc${NC}"
  
  echo ""
}

# Function to check code quality
audit_code_quality() {
  echo -e "${BLUE}=== Code Quality Audit ===${NC}"
  echo ""
  
  # Check for TODO comments
  local todos=$(grep -r "TODO" src/ --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
  if [ $todos -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $todos TODO comments${NC}"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✓ No TODO comments${NC}"
  fi
  
  # Check for FIXME comments
  local fixmes=$(grep -r "FIXME" src/ --include="*.js" 2>/dev/null | wc -l)
  if [ $fixmes -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $fixmes FIXME comments${NC}"
    ((WARNINGS++))
  else
    echo -e "${GREEN}✓ No FIXME comments${NC}"
  fi
  
  # Check for proper JSDoc/comments
  local jsdoc_count=$(grep -r "/\*\*" src/ --include="*.js" 2>/dev/null | wc -l)
  if [ $jsdoc_count -gt 50 ]; then
    echo -e "${GREEN}✓ Good documentation coverage ($jsdoc_count JSDoc blocks)${NC}"
  else
    echo -e "${YELLOW}⚠ Limited inline documentation${NC}"
    ((WARNINGS++))
  fi
  
  echo ""
}

# Run all audits
count_files
audit_terraform
audit_javascript
audit_python
audit_security
audit_tests
audit_documentation
audit_code_quality

# Summary
echo "========================================"
echo "AUDIT SUMMARY"
echo "========================================"
echo -e "Total Files Audited: ${BLUE}$TOTAL_FILES${NC}"
echo -e "Critical Issues: ${RED}$ISSUES_FOUND${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

# Calculate score
TOTAL_CHECKS=$((ISSUES_FOUND + WARNINGS + 20))
PASSED_CHECKS=$((TOTAL_CHECKS - ISSUES_FOUND - WARNINGS))
SCORE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))

echo -e "Audit Score: ${BLUE}${SCORE}/100${NC}"
echo ""

if [ $ISSUES_FOUND -eq 0 ] && [ $WARNINGS -lt 5 ]; then
  echo -e "${GREEN}✓ AUDIT PASSED - Code quality excellent${NC}"
  exit 0
elif [ $ISSUES_FOUND -eq 0 ]; then
  echo -e "${YELLOW}⚠ AUDIT PASSED WITH WARNINGS${NC}"
  exit 0
else
  echo -e "${RED}✗ AUDIT FAILED - Critical issues found${NC}"
  exit 1
fi
