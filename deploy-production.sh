#!/bin/bash
set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if user is logged into required services
check_auth() {
    log_info "Checking authentication status..."

    # Check Vercel
    if ! vercel whoami &> /dev/null; then
        log_error "Not logged into Vercel. Run: vercel login"
        exit 1
    fi
    log_success "Vercel authenticated"

    # Check Google Cloud (optional for frontend-only deployment)
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
        log_success "Google Cloud authenticated"
        GCP_ENABLED=true
    else
        log_warning "Google Cloud not authenticated (backend deployment will be skipped)"
        GCP_ENABLED=false
    fi
}

# Collect necessary environment variables
collect_env_vars() {
    log_info "Collecting environment variables..."

    echo ""
    echo "======================================"
    echo "  Environment Variable Configuration"
    echo "======================================"
    echo ""

    # Database URL
    read -p "Enter your Supabase/PostgreSQL DATABASE_URL (with connection pooling): " DATABASE_URL
    read -p "Enter your Supabase/PostgreSQL DIRECT_URL (direct connection): " DIRECT_URL

    # Auth secrets
    read -p "Enter NEXTAUTH_SECRET (or press enter to generate): " NEXTAUTH_SECRET
    if [ -z "$NEXTAUTH_SECRET" ]; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
        log_info "Generated NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
    fi

    read -p "Enter JWT_SECRET (or press enter to generate): " JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32)
        log_info "Generated JWT_SECRET: $JWT_SECRET"
    fi

    # Stripe keys
    echo ""
    log_info "Stripe Configuration (get from https://dashboard.stripe.com/apikeys)"
    read -p "Enter STRIPE_SECRET_KEY: " STRIPE_SECRET_KEY
    read -p "Enter NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: " NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    read -p "Enter STRIPE_WEBHOOK_SECRET (create webhook first): " STRIPE_WEBHOOK_SECRET

    # Backend API URL (will be set after Cloud Run deployment)
    read -p "Enter NEXT_PUBLIC_API_URL (your FastAPI backend URL, or skip for now): " NEXT_PUBLIC_API_URL
    if [ -z "$NEXT_PUBLIC_API_URL" ]; then
        NEXT_PUBLIC_API_URL="https://api.lifenavigator.app"  # Placeholder
    fi

    # Optional: OAuth credentials
    echo ""
    log_info "Optional OAuth Configuration (press enter to skip)"
    read -p "Enter GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
    read -p "Enter GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET

    # Export for use in deployment
    export DATABASE_URL
    export DIRECT_URL
    export NEXTAUTH_SECRET
    export JWT_SECRET
    export STRIPE_SECRET_KEY
    export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    export STRIPE_WEBHOOK_SECRET
    export NEXT_PUBLIC_API_URL
    export GOOGLE_CLIENT_ID
    export GOOGLE_CLIENT_SECRET

    log_success "Environment variables collected"
}

