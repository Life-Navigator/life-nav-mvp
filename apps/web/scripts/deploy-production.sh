#!/bin/bash

# Production Deployment Script for Life Navigator
# This script automates the deployment to Vercel with GCP Cloud SQL

set -e  # Exit on error

echo "🚀 Life Navigator - Production Deployment Script"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_dependencies() {
    echo "📦 Checking dependencies..."

    if ! command -v vercel &> /dev/null; then
        echo -e "${RED}❌ Vercel CLI not installed${NC}"
        echo "Install with: npm i -g vercel"
        exit 1
    fi

    if ! command -v gcloud &> /dev/null; then
        echo -e "${YELLOW}⚠️  Google Cloud SDK not installed (optional for GCP setup)${NC}"
    fi

    echo -e "${GREEN}✅ Dependencies check passed${NC}"
}

# Check environment variables
check_env_vars() {
    echo ""
    echo "🔐 Checking required environment variables..."

    REQUIRED_VARS=(
        "NEXTAUTH_SECRET"
        "DATABASE_URL"
        "ENCRYPTION_KEY"
        "JWT_SECRET"
    )

    MISSING_VARS=()

    for var in "${REQUIRED_VARS[@]}"; do
        if ! vercel env ls production | grep -q "$var"; then
            MISSING_VARS+=("$var")
        fi
    done

    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Set them with: vercel env add $var production"
        exit 1
    fi

    echo -e "${GREEN}✅ All required environment variables are set${NC}"
}

# Run tests
run_tests() {
    echo ""
    echo "🧪 Running tests..."

    if npm test; then
        echo -e "${GREEN}✅ Tests passed${NC}"
    else
        echo -e "${RED}❌ Tests failed${NC}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Build check
build_check() {
    echo ""
    echo "🏗️  Checking build..."

    if npm run build; then
        echo -e "${GREEN}✅ Build successful${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
}

# Deploy to Vercel
deploy_to_vercel() {
    echo ""
    echo "🚀 Deploying to Vercel..."

    if vercel --prod --yes; then
        echo -e "${GREEN}✅ Deployment successful${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    echo ""
    echo "🗄️  Running database migrations..."

    # Pull production environment
    vercel env pull .env.production

    # Run migrations
    if npx prisma migrate deploy; then
        echo -e "${GREEN}✅ Migrations completed${NC}"
    else
        echo -e "${RED}❌ Migrations failed${NC}"
        echo "Check database connection and try manually"
        exit 1
    fi

    # Clean up env file
    rm .env.production
}

# Health check
health_check() {
    echo ""
    echo "🏥 Performing health check..."

    # Get deployment URL
    DEPLOYMENT_URL=$(vercel ls --prod | grep -o 'https://[^ ]*' | head -1)

    if [ -z "$DEPLOYMENT_URL" ]; then
        echo -e "${YELLOW}⚠️  Could not determine deployment URL${NC}"
        return
    fi

    echo "Testing: $DEPLOYMENT_URL/health"

    # Wait a bit for deployment to be ready
    sleep 10

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/health")

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        echo "Deployment is live at: $DEPLOYMENT_URL"
    else
        echo -e "${RED}❌ Health check failed (HTTP $HTTP_CODE)${NC}"
    fi
}

# Main deployment flow
main() {
    check_dependencies
    check_env_vars

    # Ask for confirmation
    echo ""
    echo "⚠️  You are about to deploy to PRODUCTION"
    read -p "Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 0
    fi

    run_tests
    build_check
    deploy_to_vercel
    run_migrations
    health_check

    echo ""
    echo "================================================"
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo "================================================"
}

# Run main function
main
