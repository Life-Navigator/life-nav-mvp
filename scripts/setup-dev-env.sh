#!/usr/bin/env bash
# ===========================================================================
# Developer Environment Setup Script
# ===========================================================================
# Sets up local development environment with security tools
# Run: ./scripts/setup-dev-env.sh
# ===========================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}LifeNavigator Dev Setup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# ===========================================================================
# 1. Check Prerequisites
# ===========================================================================
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

command -v python3 >/dev/null 2>&1 || {
    echo -e "${RED}ERROR: Python 3 is required but not installed.${NC}"
    exit 1
}

command -v pip3 >/dev/null 2>&1 || {
    echo -e "${RED}ERROR: pip3 is required but not installed.${NC}"
    exit 1
}

command -v node >/dev/null 2>&1 || {
    echo -e "${RED}ERROR: Node.js is required but not installed.${NC}"
    exit 1
}

command -v pnpm >/dev/null 2>&1 || {
    echo -e "${YELLOW}WARNING: pnpm not found. Installing...${NC}"
    npm install -g pnpm
}

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# ===========================================================================
# 2. Install Pre-commit Hooks
# ===========================================================================
echo -e "${YELLOW}[2/6] Installing pre-commit hooks...${NC}"

pip3 install --user pre-commit detect-secrets || {
    echo -e "${RED}ERROR: Failed to install pre-commit tools${NC}"
    exit 1
}

# Install hooks
pre-commit install --install-hooks || {
    echo -e "${RED}ERROR: Failed to install pre-commit hooks${NC}"
    exit 1
}

# Install commit-msg hook for conventional commits (optional)
pre-commit install --hook-type commit-msg || echo "commit-msg hook not configured"

echo -e "${GREEN}✓ Pre-commit hooks installed${NC}"
echo ""

# ===========================================================================
# 3. Generate Secrets Baseline
# ===========================================================================
echo -e "${YELLOW}[3/6] Scanning for existing secrets...${NC}"

if [ ! -f .secrets.baseline ]; then
    echo -e "${YELLOW}No baseline found, generating...${NC}"
    detect-secrets scan --all-files \
        --exclude-files 'pnpm-lock.yaml|poetry.lock|.*\.lock|.*\.md|docs/.*' \
        > .secrets.baseline
    echo -e "${GREEN}✓ Secrets baseline generated${NC}"
else
    echo -e "${GREEN}✓ Secrets baseline exists${NC}"
fi
echo ""

# ===========================================================================
# 4. Install Node Dependencies
# ===========================================================================
echo -e "${YELLOW}[4/6] Installing Node dependencies...${NC}"

pnpm install --frozen-lockfile || {
    echo -e "${RED}ERROR: Failed to install Node dependencies${NC}"
    exit 1
}

echo -e "${GREEN}✓ Node dependencies installed${NC}"
echo ""

# ===========================================================================
# 5. Install Python Dependencies (Backend)
# ===========================================================================
echo -e "${YELLOW}[5/6] Installing Python dependencies...${NC}"

if command -v poetry >/dev/null 2>&1; then
    echo "Installing backend dependencies..."
    cd backend && poetry install --no-interaction && cd ..

    echo "Installing agents service dependencies..."
    cd services/agents && poetry install --no-interaction && cd ../..

    echo -e "${GREEN}✓ Python dependencies installed${NC}"
else
    echo -e "${YELLOW}WARNING: Poetry not found. Skipping Python dependencies.${NC}"
    echo -e "${YELLOW}Install Poetry: curl -sSL https://install.python-poetry.org | python3 -${NC}"
fi
echo ""

# ===========================================================================
# 6. Setup Environment Files
# ===========================================================================
echo -e "${YELLOW}[6/6] Checking environment files...${NC}"

# Check backend .env
if [ ! -f backend/.env ]; then
    if [ -f backend/.env.example ]; then
        echo -e "${YELLOW}Creating backend/.env from template...${NC}"
        cp backend/.env.example backend/.env
        echo -e "${GREEN}✓ Created backend/.env - PLEASE UPDATE WITH REAL CREDENTIALS${NC}"
    fi
fi

# Check frontend .env
if [ ! -f apps/web/.env.local ]; then
    if [ -f apps/web/.env.example ]; then
        echo -e "${YELLOW}Creating apps/web/.env.local from template...${NC}"
        cp apps/web/.env.example apps/web/.env.local
        echo -e "${GREEN}✓ Created apps/web/.env.local - PLEASE UPDATE WITH REAL CREDENTIALS${NC}"
    fi
fi

echo ""

# ===========================================================================
# Success Summary
# ===========================================================================
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update environment files with real credentials:"
echo "   - backend/.env"
echo "   - apps/web/.env.local"
echo ""
echo "2. Start development services:"
echo "   ${YELLOW}pnpm run dev${NC}"
echo ""
echo "3. Run tests to verify setup:"
echo "   ${YELLOW}pnpm test${NC}"
echo ""
echo -e "${BLUE}Security features enabled:${NC}"
echo "✓ Pre-commit hooks (runs on every commit)"
echo "✓ Secret detection (blocks commits with API keys)"
echo "✓ Code formatting (Black for Python, Prettier for JS/TS)"
echo "✓ Linting (Ruff for Python, ESLint for JS/TS)"
echo ""
echo -e "${BLUE}Manual security scans:${NC}"
echo "- Run all pre-commit checks: ${YELLOW}pre-commit run --all-files${NC}"
echo "- Scan for secrets: ${YELLOW}detect-secrets scan --all-files${NC}"
echo "- Audit secrets baseline: ${YELLOW}detect-secrets audit .secrets.baseline${NC}"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
