#!/bin/bash

#
# FloodWatch k6 Load Testing Runner
#
# Usage:
#   ./ops/loadtest/run_tests.sh smoke         # Quick validation
#   ./ops/loadtest/run_tests.sh load          # Full load test
#   ./ops/loadtest/run_tests.sh stress        # Stress test
#   ./ops/loadtest/run_tests.sh all           # Run all tests
#

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${YELLOW}FloodWatch k6 Load Testing${NC}"
echo "=============================="
echo ""
echo "Base URL: $BASE_URL"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Install k6: https://k6.io/docs/getting-started/installation"
    echo ""
    echo "macOS:   brew install k6"
    echo "Linux:   See https://k6.io/docs/getting-started/installation"
    exit 1
fi

# Get API key from .env if not provided
if [ -z "$API_KEY" ]; then
    if [ -f "$PROJECT_ROOT/.env" ]; then
        API_KEY=$(grep "API_KEY_1=" "$PROJECT_ROOT/.env" | cut -d= -f2 | tr -d '"' || echo "")
    fi
fi

if [ -z "$API_KEY" ]; then
    echo -e "${YELLOW}Warning: No API key found. Some tests may fail.${NC}"
    echo "Set API_KEY environment variable or add API_KEY_1 to .env"
    echo ""
fi

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2

    echo -e "${YELLOW}Running $test_name...${NC}"
    echo "-------------------------------"

    if BASE_URL="$BASE_URL" API_KEY="$API_KEY" k6 run "$test_file"; then
        echo -e "${GREEN}✓ $test_name passed${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ $test_name failed${NC}"
        echo ""
        return 1
    fi
}

# Main script
TEST_TYPE="${1:-all}"

case "$TEST_TYPE" in
    smoke)
        run_test "Smoke Test" "$SCRIPT_DIR/k6_smoke_test.js"
        ;;

    load)
        run_test "Load Test" "$SCRIPT_DIR/k6_reports_scenario.js"
        ;;

    stress)
        echo -e "${RED}WARNING: Stress test will put heavy load on the system!${NC}"
        echo "Only run this in test/staging environment."
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            run_test "Stress Test" "$SCRIPT_DIR/k6_stress_test.js"
        else
            echo "Stress test cancelled."
        fi
        ;;

    all)
        echo -e "${GREEN}Running all tests...${NC}"
        echo ""

        FAILED=0

        run_test "Smoke Test" "$SCRIPT_DIR/k6_smoke_test.js" || FAILED=1

        if [ $FAILED -eq 0 ]; then
            run_test "Load Test" "$SCRIPT_DIR/k6_reports_scenario.js" || FAILED=1
        else
            echo -e "${RED}Skipping load test due to smoke test failure${NC}"
        fi

        echo "=============================="
        if [ $FAILED -eq 0 ]; then
            echo -e "${GREEN}All tests passed!${NC}"
        else
            echo -e "${RED}Some tests failed${NC}"
            exit 1
        fi
        ;;

    *)
        echo "Usage: $0 {smoke|load|stress|all}"
        echo ""
        echo "  smoke   - Quick validation (30s, 5 VUs)"
        echo "  load    - Realistic traffic (5min, 10-50 RPS)"
        echo "  stress  - Find breaking point (10min, up to 200 RPS)"
        echo "  all     - Run smoke + load tests"
        exit 1
        ;;
esac
