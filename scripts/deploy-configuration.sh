#!/bin/bash

# Configuration Deployment Script
# Automates the deployment of feature flags and application settings

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
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# Function to display usage
usage() {
    cat << EOF
Configuration Deployment Script

Usage: $0 [OPTIONS] COMMAND

Commands:
    deploy-flags       Deploy feature flags configuration
    deploy-settings    Deploy application settings configuration
    validate          Validate configuration files
    preview           Preview configuration changes
    promote           Promote configuration from one environment to another

Options:
    -e, --environment   Target environment (development|staging|production)
    -f, --file         Configuration file path
    -s, --strategy     Deployment strategy (gradual|immediate)
    -d, --description  Deployment description
    --from-env         Source environment for promotion
    --to-env           Target environment for promotion
    --dry-run          Preview changes without deploying
    -h, --help         Show this help message

Examples:
    $0 -e development -f configs/feature-flags.json deploy-flags
    $0 -e production -s gradual -d "Enable new leaderboard" deploy-flags
    $0 --from-env staging --to-env production promote
    $0 -e staging validate

EOF
}

# Parse command line arguments
ENVIRONMENT=""
CONFIG_FILE=""
STRATEGY="gradual"
DESCRIPTION=""
FROM_ENV=""
TO_ENV=""
DRY_RUN=false
COMMAND=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -f|--file)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
        -d|--description)
            DESCRIPTION="$2"
            shift 2
            ;;
        --from-env)
            FROM_ENV="$2"
            shift 2
            ;;
        --to-env)
            TO_ENV="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        deploy-flags|deploy-settings|validate|preview|promote)
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

# Get AppConfig application and environment IDs
get_appconfig_ids() {
    local env_name="$1"
    
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
        --query "Items[?Name=='$env_name'].Id" \
        --output text)
    
    if [[ -z "$ENVIRONMENT_ID" ]]; then
        print_error "AppConfig environment '$env_name' not found"
        exit 1
    fi
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

# Get deployment strategy ID
get_strategy_id() {
    local strategy_name="$1"
    
    case "$strategy_name" in
        "gradual")
            strategy_name="gradual-rollout"
            ;;
        "immediate")
            strategy_name="immediate-rollout"
            ;;
    esac
    
    STRATEGY_ID=$(aws appconfig list-deployment-strategies \
        --region "$AWS_REGION" \
        --query "Items[?Name=='$strategy_name'].Id" \
        --output text)
    
    if [[ -z "$STRATEGY_ID" ]]; then
        print_error "Deployment strategy '$strategy_name' not found"
        exit 1
    fi
    
    echo "$STRATEGY_ID"
}

# Validate configuration file
validate_config() {
    local config_file="$1"
    local config_type="$2"
    
    if [[ ! -f "$config_file" ]]; then
        print_error "Configuration file not found: $config_file"
        exit 1
    fi
    
    # Validate JSON syntax
    if ! jq empty "$config_file" 2>/dev/null; then
        print_error "Invalid JSON in configuration file: $config_file"
        exit 1
    fi
    
    # Validate configuration structure based on type
    case "$config_type" in
        "feature-flags")
            validate_feature_flags "$config_file"
            ;;
        "app-settings")
            validate_app_settings "$config_file"
            ;;
    esac
    
    print_status "Configuration file validation passed: $config_file"
}

# Validate feature flags configuration
validate_feature_flags() {
    local config_file="$1"
    
    # Check required structure
    if ! jq -e '.flags' "$config_file" >/dev/null; then
        print_error "Feature flags configuration must have 'flags' object"
        exit 1
    fi
    
    if ! jq -e '.values' "$config_file" >/dev/null; then
        print_error "Feature flags configuration must have 'values' object"
        exit 1
    fi
    
    # Validate each flag
    jq -r '.flags | keys[]' "$config_file" | while read -r flag_name; do
        if ! jq -e ".flags.\"$flag_name\".name" "$config_file" >/dev/null; then
            print_error "Flag '$flag_name' missing required 'name' property"
            exit 1
        fi
    done
}