# Deploy frontend to Vercel
deploy_frontend() {
    log_info "Deploying frontend to Vercel..."

    cd apps/web

    # Link to Vercel project (creates new if doesn't exist)
    log_info "Linking Vercel project..."
    vercel link --yes || true

    # Set environment variables in Vercel
    log_info "Configuring Vercel environment variables..."

    vercel env add DATABASE_URL production <<< "$DATABASE_URL" || vercel env rm DATABASE_URL production && vercel env add DATABASE_URL production <<< "$DATABASE_URL"
    vercel env add DIRECT_URL production <<< "$DIRECT_URL" || vercel env rm DIRECT_URL production && vercel env add DIRECT_URL production <<< "$DIRECT_URL"
    vercel env add NEXTAUTH_SECRET production <<< "$NEXTAUTH_SECRET" || vercel env rm NEXTAUTH_SECRET production && vercel env add NEXTAUTH_SECRET production <<< "$NEXTAUTH_SECRET"
    vercel env add JWT_SECRET production <<< "$JWT_SECRET" || vercel env rm JWT_SECRET production && vercel env add JWT_SECRET production <<< "$JWT_SECRET"
    vercel env add STRIPE_SECRET_KEY production <<< "$STRIPE_SECRET_KEY" || vercel env rm STRIPE_SECRET_KEY production && vercel env add STRIPE_SECRET_KEY production <<< "$STRIPE_SECRET_KEY"
    vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production <<< "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" || vercel env rm NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production && vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production <<< "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    vercel env add STRIPE_WEBHOOK_SECRET production <<< "$STRIPE_WEBHOOK_SECRET" || vercel env rm STRIPE_WEBHOOK_SECRET production && vercel env add STRIPE_WEBHOOK_SECRET production <<< "$STRIPE_WEBHOOK_SECRET"
    vercel env add NEXT_PUBLIC_API_URL production <<< "$NEXT_PUBLIC_API_URL" || vercel env rm NEXT_PUBLIC_API_URL production && vercel env add NEXT_PUBLIC_API_URL production <<< "$NEXT_PUBLIC_API_URL"

    if [ -n "$GOOGLE_CLIENT_ID" ]; then
        vercel env add GOOGLE_CLIENT_ID production <<< "$GOOGLE_CLIENT_ID" || vercel env rm GOOGLE_CLIENT_ID production && vercel env add GOOGLE_CLIENT_ID production <<< "$GOOGLE_CLIENT_ID"
        vercel env add GOOGLE_CLIENT_SECRET production <<< "$GOOGLE_CLIENT_SECRET" || vercel env rm GOOGLE_CLIENT_SECRET production && vercel env add GOOGLE_CLIENT_SECRET production <<< "$GOOGLE_CLIENT_SECRET"
    fi

    # Deploy to production
    log_info "Deploying to production..."
    FRONTEND_URL=$(vercel --prod --yes | grep -o 'https://[^ ]*')

    cd ../..

    log_success "Frontend deployed to: $FRONTEND_URL"
    echo "$FRONTEND_URL" > .vercel-url

    # Update NEXTAUTH_URL with actual deployment URL
    log_info "Updating NEXTAUTH_URL..."
    cd apps/web
    vercel env add NEXTAUTH_URL production <<< "$FRONTEND_URL" || vercel env rm NEXTAUTH_URL production && vercel env add NEXTAUTH_URL production <<< "$FRONTEND_URL"
    cd ../..
}

# Run database migrations
run_migrations() {
    log_info "Running Prisma migrations..."

    cd apps/web

    # Generate Prisma client
    npx prisma generate

    # Run migrations
    log_info "Applying database migrations..."
    DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" npx prisma migrate deploy

    log_success "Database migrations completed"

    cd ../..
}

# Deploy backend to Google Cloud Run
deploy_backend() {
    if [ "$GCP_ENABLED" = false ]; then
        log_warning "Skipping backend deployment (GCP not authenticated)"
        return
    fi

    log_info "Deploying backend to Google Cloud Run..."

    # Get GCP project ID
    GCP_PROJECT=$(gcloud config get-value project)

    log_info "Using GCP project: $GCP_PROJECT"

    # Build and deploy
    cd backend

    gcloud run deploy life-navigator-api \
        --source . \
        --platform managed \
        --region us-central1 \
        --allow-unauthenticated \
        --set-env-vars="DATABASE_URL=$DATABASE_URL" \
        --project="$GCP_PROJECT"

    BACKEND_URL=$(gcloud run services describe life-navigator-api --region us-central1 --format 'value(status.url)')

    cd ..

    log_success "Backend deployed to: $BACKEND_URL"
    echo "$BACKEND_URL" > .backend-url

    # Update frontend with backend URL
    log_info "Updating frontend with backend URL..."
    cd apps/web
    vercel env add NEXT_PUBLIC_API_URL production <<< "$BACKEND_URL" || vercel env rm NEXT_PUBLIC_API_URL production && vercel env add NEXT_PUBLIC_API_URL production <<< "$BACKEND_URL"
    cd ../..
}

