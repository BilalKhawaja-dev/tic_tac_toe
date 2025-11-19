#!/bin/bash

# Force Cleanup AWS Resources
# Handles dependencies that prevent terraform destroy

set -e

AWS_REGION=${AWS_REGION:-eu-west-2}

echo "=========================================="
echo "Force Cleanup AWS Resources"
echo "=========================================="
echo ""
echo "This will manually delete blocking resources"
echo ""

# 1. Delete DAX Clusters (blocking subnet group)
echo "Step 1: Deleting DAX clusters..."
DAX_CLUSTERS=$(aws dax describe-clusters --region $AWS_REGION --query 'Clusters[*].ClusterName' --output text 2>/dev/null || echo "")
if [ -n "$DAX_CLUSTERS" ]; then
    for cluster in $DAX_CLUSTERS; do
        echo "  Deleting DAX cluster: $cluster"
        aws dax delete-cluster --cluster-name $cluster --region $AWS_REGION 2>/dev/null || echo "  Already deleted or error"
    done
    echo "  Waiting for DAX clusters to delete..."
    sleep 30
else
    echo "  No DAX clusters found"
fi

# 2. Delete ElastiCache Clusters (blocking subnet group)
echo ""
echo "Step 2: Deleting ElastiCache clusters..."
CACHE_CLUSTERS=$(aws elasticache describe-cache-clusters --region $AWS_REGION --query 'CacheClusters[*].CacheClusterId' --output text 2>/dev/null || echo "")
if [ -n "$CACHE_CLUSTERS" ]; then
    for cluster in $CACHE_CLUSTERS; do
        echo "  Deleting cache cluster: $cluster"
        aws elasticache delete-cache-cluster --cache-cluster-id $cluster --region $AWS_REGION 2>/dev/null || echo "  Already deleted or error"
    done
    echo "  Waiting for cache clusters to delete..."
    sleep 30
else
    echo "  No cache clusters found"
fi

# 3. Empty and delete ECR repositories
echo ""
echo "Step 3: Emptying ECR repositories..."
ECR_REPOS=$(aws ecr describe-repositories --region $AWS_REGION --query 'repositories[?contains(repositoryName, `global-gaming-platform`)].repositoryName' --output text 2>/dev/null || echo "")
if [ -n "$ECR_REPOS" ]; then
    for repo in $ECR_REPOS; do
        echo "  Emptying ECR repository: $repo"
        # Get all image digests
        IMAGE_DIGESTS=$(aws ecr list-images --repository-name $repo --region $AWS_REGION --query 'imageIds[*].imageDigest' --output text 2>/dev/null || echo "")
        if [ -n "$IMAGE_DIGESTS" ]; then
            # Delete all images
            for digest in $IMAGE_DIGESTS; do
                aws ecr batch-delete-image \
                    --repository-name $repo \
                    --image-ids imageDigest=$digest \
                    --region $AWS_REGION 2>/dev/null || echo "    Image already deleted"
            done
            echo "    Deleted images from $repo"
        else
            echo "    No images in $repo"
        fi
    done
else
    echo "  No ECR repositories found"
fi

# 4. Wait a bit for resources to fully delete
echo ""
echo "Step 4: Waiting for resources to fully delete..."
sleep 20

# 5. Now run terraform destroy again
echo ""
echo "Step 5: Running terraform destroy..."
cd infrastructure/terraform/environments/dev
terraform destroy -auto-approve

echo ""
echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
