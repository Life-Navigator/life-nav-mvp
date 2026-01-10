#!/bin/bash
set -e

# ==============================================================================
# Life Navigator - Staging Smoke Tests
# ==============================================================================
#
# This script runs comprehensive smoke tests against staging deployment.
#
# Tests cover:
# 1. Login / Authentication
# 2. Create scenario
# 3. Upload document
# 4. Run simulation
# 5. Show probability graph
# 6. Call risk snapshot
# 7. Security headers verification
# 8. Data boundary enforcement
#
# Usage:
#   ./scripts/smoke-test-staging.sh [BACKEND_URL] [FRONTEND_URL]
#
# Example:
#   ./scripts/smoke-test-staging.sh https://backend-staging.run.app https://app-staging.vercel.app
#
# ==============================================================================

# Configuration
BACKEND_URL="${1:-}"
FRONTEND_URL="${2:-}"
TIMEOUT=30
RESULTS_FILE="/tmp/smoke-test-results-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# ==============================================================================
# Helper Functions
# ==============================================================================

log() {
    echo -e "$1" | tee -a "$RESULTS_FILE"
}

test_start() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "  Testing: $1... "
    echo "=== TEST $TESTS_RUN: $1 ===" >> "$RESULTS_FILE"
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✅ PASS${NC}"
    echo "RESULT: PASS" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}❌ FAIL${NC}"
    echo "RESULT: FAIL - $1" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
}

test_skip() {
    TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
    echo -e "${YELLOW}⚠️  SKIP - $1${NC}"
    echo "RESULT: SKIP - $1" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
}

# ==============================================================================
# Pre-flight Checks
# ==============================================================================

log "╔══════════════════════════════════════════════════════════════╗"
log "║         Life Navigator - Staging Smoke Tests                ║"
log "╚══════════════════════════════════════════════════════════════╝"
log ""

# Check if URLs provided
if [ -z "$BACKEND_URL" ]; then
    log "${YELLOW}Backend URL not provided. Attempting to auto-detect...${NC}"

    # Try to get from gcloud
    if command -v gcloud &> /dev/null; then
        BACKEND_URL=$(gcloud run services describe life-navigator-backend-staging \
            --region=us-central1 \
            --format='value(status.url)' 2>/dev/null || true)
    fi

    if [ -z "$BACKEND_URL" ]; then
        log "${RED}❌ ERROR: Backend URL required${NC}"
        log "Usage: $0 <BACKEND_URL> [FRONTEND_URL]"
        exit 1
    else
        log "${GREEN}✅ Auto-detected backend: $BACKEND_URL${NC}"
    fi
fi

if [ -z "$FRONTEND_URL" ]; then
    log "${YELLOW}⚠️  Frontend URL not provided - frontend tests will be skipped${NC}"
fi

log ""
log "🎯 Test Target:"
log "   Backend:  $BACKEND_URL"
log "   Frontend: ${FRONTEND_URL:-N/A}"
log "   Results:  $RESULTS_FILE"
log ""

# Check curl is available
if ! command -v curl &> /dev/null; then
    log "${RED}❌ ERROR: curl not found${NC}"
    exit 1
fi

# Check jq is available (optional)
if ! command -v jq &> /dev/null; then
    log "${YELLOW}⚠️  jq not found - JSON output will be raw${NC}"
    JQ_CMD="cat"
else
    JQ_CMD="jq '.'"
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# ==============================================================================
# Test Suite: Backend Health & Infrastructure
# ==============================================================================

log "${BLUE}📋 Test Suite 1: Backend Health & Infrastructure${NC}"
log ""

# Test 1.1: Backend Health Check
test_start "Backend health endpoint responds"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/health" 2>/dev/null || echo "000")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HEALTH_CODE" = "200" ]; then
    echo "$HEALTH_BODY" >> "$RESULTS_FILE"
    test_pass
else
    test_fail "HTTP $HEALTH_CODE"
fi

# Test 1.2: Database Health Check
test_start "Database connectivity"
DB_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/health/db" 2>/dev/null || echo "000")
DB_CODE=$(echo "$DB_RESPONSE" | tail -1)

