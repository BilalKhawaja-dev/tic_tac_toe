# Cleanup Inventory - Phase 0

**Date**: 2025-11-20
**Current State**: 91 markdown files, 46 shell scripts

## Markdown Files Categorization

### KEEP (Essential - 5 files)
- README.md - Main project documentation
- docker-compose.yml - Local development setup
- .gitignore - Git configuration
- NEXT_SESSION_SPEC_READY.md - Current session guide
- REAL_GAMEPLAY_MISSING_FEATURES_ANALYSIS.md - Feature analysis

### DELETE - Status/Summary Files (60+ files)
**Pattern**: *_STATUS.md, *_SUMMARY.md, *_COMPLETE.md, *_SUCCESS.md

- 100_PERCENT_SUCCESS.md
- ALL_SERVICES_HEALTHY.md
- ALL_SERVICES_READY.md
- API_TEST_RESULTS.md
- APP_DEPLOYMENT_STATUS.md
- AUDIT_REPORT.md
- AUDIT_SUMMARY.md
- AWS_DEPLOYMENT_STATUS.md
- COMPLETE_DEPLOYMENT_PLAN.md
- COMPLETE_FIX_SUMMARY.md
- COMPREHENSIVE_AUDIT_REPORT.md
- COMPREHENSIVE_TEST_REPORT.md
- COMPREHENSIVE_TEST_SUMMARY.md
- CURRENT_DEPLOYMENT_STATUS.md
- CURRENT_STATUS.md
- DEPLOYMENT_100_PERCENT_WORKING.md
- DEPLOYMENT_COMPLETE.md
- DEPLOYMENT_COMPLETE_FINAL.md
- DEPLOYMENT_COMPLETE_SUMMARY.md
- DEPLOYMENT_COMPLETE_WORKING.md
- DEPLOYMENT_FINAL_STATUS.md
- DEPLOYMENT_IN_PROGRESS.md
- DEPLOYMENT_STATUS.md
- DEPLOYMENT_STATUS_FINAL.md
- DEPLOYMENT_SUCCESS.md
- DEPLOYMENT_SUCCESS_ALL_HEALTHY.md
- ECS_DEPLOYMENT_FIXED.md
- ECS_FIXES_COMPLETE.md
- ECS_SERVICES_FIX.md
- EXECUTIVE_SUMMARY.md
- EXECUTIVE_SUMMARY_FINAL.md
- FINAL_DEPLOYMENT_STATUS.md
- FINAL_DEPLOYMENT_SUMMARY.md
- FINAL_ECS_FIX_SUMMARY.md
- FINAL_STATUS.md
- FINAL_SUCCESS_SUMMARY.md
- FINAL_SUMMARY.md
- FINAL_TEST_REPORT.md
- FINAL_WORKING_STATUS.md
- GIT_CLEANUP_SUMMARY.md
- IMPLEMENTATION_COMPLETE_SUMMARY.md
- INFRASTRUCTURE_FIX_STATUS.md
- INFRASTRUCTURE_FIXES_APPLIED.md
- INFRASTRUCTURE_FIXES_COMPLETE.md
- INFRASTRUCTURE_FIXES_SUMMARY.md
- PROJECT_STATUS_SUMMARY.md
- SESSION_COMPLETE.md
- SESSION_COMPLETION_SUMMARY.md
- SESSION_FINAL_SUMMARY.md
- SESSION_HANDOFF_SUMMARY.md
- SUCCESS_FINAL.md
- TERRAFORM_DEPLOYMENT_COMPLETE.md
- TERRAFORM_DEPLOYMENT_SUCCESS.md
- TERRAFORM_FIXES_APPLIED.md
- TEST_VALIDATION_REPORT.md
- TRANSITION_TO_LOCAL_SUMMARY.md
- WORK_COMPLETE_SUMMARY.md

### DELETE - Session Handoff Files (10 files)
- HANDOFF_DOCUMENT.md
- HANDOFF_NEXT_SESSION.md
- NEXT_SESSION_START_HERE.md
- START_HERE.md
- START_HERE_FINAL.md
- START_HERE_NOW.md
- DEPLOY_NOW.md
- READY_TO_START.md

### DELETE - Temporary Fix Documentation (8 files)
- FIXING_WHATS_BROKEN.md
- WHATS_BROKEN.md
- CRITICAL_FIX_ENVIRONMENT_VARIABLES.md
- FINAL_DIAGNOSIS.md
- SERVICES_FIX_GUIDE.md
- SERVICES_REBUILD_INSTRUCTIONS.md

### DELETE - Duplicate Guides (8 files)
- DEPLOYMENT_CHECKLIST.md (consolidate into docs/)
- DEPLOYMENT_GUIDE.md (consolidate into docs/)
- DEPLOYMENT_READY.md
- README_DEPLOYMENT.md
- README_LOCAL_TESTING.md
- LOCAL_TESTING_GUIDE.md
- LOCAL_TESTING_PLAN.md
- LOCAL_TESTING_SUCCESS.md
- TERRAFORM_DEPLOYMENT_GUIDE.md

