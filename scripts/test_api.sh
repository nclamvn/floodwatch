#!/bin/bash
# Test FloodWatch API Endpoints

set -e

API_URL="${API_URL:-http://localhost:8000}"

echo "🧪 Testing FloodWatch API..."
echo "API URL: $API_URL"
echo ""

# Test 1: Health check
echo "1️⃣ Testing /health endpoint..."
if curl -s "$API_URL/health" | grep -q '"status":"ok"'; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed"
    exit 1
fi

# Test 2: Get reports
echo "2️⃣ Testing /reports endpoint..."
if curl -s "$API_URL/reports" | grep -q '"total"'; then
    echo "   ✅ Reports endpoint working"
else
    echo "   ❌ Reports endpoint failed"
    exit 1
fi

# Test 3: Get road events
echo "3️⃣ Testing /road-events endpoint..."
if curl -s "$API_URL/road-events" | grep -q '"total"'; then
    echo "   ✅ Road events endpoint working"
else
    echo "   ❌ Road events endpoint failed"
    exit 1
fi

# Test 4: Ingest community report
echo "4️⃣ Testing /ingest/community endpoint..."
RESPONSE=$(curl -s -X POST "$API_URL/ingest/community" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SOS",
    "text": "Test report from script",
    "lat": 16.07,
    "lon": 108.22,
    "province": "Đà Nẵng"
  }')

if echo "$RESPONSE" | grep -q '"status":"success"'; then
    echo "   ✅ Community ingest working"
else
    echo "   ❌ Community ingest failed"
    exit 1
fi

echo ""
echo "✅ All API tests passed!"
echo ""
echo "🌐 Open in browser:"
echo "   - Web UI: http://localhost:3000"
echo "   - API Docs: http://localhost:8000/docs"