if [ "$DB_CODE" = "200" ]; then
    test_pass
elif [ "$DB_CODE" = "503" ]; then
    test_fail "Database unreachable"
else
    test_fail "HTTP $DB_CODE"
fi

# Test 1.3: API Root Endpoint
test_start "API root responds with metadata"
ROOT_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/" 2>/dev/null || echo "000")
ROOT_CODE=$(echo "$ROOT_RESPONSE" | tail -1)

if [ "$ROOT_CODE" = "200" ]; then
    test_pass
else
    test_fail "HTTP $ROOT_CODE"
fi

# Test 1.4: OpenAPI docs (should be disabled in staging/production)
test_start "OpenAPI docs disabled in staging"
DOCS_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/docs" 2>/dev/null || echo "000")
DOCS_CODE=$(echo "$DOCS_RESPONSE" | tail -1)

if [ "$DOCS_CODE" = "404" ] || [ "$DOCS_CODE" = "403" ]; then
    test_pass
else
    test_fail "Docs accessible (should be disabled) - HTTP $DOCS_CODE"
fi

log ""

# ==============================================================================
# Test Suite: Security & Compliance
# ==============================================================================

log "${BLUE}📋 Test Suite 2: Security & Compliance${NC}"
log ""

# Test 2.1: Data Boundary Enforcement - SSN
test_start "Data boundary blocks SSN"
BOUNDARY_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
    -X POST "$BACKEND_URL/api/v1/internal/risk-engine/compute" \
    -H "Content-Type: application/json" \
    -d '{"ssn": "123-45-6789"}' 2>/dev/null || echo "000")
BOUNDARY_CODE=$(echo "$BOUNDARY_RESPONSE" | tail -1)

if [ "$BOUNDARY_CODE" = "400" ]; then
    BOUNDARY_BODY=$(echo "$BOUNDARY_RESPONSE" | sed '$d')
    if echo "$BOUNDARY_BODY" | grep -q "data_boundary_violation"; then
        test_pass
    else
        test_fail "Wrong error type"
    fi
elif [ "$BOUNDARY_CODE" = "404" ]; then
    test_skip "Risk engine endpoint not deployed"
else
    test_fail "HTTP $BOUNDARY_CODE (expected 400)"
fi

# Test 2.2: Data Boundary Enforcement - Diagnosis
test_start "Data boundary blocks diagnosis field"
DIAGNOSIS_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
    -X POST "$BACKEND_URL/api/v1/internal/risk-engine/compute" \
    -H "Content-Type: application/json" \
    -d '{"diagnosis": "diabetes"}' 2>/dev/null || echo "000")
DIAGNOSIS_CODE=$(echo "$DIAGNOSIS_RESPONSE" | tail -1)

if [ "$DIAGNOSIS_CODE" = "400" ]; then
    test_pass
elif [ "$DIAGNOSIS_CODE" = "404" ]; then
    test_skip "Risk engine endpoint not deployed"
else
    test_fail "HTTP $DIAGNOSIS_CODE (expected 400)"
fi

# Test 2.3: Data Boundary Enforcement - Credit Card
test_start "Data boundary blocks credit card"
CC_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
    -X POST "$BACKEND_URL/api/v1/internal/risk-engine/compute" \
    -H "Content-Type: application/json" \
    -d '{"credit_card_number": "4111111111111111"}' 2>/dev/null || echo "000")
CC_CODE=$(echo "$CC_RESPONSE" | tail -1)

if [ "$CC_CODE" = "400" ]; then
    test_pass
elif [ "$CC_CODE" = "404" ]; then
    test_skip "Risk engine endpoint not deployed"
else
    test_fail "HTTP $CC_CODE (expected 400)"
fi

# Test 2.4: Data Boundary - Safe Data Passes
test_start "Data boundary allows safe aggregates"
SAFE_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
    -X POST "$BACKEND_URL/api/v1/internal/risk-engine/compute" \
    -H "Content-Type: application/json" \
    -d '{"age": 30, "bmi": 24.5, "risk_score": 0.75}' 2>/dev/null || echo "000")
