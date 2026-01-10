#!/bin/bash
set -e

# ==============================================================================
# Life Navigator - Staging Rollback Script
# ==============================================================================
#
# This script rolls back staging deployment to the previous version.
#
# Usage:
#   ./scripts/rollback-staging.sh [OPTIONS]
#
# Options:
#   --backend-only    Rollback backend only
#   --frontend-only   Rollback frontend only
#   --to-revision N   Rollback to specific revision
#
# ==============================================================================

# Configuration
GCP_PROJECT="${GCP_PROJECT:-life-navigator-staging}"
GCP_REGION="${GCP_REGION:-us-central1}"
BACKEND_SERVICE_NAME="life-navigator-backend-staging"
BACKEND_ONLY=false
FRONTEND_ONLY=false
SPECIFIC_REVISION=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==============================================================================
# Parse Arguments
# ==============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --to-revision)
            SPECIFIC_REVISION="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--backend-only|--frontend-only] [--to-revision N]"
            exit 1
            ;;
    esac
done

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

echo "🔄 Life Navigator - Staging Rollback"
echo "====================================="
echo ""

# Check gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ ERROR: gcloud CLI not found${NC}"
    exit 1
fi

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ ERROR: Not authenticated with gcloud${NC}"
    exit 1
fi

echo -e "${GREEN}✅ gcloud authenticated${NC}"
echo ""

# ==============================================================================
# Show Current and Previous Revisions
# ==============================================================================

echo "📋 Current Deployment Status:"
echo "------------------------------"
echo ""

if [ "$FRONTEND_ONLY" != "true" ]; then
    echo "Backend Revisions (last 5):"
    gcloud run revisions list \
        --service="$BACKEND_SERVICE_NAME" \
        --project="$GCP_PROJECT" \
        --region="$GCP_REGION" \
        --limit=5 \
        --format="table(metadata.name,status.conditions[0].status,spec.containers[0].image.split('/')[-1],metadata.creationTimestamp)"

    echo ""

    # Get current traffic routing
    echo "Current Traffic Routing:"
    gcloud run services describe "$BACKEND_SERVICE_NAME" \
        --project="$GCP_PROJECT" \
        --region="$GCP_REGION" \
        --format="table(status.traffic[].revisionName,status.traffic[].percent)"

    echo ""
fi

if [ "$BACKEND_ONLY" != "true" ] && command -v vercel &> /dev/null; then
    echo "Frontend Deployments (last 5):"
    vercel ls --yes 2>/dev/null | head -6 || echo "  (Run 'vercel login' to see deployments)"
    echo ""
fi

# ==============================================================================
# Confirm Rollback
# ==============================================================================

echo "⚠️  WARNING: This will rollback the staging environment"
echo ""

if [ -n "$SPECIFIC_REVISION" ]; then
    echo "  Target Revision: $SPECIFIC_REVISION"
else
    echo "  Target: Previous revision (auto-detect)"
fi

if [ "$BACKEND_ONLY" = "true" ]; then
    echo "  Scope: Backend only"
elif [ "$FRONTEND_ONLY" = "true" ]; then
    echo "  Scope: Frontend only"
else
    echo "  Scope: Both backend and frontend"
fi

echo ""
read -p "Continue with rollback? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled"
    exit 0
fi

# ==============================================================================
# Rollback Backend
# ==============================================================================

