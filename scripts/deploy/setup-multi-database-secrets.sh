#!/bin/bash
#
# Multi-Database Secrets Setup Script
#
# Creates secrets for the multi-database architecture:
# - Core DB: User accounts, sessions, preferences
# - Finance DB: Financial data (GLBA/PCI DSS compliant)
# - Health DB: Health records (HIPAA compliant)
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Terraform has been applied (databases exist)
# - Running from terraform/gcp/environments/beta directory
#
# Usage:
#   ./setup-multi-database-secrets.sh [PROJECT_ID] [ENVIRONMENT]
#
# Examples:
#   ./setup-multi-database-secrets.sh lifenav-prod beta
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID="${1:-lifenav-prod}"
ENVIRONMENT="${2:-beta}"
REGION="${3:-us-central1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../../terraform/gcp/environments/${ENVIRONMENT}"

echo "=================================================="
echo "Multi-Database Secrets Setup"
echo "=================================================="
echo "Project ID:   $PROJECT_ID"
echo "Environment:  $ENVIRONMENT"
echo "Region:       $REGION"
echo "Terraform:    $TERRAFORM_DIR"
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
        --quiet 2>/dev/null || true
    echo "  Done."
}

# =============================================================================
# Get Terraform Outputs
# =============================================================================

echo "Retrieving database information from Terraform..."
cd "$TERRAFORM_DIR"

# Core Database
CORE_DB_PASSWORD=$(terraform output -raw core_db_password 2>/dev/null || echo "")
CORE_DB_CONNECTION=$(terraform output -raw core_db_connection 2>/dev/null || echo "")

# Finance Database
FINANCE_DB_PASSWORD=$(terraform output -raw finance_db_password 2>/dev/null || echo "")
FINANCE_DB_CONNECTION=$(terraform output -raw finance_db_connection 2>/dev/null || echo "")

# Health Database
HEALTH_DB_PASSWORD=$(terraform output -raw health_db_password 2>/dev/null || echo "")
HEALTH_DB_CONNECTION=$(terraform output -raw health_db_connection 2>/dev/null || echo "")

# Validate we got the values
if [[ -z "$CORE_DB_PASSWORD" ]]; then
    echo "ERROR: Could not retrieve core database password from Terraform"
    echo "Please run 'terraform apply' first."
    exit 1
fi

if [[ -z "$FINANCE_DB_PASSWORD" ]]; then
    echo "ERROR: Could not retrieve finance database password from Terraform"
    echo "Please run 'terraform apply' first."
    exit 1
fi

if [[ -z "$HEALTH_DB_PASSWORD" ]]; then
    echo "ERROR: Could not retrieve health database password from Terraform"
    echo "Please run 'terraform apply' first."
    exit 1
fi

echo "  Core DB Connection: $CORE_DB_CONNECTION"
echo "  Finance DB Connection: $FINANCE_DB_CONNECTION"
echo "  Health DB Connection: $HEALTH_DB_CONNECTION"

# =============================================================================
# Create Database URL Secrets
# =============================================================================

echo ""
echo "Step 1: Creating Core Database Secrets..."
echo "-------------------------------------------"

# Core database password
create_secret "core-database-password" "$CORE_DB_PASSWORD"

# Core database URL (for Cloud Run with Unix socket)
CORE_DB_URL="postgresql://lifenavigator:${CORE_DB_PASSWORD}@localhost/lifenavigator_core?host=/cloudsql/${CORE_DB_CONNECTION}"
create_secret "core-database-url" "$CORE_DB_URL"

echo ""
echo "Step 2: Creating Finance Database Secrets (GLBA/PCI DSS)..."
echo "-------------------------------------------------------------"

# Finance database password
create_secret "finance-database-password" "$FINANCE_DB_PASSWORD"

# Finance database URL
FINANCE_DB_URL="postgresql://lifenavigator:${FINANCE_DB_PASSWORD}@localhost/lifenavigator_finance?host=/cloudsql/${FINANCE_DB_CONNECTION}"
create_secret "finance-database-url" "$FINANCE_DB_URL"

echo ""
echo "Step 3: Creating Health Database Secrets (HIPAA)..."
echo "-----------------------------------------------------"

