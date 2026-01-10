#!/bin/bash
set -e

# ==============================================================================
# Life Navigator - Staging Deployment Script
# ==============================================================================
#
# This script deploys the backend and frontend to staging environment.
#
# Prerequisites:
# - gcloud CLI authenticated (gcloud auth login)
# - Vercel CLI authenticated (vercel login)
# - GCP project configured (life-navigator-staging or your staging project)
# - Secrets already created in GCP Secret Manager
#
# Usage:
#   ./scripts/deploy-staging.sh
#
# ==============================================================================

echo "🚀 Life Navigator - Staging Deployment"
echo "========================================"
echo ""

# Configuration
GCP_PROJECT="${GCP_PROJECT:-life-navigator-staging}"
GCP_REGION="${GCP_REGION:-us-central1}"
BACKEND_SERVICE_NAME="life-navigator-backend-staging"
FRONTEND_VERCEL_ENV="preview"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

echo "📋 Pre-flight checks..."

# Check gcloud is installed and authenticated
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ ERROR: gcloud CLI not found${NC}"
    echo "Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ ERROR: Not authenticated with gcloud${NC}"
    echo "Run: gcloud auth login"
    exit 1
fi

echo -e "${GREEN}✅ gcloud authenticated${NC}"

# Check Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: vercel CLI not found${NC}"
    echo "Install: npm install -g vercel"
    echo "Frontend deployment will be skipped"
    SKIP_FRONTEND=true
else
    echo -e "${GREEN}✅ vercel CLI installed${NC}"
fi

# Verify we're in the repo root
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "apps/web" ]; then
    echo -e "${RED}❌ ERROR: Must run from repository root${NC}"
    exit 1
fi

# Check launch readiness
echo ""
echo "🔍 Running launch readiness checks..."
if [ -x "./scripts/launch-readiness-check.sh" ]; then
    if ! ./scripts/launch-readiness-check.sh; then
        echo -e "${RED}❌ ERROR: Launch readiness checks failed${NC}"
        echo "Fix issues before deploying to staging"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  WARNING: Launch readiness script not found or not executable${NC}"
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"
echo ""

# ==============================================================================
# Confirm Deployment
# ==============================================================================

echo "📦 Deployment Target:"
echo "  GCP Project: $GCP_PROJECT"
echo "  GCP Region: $GCP_REGION"
echo "  Backend Service: $BACKEND_SERVICE_NAME"
echo "  Frontend Env: $FRONTEND_VERCEL_ENV"
echo ""

read -p "Continue with staging deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# ==============================================================================
# Deploy Backend (Cloud Run)
# ==============================================================================

echo ""
echo "🐍 Deploying Backend to Cloud Run..."
echo "-----------------------------------"

cd backend

# Verify secrets exist
echo "Checking required secrets..."
REQUIRED_SECRETS=(
    "SECRET_KEY"
    "ENCRYPTION_KEY"
    "DATABASE_HIPAA_URL"
    "DATABASE_FINANCIAL_URL"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
    if gcloud secrets describe "$secret" --project="$GCP_PROJECT" &> /dev/null; then
        echo -e "${GREEN}✅ $secret exists${NC}"
    else
        echo -e "${RED}❌ ERROR: Secret $secret not found in GCP Secret Manager${NC}"
        echo "Create it with: echo -n 'value' | gcloud secrets create $secret --data-file=- --project=$GCP_PROJECT"
        exit 1
    fi
done

echo ""
echo "Deploying backend service..."

# Deploy to Cloud Run
gcloud run deploy "$BACKEND_SERVICE_NAME" \
    --source . \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --set-env-vars="ENVIRONMENT=staging,USE_GCP_SECRET_MANAGER=true,GCP_PROJECT_ID=$GCP_PROJECT" \
    --update-secrets="SECRET_KEY=SECRET_KEY:latest,ENCRYPTION_KEY=ENCRYPTION_KEY:latest,DATABASE_HIPAA_URL=DATABASE_HIPAA_URL:latest,DATABASE_FINANCIAL_URL=DATABASE_FINANCIAL_URL:latest" \
    --memory=2Gi \
    --cpu=2 \
    --timeout=300 \
    --max-instances=5 \
    --min-instances=0 \
    --service-account="backend@${GCP_PROJECT}.iam.gserviceaccount.com" \
    --tag=staging

# Get backend URL
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --format='value(status.url)')

echo ""
echo -e "${GREEN}✅ Backend deployed successfully${NC}"
echo "   URL: $BACKEND_URL"

cd ..

# ==============================================================================
# Deploy Frontend (Vercel)
# ==============================================================================

