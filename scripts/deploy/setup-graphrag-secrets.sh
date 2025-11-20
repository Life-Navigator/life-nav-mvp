#!/bin/bash
# Setup GraphRAG secrets in Google Secret Manager
#
# This script creates the required secrets for the GraphRAG system:
# - Neo4j credentials
# - Qdrant configuration
# - OpenAI API key
#
# Usage:
#   ./scripts/deploy/setup-graphrag-secrets.sh [PROJECT_ID]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project ID
PROJECT_ID="${1:-$(gcloud config get-value project)}"

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: PROJECT_ID not set. Usage: $0 [PROJECT_ID]${NC}"
    exit 1
fi

echo -e "${GREEN}Setting up GraphRAG secrets for project: $PROJECT_ID${NC}"

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    echo -e "${YELLOW}Processing secret: $secret_name${NC}"

    # Check if secret exists
    if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &> /dev/null; then
        echo "  Secret exists. Adding new version..."
        echo -n "$secret_value" | gcloud secrets versions add "$secret_name" \
            --project="$PROJECT_ID" \
            --data-file=-
        echo -e "${GREEN}  ✓ Updated $secret_name${NC}"
    else
        echo "  Secret does not exist. Creating..."
        echo -n "$secret_value" | gcloud secrets create "$secret_name" \
            --project="$PROJECT_ID" \
            --replication-policy="automatic" \
            --data-file=- \
            --labels="component=graphrag,managed-by=external-secrets"

        # Add description if provided
        if [ -n "$description" ]; then
            gcloud secrets update "$secret_name" \
                --project="$PROJECT_ID" \
                --update-labels="description=$description"
        fi

        echo -e "${GREEN}  ✓ Created $secret_name${NC}"
    fi
}

echo ""
echo -e "${YELLOW}=== Neo4j Configuration ===${NC}"
echo ""

# Neo4j URI
read -p "Enter Neo4j URI (default: bolt://neo4j.default.svc.cluster.local:7687): " NEO4J_URI
NEO4J_URI=${NEO4J_URI:-bolt://neo4j.default.svc.cluster.local:7687}
create_or_update_secret "backend-neo4j-uri" "$NEO4J_URI" "Neo4j database URI"

# Neo4j Password
read -sp "Enter Neo4j Password: " NEO4J_PASSWORD
echo ""
if [ -z "$NEO4J_PASSWORD" ]; then
    echo -e "${RED}Error: Neo4j password cannot be empty${NC}"
    exit 1
fi
create_or_update_secret "backend-neo4j-password" "$NEO4J_PASSWORD" "Neo4j database password"

echo ""
echo -e "${YELLOW}=== Qdrant Configuration ===${NC}"
echo ""

# Qdrant URL (from ConfigMap, but showing for reference)
read -p "Enter Qdrant URL (default: http://qdrant.default.svc.cluster.local:6333): " QDRANT_URL
QDRANT_URL=${QDRANT_URL:-http://qdrant.default.svc.cluster.local:6333}
echo "Note: QDRANT_URL is configured in ConfigMap, not as secret"

# Qdrant API Key (optional)
read -p "Enter Qdrant API Key (optional, press Enter to skip): " QDRANT_API_KEY
if [ -n "$QDRANT_API_KEY" ]; then
    create_or_update_secret "backend-qdrant-api-key" "$QDRANT_API_KEY" "Qdrant API key"
else
    # Create empty secret
    create_or_update_secret "backend-qdrant-api-key" "" "Qdrant API key (empty)"
    echo "  Note: Created empty secret for compatibility"
fi

echo ""
echo -e "${YELLOW}=== OpenAI Configuration ===${NC}"
echo ""

# OpenAI API Key
read -sp "Enter OpenAI API Key: " OPENAI_API_KEY
echo ""
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}Error: OpenAI API key cannot be empty${NC}"
    exit 1
fi
create_or_update_secret "backend-openai-api-key" "$OPENAI_API_KEY" "OpenAI API key for embeddings"

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Secrets created/updated in project: $PROJECT_ID"
echo ""
echo "Next steps:"
echo "  1. Update ConfigMap with QDRANT_URL if needed:"
echo "     kubectl edit configmap backend-config"
echo ""
echo "  2. Verify ExternalSecret is syncing:"
echo "     kubectl get externalsecret backend-secrets -o yaml"
echo ""
echo "  3. Check that the Secret is created:"
echo "     kubectl get secret backend-secrets"
echo ""
echo "  4. Restart backend pods to pick up new secrets:"
echo "     kubectl rollout restart deployment/backend"
echo ""
echo "  5. Check logs for GraphRAG initialization:"
echo "     kubectl logs -l app=backend --tail=100 | grep graphrag"
echo ""

# Show current secrets status
echo -e "${YELLOW}Current secrets status:${NC}"
gcloud secrets list --project="$PROJECT_ID" --filter="name~backend-(neo4j|qdrant|openai)" --format="table(name,createTime,labels.component)"

echo ""
echo -e "${GREEN}Setup complete!${NC}"