# Health database password
create_secret "health-database-password" "$HEALTH_DB_PASSWORD"

# Health database URL
HEALTH_DB_URL="postgresql://lifenavigator:${HEALTH_DB_PASSWORD}@localhost/lifenavigator_health?host=/cloudsql/${HEALTH_DB_CONNECTION}"
create_secret "health-database-url" "$HEALTH_DB_URL"

echo ""
echo "Step 4: Creating Encryption Master Key..."
echo "------------------------------------------"

# Generate a 32-byte encryption key for field-level encryption
ENCRYPTION_KEY=$(openssl rand -base64 32)
create_secret "encryption-master-key" "$ENCRYPTION_KEY"

# =============================================================================
# Grant Access to Service Accounts
# =============================================================================

echo ""
echo "Step 5: Granting secret access to service accounts..."
echo "------------------------------------------------------"

# Service accounts that need database access
SERVICE_ACCOUNTS=(
    "ln-api-gateway-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"
    "ln-orchestrator-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"
    "ln-graphrag-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"
    "ln-compliance-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"
    "ln-jobs-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"
    "ln-web-frontend-${ENVIRONMENT}@${PROJECT_ID}.iam.gserviceaccount.com"
)

for SA in "${SERVICE_ACCOUNTS[@]}"; do
    if gcloud iam service-accounts describe "$SA" --project="$PROJECT_ID" &>/dev/null; then
        echo "Granting access for: $SA"

        # Core database access (all services)
        grant_secret_access "core-database-url" "$SA"
        grant_secret_access "core-database-password" "$SA"

        # Finance database access (specific services)
        if [[ "$SA" == *"api-gateway"* ]] || [[ "$SA" == *"web-frontend"* ]] || [[ "$SA" == *"jobs"* ]]; then
            grant_secret_access "finance-database-url" "$SA"
            grant_secret_access "finance-database-password" "$SA"
        fi

        # Health database access (specific services)
        if [[ "$SA" == *"api-gateway"* ]] || [[ "$SA" == *"web-frontend"* ]] || [[ "$SA" == *"jobs"* ]]; then
            grant_secret_access "health-database-url" "$SA"
            grant_secret_access "health-database-password" "$SA"
        fi

        # Encryption key (all services that handle sensitive data)
        grant_secret_access "encryption-master-key" "$SA"
    else
        echo "WARNING: Service account $SA does not exist yet."
    fi
done

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "=================================================="
echo "Multi-Database Secrets Setup Complete!"
echo "=================================================="
echo ""
echo "Created secrets for three compliance-isolated databases:"
echo ""
echo "1. CORE DATABASE (General Application Data)"
echo "   - Secret: core-database-url-${ENVIRONMENT}"
echo "   - Secret: core-database-password-${ENVIRONMENT}"
echo "   - Connection: $CORE_DB_CONNECTION"
echo ""
echo "2. FINANCE DATABASE (GLBA/PCI DSS Compliant)"
echo "   - Secret: finance-database-url-${ENVIRONMENT}"
echo "   - Secret: finance-database-password-${ENVIRONMENT}"
echo "   - Connection: $FINANCE_DB_CONNECTION"
echo "   - Contains: Financial accounts, transactions, tax data"
echo ""
echo "3. HEALTH DATABASE (HIPAA Compliant)"
echo "   - Secret: health-database-url-${ENVIRONMENT}"
echo "   - Secret: health-database-password-${ENVIRONMENT}"
echo "   - Connection: $HEALTH_DB_CONNECTION"
echo "   - Contains: Health records, medical data, PHI"
echo ""
echo "4. ENCRYPTION KEY"
echo "   - Secret: encryption-master-key-${ENVIRONMENT}"
echo "   - Used for field-level encryption of sensitive data"
echo ""
echo "Next steps:"
echo "  1. Update Prisma schema to use multi-database configuration"
echo "  2. Run database migrations for each database"
echo "  3. Update application code to use correct database for each data type"
echo ""
echo "To verify secrets:"
echo "  gcloud secrets list --project=$PROJECT_ID | grep $ENVIRONMENT"
echo ""
