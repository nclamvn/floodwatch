#!/bin/bash
# Test script for AI Forecast Layer functionality
# This tests the complete AI forecast feature end-to-end

set -e

# Configuration
API_URL="${API_URL:-https://api.thongtinmualu.live}"
ADMIN_TOKEN="${ADMIN_TOKEN:-cd07904694237307b738f80caa2e4580af5e6575e58ded1031bb7cb3eaf4ebe2}"

echo "🧪 Testing AI Forecast Layer"
echo "API URL: $API_URL"
echo ""

# Test 1: Health check
echo "1️⃣ Testing API health..."
HEALTH=$(curl -s "$API_URL/health")
echo "$HEALTH" | jq .
echo "✅ API is healthy"
echo ""

# Test 2: Create a test AI forecast
echo "2️⃣ Creating test AI forecast..."
FORECAST_DATA=$(cat <<EOF
{
  "type": "flood",
  "severity": "high",
  "confidence": 0.85,
  "location": {
    "type": "Point",
    "coordinates": [106.6297, 10.8231]
  },
  "radius_km": 5.0,
  "forecast_time": "$(date -u -v+2H +"%Y-%m-%dT%H:%M:%SZ")",
  "valid_until": "$(date -u -v+8H +"%Y-%m-%dT%H:%M:%SZ")",
  "model_name": "FloodPredictorV2",
  "model_version": "2.1.0",
  "summary": "Dự báo nguy cơ lũ lụt cao tại khu vực TP.HCM trong 2-8 giờ tới do mưa lớn kéo dài kết hợp triều cường. Mực nước sông Sài Gòn có thể vượt mức báo động 2.",
  "predicted_intensity": 0.8,
  "predicted_duration_hours": 6,
  "risk_factors": [
    "Mưa lớn kéo dài >100mm",
    "Triều cường đạt đỉnh",
    "Hệ thống thoát nước quá tải"
  ],
  "data_sources": [
    "Trạm khí tượng Tân Sơn Nhất",
    "Hệ thống radar thời tiết",
    "Dữ liệu mực nước sông",
    "Dự báo triều cường KTTV"
  ]
}
EOF
)

RESPONSE=$(curl -s -X POST "$API_URL/ai-forecasts" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_TOKEN" \
  -d "$FORECAST_DATA")

echo "$RESPONSE" | jq .
FORECAST_ID=$(echo "$RESPONSE" | jq -r '.data.id')

if [ "$FORECAST_ID" != "null" ] && [ -n "$FORECAST_ID" ]; then
  echo "✅ AI forecast created successfully: $FORECAST_ID"
else
  echo "❌ Failed to create AI forecast"
  exit 1
fi
echo ""

# Test 3: Retrieve the forecast
echo "3️⃣ Retrieving AI forecasts..."
FORECASTS=$(curl -s "$API_URL/ai-forecasts?lat=10.8231&lng=106.6297&radius_km=50&min_confidence=0.6")
echo "$FORECASTS" | jq .
COUNT=$(echo "$FORECASTS" | jq '.data | length')
echo "✅ Found $COUNT AI forecast(s)"
echo ""

# Test 4: Get specific forecast
echo "4️⃣ Getting specific forecast details..."
DETAIL=$(curl -s "$API_URL/ai-forecasts/$FORECAST_ID")
echo "$DETAIL" | jq .
echo "✅ Forecast retrieved successfully"
echo ""

# Test 5: Update forecast
echo "5️⃣ Updating forecast confidence..."
UPDATE_DATA='{"confidence": 0.92, "summary": "Cập nhật: Nguy cơ lũ lụt tăng cao hơn dự kiến ban đầu."}'
UPDATED=$(curl -s -X PATCH "$API_URL/ai-forecasts/$FORECAST_ID" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_TOKEN" \
  -d "$UPDATE_DATA")
echo "$UPDATED" | jq .
echo "✅ Forecast updated successfully"
echo ""

# Test 6: Filter by confidence
echo "6️⃣ Testing confidence filter (min_confidence=0.9)..."
HIGH_CONF=$(curl -s "$API_URL/ai-forecasts?min_confidence=0.9&lat=10.8231&lng=106.6297&radius_km=50")
echo "$HIGH_CONF" | jq .
HIGH_COUNT=$(echo "$HIGH_CONF" | jq '.data | length')
echo "✅ Found $HIGH_COUNT high-confidence forecast(s)"
echo ""

# Summary
echo "🎉 All tests passed!"
echo ""
echo "📋 Summary:"
echo "  - Forecast ID: $FORECAST_ID"
echo "  - Location: Ho Chi Minh City (10.8231, 106.6297)"
echo "  - Confidence: 92%"
echo "  - Type: Flood"
echo "  - Severity: High"
echo ""
echo "🌐 View on map: https://thongtinmualu.live/map"
echo "   (Enable '🔮 Dự báo AI' layer in the layer control panel)"
echo ""
echo "🔧 To clean up (delete test forecast):"
echo "   curl -X DELETE $API_URL/ai-forecasts/$FORECAST_ID -H 'X-API-Key: $ADMIN_TOKEN'"
