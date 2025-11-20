#!/bin/bash

# Repository Initialization Script
# Sets up Git repository with branch protection and security scanning

set -e

echo "🔧 Initializing Global Gaming Platform Repository"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize Git repository
init_git_repo() {
    print_status "Initializing Git repository..."
    
    if [ -d ".git" ]; then
        print_warning "Git repository already initialized"
        return
    fi
    
    git init
    git branch -M main
    
    print_status "Git repository initialized with main branch"
}

# Create .gitignore file
create_gitignore() {
    print_status "Creating .gitignore file..."
    
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.venv/
pip-log.txt
pip-delete-this-directory.txt

# IDE and Editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
.nyc_output/

# Terraform
*.tfstate
*.tfstate.*
.terraform/
.terraform.lock.hcl
terraform.tfvars
*.tfplan

# AWS
.aws/

# Docker
.dockerignore

# Build outputs
dist/
build/
*.tgz
*.tar.gz

# Test outputs
test-results/
junit.xml

# Temporary files
tmp/
temp/
*.tmp
*.temp

# Security
*.pem
*.key
*.crt
secrets.yml
EOF

    print_status ".gitignore file created"
}

# Create README.md
create_readme() {
    print_status "Creating README.md..."
    
    cat > README.md << 'EOF'
# Global Gaming Platform

A globally distributed tic-tac-toe gaming platform built on AWS with real-time multiplayer capabilities.

## 🎮 Features

- **Real-time Multiplayer**: WebSocket-based gameplay with sub-100ms latency
- **Global Scale**: Multi-region deployment with automatic failover
- **Social Integration**: OAuth login with Google, Facebook, and Twitter
- **Leaderboards**: Global and regional player rankings
- **Enterprise Security**: Zero-trust architecture with comprehensive monitoring

## 🏗️ Architecture

- **Microservices**: Independent services for game engine, user management, and leaderboards
- **AWS Infrastructure**: ECS Fargate, Aurora Global Database, DynamoDB, ElastiCache
- **Real-time Communication**: API Gateway WebSocket APIs
- **Security**: WAF, encryption at rest/transit, IAM with least privilege

## 🚀 Quick Start

### Prerequisites

- AWS CLI v2
- Terraform >= 1.6.0
- Docker
- Node.js 18+
- Python 3.9+

### Setup Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd global-gaming-platform

# Run setup script
./scripts/setup-dev-environment.sh

# Copy environment template
cp .env.example .env

# Edit .env with your AWS credentials and configuration
```

### Deploy Infrastructure

```bash
# Initialize Terraform
cd infrastructure/terraform/environments/dev
terraform init

# Plan deployment
terraform plan

# Apply infrastructure
terraform apply
```

### Run Services Locally

```bash
# Install dependencies
npm run install:all

# Start all services
npm run dev
```

## 📁 Project Structure

```
├── src/                    # Source code
│   ├── game-engine/       # Game logic service
│   ├── user-service/      # Authentication & user management
│   ├── leaderboard-service/ # Rankings and statistics
│   └── support-service/   # Customer support system
├── infrastructure/        # Infrastructure as Code
│   └── terraform/        # Terraform configurations
├── scripts/              # Deployment and utility scripts
├── tests/               # Test suites
├── docs/                # Documentation
└── .github/             # CI/CD workflows
```

## 🧪 Testing

```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run all tests
npm test
```

## 🚀 Deployment

The project uses GitHub Actions for CI/CD with automatic deployments:

- **Development**: Auto-deploy on push to `develop` branch
- **Staging**: Auto-deploy on push to `main` branch
- **Production**: Manual approval required after staging validation

## 📊 Monitoring

- **CloudWatch**: Application and infrastructure metrics
- **X-Ray**: Distributed tracing
- **CloudTrail**: Audit logging
- **Custom Dashboards**: Business and operational metrics

## 🔒 Security

- Zero-trust network architecture
- Encryption at rest and in transit
- Regular security scanning and penetration testing
- GDPR compliance for data protection

## 📖 Documentation

- [Architecture Overview](docs/architecture/README.md)
- [API Documentation](docs/api/README.md)
- [Deployment Guide](docs/deployment/README.md)
- [Runbooks](docs/runbooks/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the [troubleshooting guide](docs/troubleshooting.md)
EOF

    print_status "README.md created"
}

# Create package.json for root project
create_package_json() {
    print_status "Creating package.json..."
    
    cat > package.json << 'EOF'
{
  "name": "global-gaming-platform",
  "version": "1.0.0",
  "description": "A globally distributed tic-tac-toe gaming platform",
  "main": "index.js",
  "scripts": {
    "install:all": "npm install && npm run install:services",
    "install:services": "cd src/game-engine && npm install && cd ../user-service && npm install && cd ../leaderboard-service && npm install && cd ../support-service && npm install",
    "dev": "concurrently \"npm run dev:game-engine\" \"npm run dev:user-service\" \"npm run dev:leaderboard\" \"npm run dev:support\"",
    "dev:game-engine": "cd src/game-engine && npm run dev",
    "dev:user-service": "cd src/user-service && npm run dev",
    "dev:leaderboard": "cd src/leaderboard-service && npm run dev",
    "dev:support": "cd src/support-service && npm run dev",
    "build": "npm run build:services",
    "build:services": "cd src/game-engine && npm run build && cd ../user-service && npm run build && cd ../leaderboard-service && npm run build && cd ../support-service && npm run build",
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "jest --config=jest.config.js --testPathPattern=tests/unit",
    "test:integration": "jest --config=jest.config.js --testPathPattern=tests/integration",
    "test:e2e": "cypress run",
    "test:smoke": "jest --config=jest.config.js --testPathPattern=tests/smoke",
    "lint": "eslint src/ --ext .js,.ts && prettier --check src/",
    "lint:fix": "eslint src/ --ext .js,.ts --fix && prettier --write src/",
    "docker:build": "./scripts/build-docker-images.sh",
    "docker:run": "docker-compose up -d",
    "docker:stop": "docker-compose down",
    "terraform:init": "cd infrastructure/terraform/environments/dev && terraform init",
    "terraform:plan": "cd infrastructure/terraform/environments/dev && terraform plan",
    "terraform:apply": "cd infrastructure/terraform/environments/dev && terraform apply",
    "deploy:dev": "./scripts/deploy.sh development",
    "deploy:staging": "./scripts/deploy.sh staging",
    "deploy:prod": "./scripts/deploy.sh production"
  },
  "keywords": [
    "gaming",
    "tic-tac-toe",
    "aws",
    "microservices",
    "real-time",
    "websocket"
  ],
  "author": "Global Gaming Platform Team",
  "license": "MIT",
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^18.15.0",
    "@typescript-eslint/eslint-plugin": "^5.57.0",
    "@typescript-eslint/parser": "^5.57.0",
    "concurrently": "^8.0.0",
    "cypress": "^12.9.0",
    "eslint": "^8.37.0",
    "eslint-config-prettier": "^8.8.0",
    "eslint-plugin-prettier": "^4.2.1",
    "jest": "^29.5.0",
    "prettier": "^2.8.7",
    "ts-jest": "^29.1.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "aws-sdk": "^2.1345.0"
  }
}
EOF

    print_status "package.json created"
}

# Create development documentation
create_dev_docs() {
    print_status "Creating development documentation..."
    
    mkdir -p docs/development
    
    cat > docs/development/onboarding.md << 'EOF'
# Developer Onboarding Guide

## Welcome to the Global Gaming Platform Team! 🎮

This guide will help you get up and running with the development environment.

## Prerequisites

Before you begin, ensure you have:
- AWS account with appropriate permissions
- GitHub account with repository access
- Basic knowledge of Node.js, Python, and AWS services

## Setup Steps

### 1. Environment Setup

Run the automated setup script:
```bash
./scripts/setup-dev-environment.sh
```

This script will install:
- AWS CLI v2
- Terraform
- Docker
- Node.js 18+
- Python 3.9+
- Development tools

### 2. AWS Configuration

Configure your AWS credentials:
```bash
aws configure
```

Set the following:
- AWS Access Key ID: [Your access key]
- AWS Secret Access Key: [Your secret key]
- Default region: eu-west-2
- Default output format: json

### 3. Repository Setup

Initialize the repository:
```bash
./scripts/init-repository.sh
```

### 4. Environment Variables

Copy the environment template:
```bash
cp .env.example .env
```

Update `.env` with your specific configuration values.

### 5. Install Dependencies

Install all project dependencies:
```bash
npm run install:all
```

### 6. Verify Setup

Run the verification script:
```bash
./scripts/verify-setup.sh
```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `hotfix/*`: Critical production fixes

### Code Standards

- **JavaScript/TypeScript**: ESLint + Prettier
- **Python**: Black + Flake8 + MyPy
- **Terraform**: terraform fmt
- **Commit Messages**: Conventional Commits format

### Testing Requirements

- Unit tests: Minimum 80% coverage
- Integration tests: All API endpoints
- E2E tests: Critical user journeys
- Security tests: Automated vulnerability scanning

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Run local validation: `npm run lint && npm test`
4. Push branch and create PR
5. Ensure CI/CD pipeline passes
6. Request code review from team members
7. Merge after approval

## Local Development

### Running Services

Start all services locally:
```bash
npm run dev
```

Individual services:
```bash
npm run dev:game-engine
npm run dev:user-service
npm run dev:leaderboard
npm run dev:support
```

### Database Setup

For local development, use Docker Compose:
```bash
docker-compose up -d postgres redis
```

### Testing

Run different test suites:
```bash
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm test                # All tests
```

## Deployment

### Development Environment

Automatic deployment on push to `develop` branch.

### Staging Environment

Automatic deployment on push to `main` branch.

### Production Environment

Manual approval required after staging validation.

## Troubleshooting

### Common Issues

1. **AWS CLI not configured**
   ```bash
   aws configure
   aws sts get-caller-identity
   ```

2. **Docker permission denied**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **Node.js version mismatch**
   ```bash
   nvm install 18
   nvm use 18
   ```

4. **Terraform state lock**
   ```bash
   terraform force-unlock <LOCK_ID>
   ```

### Getting Help

- Check the [troubleshooting guide](../troubleshooting.md)
- Ask in the team Slack channel
- Create an issue in the repository
- Contact the tech lead

## Resources

- [Architecture Documentation](../architecture/README.md)
- [API Documentation](../api/README.md)
- [Deployment Guide](../deployment/README.md)
- [AWS Best Practices](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Documentation](https://www.terraform.io/docs/)

Welcome to the team! 🚀
EOF

    print_status "Development documentation created"
}

# Create branch protection script
create_branch_protection() {
    print_status "Creating branch protection configuration..."
    
    cat > scripts/setup-branch-protection.sh << 'EOF'
#!/bin/bash

# GitHub Branch Protection Setup
# This script configures branch protection rules via GitHub CLI

set -e

echo "🔒 Setting up branch protection rules"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is required but not installed."
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "Please authenticate with GitHub CLI:"
    gh auth login
fi

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Setting up branch protection for repository: $REPO"

# Protect main branch
echo "Protecting main branch..."
gh api repos/$REPO/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["test","security-scan","infrastructure-validate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false

# Protect develop branch
echo "Protecting develop branch..."
gh api repos/$REPO/branches/develop/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["test","security-scan"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false

echo "✅ Branch protection rules configured successfully"
EOF

    chmod +x scripts/setup-branch-protection.sh
    print_status "Branch protection script created"
}

# Main execution
main() {
    print_status "Starting repository initialization..."
    
    init_git_repo
    create_gitignore
    create_readme
    create_package_json
    create_dev_docs
    create_branch_protection
    
    # Initial commit
    git add .
    git commit -m "feat: initial project setup with CI/CD pipeline and development environment"
    
    print_status "✅ Repository initialization completed!"
    print_status "Next steps:"
    echo "  1. Create GitHub repository and push code:"
    echo "     git remote add origin <repository-url>"
    echo "     git push -u origin main"
    echo "  2. Set up branch protection: ./scripts/setup-branch-protection.sh"
    echo "  3. Configure GitHub secrets for CI/CD pipeline"
    echo "  4. Create develop branch: git checkout -b develop && git push -u origin develop"
}

# Run main function
main "$@"