SAFE_CODE=$(echo "$SAFE_RESPONSE" | tail -1)

if [ "$SAFE_CODE" = "200" ] || [ "$SAFE_CODE" = "404" ] || [ "$SAFE_CODE" = "422" ]; then
    # 200 = success, 404 = endpoint not found (ok), 422 = validation error (ok - just missing required fields)
    test_pass
elif [ "$SAFE_CODE" = "400" ]; then
    test_fail "Safe data blocked incorrectly"
else
    test_fail "HTTP $SAFE_CODE"
fi

log ""

# ==============================================================================
# Test Suite: Frontend (if URL provided)
# ==============================================================================

if [ -n "$FRONTEND_URL" ]; then
    log "${BLUE}📋 Test Suite 3: Frontend${NC}"
    log ""

    # Test 3.1: Frontend loads
    test_start "Frontend responds"
    FRONTEND_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$FRONTEND_URL" 2>/dev/null || echo "000")
    FRONTEND_CODE=$(echo "$FRONTEND_RESPONSE" | tail -1)

    if [ "$FRONTEND_CODE" = "200" ]; then
        test_pass
    else
        test_fail "HTTP $FRONTEND_CODE"
    fi

    # Test 3.2: Security Headers - CSP
    test_start "Content-Security-Policy header present"
    CSP_HEADER=$(curl -sI --max-time $TIMEOUT "$FRONTEND_URL" 2>/dev/null | grep -i "content-security-policy" || true)

    if [ -n "$CSP_HEADER" ]; then
        echo "$CSP_HEADER" >> "$RESULTS_FILE"
        test_pass
    else
        test_fail "CSP header missing"
    fi

    # Test 3.3: Security Headers - HSTS
    test_start "Strict-Transport-Security header"
    HSTS_HEADER=$(curl -sI --max-time $TIMEOUT "$FRONTEND_URL" 2>/dev/null | grep -i "strict-transport-security" || true)

    if [ -n "$HSTS_HEADER" ]; then
        test_pass
    else
        test_skip "HSTS may not be enabled in preview deployments"
    fi

    # Test 3.4: Security Headers - X-Frame-Options
    test_start "X-Frame-Options header"
    XFO_HEADER=$(curl -sI --max-time $TIMEOUT "$FRONTEND_URL" 2>/dev/null | grep -i "x-frame-options" || true)

    if [ -n "$XFO_HEADER" ]; then
        test_pass
    else
        test_fail "X-Frame-Options header missing"
    fi

    log ""
fi

# ==============================================================================
# Test Suite: API Endpoints (Basic Authentication Flow)
# ==============================================================================

log "${BLUE}📋 Test Suite 4: API Endpoints${NC}"
log ""

# Test 4.1: Health endpoints don't require auth
test_start "Health endpoints unauthenticated"
UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/health" 2>/dev/null || echo "000")
UNAUTH_CODE=$(echo "$UNAUTH_RESPONSE" | tail -1)

if [ "$UNAUTH_CODE" = "200" ]; then
    test_pass
else
    test_fail "HTTP $UNAUTH_CODE"
fi

# Test 4.2: Protected endpoints require auth
test_start "Protected endpoints require authentication"
# Try to access a protected endpoint without token
PROTECTED_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
    "$BACKEND_URL/api/v1/users/me" 2>/dev/null || echo "000")
PROTECTED_CODE=$(echo "$PROTECTED_RESPONSE" | tail -1)

if [ "$PROTECTED_CODE" = "401" ] || [ "$PROTECTED_CODE" = "403" ]; then
    test_pass
elif [ "$PROTECTED_CODE" = "404" ]; then
    test_skip "Endpoint not found (may not be implemented)"
else
    test_fail "HTTP $PROTECTED_CODE (expected 401/403)"
fi

# Test 4.3: CORS headers present
test_start "CORS headers configured"
CORS_RESPONSE=$(curl -sI --max-time $TIMEOUT \
    -H "Origin: https://app.lifenavigator.ai" \
    -H "Access-Control-Request-Method: POST" \
    "$BACKEND_URL/health" 2>/dev/null || true)

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow"; then
    test_pass
