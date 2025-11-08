# Local Development Setup Guide

## Overview

This guide provides detailed instructions for setting up a complete local development environment for the Global Gaming Platform.

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+) or macOS (10.15+)
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: 20GB free disk space
- **Network**: Stable internet connection for AWS services

### Required Software

The setup script will install these automatically, but you can install them manually if needed:

- **AWS CLI v2**: For AWS service interaction
- **Terraform**: Infrastructure as Code tool (v1.6.0+)
- **Docker**: Container runtime (v20.10+)
- **Node.js**: JavaScript runtime (v18.x LTS)
- **Python**: Programming language (v3.9+)
- **Git**: Version control system

## Automated Setup

### Quick Start

Run the automated setup script:

```bash
# Make script executable
chmod +x scripts/setup-dev-environment.sh

# Run setup
./scripts/setup-dev-environment.sh
```

The script will:
1. Detect your operating system
2. Install required tools and dependencies
3. Configure AWS CLI
4. Create project directory structure
5. Install development tools
6. Create environment configuration template

### Manual Verification

After running the setup script, verify installations:

```bash
# Check AWS CLI
aws --version
aws sts get-caller-identity

# Check Terraform
terraform version

# Check Docker
docker --version
docker run hello-world

# Check Node.js and npm
node --version
npm --version

# Check Python
python3 --version
pip3 --version
```

## Manual Setup (Alternative)

If you prefer manual installation or the script fails:

### 1. Install AWS CLI v2

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip
```

**macOS:**
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
rm AWSCLIV2.pkg
```

### 2. Install Terraform

**Linux:**
```bash
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
rm terraform_1.6.0_linux_amd64.zip
```

**macOS:**
```bash
brew install terraform
```

### 3. Install Docker

**Linux (Ubuntu):**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
rm get-docker.sh
```

**macOS:**
Install Docker Desktop from https://docker.com/products/docker-desktop

### 4. Install Node.js

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**macOS:**
```bash
brew install node@18
```

### 5. Install Python 3.9

**Linux:**
```bash
sudo apt-get update
sudo apt-get install -y python3.9 python3.9-pip python3.9-venv
```

**macOS:**
```bash
brew install python@3.9
```

## AWS Configuration

### 1. Configure Credentials

Set up your AWS credentials:

```bash
aws configure
```

Provide the following information:
- **AWS Access Key ID**: Your IAM user access key
- **AWS Secret Access Key**: Your IAM user secret key
- **Default region name**: `eu-west-2`
- **Default output format**: `json`

### 2. Verify Access

Test your AWS configuration:

```bash
# Check identity
aws sts get-caller-identity

# List S3 buckets (if you have any)
aws s3 ls

# Check EC2 instances
aws ec2 describe-instances --region eu-west-2
```

### 3. Required IAM Permissions

Your IAM user needs the following permissions for development:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "ecs:*",
        "rds:*",
        "dynamodb:*",
        "elasticache:*",
        "apigateway:*",
        "lambda:*",
        "iam:*",
        "cloudformation:*",
        "s3:*",
        "cloudwatch:*",
        "logs:*",
        "ecr:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Project Configuration

### 1. Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` with your specific values:

```bash
# AWS Configuration
AWS_REGION=eu-west-2
AWS_ACCOUNT_ID=123456789012

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Database Configuration (for local development)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tic_tac_toe_dev
DB_USER=postgres
DB_PASSWORD=password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# API Configuration
API_PORT=3000
WEBSOCKET_PORT=3001

# Feature Flags
FEATURE_LEADERBOARD=true
FEATURE_SOCIAL_LOGIN=true
```

### 2. Install Dependencies

Install all project dependencies:

```bash
# Install root dependencies
npm install

# Install service dependencies
npm run install:all
```

## Local Services

### 1. Database Setup

Start local PostgreSQL and Redis using Docker:

```bash
# Create docker-compose.yml for local services
cat > docker-compose.local.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: tic_tac_toe_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
EOF

# Start services
docker-compose -f docker-compose.local.yml up -d
```

### 2. Initialize Database

Create database schema:

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d tic_tac_toe_dev

# Run schema creation scripts (when available)
# \i database/schema.sql
```

## Development Workflow

### 1. Start Development Servers

Start all services in development mode:

```bash
# Start all services
npm run dev

# Or start individual services
npm run dev:game-engine
npm run dev:user-service
npm run dev:leaderboard
npm run dev:support
```

### 2. Code Quality Tools

Run linting and formatting:

```bash
# Check code style
npm run lint

# Fix code style issues
npm run lint:fix
```

### 3. Testing

Run different test suites:

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# All tests
npm test
```

## IDE Configuration

### Visual Studio Code

Recommended extensions:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-python.python",
    "hashicorp.terraform",
    "ms-vscode.docker",
    "amazonwebservices.aws-toolkit-vscode"
  ]
}
```

Workspace settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "python.defaultInterpreterPath": "python3",
  "terraform.experimentalFeatures.validateOnSave": true
}
```

## Troubleshooting

### Common Issues

1. **Permission denied for Docker**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

2. **AWS CLI not found**
   ```bash
   # Add to PATH in ~/.bashrc or ~/.zshrc
   export PATH=$PATH:/usr/local/bin
   ```

3. **Node.js version conflicts**
   ```bash
   # Use Node Version Manager
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

4. **Python module not found**
   ```bash
   # Install in user directory
   pip3 install --user <module-name>
   ```

5. **Terraform state lock**
   ```bash
   # Force unlock (use carefully)
   terraform force-unlock <LOCK_ID>
   ```

### Getting Help

- Check the [main troubleshooting guide](../troubleshooting.md)
- Review error logs in `logs/` directory
- Ask in team communication channels
- Create an issue in the repository

## Next Steps

After completing the setup:

1. **Verify Setup**: Run `./scripts/verify-setup.sh`
2. **Read Documentation**: Review architecture and API docs
3. **Run Tests**: Ensure all tests pass locally
4. **Create Feature Branch**: Start working on your first task
5. **Submit PR**: Follow the contribution guidelines

## Performance Optimization

### Local Development Tips

1. **Use SSD**: Store project on SSD for faster I/O
2. **Increase Memory**: Allocate more RAM to Docker
3. **Use Local Cache**: Configure npm and pip caches
4. **Optimize IDE**: Disable unnecessary extensions
5. **Monitor Resources**: Use system monitoring tools

### Docker Optimization

```bash
# Increase Docker memory (macOS/Windows)
# Docker Desktop > Settings > Resources > Memory: 4GB+

# Clean up Docker resources
docker system prune -a

# Use multi-stage builds for faster rebuilds
# (Implemented in service Dockerfiles)
```

This completes your local development environment setup. You're now ready to start developing the Global Gaming Platform! 🚀