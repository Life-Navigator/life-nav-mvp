#!/bin/bash
#
# GCP Secret Manager Setup Script
#
# Creates all required secrets for Life Navigator production deployment.
# Secrets are stored in Google Cloud Secret Manager and accessed via
# External Secrets Operator in Kubernetes.
#
# Prerequisites:
# - gcloud CLI installed and authenticated
# - PROJECT_ID set in environment or passed as argument
# - Appropriate IAM permissions (roles/secretmanager.admin)
#
# Usage:
#   ./setup-secrets.sh [PROJECT_ID] [ENVIRONMENT]
#
# Examples:
#   ./setup-secrets.sh my-gcp-project production
#   ./setup-secrets.sh my-gcp-project staging
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID="${1:-}"
ENVIRONMENT="${2:-production}"

if [[ -z "$PROJECT_ID" ]]; then
    echo "Error: PROJECT_ID not provided"
    echo "Usage: $0 PROJECT_ID [ENVIRONMENT]"
    exit 1
fi

echo "=================================================="
echo "GCP Secret Manager Setup"
echo "=================================================="
echo "Project ID:   $PROJECT_ID"
echo "Environment:  $ENVIRONMENT"
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
    local description="$3"

    echo "Creating secret: $secret_name"

    # Check if secret already exists
    if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &>/dev/null; then
        echo "  ✓ Secret already exists, adding new version"
        echo -n "$secret_value" | gcloud secrets versions add "$secret_name" \
            --project="$PROJECT_ID" \
            --data-file=-
    else
        echo "  ✓ Creating new secret"
        echo -n "$secret_value" | gcloud secrets create "$secret_name" \
            --project="$PROJECT_ID" \
            --replication-policy="automatic" \
            --data-file=- \
            --labels="environment=$ENVIRONMENT,managed-by=script"

        # Add description via update (can't set on create)
        if [[ -n "$description" ]]; then
            gcloud secrets update "$secret_name" \
                --project="$PROJECT_ID" \
                --update-labels="description=$description" || true
        fi
    fi

    echo "  ✓ Done"
    echo ""
}

generate_random_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

prompt_secret() {
    local prompt_text="$1"
    local secret_value

    read -rsp "$prompt_text: " secret_value
    echo "" >&2
    echo "$secret_value"
}

# =============================================================================
# Backend Secrets
# =============================================================================

echo "Creating Backend Secrets..."
echo "----------------------------"

# JWT Secret Key (auto-generate if not provided)
if [[ -z "${JWT_SECRET_KEY:-}" ]]; then
    JWT_SECRET_KEY=$(generate_random_secret)
    echo "Generated JWT_SECRET_KEY: $JWT_SECRET_KEY"
fi
create_secret "backend-jwt-secret-key" "$JWT_SECRET_KEY" "JWT secret key for token signing"

# Database URL
if [[ -z "${DATABASE_URL:-}" ]]; then
    DATABASE_URL=$(prompt_secret "Enter DATABASE_URL (PostgreSQL connection string)")
fi
create_secret "backend-database-url" "$DATABASE_URL" "PostgreSQL database connection URL"

# Redis URL
if [[ -z "${REDIS_URL:-}" ]]; then
    REDIS_URL=$(prompt_secret "Enter REDIS_URL (Redis connection string)")
fi
create_secret "backend-redis-url" "$REDIS_URL" "Redis connection URL"

# Neo4j Credentials
if [[ -z "${NEO4J_URI:-}" ]]; then
    NEO4J_URI=$(prompt_secret "Enter NEO4J_URI (e.g., bolt://neo4j:7687)")
fi
create_secret "backend-neo4j-uri" "$NEO4J_URI" "Neo4j database URI"

if [[ -z "${NEO4J_PASSWORD:-}" ]]; then
    NEO4J_PASSWORD=$(prompt_secret "Enter NEO4J_PASSWORD")
fi
create_secret "backend-neo4j-password" "$NEO4J_PASSWORD" "Neo4j database password"

# Qdrant API Key (optional)
if [[ -z "${QDRANT_API_KEY:-}" ]]; then
    read -rp "Enter QDRANT_API_KEY (press Enter to skip): " QDRANT_API_KEY
fi
if [[ -n "${QDRANT_API_KEY}" ]]; then
    create_secret "backend-qdrant-api-key" "$QDRANT_API_KEY" "Qdrant vector database API key"
fi

# =============================================================================
# Third-Party API Keys
# =============================================================================

echo "Creating Third-Party API Secrets..."
echo "------------------------------------"

# Sentry DSN
if [[ -z "${SENTRY_DSN:-}" ]]; then
    SENTRY_DSN=$(prompt_secret "Enter SENTRY_DSN (get from sentry.io)")
fi
create_secret "backend-sentry-dsn" "$SENTRY_DSN" "Sentry error tracking DSN"

# OpenAI API Key
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    OPENAI_API_KEY=$(prompt_secret "Enter OPENAI_API_KEY")
fi
create_secret "backend-openai-api-key" "$OPENAI_API_KEY" "OpenAI API key"

# Anthropic API Key
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    ANTHROPIC_API_KEY=$(prompt_secret "Enter ANTHROPIC_API_KEY")
fi
create_secret "backend-anthropic-api-key" "$ANTHROPIC_API_KEY" "Anthropic Claude API key"