if [ "$SKIP_FRONTEND" != "true" ]; then
    echo ""
    echo "⚛️  Deploying Frontend to Vercel..."
    echo "-----------------------------------"

    cd apps/web

    # Link to Vercel project (if not already linked)
    if [ ! -f ".vercel/project.json" ]; then
        echo "Linking to Vercel project..."
        vercel link
    fi

    # Set environment variables for this deployment
    echo "Setting environment variables..."

    # Note: These would typically already be set in Vercel dashboard
    # This is just a reminder of what's needed
    echo "Ensure these environment variables are set in Vercel dashboard:"
    echo "  - NEXT_PUBLIC_API_URL (should be: $BACKEND_URL)"
    echo "  - NEXTAUTH_SECRET"
    echo "  - NEXTAUTH_URL"
    echo "  - NEXT_PUBLIC_SUPABASE_URL"
    echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"

    # Deploy to Vercel (creates preview deployment)
    echo ""
    echo "Deploying to Vercel..."
    FRONTEND_URL=$(vercel --yes | grep -o 'https://[^ ]*' | head -1)

    echo ""
    echo -e "${GREEN}✅ Frontend deployed successfully${NC}"
    echo "   URL: $FRONTEND_URL"

    cd ../..
else
    echo ""
    echo -e "${YELLOW}⚠️  Frontend deployment skipped${NC}"
fi

# ==============================================================================
# Post-Deployment Checks
# ==============================================================================

echo ""
echo "🔍 Post-Deployment Health Checks..."
echo "-----------------------------------"

# Backend health check
echo "Checking backend health..."
if curl -sf "$BACKEND_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
    curl -s "$BACKEND_URL/health" | jq '.'
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    echo "Check logs: gcloud run logs read $BACKEND_SERVICE_NAME --project=$GCP_PROJECT --region=$GCP_REGION"
fi

# Database health check
echo ""
echo "Checking database connectivity..."
if curl -sf "$BACKEND_URL/health/db" > /dev/null; then
    echo -e "${GREEN}✅ Database health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Database health check failed (may be expected if DB not set up)${NC}"
fi

# Security headers check
echo ""
echo "Checking security headers..."
if [ -n "$FRONTEND_URL" ]; then
    HEADERS=$(curl -sI "$FRONTEND_URL" 2>/dev/null || true)

    if echo "$HEADERS" | grep -qi "content-security-policy"; then
        echo -e "${GREEN}✅ CSP header present${NC}"
    else
        echo -e "${YELLOW}⚠️  CSP header not found${NC}"
    fi

    if echo "$HEADERS" | grep -qi "strict-transport-security"; then
        echo -e "${GREEN}✅ HSTS header present${NC}"
    else
        echo -e "${YELLOW}⚠️  HSTS header not found (may be expected in preview)${NC}"
    fi
fi

# Data boundary check (should fail with 400)
echo ""
echo "Testing data boundary enforcement..."
BOUNDARY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/v1/internal/risk-engine/compute" \
    -H "Content-Type: application/json" \
    -d '{"ssn": "123-45-6789"}' 2>/dev/null || true)

BOUNDARY_CODE=$(echo "$BOUNDARY_RESPONSE" | tail -1)

if [ "$BOUNDARY_CODE" = "400" ]; then
    echo -e "${GREEN}✅ Data boundary enforcement working (blocked SSN)${NC}"
elif [ "$BOUNDARY_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠️  Endpoint not found (expected if risk-engine not deployed)${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected response: HTTP $BOUNDARY_CODE${NC}"
fi

# ==============================================================================
# Deployment Summary
# ==============================================================================

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            STAGING DEPLOYMENT COMPLETE 🚀                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Deployment URLs:"
echo "   Backend:  $BACKEND_URL"
if [ -n "$FRONTEND_URL" ]; then
    echo "   Frontend: $FRONTEND_URL"
fi
echo ""
echo "📋 Next Steps:"
echo "   1. Run smoke tests: ./scripts/smoke-test-staging.sh"
echo "   2. Test critical user flows"
echo "   3. Monitor logs for errors"
echo "   4. If issues found, rollback: ./scripts/rollback-staging.sh"
echo ""
echo "📊 Monitoring:"
echo "   Backend logs:  gcloud run logs read $BACKEND_SERVICE_NAME --project=$GCP_PROJECT --region=$GCP_REGION --tail=100"
echo "   Cloud Console: https://console.cloud.google.com/run?project=$GCP_PROJECT"
if [ -n "$FRONTEND_URL" ]; then
    echo "   Vercel:        https://vercel.com/dashboard"
fi
echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
