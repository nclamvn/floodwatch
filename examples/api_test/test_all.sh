#!/bin/bash
# FloodWatch API Test Script
# Usage: ./test_all.sh [API_URL]

API_URL="${1:-http://localhost:8002}"

echo "🧪 Testing FloodWatch API: $API_URL"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "$API_URL/health")
BODY=$(cat /tmp/response.txt)

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ PASS${NC} - API is healthy"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL${NC} - HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Community Report
echo -e "${YELLOW}Test 2: Community Report${NC}"
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" -X POST "$API_URL/ingest/community" \
  -H 'Content-Type: application/json' \
  -d @test_community.json)
BODY=$(cat /tmp/response.txt)

if [ "$HTTP_CODE" == "200" ]; then
    REPORT_ID=$(echo "$BODY" | grep -o '"report_id":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ PASS${NC} - Community report created"
    echo "Report ID: $REPORT_ID"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL${NC} - HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 3: Road Event
echo -e "${YELLOW}Test 3: Road Event${NC}"
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" -X POST "$API_URL/ingest/road-event" \
  -H 'Content-Type: application/json' \
  -d @test_road.json)
BODY=$(cat /tmp/response.txt)

if [ "$HTTP_CODE" == "200" ]; then
    ROAD_ID=$(echo "$BODY" | grep -o '"road_id":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ PASS${NC} - Road event created"
    echo "Road ID: $ROAD_ID"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL${NC} - HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 4: KTTV Alerts (batch)
echo -e "${YELLOW}Test 4: KTTV Alerts (Batch)${NC}"
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" -X POST "$API_URL/ingest/alerts" \
  -H 'Content-Type: application/json' \
  -d @test_alerts.json)
BODY=$(cat /tmp/response.txt)

if [ "$HTTP_CODE" == "200" ]; then
    INGESTED=$(echo "$BODY" | grep -o '"ingested":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ PASS${NC} - Alerts ingested: $INGESTED"
    echo "Response: $BODY"
else
    echo -e "${RED}❌ FAIL${NC} - HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi
echo ""

# Test 5: Verify Data
echo -e "${YELLOW}Test 5: Verify Reports${NC}"
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "$API_URL/reports?limit=3")
BODY=$(cat /tmp/response.txt)

if [ "$HTTP_CODE" == "200" ]; then
    TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ PASS${NC} - Total reports: $TOTAL"
else
    echo -e "${RED}❌ FAIL${NC} - HTTP $HTTP_CODE"
fi
echo ""

echo -e "${YELLOW}Test 6: Verify Road Events${NC}"
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "$API_URL/road-events?limit=3")
BODY=$(cat /tmp/response.txt)

if [ "$HTTP_CODE" == "200" ]; then
    TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ PASS${NC} - Total road events: $TOTAL"
else
    echo -e "${RED}❌ FAIL${NC} - HTTP $HTTP_CODE"
fi
echo ""

echo "=================================="
echo -e "${GREEN}🎉 Test suite completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Check logs: docker compose logs -f api"
echo "2. View on map: https://your-domain.com/map"
echo "3. Share API docs with partners"
