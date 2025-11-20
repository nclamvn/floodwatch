#!/bin/bash
# Seed 18 AI Forecasts across Vietnam
# Distribution: Hà Nội (4), TP.HCM (4), Đà Nẵng (3), Cần Thơ (2), Huế (2), Quảng Ninh (1), Nghệ An (1), Bình Định (1)

set -e

DB_CONTAINER="floodwatch-db-1"
DB_NAME="floodwatch_dev"
DB_USER="postgres"
SCRIPT_DIR="$(dirname "$0")"

echo "🌍 Seeding 18 AI Forecasts across Vietnam..."

# Execute SQL file
docker cp "$SCRIPT_DIR/seed_ai_forecasts.sql" $DB_CONTAINER:/tmp/seed_ai_forecasts.sql
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -f /tmp/seed_ai_forecasts.sql

# Count inserted records
COUNT=$(docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM ai_forecasts WHERE source = 'seed_script';")

echo "✅ Seeded $COUNT AI forecasts successfully!"
echo ""
echo "📊 Distribution:"
echo "   - Hà Nội: 4 forecasts"
echo "   - TP.HCM: 4 forecasts"
echo "   - Đà Nẵng: 3 forecasts"
echo "   - Cần Thơ: 2 forecasts"
echo "   - Huế: 2 forecasts"
echo "   - Quảng Ninh: 1 forecast"
echo "   - Nghệ An: 1 forecast"
echo "   - Bình Định: 1 forecast"
echo ""
echo "🔍 View in API: http://localhost:8002/ai-forecasts"
echo "🗺️  View on map: http://localhost:3002/map"
