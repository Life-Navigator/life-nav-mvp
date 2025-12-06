#!/bin/bash
# ===========================================================================
# Build and Push All Cloud Run Images
# ===========================================================================
# Usage: ./docker/build-all.sh [beta|prod]
# ===========================================================================

set -e

# Configuration
ENV="${1:-beta}"
PROJECT_ID="${GCP_PROJECT_ID:-lifenav-prod}"
REGION="${GCP_REGION:-us-central1}"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/life-navigator"

echo "========================================"
echo "Building Life Navigator Cloud Run Images"
echo "========================================"
echo "Environment: ${ENV}"
echo "Registry: ${REGISTRY}"
echo "========================================"

# Authenticate with GCP (if not already)
echo "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# Change to repository root
cd "$(dirname "$0")/.."

# Define services and their Dockerfiles
declare -A SERVICES=(
    ["api-gateway"]="docker/api-gateway.Dockerfile"
    ["agent-orchestrator"]="docker/agent-orchestrator.Dockerfile"
    ["graphrag-api"]="docker/graphrag-api.Dockerfile"
    ["compliance-checker"]="docker/compliance-checker.Dockerfile"
    ["proactive-engine"]="docker/proactive-engine.Dockerfile"
    ["ingestion-worker"]="docker/ingestion-worker.Dockerfile"
)

# Build and push each service
for SERVICE in "${!SERVICES[@]}"; do
    DOCKERFILE="${SERVICES[$SERVICE]}"
    IMAGE="${REGISTRY}/${SERVICE}:${ENV}"

    echo ""
    echo "========================================"
    echo "Building: ${SERVICE}"
    echo "Dockerfile: ${DOCKERFILE}"
    echo "Image: ${IMAGE}"
    echo "========================================"

    # Build
    docker build \
        -f "${DOCKERFILE}" \
        -t "${IMAGE}" \
        --platform linux/amd64 \
        --build-arg ENVIRONMENT="${ENV}" \
        .

    echo "Pushing: ${IMAGE}"
    docker push "${IMAGE}"

    echo "✓ ${SERVICE} built and pushed successfully"
done

echo ""
echo "========================================"
echo "All images built and pushed!"
echo "========================================"
echo ""
echo "Images pushed:"
for SERVICE in "${!SERVICES[@]}"; do
    echo "  - ${REGISTRY}/${SERVICE}:${ENV}"
done
echo ""
echo "Next steps:"
echo "  1. Run 'terraform apply' to deploy Cloud Run services"
echo "  2. Check Cloud Run console for service status"
echo ""
