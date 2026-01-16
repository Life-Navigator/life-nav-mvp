#!/bin/bash
# ============================================================================
# QUICKSTART: Vertex AI Integration (30 Minutes)
# ============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║        VERTEX AI RAPID DEPLOYMENT - 30 MINUTES           ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Step 1: Verify prerequisites
echo -e "${YELLOW}Step 1/5: Verifying prerequisites...${NC}"
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk${NC}"
    exit 1
fi

if ! command -v poetry &> /dev/null; then
    echo -e "${RED}❌ Poetry not found. Install from: https://python-poetry.org${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites verified${NC}"
echo ""

# Step 2: GCP Setup
echo -e "${YELLOW}Step 2/5: Setting up Vertex AI on GCP...${NC}"
echo "This will:"
echo "  - Enable required APIs"
echo "  - Create service account"
echo "  - Grant IAM permissions"
echo "  - Generate credentials"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

./scripts/setup-vertex-ai.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ GCP setup failed. Check errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Vertex AI configured${NC}"
echo ""

# Step 3: Install dependencies
echo -e "${YELLOW}Step 3/5: Installing Python dependencies...${NC}"

cd services/api
echo "Installing backend dependencies..."
poetry install
cd ../..

cd services/agents
echo "Installing agent system dependencies..."
poetry install
cd ../..

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 4: Configure environment
echo -e "${YELLOW}Step 4/5: Configuring environment...${NC}"

if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.vertex.example .env
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env and set:${NC}"
    echo "  - GCP_PROJECT_ID"
    echo "  - GOOGLE_APPLICATION_CREDENTIALS=./vertex-ai-key.json"
    echo ""
    read -p "Press Enter after editing .env..."
fi

# Verify required env vars
source .env
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}❌ GCP_PROJECT_ID not set in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Step 5: Run tests
echo -e "${YELLOW}Step 5/5: Running integration tests...${NC}"
python scripts/test-vertex-ai.py

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║              🎉 SETUP COMPLETE! 🎉                        ║"
    echo "║                                                           ║"
    echo "║  Vertex AI Gemini is ready for production deployment     ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review: VERTEX_AI_LAUNCH_GUIDE.md"
    echo "2. Review: RAPID_LAUNCH_SUMMARY.md"
    echo "3. Deploy to staging: kubectl apply -k k8s/overlays/staging"
    echo "4. Run load tests"
    echo "5. Deploy to production"
    echo ""
else
    echo -e "${RED}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║           ⚠️  TESTS FAILED  ⚠️                            ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check GCP_PROJECT_ID is correct"
    echo "2. Verify GOOGLE_APPLICATION_CREDENTIALS path"
    echo "3. Run: gcloud auth list"
    echo "4. Check IAM permissions in GCP Console"
    echo ""
    exit 1
fi
