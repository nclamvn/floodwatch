#!/bin/bash

# ==========================================
# RAILWAY DATABASE SETUP - TỰ ĐỘNG 100%
# ==========================================

set -e  # Exit on error

echo "🚀 =========================================="
echo "   RAILWAY DATABASE AUTO SETUP"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database connection details
DB_URL="postgresql://postgres:BzWZmXtNBGlpwfNUsFPrZchahVtAcyJc@postgres.railway.internal:5432/railway"
DB_HOST="postgres.railway.internal"
DB_USER="postgres"
DB_PASS="BzWZmXtNBGlpwfNUsFPrZchahVtAcyJc"
DB_NAME="railway"

echo "📋 Step 1: Checking Railway CLI..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}⚠️  Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
    echo -e "${GREEN}✅ Railway CLI installed${NC}"
else
    echo -e "${GREEN}✅ Railway CLI found${NC}"
fi

echo ""
echo "📋 Step 2: Logging into Railway..."

# Login to Railway
railway login

echo ""
echo "📋 Step 3: Linking to Railway project..."

# Link to the project
cd /Users/mac/floodwatch
railway link

echo ""
echo "📋 Step 4: Enabling PostGIS extension..."

# Enable PostGIS using Railway CLI
railway run --service Postgres psql $DB_URL -c "CREATE EXTENSION IF NOT EXISTS postgis;"
railway run --service Postgres psql $DB_URL -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

echo -e "${GREEN}✅ PostGIS enabled${NC}"

echo ""
echo "📋 Step 5: Running database migrations..."

# Run Alembic migrations
cd /Users/mac/floodwatch/apps/api
railway run --service floodwatch alembic upgrade head

echo -e "${GREEN}✅ Migrations completed${NC}"

echo ""
echo "📋 Step 6: Testing API health..."

# Wait a bit for deployment
sleep 5

# Test API
API_URL="https://floodwatch-production.up.railway.app"
HEALTH_CHECK=$(curl -s "$API_URL/health")

echo "API Response:"
echo "$HEALTH_CHECK" | python3 -m json.tool || echo "$HEALTH_CHECK"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ SETUP COMPLETED!${NC}"
echo "=========================================="
echo ""
echo "🎉 Your API should now be working!"
echo ""
echo "Test it:"
echo "  curl $API_URL/health"
echo ""
echo "Next steps:"
echo "  1. Deploy frontend to Vercel"
echo "  2. Add custom domain"
echo "  3. Done!"
echo ""
