#!/bin/bash

# =====================================================
# Production API Health Check Script
# =====================================================
# File: scripts/test-production-api.sh
# Purpose: Verify production API is working correctly
# Usage: ./scripts/test-production-api.sh
# =====================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL
API_URL="https://api.thongtinmualu.live"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# =====================================================
# Helper Functions
# =====================================================

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_test() {
    echo -e "${YELLOW}▶ Testing:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}ℹ Info:${NC} $1"
}

# =====================================================
# Test Functions
# =====================================================

test_health_endpoint() {
    print_header "TEST 1: Health Endpoint"
    print_test "/health"

    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Health endpoint returned 200 OK"

        # Check if response contains expected fields
        if echo "$BODY" | grep -q '"status"'; then
            print_success "Response contains 'status' field"
        else
            print_error "Response missing 'status' field"
        fi

        if echo "$BODY" | grep -q '"version"'; then
            print_success "Response contains 'version' field"
        else
            print_error "Response missing 'version' field"
        fi

        print_info "Response: $BODY"
    else
        print_error "Health endpoint returned HTTP $HTTP_CODE"
        print_info "Response: $BODY"
    fi
}

test_reports_endpoint() {
    print_header "TEST 2: Reports Endpoint"
    print_test "/reports?limit=5"

    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/reports?limit=5" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Reports endpoint returned 200 OK"

        # Check if response contains data
        if echo "$BODY" | grep -q '"data"'; then
            print_success "Response contains 'data' field"

            # Count reports
            REPORT_COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l)
            print_info "Found $REPORT_COUNT reports in response"
        else
            print_error "Response missing 'data' field"
        fi
    else
        print_error "Reports endpoint returned HTTP $HTTP_CODE"
        print_info "Response: $BODY"
    fi
}

test_traffic_endpoint() {
    print_header "TEST 3: Traffic Disruptions Endpoint"
    print_test "/traffic/disruptions?limit=5"

    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/traffic/disruptions?limit=5" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Traffic disruptions endpoint returned 200 OK"

        if echo "$BODY" | grep -q '"data"'; then
            print_success "Response contains 'data' field"
        else
            print_error "Response missing 'data' field"
        fi
    else
        print_error "Traffic disruptions endpoint returned HTTP $HTTP_CODE"
        print_info "Response: $BODY"
    fi
}

test_distress_endpoint() {
    print_header "TEST 4: Distress Reports Endpoint"
    print_test "/distress?limit=5"

    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/distress?limit=5" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Distress endpoint returned 200 OK"

        if echo "$BODY" | grep -q '"data"'; then
            print_success "Response contains 'data' field"
        else
            print_error "Response missing 'data' field"
        fi
    else
        print_error "Distress endpoint returned HTTP $HTTP_CODE"
        print_info "Response: $BODY"
    fi
}

test_cors_headers() {
    print_header "TEST 5: CORS Headers"
    print_test "OPTIONS /reports with Origin header"

    CORS_RESPONSE=$(curl -s -I -X OPTIONS "$API_URL/reports" \
        -H "Origin: https://thongtinmualu.live" \
        -H "Access-Control-Request-Method: GET" 2>&1)

    if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
        ORIGIN=$(echo "$CORS_RESPONSE" | grep "Access-Control-Allow-Origin" | cut -d' ' -f2 | tr -d '\r')
        print_success "CORS header present: $ORIGIN"

        if echo "$CORS_RESPONSE" | grep -q "thongtinmualu.live"; then
            print_success "Origin matches production domain"
        else
            print_error "Origin does not match production domain"
        fi
    else
        print_error "CORS headers missing!"
        print_info "Response: $CORS_RESPONSE"
    fi
}

test_ai_forecasts() {
    print_header "TEST 6: AI Forecasts Endpoint"
    print_test "/ai-forecasts"

    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/ai-forecasts" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "AI forecasts endpoint returned 200 OK"
    else
        print_error "AI forecasts endpoint returned HTTP $HTTP_CODE"
        print_info "Response: $BODY"
    fi
}

test_road_events() {
    print_header "TEST 7: Road Events Endpoint"
    print_test "/road-events?limit=5"

    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/road-events?limit=5" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Road events endpoint returned 200 OK"
    else
        print_error "Road events endpoint returned HTTP $HTTP_CODE"
        print_info "Response: $BODY"
    fi
}

print_summary() {
    print_header "TEST SUMMARY"

    TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed:      ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed:      ${RED}$TESTS_FAILED${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  🎉 ALL TESTS PASSED! API is healthy!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        exit 0
    else
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  ⚠️  SOME TESTS FAILED! Check logs above.${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Troubleshooting steps:"
        echo "1. Check if environment variables are set in Render Dashboard"
        echo "2. Verify deployment completed successfully"
        echo "3. Check Render logs for errors"
        echo "4. See PRODUCTION_FIX.md for detailed instructions"
        echo ""
        exit 1
    fi
}

# =====================================================
# Main Execution
# =====================================================

main() {
    clear

    print_header "🚀 FloodWatch Production API Health Check"
    print_info "Testing API at: $API_URL"
    print_info "Started at: $(date '+%Y-%m-%d %H:%M:%S')"

    # Run all tests
    test_health_endpoint
    test_reports_endpoint
    test_traffic_endpoint
    test_distress_endpoint
    test_cors_headers
    test_ai_forecasts
    test_road_events

    # Print summary
    print_summary
}

# Run main function
main
