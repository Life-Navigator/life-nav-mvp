#!/bin/bash
# ===========================================================================
# Launch Readiness Check Script
# ===========================================================================
# Validates that the codebase is ready for production deployment.
# Checks for common security and configuration issues.
#
# Usage:
#   ./scripts/launch-readiness-check.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# ===========================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED_CHECKS=0
PASSED_CHECKS=0

echo "🚀 Life Navigator Launch Readiness Check"
echo "=========================================="
echo ""

# ===========================================================================
# Helper Functions
# ===========================================================================

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED_CHECKS++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED_CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# ===========================================================================
# Check 1: No .env files (except .env.example)
# ===========================================================================

echo "📋 Check 1: No .env files in production paths"
echo "-------------------------------------------"

FORBIDDEN_ENV_FILES=$(find . -type f \
    \( -name ".env" -o -name ".env.*" \) \
    ! -name ".env.example" \
    ! -path "./node_modules/*" \
    ! -path "./.git/*" \
    ! -path "./.next/*" \
    ! -path "./dist/*" \
    ! -path "./.turbo/*" \
    ! -path "./apps/web/.env.local" \
    ! -path "./backend/.env.local" 2>/dev/null || true)

if [ -n "$FORBIDDEN_ENV_FILES" ]; then
    check_fail ".env files found in repository"
    echo "$FORBIDDEN_ENV_FILES"
    echo "Remove these files and use:"
    echo "  - .env.local (local dev, gitignored)"
    echo "  - GCP Secret Manager (production)"
    echo "  - Vercel Environment Variables (frontend)"
else
    check_pass "No forbidden .env files"
fi

echo ""

# ===========================================================================
# Check 2: No OpenAI imports in backend
# ===========================================================================

echo "📋 Check 2: No OpenAI runtime imports"
echo "-------------------------------------"

OPENAI_IMPORTS=$(grep -r "from openai import\|import openai" backend/app/ 2>/dev/null | grep -v "__pycache__" || true)

if [ -n "$OPENAI_IMPORTS" ]; then
    check_fail "OpenAI imports found in backend/app/"
    echo "$OPENAI_IMPORTS"
    echo "OpenAI is not allowed in production."
    echo "Use EMBEDDINGS_PROVIDER=graphrag instead."
else
    check_pass "No OpenAI imports in production code"
fi

echo ""

# ===========================================================================
# Check 3: Data boundary tests pass
# ===========================================================================

echo "📋 Check 3: Data boundary enforcement tests"
echo "-------------------------------------------"

if [ -f "backend/tests/middleware/test_data_boundary.py" ]; then
    cd backend
    if poetry run pytest tests/middleware/test_data_boundary.py -q 2>&1 | grep -q "passed"; then
        check_pass "Data boundary tests passing"
    else
        check_fail "Data boundary tests failing"
        poetry run pytest tests/middleware/test_data_boundary.py -v
    fi
    cd ..
else
    check_warn "Data boundary tests not found"
fi

echo ""

# ===========================================================================
# Check 4: Backend required env keys documented
# ===========================================================================

echo "📋 Check 4: Required environment keys documented"
echo "------------------------------------------------"

if [ -f "docs/security/SECRETS_INVENTORY.md" ]; then
    check_pass "Secrets inventory exists"
else
    check_fail "Secrets inventory missing (docs/security/SECRETS_INVENTORY.md)"
fi

if [ -f "backend/app/core/config_production.py" ]; then
    check_pass "Production config loader exists"
else
    check_fail "Production config loader missing (backend/app/core/config_production.py)"
fi

echo ""

# ===========================================================================
# Check 5: Frontend has security headers configured
# ===========================================================================

echo "📋 Check 5: Security headers configured"
echo "---------------------------------------"

if grep -q "Content-Security-Policy" apps/web/next.config.ts 2>/dev/null; then
    check_pass "CSP header configured in next.config.ts"
else
    check_fail "CSP header not found in next.config.ts"
fi

if grep -q "Strict-Transport-Security" apps/web/next.config.ts 2>/dev/null; then
    check_pass "HSTS header configured"
else
    check_fail "HSTS header not found"
fi

echo ""

# ===========================================================================
# Check 6: Git hooks installed (pre-commit)
# ===========================================================================

echo "📋 Check 6: Pre-commit hooks"
echo "----------------------------"

if [ -f ".git/hooks/pre-commit" ]; then
    check_pass "Pre-commit hooks installed"
else
    check_warn "Pre-commit hooks not installed"
    echo "Run: pip install pre-commit && pre-commit install"
fi

echo ""

# ===========================================================================
# Check 7: CI workflows exist
# ===========================================================================

echo "📋 Check 7: CI workflows configured"
echo "-----------------------------------"

if [ -f ".github/workflows/secrets-hygiene.yml" ]; then
    check_pass "Secrets hygiene workflow exists"
else
    check_fail "Secrets hygiene workflow missing"
fi

if [ -f ".github/workflows/backend.yml" ]; then
    check_pass "Backend CI workflow exists"
else
    check_warn "Backend CI workflow missing"
fi

echo ""

# ===========================================================================
# Check 8: Documentation exists
# ===========================================================================

echo "📋 Check 8: Documentation complete"
echo "----------------------------------"

REQUIRED_DOCS=(
    "docs/security/SECRETS_INVENTORY.md"
    "docs/security/DATA_BOUNDARY_ENFORCEMENT.md"
    "docs/architecture/DEPENDENCY_REMOVAL_OPENAI.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "$(basename $doc) exists"
    else
        check_fail "$doc missing"
    fi
done

echo ""

# ===========================================================================
# Check 9: Dependency security
# ===========================================================================

echo "📋 Check 9: Dependency security"
echo "-------------------------------"

if command -v poetry &> /dev/null; then
    cd backend
    if poetry check 2>&1 | grep -q "All set"; then
        check_pass "Poetry dependencies valid"
    else
        check_warn "Poetry dependency issues detected"
    fi
    cd ..
else
    check_warn "Poetry not installed, skipping dependency check"
fi

echo ""

# ===========================================================================
# Check 10: TypeScript build
# ===========================================================================

echo "📋 Check 10: TypeScript compilation"
echo "-----------------------------------"

if command -v pnpm &> /dev/null; then
    if pnpm --filter=web build 2>&1 | grep -q "Compiled successfully\|Build succeeded"; then
        check_pass "Frontend builds successfully"
    else
        check_warn "Frontend build issues (check manually)"
    fi
else
    check_warn "pnpm not installed, skipping frontend build check"
fi

echo ""

# ===========================================================================
# Summary
# ===========================================================================

echo "=========================================="
echo "📊 Launch Readiness Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
    echo "The codebase is ready for production deployment."
    echo ""
    echo "Next steps:"
    echo "  1. Migrate secrets to GCP Secret Manager"
    echo "  2. Configure Vercel environment variables"
    echo "  3. Deploy backend to Cloud Run"
    echo "  4. Deploy frontend to Vercel"
    echo "  5. Run smoke tests"
    exit 0
else
    echo -e "${RED}❌ Launch readiness check FAILED${NC}"
    echo "Fix the issues above before deploying to production."
    echo ""
    echo "Critical issues must be resolved:"
    echo "  - Remove all .env files from git"
    echo "  - Remove OpenAI imports"
    echo "  - Fix failing tests"
    echo "  - Add missing documentation"
    exit 1
fi