# Plaid (Finance Integration)
if [[ -z "${PLAID_CLIENT_ID:-}" ]]; then
    read -rp "Enter PLAID_CLIENT_ID (press Enter to skip): " PLAID_CLIENT_ID
fi
if [[ -n "${PLAID_CLIENT_ID}" ]]; then
    create_secret "backend-plaid-client-id" "$PLAID_CLIENT_ID" "Plaid finance API client ID"

    if [[ -z "${PLAID_SECRET:-}" ]]; then
        PLAID_SECRET=$(prompt_secret "Enter PLAID_SECRET")
    fi
    create_secret "backend-plaid-secret" "$PLAID_SECRET" "Plaid finance API secret"
fi

# Stripe (Payments)
if [[ -z "${STRIPE_API_KEY:-}" ]]; then
    read -rp "Enter STRIPE_API_KEY (press Enter to skip): " STRIPE_API_KEY
fi
if [[ -n "${STRIPE_API_KEY}" ]]; then
    create_secret "backend-stripe-api-key" "$STRIPE_API_KEY" "Stripe payment API key"

    if [[ -z "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
        STRIPE_WEBHOOK_SECRET=$(prompt_secret "Enter STRIPE_WEBHOOK_SECRET")
    fi
    create_secret "backend-stripe-webhook-secret" "$STRIPE_WEBHOOK_SECRET" "Stripe webhook signing secret"
fi

# SendGrid (Email)
if [[ -z "${SENDGRID_API_KEY:-}" ]]; then
    read -rp "Enter SENDGRID_API_KEY (press Enter to skip): " SENDGRID_API_KEY
fi
if [[ -n "${SENDGRID_API_KEY}" ]]; then
    create_secret "backend-sendgrid-api-key" "$SENDGRID_API_KEY" "SendGrid email API key"
fi

# Twilio (SMS)
if [[ -z "${TWILIO_ACCOUNT_SID:-}" ]]; then
    read -rp "Enter TWILIO_ACCOUNT_SID (press Enter to skip): " TWILIO_ACCOUNT_SID
fi
if [[ -n "${TWILIO_ACCOUNT_SID}" ]]; then
    create_secret "backend-twilio-account-sid" "$TWILIO_ACCOUNT_SID" "Twilio SMS account SID"

    if [[ -z "${TWILIO_AUTH_TOKEN:-}" ]]; then
        TWILIO_AUTH_TOKEN=$(prompt_secret "Enter TWILIO_AUTH_TOKEN")
    fi
    create_secret "backend-twilio-auth-token" "$TWILIO_AUTH_TOKEN" "Twilio SMS auth token"
fi

# OAuth Providers
echo ""
echo "OAuth Provider Secrets (optional)..."
echo "-------------------------------------"

# Google OAuth
if [[ -z "${GOOGLE_CLIENT_ID:-}" ]]; then
    read -rp "Enter GOOGLE_CLIENT_ID (press Enter to skip): " GOOGLE_CLIENT_ID
fi
if [[ -n "${GOOGLE_CLIENT_ID}" ]]; then
    create_secret "backend-google-client-id" "$GOOGLE_CLIENT_ID" "Google OAuth client ID"

    if [[ -z "${GOOGLE_CLIENT_SECRET:-}" ]]; then
        GOOGLE_CLIENT_SECRET=$(prompt_secret "Enter GOOGLE_CLIENT_SECRET")
    fi
    create_secret "backend-google-client-secret" "$GOOGLE_CLIENT_SECRET" "Google OAuth client secret"
fi

# Microsoft OAuth
if [[ -z "${MICROSOFT_CLIENT_ID:-}" ]]; then
    read -rp "Enter MICROSOFT_CLIENT_ID (press Enter to skip): " MICROSOFT_CLIENT_ID
fi
if [[ -n "${MICROSOFT_CLIENT_ID}" ]]; then
    create_secret "backend-microsoft-client-id" "$MICROSOFT_CLIENT_ID" "Microsoft OAuth client ID"

    if [[ -z "${MICROSOFT_CLIENT_SECRET:-}" ]]; then
        MICROSOFT_CLIENT_SECRET=$(prompt_secret "Enter MICROSOFT_CLIENT_SECRET")
    fi
    create_secret "backend-microsoft-client-secret" "$MICROSOFT_CLIENT_SECRET" "Microsoft OAuth client secret"
fi

# =============================================================================
# Grant Access to GKE Service Accounts
# =============================================================================

echo "Granting Secret Access to GKE Service Accounts..."
echo "--------------------------------------------------"

# Backend service account
BACKEND_SA="api-server-$ENVIRONMENT@$PROJECT_ID.iam.gserviceaccount.com"

echo "Granting access to: $BACKEND_SA"

for secret in $(gcloud secrets list --project="$PROJECT_ID" --filter="labels.environment=$ENVIRONMENT" --format="value(name)"); do
    echo "  - $secret"
    gcloud secrets add-iam-policy-binding "$secret" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:$BACKEND_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet || true
done

echo ""
echo "=================================================="
echo "✓ Secrets setup complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Apply ExternalSecrets manifests:"
echo "   kubectl apply -f k8s/shared/external-secrets.yaml"
echo ""
echo "2. Verify secrets are synced:"
echo "   kubectl get externalsecrets -n life-navigator-$ENVIRONMENT"
echo "   kubectl get secrets -n life-navigator-$ENVIRONMENT"
echo ""
echo "3. Deploy application:"
echo "   kubectl apply -k k8s/overlays/$ENVIRONMENT"
echo ""
