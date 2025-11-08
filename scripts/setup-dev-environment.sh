#!/bin/bash

# Global Gaming Platform - Development Environment Setup Script
# This script configures a developer workstation with required tools

set -e

echo "🚀 Setting up Global Gaming Platform Development Environment"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on supported OS
check_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    print_status "Detected OS: $OS"
}

# Install AWS CLI v2
install_aws_cli() {
    print_status "Installing AWS CLI v2..."
    
    if command -v aws &> /dev/null; then
        AWS_VERSION=$(aws --version | cut -d/ -f2 | cut -d' ' -f1)
        print_warning "AWS CLI already installed (version: $AWS_VERSION)"
        return
    fi

    if [[ "$OS" == "linux" ]]; then
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    elif [[ "$OS" == "macos" ]]; then
        curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
        sudo installer -pkg AWSCLIV2.pkg -target /
        rm AWSCLIV2.pkg
    fi
    
    print_status "AWS CLI installed successfully"
}

# Install Terraform
install_terraform() {
    print_status "Installing Terraform..."
    
    if command -v terraform &> /dev/null; then
        TF_VERSION=$(terraform version | head -n1 | cut -d' ' -f2)
        print_warning "Terraform already installed (version: $TF_VERSION)"
        return
    fi

    TERRAFORM_VERSION="1.6.0"
    
    if [[ "$OS" == "linux" ]]; then
        wget "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
        unzip "terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
        sudo mv terraform /usr/local/bin/
        rm "terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
    elif [[ "$OS" == "macos" ]]; then
        wget "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_amd64.zip"
        unzip "terraform_${TERRAFORM_VERSION}_darwin_amd64.zip"
        sudo mv terraform /usr/local/bin/
        rm "terraform_${TERRAFORM_VERSION}_darwin_amd64.zip"
    fi
    
    print_status "Terraform installed successfully"
}

# Install Docker
install_docker() {
    print_status "Installing Docker..."
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        print_warning "Docker already installed (version: $DOCKER_VERSION)"
        return
    fi

    if [[ "$OS" == "linux" ]]; then
        # Install Docker using official script
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        print_warning "Please log out and back in for Docker group membership to take effect"
    elif [[ "$OS" == "macos" ]]; then
        print_warning "Please install Docker Desktop for Mac from https://docker.com/products/docker-desktop"
    fi
    
    print_status "Docker installation completed"
}

# Install Node.js and npm
install_nodejs() {
    print_status "Installing Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_warning "Node.js already installed (version: $NODE_VERSION)"
        return
    fi

    # Install Node.js 18 LTS
    if [[ "$OS" == "linux" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "macos" ]]; then
        # Assume Homebrew is available
        if command -v brew &> /dev/null; then
            brew install node@18
        else
            print_error "Homebrew not found. Please install Node.js manually from https://nodejs.org"
            return 1
        fi
    fi
    
    print_status "Node.js installed successfully"
}

# Install Python and pip
install_python() {
    print_status "Installing Python 3.9..."
    
    if command -v python3.9 &> /dev/null; then
        PYTHON_VERSION=$(python3.9 --version)
        print_warning "Python 3.9 already installed (version: $PYTHON_VERSION)"
        return
    fi

    if [[ "$OS" == "linux" ]]; then
        sudo apt-get update
        sudo apt-get install -y python3.9 python3.9-pip python3.9-venv
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install python@3.9
        else
            print_error "Homebrew not found. Please install Python manually"
            return 1
        fi
    fi
    
    print_status "Python 3.9 installed successfully"
}

# Configure AWS CLI
configure_aws() {
    print_status "Configuring AWS CLI..."
    
    if [[ -f ~/.aws/credentials ]]; then
        print_warning "AWS credentials already configured"
        return
    fi

    print_status "Please configure AWS CLI with your credentials:"
    aws configure
    
    # Set default region for the project
    aws configure set region eu-west-2
    
    print_status "AWS CLI configured successfully"
}

# Create project directory structure
create_project_structure() {
    print_status "Creating project directory structure..."
    
    mkdir -p \
        src/{game-engine,user-service,leaderboard-service,support-service} \
        infrastructure/{terraform,docker} \
        scripts/{deployment,testing} \
        docs/{api,architecture,runbooks} \
        tests/{unit,integration,e2e} \
        .github/workflows
    
    print_status "Project structure created"
}

# Install development tools
install_dev_tools() {
    print_status "Installing development tools..."
    
    # Install global npm packages
    npm install -g @aws-cdk/cli serverless jest eslint prettier
    
    # Install Python development tools
    pip3 install --user boto3 pytest black flake8 mypy
    
    print_status "Development tools installed"
}

# Create environment configuration
create_env_config() {
    print_status "Creating environment configuration..."
    
    cat > .env.example << EOF
# AWS Configuration
AWS_REGION=eu-west-2
AWS_ACCOUNT_ID=your-account-id

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Database Configuration
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
EOF

    print_status "Environment configuration template created (.env.example)"
}

# Main execution
main() {
    print_status "Starting development environment setup..."
    
    check_os
    install_aws_cli
    install_terraform
    install_docker
    install_nodejs
    install_python
    configure_aws
    create_project_structure
    install_dev_tools
    create_env_config
    
    print_status "✅ Development environment setup completed!"
    print_status "Next steps:"
    echo "  1. Copy .env.example to .env and update with your values"
    echo "  2. Run 'aws sts get-caller-identity' to verify AWS access"
    echo "  3. Run 'terraform version' to verify Terraform installation"
    echo "  4. Run 'docker --version' to verify Docker installation"
    echo "  5. Initialize Git repository: git init"
}

# Run main function
main "$@"