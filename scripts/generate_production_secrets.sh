#!/bin/bash
#===============================================================================
# Production Secrets Generator for Life Navigator
#
# This script generates cryptographically secure secrets for production deployment
# Secrets are stored in GCP Secret Manager (not committed to git!)
#===============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "==============================================================================="
echo "Life Navigator - Production Secrets Generator"
echo "==============================================================================="
echo ""

# Check required commands
for cmd in openssl base64; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}✗ ERROR: $cmd not found${NC}"
        exit 1
    fi
done

echo -e "${BLUE}[1/3] Generating Cryptographic Secrets...${NC}"
echo ""

# Generate secrets
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

echo -e "${GREEN}✓ Generated SECRET_KEY (64 chars)${NC}"
echo -e "${GREEN}✓ Generated JWT_SECRET (64 chars)${NC}"
echo -e "${GREEN}✓ Generated ENCRYPTION_KEY (64 chars)${NC}"
echo -e "${GREEN}✓ Generated DB_PASSWORD (32 chars)${NC}"
echo -e "${GREEN}✓ Generated REDIS_PASSWORD (32 chars)${NC}"
echo -e "${GREEN}✓ Generated NEO4J_PASSWORD (32 chars)${NC}"

echo ""
echo -e "${BLUE}[2/3] Creating Local Secrets File...${NC}"
echo ""

# Create secrets directory
mkdir -p .secrets

# Write to local file (add to .gitignore!)
cat > .secrets/production.env <<EOF
# ==============================================================================
# Life Navigator - Production Secrets
# ==============================================================================
# Generated: $(date)
#
# ⚠️  CRITICAL SECURITY NOTICE ⚠️
#
# This file contains production secrets and MUST be handled securely:
# 1. DO NOT commit to git
# 2. DO NOT share via email/Slack
# 3. DO NOT store in unsecured locations
# 4. Store in GCP Secret Manager
# 5. Restrict access to authorized personnel only
# ==============================================================================

# Application Secrets
SECRET_KEY=$SECRET_KEY
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Database Credentials
POSTGRES_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
NEO4J_PASSWORD=$NEO4J_PASSWORD

# Generated on: $(date)
# By: $(whoami)@$(hostname)
EOF

chmod 600 .secrets/production.env

echo -e "${GREEN}✓ Created .secrets/production.env${NC}"
echo -e "${YELLOW}  Permissions: 600 (read/write owner only)${NC}"

echo ""
echo -e "${BLUE}[3/3] Creating GCP Secret Manager Upload Script...${NC}"
echo ""

# Create GCP Secret Manager upload script
cat > .secrets/upload_to_gcp.sh <<'SCRIPT'
#!/bin/bash
#===============================================================================
# Upload Production Secrets to GCP Secret Manager
#===============================================================================

set -e

# Load secrets
source .secrets/production.env

# Check GCP project
if [ -z "$GCP_PROJECT_ID" ]; then
    echo "ERROR: GCP_PROJECT_ID not set"
    echo "Set it with: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

echo "Uploading secrets to GCP Secret Manager..."
echo "Project: $GCP_PROJECT_ID"
echo ""

# Function to create or update secret
create_or_update_secret() {
    SECRET_NAME=$1
    SECRET_VALUE=$2

    # Check if secret exists
    if gcloud secrets describe $SECRET_NAME --project=$GCP_PROJECT_ID &>/dev/null; then
        echo "Updating existing secret: $SECRET_NAME"
        echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME \
            --data-file=- \
            --project=$GCP_PROJECT_ID
    else
        echo "Creating new secret: $SECRET_NAME"
        echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME \
            --data-file=- \
            --replication-policy=automatic \
            --project=$GCP_PROJECT_ID
    fi
}

# Upload all secrets
create_or_update_secret "secret-key" "$SECRET_KEY"
create_or_update_secret "jwt-secret" "$JWT_SECRET"
create_or_update_secret "encryption-key" "$ENCRYPTION_KEY"
create_or_update_secret "postgres-password" "$POSTGRES_PASSWORD"
create_or_update_secret "redis-password" "$REDIS_PASSWORD"
create_or_update_secret "neo4j-password" "$NEO4J_PASSWORD"

echo ""
echo "✓ All secrets uploaded successfully!"
echo ""
echo "Grant access to GKE service accounts:"
echo "  gcloud secrets add-iam-policy-binding SECRET_NAME \\"
echo "    --member='serviceAccount:SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com' \\"
echo "    --role='roles/secretmanager.secretAccessor' \\"
echo "    --project=\$GCP_PROJECT_ID"
SCRIPT

chmod +x .secrets/upload_to_gcp.sh

echo -e "${GREEN}✓ Created .secrets/upload_to_gcp.sh${NC}"

echo ""
echo "==============================================================================="
echo "Secrets Generation Complete!"
echo "==============================================================================="
echo ""
echo -e "${GREEN}✓ Generated 6 secure secrets${NC}"
echo -e "${GREEN}✓ Saved to .secrets/production.env${NC}"
echo -e "${GREEN}✓ Created GCP upload script${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Review generated secrets:"
echo "   cat .secrets/production.env"
echo ""
echo "2. Upload to GCP Secret Manager:"
echo "   export GCP_PROJECT_ID=your-project-id"
echo "   ./.secrets/upload_to_gcp.sh"
echo ""
echo "3. Update docker-compose.yml to use secrets:"
echo "   Replace hardcoded passwords with \${POSTGRES_PASSWORD}"
echo ""
echo "4. For K8s deployment, use External Secrets Operator:"
echo "   kubectl apply -f k8s/base/external-secrets/"
echo ""
echo -e "${RED}⚠️  SECURITY REMINDER:${NC}"
echo "   - Add .secrets/ to .gitignore"
echo "   - Never commit production secrets"
echo "   - Rotate secrets every 90 days"
echo "   - Restrict access to authorized personnel"
echo ""
echo "==============================================================================="

# Add .secrets to .gitignore
if ! grep -q "^\.secrets/" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Production secrets (generated by scripts/generate_production_secrets.sh)" >> .gitignore
    echo ".secrets/" >> .gitignore
    echo -e "${GREEN}✓ Added .secrets/ to .gitignore${NC}"
fi
