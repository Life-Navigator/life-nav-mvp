#!/bin/bash
#
# Web Frontend Secrets Setup Script
#
# Creates secrets required for the Next.js web frontend on Cloud Run.
# These secrets are in addition to the main setup-secrets.sh
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - PROJECT_ID set in environment or passed as argument
# - Database password secret already created (database-password-{env})
#
# Usage:
#   ./setup-web-frontend-secrets.sh [PROJECT_ID] [ENVIRONMENT]
#
# Examples:
#   ./setup-web-frontend-secrets.sh lifenav-prod beta
#   ./setup-web-frontend-secrets.sh lifenav-prod prod
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID="${1:-lifenav-prod}"
ENVIRONMENT="${2:-beta}"
REGION="${3:-us-central1}"

echo "=================================================="
echo "Web Frontend Secrets Setup"
echo "=================================================="
echo "Project ID:   $PROJECT_ID"
echo "Environment:  $ENVIRONMENT"
echo "Region:       $REGION"
echo "=================================================="
echo ""

# Set the active project
gcloud config set project "$PROJECT_ID"

# =============================================================================
# Helper Functions
# =============================================================================

create_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local full_name="${secret_name}-${ENVIRONMENT}"

    echo "Creating secret: $full_name"

    # Check if secret exists
    if gcloud secrets describe "$full_name" --project="$PROJECT_ID" &>/dev/null; then
        echo "  Secret exists, adding new version..."
        echo -n "$secret_value" | gcloud secrets versions add "$full_name" \
            --project="$PROJECT_ID" \
            --data-file=-
    else
        echo "  Creating new secret..."
        echo -n "$secret_value" | gcloud secrets create "$full_name" \
            --project="$PROJECT_ID" \
            --data-file=- \
            --replication-policy="automatic"
    fi
    echo "  Done."
}

grant_secret_access() {
    local secret_name="$1"
    local service_account="$2"
    local full_name="${secret_name}-${ENVIRONMENT}"

    echo "Granting access to $full_name for $service_account..."
    gcloud secrets add-iam-policy-binding "$full_name" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:${service_account}" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet
    echo "  Done."
}

# =============================================================================
# Create Secrets
# =============================================================================

echo ""
echo "Step 1: Creating NEXTAUTH_SECRET..."
echo "-----------------------------------"

# Generate a secure NextAuth secret (32 bytes, base64 encoded)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
create_secret "nextauth-secret" "$NEXTAUTH_SECRET"

echo ""
echo "Step 2: Creating DATABASE_URL..."
echo "---------------------------------"

# Get the database password from existing secret
echo "Retrieving database password..."
DB_PASSWORD=$(gcloud secrets versions access latest \
    --secret="database-password-${ENVIRONMENT}" \
    --project="$PROJECT_ID" 2>/dev/null || echo "")

if [[ -z "$DB_PASSWORD" ]]; then
    echo "ERROR: Could not retrieve database-password-${ENVIRONMENT}"
    echo "Please ensure the main setup-secrets.sh has been run first."
    exit 1
fi

# Get Cloud SQL instance connection name
echo "Getting Cloud SQL connection name..."
INSTANCE_NAME="life-navigator-db-${ENVIRONMENT}"
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --format='value(connectionName)' 2>/dev/null || echo "")

if [[ -z "$CONNECTION_NAME" ]]; then
    echo "WARNING: Could not find Cloud SQL instance: $INSTANCE_NAME"
    echo "Using placeholder connection string. Update after Terraform apply."
    CONNECTION_NAME="${PROJECT_ID}:${REGION}:${INSTANCE_NAME}"
fi

# Construct database URL for Cloud Run (uses Unix socket)
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@localhost/lifenavigator_${ENVIRONMENT}?host=/cloudsql/${CONNECTION_NAME}"

create_secret "database-url" "$DATABASE_URL"

# =============================================================================
# Grant Access to Service Accounts
# =============================================================================

echo ""
echo "Step 3: Granting secret access..."
echo "----------------------------------"

WEB_FRONTEND_SA="ln-web-frontend-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if service account exists
if gcloud iam service-accounts describe "$WEB_FRONTEND_SA" --project="$PROJECT_ID" &>/dev/null; then
    grant_secret_access "nextauth-secret" "$WEB_FRONTEND_SA"
    grant_secret_access "database-url" "$WEB_FRONTEND_SA"
else
    echo "WARNING: Service account $WEB_FRONTEND_SA does not exist yet."
    echo "Run 'terraform apply' first, then re-run this script to grant permissions."
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "=================================================="
echo "Web Frontend Secrets Setup Complete!"
echo "=================================================="
echo ""
echo "Created secrets:"
echo "  - nextauth-secret-${ENVIRONMENT}"
echo "  - database-url-${ENVIRONMENT}"
echo ""
echo "Next steps:"
echo "  1. Run 'terraform apply' if not already done"
echo "  2. Re-run this script to grant SA permissions (if SA didn't exist)"
echo "  3. Deploy the web frontend via CI/CD"
echo ""
echo "To verify secrets:"
echo "  gcloud secrets list --project=$PROJECT_ID | grep $ENVIRONMENT"
echo ""
