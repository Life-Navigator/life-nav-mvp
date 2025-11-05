#!/bin/bash

# GCP Cloud SQL Setup Script for Life Navigator
# HIPAA & Financial Compliance Configuration

set -e  # Exit on error

echo "🗄️  Life Navigator - GCP Cloud SQL Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-us-central1}"
INSTANCE_NAME="${DB_INSTANCE_NAME:-lifenavigator-db}"
DATABASE_NAME="${DB_NAME:-lifenavigator}"
DB_USER="${DB_USER:-lifenavigator_app}"
KEYRING_NAME="lifenavigator-keyring"
KEY_NAME="lifenavigator-db-key"

# Check if gcloud is installed
check_gcloud() {
    echo "📦 Checking for Google Cloud SDK..."

    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}❌ Google Cloud SDK not installed${NC}"
        echo "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    echo -e "${GREEN}✅ Google Cloud SDK found${NC}"
}

# Prompt for configuration if not set
get_configuration() {
    echo ""
    echo "🔧 Configuration Setup"
    echo "======================"

    if [ -z "$PROJECT_ID" ]; then
        echo -e "${YELLOW}Please enter your GCP Project ID:${NC}"
        read -r PROJECT_ID
    fi

    echo ""
    echo "Configuration Summary:"
    echo "  Project ID:      $PROJECT_ID"
    echo "  Region:          $REGION"
    echo "  Instance Name:   $INSTANCE_NAME"
    echo "  Database Name:   $DATABASE_NAME"
    echo "  Database User:   $DB_USER"
    echo ""

    read -p "Continue with this configuration? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled"
        exit 0
    fi
}

# Set the GCP project
set_project() {
    echo ""
    echo "🎯 Setting GCP project to: $PROJECT_ID"

    if gcloud config set project "$PROJECT_ID"; then
        echo -e "${GREEN}✅ Project set successfully${NC}"
    else
        echo -e "${RED}❌ Failed to set project${NC}"
        exit 1
    fi
}

# Enable required GCP APIs
enable_apis() {
    echo ""
    echo "🔌 Enabling required GCP APIs..."

    APIS=(
        "sqladmin.googleapis.com"
        "compute.googleapis.com"
        "secretmanager.googleapis.com"
        "cloudkms.googleapis.com"
    )

    for api in "${APIS[@]}"; do
        echo "  Enabling $api..."
        gcloud services enable "$api" --quiet
    done

    echo -e "${GREEN}✅ All APIs enabled${NC}"
}

# Create KMS keyring and encryption key
create_encryption_key() {
    echo ""
    echo "🔐 Creating customer-managed encryption key..."

    # Check if keyring exists
    if gcloud kms keyrings describe "$KEYRING_NAME" --location="$REGION" &>/dev/null; then
        echo "  Keyring already exists: $KEYRING_NAME"
    else
        echo "  Creating keyring: $KEYRING_NAME"
        gcloud kms keyrings create "$KEYRING_NAME" --location="$REGION"
    fi

    # Check if key exists
    if gcloud kms keys describe "$KEY_NAME" --location="$REGION" --keyring="$KEYRING_NAME" &>/dev/null; then
        echo "  Encryption key already exists: $KEY_NAME"
    else
        echo "  Creating encryption key: $KEY_NAME"
        gcloud kms keys create "$KEY_NAME" \
            --location="$REGION" \
            --keyring="$KEYRING_NAME" \
            --purpose=encryption
    fi

    # Get the key resource name
    KEY_RESOURCE_NAME=$(gcloud kms keys describe "$KEY_NAME" \
        --location="$REGION" \
        --keyring="$KEYRING_NAME" \
        --format="value(name)")

    echo -e "${GREEN}✅ Encryption key created: $KEY_RESOURCE_NAME${NC}"
}

# Create Cloud SQL instance
create_sql_instance() {
    echo ""
    echo "🗄️  Creating Cloud SQL instance..."
    echo "  This may take 10-15 minutes..."

    # Check if instance already exists
    if gcloud sql instances describe "$INSTANCE_NAME" &>/dev/null; then
        echo -e "${YELLOW}⚠️  Instance already exists: $INSTANCE_NAME${NC}"
        read -p "Skip instance creation? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            echo "Skipping instance creation"
            return 0
        fi
    fi

    # Create the instance with HIPAA-compliant settings
    gcloud sql instances create "$INSTANCE_NAME" \
        --database-version=POSTGRES_15 \
        --tier=db-custom-2-8192 \
        --region="$REGION" \
        --network=default \
        --no-assign-ip \
        --enable-bin-log \
        --backup-start-time=02:00 \
        --backup-location="$REGION" \
        --retained-backups-count=30 \
        --retained-transaction-log-days=7 \
        --database-flags="\
cloudsql.iam_authentication=on,\
log_connections=on,\
log_disconnections=on,\
log_statement=all,\
log_duration=on" \
        --require-ssl \
        --disk-encryption-key="$KEY_RESOURCE_NAME"

    echo -e "${GREEN}✅ Cloud SQL instance created${NC}"
}

# Enable point-in-time recovery
enable_pitr() {
    echo ""
    echo "⏰ Enabling point-in-time recovery..."

    gcloud sql instances patch "$INSTANCE_NAME" \
        --enable-point-in-time-recovery \
        --quiet

    echo -e "${GREEN}✅ Point-in-time recovery enabled${NC}"
}

# Create database
create_database() {
    echo ""
    echo "📊 Creating database: $DATABASE_NAME"

    if gcloud sql databases describe "$DATABASE_NAME" --instance="$INSTANCE_NAME" &>/dev/null; then
        echo -e "${YELLOW}⚠️  Database already exists${NC}"
    else
        gcloud sql databases create "$DATABASE_NAME" \
            --instance="$INSTANCE_NAME"
        echo -e "${GREEN}✅ Database created${NC}"
    fi
}

