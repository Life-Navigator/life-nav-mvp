#!/bin/bash
# ============================================================================
# Vertex AI Setup Script
# Sets up GCP project for Vertex AI Gemini integration
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Vertex AI Setup for Life Navigator${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${YELLOW}Enter your GCP Project ID:${NC}"
    read GCP_PROJECT_ID
fi

echo -e "${GREEN}Using project: $GCP_PROJECT_ID${NC}"
echo ""

# Set project
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}Enabling required GCP APIs...${NC}"
gcloud services enable aiplatform.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable container.googleapis.com
echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Create service account for Vertex AI
SA_NAME="vertex-ai-agent"
SA_EMAIL="${SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

echo -e "${YELLOW}Creating service account: $SA_EMAIL${NC}"
if gcloud iam service-accounts describe $SA_EMAIL &> /dev/null; then
    echo -e "${YELLOW}Service account already exists${NC}"
else
    gcloud iam service-accounts create $SA_NAME \
        --display-name="Vertex AI Agent Service Account" \
        --description="Service account for Life Navigator agent system"
    echo -e "${GREEN}✓ Service account created${NC}"
fi
echo ""

# Grant required permissions
echo -e "${YELLOW}Granting IAM permissions...${NC}"
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/aiplatform.user" \
    --condition=None

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/logging.logWriter" \
    --condition=None

echo -e "${GREEN}✓ IAM permissions granted${NC}"
echo ""

# Create and download service account key
KEY_FILE="./vertex-ai-key.json"
echo -e "${YELLOW}Creating service account key...${NC}"
if [ -f "$KEY_FILE" ]; then
    echo -e "${YELLOW}Key file already exists at $KEY_FILE${NC}"
    echo -e "${YELLOW}Delete it first if you want to regenerate${NC}"
else
    gcloud iam service-accounts keys create $KEY_FILE \
        --iam-account=$SA_EMAIL
    echo -e "${GREEN}✓ Service account key saved to: $KEY_FILE${NC}"
    echo -e "${RED}IMPORTANT: Keep this file secure! Add to .gitignore${NC}"
fi
echo ""

# Store key in Secret Manager
SECRET_NAME="vertex-ai-credentials"
echo -e "${YELLOW}Storing credentials in Secret Manager...${NC}"
if gcloud secrets describe $SECRET_NAME &> /dev/null; then
    echo -e "${YELLOW}Secret already exists, creating new version...${NC}"
    gcloud secrets versions add $SECRET_NAME --data-file=$KEY_FILE
else
    gcloud secrets create $SECRET_NAME \
        --data-file=$KEY_FILE \
        --replication-policy="automatic"
fi
echo -e "${GREEN}✓ Credentials stored in Secret Manager${NC}"
echo ""

# Test Vertex AI access
echo -e "${YELLOW}Testing Vertex AI access...${NC}"
export GOOGLE_APPLICATION_CREDENTIALS=$KEY_FILE
python3 - <<EOF
import os
import vertexai
from vertexai.generative_models import GenerativeModel

project_id = "$GCP_PROJECT_ID"
location = "us-central1"

try:
    vertexai.init(project=project_id, location=location)
    model = GenerativeModel("gemini-2.0-flash-exp")
    response = model.generate_content("Say 'Vertex AI setup successful!'")
    print(f"\n✓ Test Response: {response.text}\n")
    print("${GREEN}Vertex AI is working correctly!${NC}")
except Exception as e:
    print(f"${RED}Error testing Vertex AI: {e}${NC}")
    exit(1)
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. Add $KEY_FILE to your .gitignore"
echo -e "2. Set GOOGLE_APPLICATION_CREDENTIALS=$KEY_FILE in your .env"
echo -e "3. Set GCP_PROJECT_ID=$GCP_PROJECT_ID in your .env"
echo -e "4. Run: poetry install (to install Vertex AI SDK)"
echo -e "5. Test with: python scripts/test-vertex-ai.py"
echo ""
