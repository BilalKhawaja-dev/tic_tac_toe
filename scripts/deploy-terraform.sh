#!/bin/bash

# Terraform Deployment Script
# Deploys infrastructure to specified environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <environment> [action]"
    print_info "Environments: dev, staging, production"
    print_info "Actions: plan, apply, destroy (default: plan)"
    exit 1
fi

ENVIRONMENT=$1
ACTION=${2:-plan}
TERRAFORM_DIR="infrastructure/terraform/environments/$ENVIRONMENT"

# Validate environment
if [ ! -d "$TERRAFORM_DIR" ]; then
    print_error "Environment '$ENVIRONMENT' not found"
    exit 1
fi

# Validate action
if [[ ! "$ACTION" =~ ^(plan|apply|destroy)$ ]]; then
    print_error "Invalid action: $ACTION"
    print_info "Valid actions: plan, apply, destroy"
    exit 1
fi

print_info "========================================="
print_info "Terraform Deployment"
print_info "========================================="
print_info "Environment: $ENVIRONMENT"
print_info "Action: $ACTION"
print_info "Directory: $TERRAFORM_DIR"
print_info "========================================="

# Check prerequisites
print_info "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install it first."
    exit 1
fi

# Check Terraform
if ! command -v terraform &> /dev/null; then
    print_error "Terraform not found. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

print_info "Prerequisites check passed ✓"

# Navigate to terraform directory
cd "$TERRAFORM_DIR"

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    print_warn "terraform.tfvars not found"
    if [ -f "terraform.tfvars.example" ]; then
        print_info "Creating terraform.tfvars from example..."
        cp terraform.tfvars.example terraform.tfvars
        print_warn "Please update terraform.tfvars with your values before proceeding"
        exit 1
    else
        print_error "No terraform.tfvars or example file found"
        exit 1
    fi
fi

# Initialize Terraform
print_info "Initializing Terraform..."
terraform init -upgrade

# Validate Terraform configuration
print_info "Validating Terraform configuration..."
terraform validate

if [ $? -ne 0 ]; then
    print_error "Terraform validation failed"
    exit 1
fi

print_info "Validation passed ✓"

# Format check
print_info "Checking Terraform formatting..."
terraform fmt -check -recursive || {
    print_warn "Formatting issues found. Running terraform fmt..."
    terraform fmt -recursive
}

# Execute action
case $ACTION in
    plan)
        print_info "Running Terraform plan..."
        terraform plan -out=tfplan
        print_info "Plan saved to tfplan"
        print_info "To apply this plan, run: $0 $ENVIRONMENT apply"
        ;;
    
    apply)
        if [ -f "tfplan" ]; then
            print_info "Applying Terraform plan..."
            terraform apply tfplan
            rm -f tfplan
        else
            print_warn "No plan file found. Running plan and apply..."
            terraform plan -out=tfplan
            
            # Ask for confirmation
            read -p "Do you want to apply this plan? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                terraform apply tfplan
                rm -f tfplan
            else
                print_info "Apply cancelled"
                exit 0
            fi
        fi
        
        print_info "========================================="
        print_info "Deployment completed successfully! ✓"
        print_info "========================================="
        
        # Show outputs
        print_info "Infrastructure outputs:"
        terraform output
        ;;
    
    destroy)
        print_warn "========================================="
        print_warn "WARNING: This will destroy all infrastructure!"
        print_warn "========================================="
        
        # Ask for confirmation
        read -p "Are you sure you want to destroy $ENVIRONMENT environment? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            read -p "Type the environment name to confirm: " confirm_env
            if [ "$confirm_env" = "$ENVIRONMENT" ]; then
                print_info "Destroying infrastructure..."
                terraform destroy -auto-approve
                print_info "Infrastructure destroyed"
            else
                print_error "Environment name mismatch. Destroy cancelled."
                exit 1
            fi
        else
            print_info "Destroy cancelled"
            exit 0
        fi
        ;;
esac

print_info "Done!"