# Create database user with secure password
create_db_user() {
    echo ""
    echo "👤 Creating database user: $DB_USER"

    # Generate secure password
    DB_PASSWORD=$(openssl rand -base64 32)

    # Create user
    gcloud sql users create "$DB_USER" \
        --instance="$INSTANCE_NAME" \
        --password="$DB_PASSWORD"

    echo -e "${GREEN}✅ Database user created${NC}"

    # Store password in Secret Manager
    echo ""
    echo "🔒 Storing password in Secret Manager..."

    echo -n "$DB_PASSWORD" | gcloud secrets create db-password \
        --data-file=- \
        --replication-policy="automatic" || {
        echo -e "${YELLOW}⚠️  Secret already exists, updating version...${NC}"
        echo -n "$DB_PASSWORD" | gcloud secrets versions add db-password \
            --data-file=-
    }

    echo -e "${GREEN}✅ Password stored in Secret Manager${NC}"
    echo ""
    echo -e "${BLUE}📝 Database password has been generated and stored in Secret Manager${NC}"
    echo -e "${BLUE}   Secret name: db-password${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Save this connection info for Vercel environment variables:${NC}"
    echo ""
}

# Generate connection string
generate_connection_string() {
    echo ""
    echo "🔗 Generating connection information..."

    # Get instance connection name
    INSTANCE_CONNECTION=$(gcloud sql instances describe "$INSTANCE_NAME" \
        --format="value(connectionName)")

    # Retrieve password from Secret Manager
    DB_PASSWORD=$(gcloud secrets versions access latest --secret="db-password")

    echo ""
    echo "================================================"
    echo "📋 CONNECTION INFORMATION"
    echo "================================================"
    echo ""
    echo "Instance Connection Name:"
    echo "  $INSTANCE_CONNECTION"
    echo ""
    echo "Database URL (for Vercel):"
    echo "  postgresql://$DB_USER:$DB_PASSWORD@/$DATABASE_NAME?host=/cloudsql/$INSTANCE_CONNECTION&sslmode=require"
    echo ""
    echo "Database Name: $DATABASE_NAME"
    echo "Database User: $DB_USER"
    echo "Database Password: (stored in Secret Manager: db-password)"
    echo ""
    echo "================================================"
    echo ""

    # Save to file
    cat > .env.gcp << EOF
# GCP Cloud SQL Configuration
# Generated on $(date)

GCP_PROJECT_ID=$PROJECT_ID
DB_INSTANCE_NAME=$INSTANCE_NAME
DB_INSTANCE_CONNECTION=$INSTANCE_CONNECTION
DATABASE_NAME=$DATABASE_NAME
DB_USER=$DB_USER

# Database URL (add to Vercel environment variables)
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@/$DATABASE_NAME?host=/cloudsql/$INSTANCE_CONNECTION&sslmode=require"

# Encryption Key
KMS_KEY_RESOURCE_NAME=$KEY_RESOURCE_NAME
EOF

    echo -e "${GREEN}✅ Connection info saved to .env.gcp${NC}"
    echo -e "${YELLOW}⚠️  Add .env.gcp to .gitignore (contains sensitive credentials)${NC}"
}

# Configure audit logging
setup_audit_logging() {
    echo ""
    echo "📝 Configuring audit logging..."

    # Create audit policy file
    cat > /tmp/audit-policy.yaml << EOF
auditConfigs:
- auditLogConfigs:
  - logType: ADMIN_READ
  - logType: DATA_READ
  - logType: DATA_WRITE
  service: sqladmin.googleapis.com
EOF

    # Apply audit policy
    gcloud projects set-iam-policy "$PROJECT_ID" /tmp/audit-policy.yaml

    rm /tmp/audit-policy.yaml

    echo -e "${GREEN}✅ Audit logging configured${NC}"
}

# Setup Cloud SQL Proxy for local development
setup_proxy() {
    echo ""
    echo "🔌 Setting up Cloud SQL Proxy for local development..."

    read -p "Download Cloud SQL Proxy? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "  Downloading Cloud SQL Proxy..."
        curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64
        chmod +x cloud-sql-proxy

        echo -e "${GREEN}✅ Cloud SQL Proxy downloaded${NC}"
        echo ""
        echo "To connect locally, run:"
        echo "  ./cloud-sql-proxy $INSTANCE_CONNECTION"
    fi
}

# Display next steps
show_next_steps() {
    echo ""
    echo "================================================"
    echo "🎉 GCP Cloud SQL Setup Complete!"
    echo "================================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Add DATABASE_URL to Vercel environment variables:"
    echo "   vercel env add DATABASE_URL production"
    echo "   (paste the DATABASE_URL from .env.gcp)"
    echo ""
    echo "2. Deploy to Vercel:"
    echo "   vercel --prod"
    echo ""
    echo "3. Run database migrations:"
    echo "   vercel env pull .env.production"
    echo "   npx prisma migrate deploy"
    echo ""
    echo "4. Test health endpoint:"
    echo "   curl https://your-app.vercel.app/health"
    echo ""
    echo "For local development:"
    echo "  ./cloud-sql-proxy $INSTANCE_CONNECTION"
    echo ""
    echo "View logs:"
    echo "  gcloud logging read \"resource.type=cloudsql_database\" --limit=50"
    echo ""
    echo "================================================"
}

# Main execution flow
main() {
    check_gcloud
    get_configuration
    set_project
    enable_apis
    create_encryption_key
    create_sql_instance
    enable_pitr
    create_database
    create_db_user
    generate_connection_string
    setup_audit_logging
    setup_proxy
    show_next_steps
}

# Run main function
main
