#!/bin/bash

# Emergency Configuration Rollback Script
# This script provides emergency rollback capabilities for AppConfig deployments

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-"eu-west-2"}
APPLICATION_NAME=${APPLICATION_NAME:-"global-gaming-platform"}

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[EMERGENCY]${NC} $1"
}

# Function to display usage
usage() {
    cat << EOF
Emergency Configuration Rollback Script

Usage: $0 [OPTIONS] COMMAND

Commands:
    list-deployments    List recent deployments for rollback
    rollback           Rollback to previous configuration
    stop-deployment    Stop ongoing deployment
    emergency-disable  Disable feature flags immediately
    status            Show current deployment status

Options:
    -e, --environment   Environment (development|staging|production)
    -p, --profile      Configuration profile (feature-flags|app-settings)
    -d, --deployment   Deployment number to rollback to
    -f, --force        Force rollback without confirmation
    -h, --help         Show this help message

Examples:
    $0 -e production list-deployments
    $0 -e production -p feature-flags rollback -d 123
    $0 -e production emergency-disable
    $0 -e staging stop-deployment

EOF
}

# Parse command line arguments
ENVIRONMENT=""
PROFILE=""
DEPLOYMENT_NUMBER=""
FORCE=false
COMMAND=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        -d|--deployment)
            DEPLOYMENT_NUMBER="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        list-deployments|rollback|stop-deployment|emergency-disable|status)
            COMMAND="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$COMMAND" ]]; then
    print_error "Command is required"
    usage
    exit 1
fi

if [[ -z "$ENVIRONMENT" ]]; then
    print_error "Environment is required (-e|--environment)"
    usage
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment. Must be: development, staging, or production"
    exit 1
fi

# Get AppConfig application and environment IDs
get_appconfig_ids() {
    print_status "Getting AppConfig application and environment IDs..."
    
    # Get application ID
    APPLICATION_ID=$(aws appconfig list-applications \
        --region "$AWS_REGION" \
        --query "Items[?Name=='$APPLICATION_NAME'].Id" \
        --output text)
    
    if [[ -z "$APPLICATION_ID" ]]; then
        print_error "AppConfig application '$APPLICATION_NAME' not found"
        exit 1
    fi
    
    # Get environment ID
    ENVIRONMENT_ID=$(aws appconfig list-environments \
        --application-id "$APPLICATION_ID" \
        --region "$AWS_REGION" \
        --query "Items[?Name=='$ENVIRONMENT'].Id" \
        --output text)
    
    if [[ -z "$ENVIRONMENT_ID" ]]; then
        print_error "AppConfig environment '$ENVIRONMENT' not found"
        exit 1
    fi
    
    print_status "Application ID: $APPLICATION_ID"
    print_status "Environment ID: $ENVIRONMENT_ID"
}

# Get configuration profile ID
get_profile_id() {
    local profile_name="$1"
    
    PROFILE_ID=$(aws appconfig list-configuration-profiles \
        --application-id "$APPLICATION_ID" \
        --region "$AWS_REGION" \
        --query "Items[?Name=='$profile_name'].Id" \
        --output text)
    
    if [[ -z "$PROFILE_ID" ]]; then
        print_error "Configuration profile '$profile_name' not found"
        exit 1
    fi
    
    echo "$PROFILE_ID"
}

# List recent deployments
list_deployments() {
    print_header "Listing recent deployments for environment: $ENVIRONMENT"
    
    get_appconfig_ids
    
    # List deployments for all profiles if none specified
    if [[ -z "$PROFILE" ]]; then
        profiles=("feature-flags" "app-settings")
    else
        profiles=("$PROFILE")
    fi
    
    for profile in "${profiles[@]}"; do
        print_status "Deployments for profile: $profile"
        
        profile_id=$(get_profile_id "$profile")
        
        aws appconfig list-deployments \
            --application-id "$APPLICATION_ID" \
            --environment-id "$ENVIRONMENT_ID" \
            --region "$AWS_REGION" \
            --query 'Items[0:10].{DeploymentNumber:DeploymentNumber,State:State,StartedAt:StartedAt,CompletedAt:CompletedAt,Description:Description}' \
            --output table
        
        echo ""
    done
}