# Validate application settings configuration
validate_app_settings() {
    local config_file="$1"
    
    # Check required sections
    required_sections=("database" "api" "game")
    
    for section in "${required_sections[@]}"; do
        if ! jq -e ".$section" "$config_file" >/dev/null; then
            print_error "Application settings must have '$section' section"
            exit 1
        fi
    done
    
    # Validate database settings
    if ! jq -e '.database.connectionTimeout' "$config_file" >/dev/null; then
        print_error "Database section missing 'connectionTimeout'"
        exit 1
    fi
    
    # Validate API settings
    if ! jq -e '.api.rateLimitPerMinute' "$config_file" >/dev/null; then
        print_error "API section missing 'rateLimitPerMinute'"
        exit 1
    fi
}

# Deploy configuration
deploy_configuration() {
    local config_type="$1"
    local config_file="$2"
    
    print_header "Deploying $config_type configuration to $ENVIRONMENT"
    
    # Validate inputs
    if [[ -z "$ENVIRONMENT" ]]; then
        print_error "Environment is required (-e|--environment)"
        exit 1
    fi
    
    if [[ -z "$config_file" ]]; then
        print_error "Configuration file is required (-f|--file)"
        exit 1
    fi
    
    # Validate configuration
    validate_config "$config_file" "$config_type"
    
    # Get AppConfig IDs
    get_appconfig_ids "$ENVIRONMENT"
    
    local profile_name
    case "$config_type" in
        "feature-flags")
            profile_name="feature-flags"
            ;;
        "app-settings")
            profile_name="application-settings"
            ;;
    esac
    
    profile_id=$(get_profile_id "$profile_name")
    strategy_id=$(get_strategy_id "$STRATEGY")
    
    print_status "Configuration details:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Profile: $profile_name"
    echo "  Strategy: $STRATEGY"
    echo "  File: $config_file"
    
    if [[ "$DRY_RUN" == true ]]; then
        print_warning "DRY RUN: Configuration would be deployed with above settings"
        return 0
    fi
    
    # Create new configuration version
    print_status "Creating configuration version..."
    
    config_content=$(cat "$config_file")
    description="${DESCRIPTION:-"Automated deployment of $config_type"}"
    
    config_version=$(aws appconfig create-hosted-configuration-version \
        --application-id "$APPLICATION_ID" \
        --configuration-profile-id "$profile_id" \
        --content-type "application/json" \
        --description "$description" \
        --content "$config_content" \
        --region "$AWS_REGION" \
        --query 'VersionNumber' \
        --output text)
    
    print_status "Created configuration version: $config_version"
    
    # Start deployment
    print_status "Starting deployment..."
    
    deployment_number=$(aws appconfig start-deployment \
        --application-id "$APPLICATION_ID" \
        --environment-id "$ENVIRONMENT_ID" \
        --deployment-strategy-id "$strategy_id" \
        --configuration-profile-id "$profile_id" \
        --configuration-version "$config_version" \
        --description "$description" \
        --region "$AWS_REGION" \
        --query 'DeploymentNumber' \
        --output text)
    
    print_status "Deployment started: $deployment_number"
    
    # Monitor deployment progress
    monitor_deployment "$deployment_number"
}

# Monitor deployment progress
monitor_deployment() {
    local deployment_number="$1"
    
    print_status "Monitoring deployment progress..."
    
    while true; do
        deployment_info=$(aws appconfig get-deployment \
            --application-id "$APPLICATION_ID" \
            --environment-id "$ENVIRONMENT_ID" \
            --deployment-number "$deployment_number" \
            --region "$AWS_REGION")
        
        deployment_state=$(echo "$deployment_info" | jq -r '.State')
        percentage_complete=$(echo "$deployment_info" | jq -r '.PercentageComplete // 0')
        
        case "$deployment_state" in
            "COMPLETE")
                print_status "✅ Deployment completed successfully!"
                break
                ;;
            "ROLLED_BACK")
                print_error "❌ Deployment failed and was rolled back"
                exit 1
                ;;
            "DEPLOYING")
                print_status "⏳ Deployment in progress... ${percentage_complete}% complete"
                sleep 10
                ;;
            "BAKING")
                print_status "🔥 Deployment baking... ${percentage_complete}% complete"
                sleep 10
                ;;
            *)
                print_warning "Unknown deployment state: $deployment_state"
                sleep 5
                ;;
        esac
    done
}