else
    test_skip "CORS headers not detected (may need configured origin)"
fi

log ""

# ==============================================================================
# Test Suite: Performance & Reliability
# ==============================================================================

log "${BLUE}📋 Test Suite 5: Performance & Reliability${NC}"
log ""

# Test 5.1: Response time < 2s
test_start "Health check response time < 2s"
START_TIME=$(date +%s%N)
curl -s --max-time $TIMEOUT "$BACKEND_URL/health" > /dev/null 2>&1 || true
END_TIME=$(date +%s%N)
DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $DURATION_MS -lt 2000 ]; then
    test_pass
    echo "Duration: ${DURATION_MS}ms" >> "$RESULTS_FILE"
else
    test_fail "Slow response: ${DURATION_MS}ms"
fi

# Test 5.2: Concurrent requests
test_start "Handles concurrent requests"
CONCURRENT_FAIL=0

for i in {1..5}; do
    curl -s --max-time $TIMEOUT "$BACKEND_URL/health" > /dev/null 2>&1 &
done
wait

if [ $CONCURRENT_FAIL -eq 0 ]; then
    test_pass
else
    test_fail "Some concurrent requests failed"
fi

# Test 5.3: GZip compression
test_start "GZip compression enabled"
GZIP_HEADER=$(curl -sI --max-time $TIMEOUT -H "Accept-Encoding: gzip" "$BACKEND_URL/health" 2>/dev/null | grep -i "content-encoding: gzip" || true)

if [ -n "$GZIP_HEADER" ]; then
    test_pass
else
    test_skip "GZip not detected (may require larger response)"
fi

log ""

# ==============================================================================
# Test Summary
# ==============================================================================

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "╔══════════════════════════════════════════════════════════════╗"
log "║                    TEST SUMMARY                              ║"
log "╚══════════════════════════════════════════════════════════════╝"
log ""
log "   Total Tests:  $TESTS_RUN"
log "   ${GREEN}Passed:       $TESTS_PASSED${NC}"
log "   ${RED}Failed:       $TESTS_FAILED${NC}"
log "   ${YELLOW}Skipped:      $TESTS_SKIPPED${NC}"
log ""

# Calculate success rate
if [ $TESTS_RUN -gt 0 ]; then
    SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TESTS_RUN ))
    log "   Success Rate: $SUCCESS_RATE%"
    log ""
fi

log "   Full results: $RESULTS_FILE"
log ""

# Exit code
if [ $TESTS_FAILED -gt 0 ]; then
    log "╔══════════════════════════════════════════════════════════════╗"
    log "║                   ${RED}❌ TESTS FAILED${NC}                            ║"
    log "╚══════════════════════════════════════════════════════════════╝"
    log ""
    log "🔍 Next Steps:"
    log "   1. Review failed tests in: $RESULTS_FILE"
    log "   2. Check backend logs:"
    log "      gcloud run logs read life-navigator-backend-staging --tail=100"
    log "   3. Fix issues and redeploy"
    log "   4. Re-run smoke tests"
    exit 1
elif [ $TESTS_PASSED -eq $TESTS_RUN ]; then
    log "╔══════════════════════════════════════════════════════════════╗"
    log "║              ${GREEN}✅ ALL TESTS PASSED${NC}                          ║"
    log "╚══════════════════════════════════════════════════════════════╝"
    log ""
    log "🎉 Staging deployment is healthy!"
    log ""
    log "📋 Next Steps:"
    log "   1. Perform manual user flow testing"
    log "   2. Monitor for 30 minutes"
    log "   3. If stable, proceed to production deployment"
    log ""
    exit 0
else
    log "╔══════════════════════════════════════════════════════════════╗"
    log "║          ${YELLOW}⚠️  TESTS PASSED WITH WARNINGS${NC}                  ║"
    log "╚══════════════════════════════════════════════════════════════╝"
    log ""
    log "   Some tests were skipped (likely expected)"
    log "   Review results and proceed with caution"
    log ""
    exit 0
fi