### DELETE - Checklists/Plans (5 files)
- PRE_DEPLOYMENT_CHECKLIST.md
- TASK_EXECUTION_PLAN.md
- VALIDATION_CHECKLIST.md
- QUICK_REFERENCE.md
- QUICK_START.md

### DELETE - Test Reports (2 files)
- FRONTEND_UI_GUIDE.md
- GITHUB_ACTIONS_FIXES.md

**Total to DELETE**: ~86 files
**Total to KEEP**: ~5 files

---

## Shell Scripts Categorization

### KEEP - Essential Deployment (6 scripts)
- scripts/deploy.sh - Main deployment
- scripts/rollback.sh - Rollback functionality
- scripts/deploy-all-services.sh - Service deployment
- scripts/init-database.sh - Database initialization
- scripts/smoke-tests.sh - Smoke testing
- scripts/run-all-tests.sh - Test runner

### KEEP - Essential Setup (3 scripts)
- scripts/init-repository.sh - Repository setup
- scripts/setup-dev-environment.sh - Dev environment
- scripts/deploy-configuration.sh - Configuration deployment

### KEEP - Essential Utilities (2 scripts)
- scripts/check-all-services.sh - Service health checks
- scripts/comprehensive-audit.sh - System audit

### DELETE - Fix/Rebuild Scripts (12 scripts)
- scripts/apply-infrastructure-fixes.sh
- scripts/apply-terraform-fixes.sh
- scripts/fix-and-redeploy-services.sh
- scripts/fix-ecs-services.sh
- scripts/fix-terraform-errors.sh
- scripts/quick-fix-game-engine.sh
- scripts/quick-fix-services.sh
- scripts/quick-rebuild-two-services.sh
- scripts/rebuild-all-services.sh
- scripts/rebuild-broken-services.sh
- scripts/redeploy-game-engine.sh

### DELETE - Duplicate Deployment Scripts (10 scripts)
- scripts/apply-ecs-services.sh (covered by deploy-all-services.sh)
- scripts/deploy-auth-service.sh (covered by deploy-all-services.sh)
- scripts/deploy-frontend.sh (covered by deploy-all-services.sh)
- scripts/deploy-game-engine.sh (covered by deploy-all-services.sh)
- scripts/deploy-leaderboard-service.sh (covered by deploy-all-services.sh)
- scripts/deploy-routing-fixes.sh
- scripts/deploy-terraform.sh (keep quick-start-terraform.sh)
- scripts/build-and-push-game-engine.sh (covered by deploy.sh)

### DELETE - Monitoring/Status Scripts (4 scripts)
- scripts/check-deployment-status.sh (covered by check-all-services.sh)
- scripts/monitor-deployment.sh
- scripts/monitor-terraform-deployment.sh
- scripts/test-fixed-routes.sh

### DELETE - One-off/Obsolete Scripts (9 scripts)
- scripts/apply-leaderboard-schema.sh
- scripts/create-ecr-repos.sh
- scripts/import-ecr-repos.sh
- scripts/init-db-via-ecs.sh
- scripts/run-schema-via-ecs.sh
- scripts/quick-start-local.sh
- scripts/quick-start-terraform.sh
- scripts/test-local-services.sh
- scripts/emergency-config-rollback.sh

### DELETE - Cleanup Scripts (2 scripts)
- scripts/cleanup-ecr-and-destroy.sh
- scripts/destroy-infrastructure.sh
- scripts/force-cleanup-aws.sh

**Total to DELETE**: ~35 scripts
**Total to KEEP**: ~11 scripts

---

## Proposed New Structure

```
scripts/
├── deploy/
│   ├── deploy.sh              # Main deployment (from deploy.sh)
│   ├── deploy-all-services.sh # Service deployment
│   └── rollback.sh            # Rollback
├── setup/
│   ├── init-repository.sh     # Repository setup
│   ├── init-database.sh       # Database setup
│   └── setup-dev-environment.sh
├── test/
│   ├── run-all-tests.sh       # All tests
│   └── smoke-tests.sh         # Smoke tests
└── utils/
    ├── check-all-services.sh  # Health checks
    ├── comprehensive-audit.sh # System audit
    └── deploy-configuration.sh

docs/
├── DEPLOYMENT.md              # Consolidated deployment guide
├── ARCHITECTURE.md            # System architecture
└── TROUBLESHOOTING.md         # Common issues
```

---

## Summary

- **Markdown Files**: 91 → 5 (86 deleted, 94% reduction)
- **Shell Scripts**: 46 → 11 (35 deleted, 76% reduction)
- **New Structure**: Organized into deploy/, setup/, test/, utils/
- **Documentation**: Consolidated into docs/ directory

## Next Steps

1. Review this inventory
2. Approve deletion list
3. Execute Task 0.2 (Delete Obsolete Documentation)
4. Execute Task 0.3 (Consolidate Scripts)
5. Execute Task 0.4 (Clean Up Terraform)
6. Execute Task 0.5 (Update Main Documentation)