# Preview configuration changes
preview_changes() {
    print_header "Previewing configuration changes for $ENVIRONMENT"
    
    if [[ -z "$ENVIRONMENT" ]]; then
        print_error "Environment is required (-e|--environment)"
        exit 1
    fi
    
    get_appconfig_ids "$ENVIRONMENT"
    
    # Get current configurations
    profiles=("feature-flags" "application-settings")
    
    for profile_name in "${profiles[@]}"; do
        print_status "Current $profile_name configuration:"
        
        profile_id=$(get_profile_id "$profile_name")
        
        # Get latest configuration
        latest_config=$(aws appconfig get-configuration \
            --application "$APPLICATION_ID" \
            --environment "$ENVIRONMENT_ID" \
            --configuration "$profile_id" \
            --client-id "preview-$(date +%s)" \
            --region "$AWS_REGION" \
            --output text \
            --query 'Content')
        
        if [[ -n "$latest_config" ]]; then
            echo "$latest_config" | jq .
        else
            print_warning "No configuration found for $profile_name"
        fi
        
        echo ""
    done
}

# Promote configuration between environments
promote_configuration() {
    print_header "Promoting configuration from $FROM_ENV to $TO_ENV"
    
    if [[ -z "$FROM_ENV" || -z "$TO_ENV" ]]; then
        print_error "Both --from-env and --to-env are required for promotion"
        exit 1
    fi
    
    # Get source environment configuration
    get_appconfig_ids "$FROM_ENV"
    source_app_id="$APPLICATION_ID"
    source_env_id="$ENVIRONMENT_ID"
    
    # Get target environment configuration
    get_appconfig_ids "$TO_ENV"
    target_app_id="$APPLICATION_ID"
    target_env_id="$ENVIRONMENT_ID"
    
    profiles=("feature-flags" "application-settings")
    
    for profile_name in "${profiles[@]}"; do
        print_status "Promoting $profile_name configuration..."
        
        # Get source configuration
        source_profile_id=$(get_profile_id "$profile_name")
        
        source_config=$(aws appconfig get-configuration \
            --application "$source_app_id" \
            --environment "$source_env_id" \
            --configuration "$source_profile_id" \
            --client-id "promote-$(date +%s)" \
            --region "$AWS_REGION" \
            --output text \
            --query 'Content')
        
        if [[ -z "$source_config" ]]; then
            print_warning "No configuration found for $profile_name in $FROM_ENV"
            continue
        fi
        
        # Create temporary file
        temp_file=$(mktemp)
        echo "$source_config" > "$temp_file"
        
        # Deploy to target environment
        ENVIRONMENT="$TO_ENV"
        CONFIG_FILE="$temp_file"
        DESCRIPTION="Promoted from $FROM_ENV"
        
        case "$profile_name" in
            "feature-flags")
                deploy_configuration "feature-flags" "$temp_file"
                ;;
            "application-settings")
                deploy_configuration "app-settings" "$temp_file"
                ;;
        esac
        
        # Clean up
        rm "$temp_file"
    done
}

# Main execution
main() {
    print_header "Configuration Deployment Tool"
    print_status "Region: $AWS_REGION"
    print_status "Command: $COMMAND"
    
    case "$COMMAND" in
        "deploy-flags")
            deploy_configuration "feature-flags" "$CONFIG_FILE"
            ;;
        "deploy-settings")
            deploy_configuration "app-settings" "$CONFIG_FILE"
            ;;
        "validate")
            if [[ -z "$CONFIG_FILE" ]]; then
                print_error "Configuration file is required for validation (-f|--file)"
                exit 1
            fi
            # Determine config type from filename
            if [[ "$CONFIG_FILE" == *"feature"* || "$CONFIG_FILE" == *"flag"* ]]; then
                validate_config "$CONFIG_FILE" "feature-flags"
            else
                validate_config "$CONFIG_FILE" "app-settings"
            fi
            ;;
        "preview")
            preview_changes
            ;;
        "promote")
            promote_configuration
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