# Create Stripe products
create_stripe_products() {
    log_info "Creating Stripe products..."

    cat << 'EOF'

====================================
  Stripe Product Creation
====================================

Please create the following products in your Stripe Dashboard:
https://dashboard.stripe.com/products

ONE-TIME PURCHASES (Payment mode):
1. Chat Queries - Starter: 10 credits, $2.00 (Price ID: price_chat_10)
2. Chat Queries - Popular: 30 credits, $5.00 (Price ID: price_chat_30)
3. Chat Queries - Best Value: 60 credits, $9.00 (Price ID: price_chat_60)
4. Scenario Runs - Starter: 10 credits, $3.00 (Price ID: price_scenario_10)
5. Scenario Runs - Popular: 30 credits, $7.00 (Price ID: price_scenario_30)
6. Scenario Runs - Best Value: 60 credits, $12.00 (Price ID: price_scenario_60)

SUBSCRIPTIONS (for Phase 2):
7. Pro Monthly: $25/month (Price ID: price_pro_monthly)
8. Pro Annual: $250/year (Price ID: price_pro_annual)
9. Enterprise Monthly: $99/month (Price ID: price_enterprise_monthly)
10. Enterprise Annual: $990/year (Price ID: price_enterprise_annual)

After creating these, update the Price IDs in:
- apps/web/src/components/usage/OutOfQueriesModal.tsx
- apps/web/src/app/pricing/page.tsx

EOF

    read -p "Press enter once you've created the Stripe products..."
}

# Setup Stripe webhook
setup_stripe_webhook() {
    log_info "Setting up Stripe webhook..."

    FRONTEND_URL=$(cat .vercel-url)
    WEBHOOK_URL="${FRONTEND_URL}/api/integrations/stripe/webhook"

    cat << EOF

====================================
  Stripe Webhook Configuration
====================================

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter URL: $WEBHOOK_URL
4. Select events to listen to:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - payment_intent.succeeded
   - payment_intent.payment_failed

5. Copy the webhook signing secret
6. Update the STRIPE_WEBHOOK_SECRET in Vercel environment variables

EOF

    read -p "Press enter once webhook is configured..."
}

# Display final summary
show_summary() {
    FRONTEND_URL=$(cat .vercel-url)

    echo ""
    echo "======================================"
    echo "  🎉 Deployment Complete!"
    echo "======================================"
    echo ""
    echo "Frontend URL: $FRONTEND_URL"

    if [ -f .backend-url ]; then
        BACKEND_URL=$(cat .backend-url)
        echo "Backend URL:  $BACKEND_URL"
    fi

    echo ""
    echo "Next Steps:"
    echo "1. ✅ Test the application at $FRONTEND_URL"
    echo "2. ✅ Complete Stripe product setup"
    echo "3. ✅ Configure Stripe webhook"
    echo "4. ✅ Test purchase flow in Stripe test mode"
    echo "5. ✅ Set up custom domain (optional)"
    echo "6. ✅ Configure DNS records"
    echo ""
    echo "Monitoring:"
    echo "- Vercel Dashboard: https://vercel.com/dashboard"
    echo "- Stripe Dashboard: https://dashboard.stripe.com"
    if [ "$GCP_ENABLED" = true ]; then
        echo "- Cloud Run Logs: https://console.cloud.google.com/run"
    fi
    echo ""

    log_success "All done! Your application is live! 🚀"
}

# Main execution
main() {
    echo ""
    echo "======================================"
    echo "  Life Navigator Production Deployment"
    echo "======================================"
    echo ""

    check_auth
    collect_env_vars
    run_migrations
    deploy_frontend
    deploy_backend
    create_stripe_products
    setup_stripe_webhook
    show_summary
}

# Run main function
main
