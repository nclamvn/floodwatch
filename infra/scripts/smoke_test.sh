#!/usr/bin/env bash
#
# FloodWatch Smoke Test
#
# Quick validation of critical endpoints after deployment
# Tests: Health, CORS/Security headers, API, Lite mode, CSV, Ops, Metrics
#
# Usage:
#   export API_KEY="your_api_key"
#   export ADMIN_TOKEN="your_admin_token"
#   ./smoke_test.sh
#
# Or inline:
#   API_KEY=xxx ADMIN_TOKEN=yyy ./smoke_test.sh
#

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-https://floodwatch.vn}"
API_URL="${API_URL:-https://api.floodwatch.vn}"
API_KEY="${API_KEY:-REPLACE_ME}"
ADMIN_TOKEN="${ADMIN_TOKEN:-REPLACE_ME}"

PASSED=0
FAILED=0

echo "======================================"
echo "FloodWatch Smoke Test"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "API URL:  $API_URL"
echo ""

# Helper function
test_endpoint() {
    local name="$1"
    local cmd="$2"
    local expected="$3"

    echo -n "Testing $name... "

    if output=$(eval "$cmd" 2>&1); then
        if echo "$output" | grep -q "$expected"; then
            echo -e "${GREEN}✓ PASS${NC}"
            PASSED=$((PASSED + 1))
            return 0
        else
            echo -e "${RED}✗ FAIL (unexpected output)${NC}"
            echo "  Expected: $expected"
            echo "  Got: $(echo "$output" | head -c 100)..."
            FAILED=$((FAILED + 1))
            return 1
        fi
    else
        echo -e "${RED}✗ FAIL (command failed)${NC}"
        echo "  Error: $output"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Test 1: Health check
echo "[1/7] Health Endpoint"
test_endpoint "GET /health" \
    "curl -sS '$BASE_URL/health'" \
    '"status":"ok"'
echo ""

# Test 2: CORS and Security Headers
echo "[2/7] Security Headers"
echo -n "Checking headers... "
HEADERS=$(curl -sSI "$BASE_URL" 2>&1)

HEADER_CHECKS=0
if echo "$HEADERS" | grep -qi "access-control-allow"; then
    echo -e "${GREEN}✓ CORS${NC}"
    HEADER_CHECKS=$((HEADER_CHECKS + 1))
else
    echo -e "${YELLOW}⚠ CORS header missing${NC}"
fi

if echo "$HEADERS" | grep -qi "strict-transport-security"; then
    echo -e "${GREEN}✓ HSTS${NC}"
    HEADER_CHECKS=$((HEADER_CHECKS + 1))
else
    echo -e "${YELLOW}⚠ HSTS header missing${NC}"
fi

if echo "$HEADERS" | grep -qi "x-content-type-options"; then
    echo -e "${GREEN}✓ X-Content-Type-Options${NC}"
    HEADER_CHECKS=$((HEADER_CHECKS + 1))
else
    echo -e "${YELLOW}⚠ X-Content-Type-Options missing${NC}"
fi

if echo "$HEADERS" | grep -qi "x-frame-options"; then
    echo -e "${GREEN}✓ X-Frame-Options${NC}"
    HEADER_CHECKS=$((HEADER_CHECKS + 1))
else
    echo -e "${YELLOW}⚠ X-Frame-Options missing${NC}"
fi

# CSP Check - verify STRICT mode (no wildcard https:)
CSP_HEADER=$(echo "$HEADERS" | grep -i "content-security-policy:" || true)
if [ -n "$CSP_HEADER" ]; then
    if echo "$CSP_HEADER" | grep -q "https://api.mapbox.com"; then
        # Has specific Mapbox domain - good
        if echo "$CSP_HEADER" | grep -Eq "img-src[^;]*https:([^/]|$)" || echo "$CSP_HEADER" | grep -Eq "connect-src[^;]*https:([^/]|$)"; then
            # Contains wildcard https: - bad
            echo -e "${YELLOW}⚠ CSP (has wildcard, should be STRICT)${NC}"
        else
            # STRICT mode - no wildcard
            echo -e "${GREEN}✓ CSP (STRICT mode)${NC}"
            HEADER_CHECKS=$((HEADER_CHECKS + 1))
        fi
    else
        echo -e "${YELLOW}⚠ CSP (Mapbox domain missing)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ CSP header missing${NC}"
fi

if [ $HEADER_CHECKS -ge 3 ]; then
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}Security headers: PASS ($HEADER_CHECKS/5 found)${NC}"
else
    FAILED=$((FAILED + 1))
    echo -e "${YELLOW}Security headers: WARN (only $HEADER_CHECKS/5 found)${NC}"
fi
echo ""

# Test 3: Public API with key
echo "[3/7] Public API Endpoint"
if [ "$API_KEY" = "REPLACE_ME" ]; then
    echo -e "${YELLOW}⚠ SKIP (API_KEY not set)${NC}"
else
    test_endpoint "GET /api/v1/reports" \
        "curl -sS -H 'X-API-Key: $API_KEY' '$API_URL/api/v1/reports?limit=3'" \
        '"data"'
fi
echo ""

# Test 4: Lite mode
echo "[4/7] Lite Mode"
test_endpoint "GET /lite" \
    "curl -sS '$BASE_URL/lite'" \
    "FloodWatch - Lite Mode"
echo ""

# Test 5: CSV Export
echo "[5/7] CSV Export"
test_endpoint "GET /reports/export (CSV)" \
    "curl -sS '$BASE_URL/reports/export?format=csv&since=24h' | head -1" \
    "id,created_at"
echo ""

# Test 6: Ops Dashboard
echo "[6/7] Ops Dashboard"
if [ "$ADMIN_TOKEN" = "REPLACE_ME" ]; then
    echo -e "${YELLOW}⚠ SKIP (ADMIN_TOKEN not set)${NC}"
else
    test_endpoint "GET /ops" \
        "curl -sSI '$BASE_URL/ops?token=$ADMIN_TOKEN' | head -1" \
        "200"
fi
echo ""

# Test 7: Metrics Endpoint
echo "[7/7] Metrics Endpoint"
if [ "$ADMIN_TOKEN" = "REPLACE_ME" ]; then
    echo -e "${YELLOW}⚠ SKIP (ADMIN_TOKEN not set)${NC}"
else
    test_endpoint "GET /metrics" \
        "curl -sS '$BASE_URL/metrics?token=$ADMIN_TOKEN' | head -10" \
        "http_requests_total"
fi
echo ""

# Summary
echo "======================================"
TOTAL=$((PASSED + FAILED))
echo "Results: $PASSED passed, $FAILED failed (out of $TOTAL tests)"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    exit 0
elif [ $FAILED -le 2 ]; then
    echo -e "${YELLOW}⚠ Some tests failed, but core features working${NC}"
    exit 0
else
    echo -e "${RED}✗ Multiple tests failed. Check deployment.${NC}"
    exit 1
fi
