#!/bin/bash
# Terraform Deployment Monitor
# Monitors the ongoing Terraform deployment and provides status updates

LOG_FILE="infrastructure/terraform/environments/dev/terraform-deploy.log"

echo "🚀 Terraform Deployment Monitor"
echo "================================"
echo ""

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    exit 1
fi

# Get total resources to create
TOTAL=$(grep "Plan:" "$LOG_FILE" | tail -1 | grep -oP '\d+(?= to add)')
echo "📊 Total Resources to Create: $TOTAL"
echo ""

# Monitor progress
while true; do
    CREATED=$(grep -c "Creation complete" "$LOG_FILE" || echo "0")
    CREATING=$(grep -c "Creating..." "$LOG_FILE" || echo "0")
    ERRORS=$(grep -c "Error:" "$LOG_FILE" || echo "0")
    
    PERCENT=$((CREATED * 100 / TOTAL))
    
    clear
    echo "🚀 Terraform Deployment Monitor"
    echo "================================"
    echo ""
    echo "Progress: $CREATED / $TOTAL resources ($PERCENT%)"
    echo "Currently Creating: $CREATING"
    echo "Errors: $ERRORS"
    echo ""
    
    # Show progress bar
    FILLED=$((PERCENT / 2))
    printf "["
    for ((i=0; i<50; i++)); do
        if [ $i -lt $FILLED ]; then
            printf "="
        else
            printf " "
        fi
    done
    printf "] $PERCENT%%\n"
    echo ""
    
    # Show last 10 lines
    echo "Recent Activity:"
    echo "----------------"
    tail -10 "$LOG_FILE" | grep -E "(Creating|Creation complete|Error)" | tail -5
    echo ""
    
    # Check if deployment is complete
    if grep -q "Apply complete!" "$LOG_FILE"; then
        echo "✅ Deployment Complete!"
        RESOURCES_ADDED=$(grep "Apply complete!" "$LOG_FILE" | tail -1 | grep -oP '\d+(?= added)')
        echo "Resources Added: $RESOURCES_ADDED"
        break
    fi
    
    # Check for errors
    if [ "$ERRORS" -gt 0 ]; then
        echo "⚠️  Errors detected! Check log file for details."
    fi
    
    sleep 10
done