# Get deployment status
get_deployment_status() {
    print_header "Current deployment status for environment: $ENVIRONMENT"
    
    get_appconfig_ids
    
    # Check ongoing deployments
    ongoing_deployments=$(aws appconfig list-deployments \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --region "$AWS_REGION" \
        --query 'Items[?State==`DEPLOYING`]' \
        --output json)
    
    if [[ "$ongoing_deployments" != "[]" ]]; then
        print_warning "Ongoing deployments found:"
        echo "$ongoing_deployments" | jq -r '.[] | "Deployment \(.DeploymentNumber): \(.State) - \(.Description // "No description")"'
    else
        print_status "No ongoing deployments"
    fi
    
    # Show recent completed deployments
    print_status "Recent completed deployments:"
    aws appconfig list-deployments \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --region "$AWS_REGION" \
        --query 'Items[0:5].{DeploymentNumber:DeploymentNumber,State:State,CompletedAt:CompletedAt,Description:Description}' \
        --output table
}

# Stop ongoing deployment
stop_deployment() {
    print_header "Stopping ongoing deployment for environment: $ENVIRONMENT"
    
    get_appconfig_ids
    
    # Find ongoing deployment
    ongoing_deployment=$(aws appconfig list-deployments \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --region "$AWS_REGION" \
        --query 'Items[?State==`DEPLOYING`] | [0].DeploymentNumber' \
        --output text)
    
    if [[ -z "$ongoing_deployment" || "$ongoing_deployment" == "None" ]]; then
        print_status "No ongoing deployment to stop"
        return 0
    fi
    
    print_warning "Found ongoing deployment: $ongoing_deployment"
    
    if [[ "$FORCE" != true ]]; then
        read -p "Are you sure you want to stop deployment $ongoing_deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Deployment stop cancelled"
            return 0
        fi
    fi
    
    print_status "Stopping deployment $ongoing_deployment..."
    
    aws appconfig stop-deployment \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --deployment-number "$ongoing_deployment" \
        --region "$AWS_REGION"
    
    print_status "Deployment stop initiated"
}

# Rollback to previous configuration
rollback_configuration() {
    print_header "Rolling back configuration for environment: $ENVIRONMENT"
    
    if [[ -z "$PROFILE" ]]; then
        print_error "Profile is required for rollback (-p|--profile)"
        exit 1
    fi
    
    get_appconfig_ids
    profile_id=$(get_profile_id "$PROFILE")
    
    # If deployment number not specified, get the previous successful deployment
    if [[ -z "$DEPLOYMENT_NUMBER" ]]; then
        print_status "Finding previous successful deployment..."
        
        DEPLOYMENT_NUMBER=$(aws appconfig list-deployments \
            --application-id "$APPLICATION_ID" \
            --environment-id "$ENVIRONMENT_ID" \
            --region "$AWS_REGION" \
            --query 'Items[?State==`COMPLETE`] | [1].DeploymentNumber' \
            --output text)
        
        if [[ -z "$DEPLOYMENT_NUMBER" || "$DEPLOYMENT_NUMBER" == "None" ]]; then
            print_error "No previous successful deployment found"
            exit 1
        fi
        
        print_status "Found previous deployment: $DEPLOYMENT_NUMBER"
    fi
    
    # Get deployment details
    deployment_info=$(aws appconfig get-deployment \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --deployment-number "$DEPLOYMENT_NUMBER" \
        --region "$AWS_REGION")
    
    config_version=$(echo "$deployment_info" | jq -r '.ConfigurationVersion')
    
    print_warning "Rollback details:"
    echo "  Profile: $PROFILE"
    echo "  Deployment: $DEPLOYMENT_NUMBER"
    echo "  Configuration Version: $config_version"
    
    if [[ "$FORCE" != true ]]; then
        read -p "Are you sure you want to rollback to this configuration? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Rollback cancelled"
            return 0
        fi
    fi
    
    # Get immediate deployment strategy
    strategy_id=$(aws appconfig list-deployment-strategies \
        --region "$AWS_REGION" \
        --query 'Items[?Name==`immediate-rollout`].Id' \
        --output text)
    
    if [[ -z "$strategy_id" ]]; then
        print_error "Immediate deployment strategy not found"
        exit 1
    fi
    
    print_status "Starting rollback deployment..."
    
    # Start deployment with previous configuration version
    rollback_deployment=$(aws appconfig start-deployment \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --deployment-strategy-id "$strategy_id" \
        --configuration-profile-id "$profile_id" \
        --configuration-version "$config_version" \
        --description "Emergency rollback to deployment $DEPLOYMENT_NUMBER" \
        --region "$AWS_REGION" \
        --query 'DeploymentNumber' \
        --output text)
    
    print_status "Rollback deployment started: $rollback_deployment"
    print_status "Monitoring deployment progress..."
    
    # Monitor deployment progress
    while true; do
        deployment_state=$(aws appconfig get-deployment \
            --application-id "$APPLICATION_ID" \
            --environment-id "$ENVIRONMENT_ID" \
            --deployment-number "$rollback_deployment" \
            --region "$AWS_REGION" \
            --query 'State' \
            --output text)
        
        case "$deployment_state" in
            "COMPLETE")
                print_status "✅ Rollback completed successfully!"
                break
                ;;
            "ROLLED_BACK")
                print_error "❌ Rollback failed and was rolled back"
                exit 1
                ;;
            "DEPLOYING")
                print_status "⏳ Rollback in progress..."
                sleep 10
                ;;
            *)
                print_warning "Unknown deployment state: $deployment_state"
                sleep 5
                ;;
        esac
    done
}