if [ "$FRONTEND_ONLY" != "true" ]; then
    echo ""
    echo "🔄 Rolling back backend..."
    echo "-------------------------"

    if [ -n "$SPECIFIC_REVISION" ]; then
        # Rollback to specific revision
        echo "Rolling back to revision: $SPECIFIC_REVISION"

        gcloud run services update-traffic "$BACKEND_SERVICE_NAME" \
            --project="$GCP_PROJECT" \
            --region="$GCP_REGION" \
            --to-revisions="$SPECIFIC_REVISION=100"

    else
        # Rollback to previous revision
        echo "Finding previous revision..."

        # Get all revisions sorted by creation time
        REVISIONS=$(gcloud run revisions list \
            --service="$BACKEND_SERVICE_NAME" \
            --project="$GCP_PROJECT" \
            --region="$GCP_REGION" \
            --sort-by="~metadata.creationTimestamp" \
            --format="value(metadata.name)" \
            --limit=5)

        # Get current serving revision
        CURRENT_REVISION=$(gcloud run services describe "$BACKEND_SERVICE_NAME" \
            --project="$GCP_PROJECT" \
            --region="$GCP_REGION" \
            --format="value(status.traffic[0].revisionName)")

        echo "Current revision: $CURRENT_REVISION"

        # Find previous revision
        PREVIOUS_REVISION=""
        FOUND_CURRENT=false

        while IFS= read -r rev; do
            if [ "$FOUND_CURRENT" = "true" ]; then
                PREVIOUS_REVISION="$rev"
                break
            fi
            if [ "$rev" = "$CURRENT_REVISION" ]; then
                FOUND_CURRENT=true
            fi
        done <<< "$REVISIONS"

        if [ -z "$PREVIOUS_REVISION" ]; then
            echo -e "${RED}❌ ERROR: Could not find previous revision${NC}"
            exit 1
        fi

        echo "Previous revision: $PREVIOUS_REVISION"
        echo ""

        # Route 100% traffic to previous revision
        gcloud run services update-traffic "$BACKEND_SERVICE_NAME" \
            --project="$GCP_PROJECT" \
            --region="$GCP_REGION" \
            --to-revisions="$PREVIOUS_REVISION=100"
    fi

    echo ""
    echo -e "${GREEN}✅ Backend rollback complete${NC}"

    # Get new backend URL
    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" \
        --project="$GCP_PROJECT" \
        --region="$GCP_REGION" \
        --format='value(status.url)')

    echo "   URL: $BACKEND_URL"
fi

# ==============================================================================
# Rollback Frontend
# ==============================================================================

if [ "$BACKEND_ONLY" != "true" ] && command -v vercel &> /dev/null; then
    echo ""
    echo "🔄 Rolling back frontend..."
    echo "--------------------------"

    cd apps/web 2>/dev/null || cd ../../apps/web 2>/dev/null || true

    if [ -f ".vercel/project.json" ]; then
        echo "Finding previous deployment..."

        # Get previous deployment URL
        PREVIOUS_URL=$(vercel ls --yes 2>/dev/null | grep "https://" | head -2 | tail -1 | awk '{print $1}' || true)

        if [ -n "$PREVIOUS_URL" ]; then
            echo "Previous deployment: $PREVIOUS_URL"
            echo ""

            # Promote previous deployment
            vercel promote "$PREVIOUS_URL" --yes

            echo ""
            echo -e "${GREEN}✅ Frontend rollback complete${NC}"
            echo "   URL: $PREVIOUS_URL"
        else
            echo -e "${YELLOW}⚠️  Could not auto-detect previous deployment${NC}"
            echo "   Manual rollback required via Vercel dashboard"
        fi
    else
        echo -e "${YELLOW}⚠️  Not linked to Vercel project${NC}"
        echo "   Manual rollback required via Vercel dashboard"
    fi

    cd ../.. 2>/dev/null || true
fi

# ==============================================================================
# Post-Rollback Health Check
# ==============================================================================

if [ "$FRONTEND_ONLY" != "true" ]; then
    echo ""
    echo "🔍 Post-Rollback Health Check..."
    echo "--------------------------------"

    sleep 5  # Wait for traffic routing to take effect

    echo "Checking backend health..."
    if curl -sf "$BACKEND_URL/health" > /dev/null; then
        echo -e "${GREEN}✅ Backend health check passed${NC}"
        curl -s "$BACKEND_URL/health" | jq '.' || cat
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
        echo "Check logs immediately:"
        echo "  gcloud run logs read $BACKEND_SERVICE_NAME --project=$GCP_PROJECT --region=$GCP_REGION --tail=50"
    fi
fi

# ==============================================================================
# Rollback Summary
# ==============================================================================

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ROLLBACK COMPLETE                               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Next Steps:"
echo "   1. Verify service is healthy"
echo "   2. Run smoke tests: ./scripts/smoke-test-staging.sh"
echo "   3. Investigate what caused the rollback"
echo "   4. Fix issues before next deployment"
echo ""
echo "📊 Monitoring:"

if [ "$FRONTEND_ONLY" != "true" ]; then
    echo "   Backend logs:  gcloud run logs read $BACKEND_SERVICE_NAME --project=$GCP_PROJECT --region=$GCP_REGION --tail=100"
    echo "   Cloud Console: https://console.cloud.google.com/run?project=$GCP_PROJECT"
fi

if [ "$BACKEND_ONLY" != "true" ]; then
    echo "   Vercel:        https://vercel.com/dashboard"
fi

echo ""
echo -e "${GREEN}✅ Rollback successful${NC}"