# Emergency disable all feature flags
emergency_disable() {
    print_header "EMERGENCY: Disabling all feature flags for environment: $ENVIRONMENT"
    
    get_appconfig_ids
    profile_id=$(get_profile_id "feature-flags")
    
    print_warning "This will disable ALL feature flags immediately!"
    
    if [[ "$FORCE" != true ]]; then
        read -p "Are you sure you want to proceed? Type 'EMERGENCY' to confirm: " -r
        echo
        if [[ "$REPLY" != "EMERGENCY" ]]; then
            print_status "Emergency disable cancelled"
            return 0
        fi
    fi
    
    # Create emergency configuration with all flags disabled
    emergency_config='{
        "flags": {},
        "values": {},
        "version": "emergency-disable"
    }'
    
    print_status "Creating emergency configuration..."
    
    # Create new configuration version
    config_version=$(aws appconfig create-hosted-configuration-version \
        --application-id "$APPLICATION_ID" \
        --configuration-profile-id "$profile_id" \
        --content-type "application/json" \
        --description "Emergency disable all feature flags" \
        --content "$emergency_config" \
        --region "$AWS_REGION" \
        --query 'VersionNumber' \
        --output text)
    
    # Get immediate deployment strategy
    strategy_id=$(aws appconfig list-deployment-strategies \
        --region "$AWS_REGION" \
        --query 'Items[?Name==`immediate-rollout`].Id' \
        --output text)
    
    print_status "Deploying emergency configuration..."
    
    # Deploy immediately
    emergency_deployment=$(aws appconfig start-deployment \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --deployment-strategy-id "$strategy_id" \
        --configuration-profile-id "$profile_id" \
        --configuration-version "$config_version" \
        --description "EMERGENCY: Disable all feature flags" \
        --region "$AWS_REGION" \
        --query 'DeploymentNumber' \
        --output text)
    
    print_status "Emergency deployment started: $emergency_deployment"
    print_status "All feature flags will be disabled within 60 seconds"
}

# Main execution
main() {
    print_header "Emergency Configuration Management"
    print_status "Environment: $ENVIRONMENT"
    print_status "Region: $AWS_REGION"
    print_status "Command: $COMMAND"
    
    case "$COMMAND" in
        "list-deployments")
            list_deployments
            ;;
        "rollback")
            rollback_configuration
            ;;
        "stop-deployment")
            stop_deployment
            ;;
        "emergency-disable")
            emergency_disable
            ;;
        "status")
            get_deployment_status
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"