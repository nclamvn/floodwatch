#!/bin/bash

# ========================================
# Script tự động deploy Backend lên Railway
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
echo "╔════════════════════════════════════════════╗"
echo "║   🚀 FloodWatch Backend Deployment 🚀     ║"
echo "║        Railway Auto Deployment             ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# ========================================
# Step 1: Check Railway CLI
# ========================================
echo -e "${BLUE}[1/7]${NC} Kiểm tra Railway CLI..."

if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}⚠️  Railway CLI chưa được cài đặt${NC}"
    echo -e "${GREEN}→${NC} Đang cài đặt Railway CLI..."
    npm i -g @railway/cli
    echo -e "${GREEN}✅ Đã cài đặt Railway CLI${NC}"
else
    echo -e "${GREEN}✅ Railway CLI đã được cài đặt${NC}"
fi

echo ""

# ========================================
# Step 2: Login to Railway
# ========================================
echo -e "${BLUE}[2/7]${NC} Đăng nhập Railway..."

if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Bạn chưa đăng nhập Railway${NC}"
    echo -e "${GREEN}→${NC} Đang mở trình duyệt để đăng nhập..."
    railway login
    echo -e "${GREEN}✅ Đã đăng nhập Railway${NC}"
else
    RAILWAY_USER=$(railway whoami 2>/dev/null | head -1)
    echo -e "${GREEN}✅ Đã đăng nhập: ${RAILWAY_USER}${NC}"
fi

echo ""

# ========================================
# Step 3: Initialize Railway Project
# ========================================
echo -e "${BLUE}[3/7]${NC} Tạo Railway project..."

# Check if already linked to a project
if railway status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Project đã được link${NC}"
    railway status
    read -p "$(echo -e ${GREEN}→${NC} Bạn có muốn tạo project mới không? [y/N]: )" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}ℹ️  Sử dụng project hiện tại${NC}"
    else
        echo -e "${GREEN}→${NC} Tạo project mới..."
        railway init --name floodwatch-api
        echo -e "${GREEN}✅ Đã tạo project: floodwatch-api${NC}"
    fi
else
    echo -e "${GREEN}→${NC} Tạo project mới..."
    railway init --name floodwatch-api
    echo -e "${GREEN}✅ Đã tạo project: floodwatch-api${NC}"
fi

echo ""

# ========================================
# Step 4: Add PostgreSQL Database
# ========================================
echo -e "${BLUE}[4/7]${NC} Thêm PostgreSQL database..."

# Check if PostgreSQL already exists
if railway variables | grep -q "DATABASE_URL"; then
    echo -e "${GREEN}✅ PostgreSQL đã tồn tại${NC}"
else
    echo -e "${GREEN}→${NC} Đang thêm PostgreSQL..."
    railway add --database postgres
    echo -e "${GREEN}✅ Đã thêm PostgreSQL database${NC}"
fi

echo ""

# ========================================
# Step 5: Set Environment Variables
# ========================================
echo -e "${BLUE}[5/7]${NC} Cấu hình environment variables..."

echo -e "${GREEN}→${NC} Set PYTHON_VERSION..."
railway variables set PYTHON_VERSION=3.11

echo -e "${GREEN}✅ Environment variables đã được cấu hình${NC}"

echo ""

# ========================================
# Step 6: Deploy Backend
# ========================================
echo -e "${BLUE}[6/7]${NC} Deploy backend lên Railway..."

echo -e "${GREEN}→${NC} Đang deploy... (có thể mất 3-5 phút)"
echo -e "${YELLOW}⏳ Vui lòng đợi...${NC}"

railway up --detach

echo -e "${GREEN}✅ Deploy thành công!${NC}"

echo ""

# ========================================
# Step 7: Get Production URL
# ========================================
echo -e "${BLUE}[7/7]${NC} Lấy production URL..."

# Generate domain if not exists
if ! railway domain 2>/dev/null | grep -q "https://"; then
    echo -e "${GREEN}→${NC} Generating domain..."
    DOMAIN=$(railway domain 2>&1)
else
    DOMAIN=$(railway domain 2>&1 | grep "https://" | head -1)
fi

echo -e "${GREEN}✅ Production URL:${NC}"
echo -e "${PURPLE}${DOMAIN}${NC}"

echo ""

# ========================================
# Step 8: Run Migrations
# ========================================
echo -e "${BLUE}[BONUS]${NC} Chạy database migrations..."

echo -e "${GREEN}→${NC} Đang chạy alembic upgrade..."
railway run bash -c "cd apps/api && alembic upgrade head"

echo -e "${GREEN}✅ Migrations hoàn tất${NC}"

echo ""

# ========================================
# Step 9: Seed AI Forecasts
# ========================================
echo -e "${BLUE}[BONUS]${NC} Seed dữ liệu AI forecasts..."

read -p "$(echo -e ${GREEN}→${NC} Bạn có muốn seed 18 AI forecasts mẫu không? [Y/n]: )" -n 1 -r
echo

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${GREEN}→${NC} Đang seed data..."
    railway run bash -c "psql \$DATABASE_URL < scripts/seed_ai_forecasts.sql"
    echo -e "${GREEN}✅ Đã seed 18 AI forecasts${NC}"
else
    echo -e "${YELLOW}⏭️  Bỏ qua seed data${NC}"
fi

echo ""

# ========================================
# Success Summary
# ========================================
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════╗"
echo "║        ✨ DEPLOYMENT THÀNH CÔNG! ✨       ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${PURPLE}📋 THÔNG TIN DEPLOYMENT:${NC}"
echo -e "${GREEN}→${NC} Backend URL: ${PURPLE}${DOMAIN}${NC}"
echo -e "${GREEN}→${NC} Database: PostgreSQL (Railway)"
echo -e "${GREEN}→${NC} Status: ✅ Running"

echo ""
echo -e "${YELLOW}⚠️  BƯỚC TIẾP THEO (QUAN TRỌNG):${NC}"
echo ""
echo -e "${GREEN}1.${NC} Set environment variable trên Vercel/Netlify:"
echo -e "   ${BLUE}NEXT_PUBLIC_API_URL${NC} = ${PURPLE}${DOMAIN}${NC}"
echo ""
echo -e "${GREEN}2.${NC} Redeploy frontend:"
echo -e "   - Vercel: Dashboard → Deployments → Redeploy"
echo -e "   - Netlify: Deploys → Trigger deploy"
echo ""
echo -e "${GREEN}3.${NC} Test API:"
echo -e "   ${BLUE}curl ${DOMAIN}/health${NC}"
echo -e "   ${BLUE}curl ${DOMAIN}/ai-forecasts?limit=5${NC}"
echo ""
echo -e "${GREEN}4.${NC} Kiểm tra website:"
echo -e "   ${BLUE}https://thongtinmualu.live/map${NC}"
echo -e "   → Click button AI (tím)"
echo -e "   → Xem markers tím xuất hiện trên map"
echo ""

# Test API
echo -e "${BLUE}🔍 TESTING API...${NC}"
echo ""
sleep 3

echo -e "${GREEN}→${NC} Testing /health endpoint..."
if curl -s "${DOMAIN}/health" | grep -q "healthy\|ok\|status"; then
    echo -e "${GREEN}✅ Health check: PASSED${NC}"
else
    echo -e "${RED}❌ Health check: FAILED${NC}"
fi

echo ""
echo -e "${GREEN}→${NC} Testing /ai-forecasts endpoint..."
FORECASTS_COUNT=$(curl -s "${DOMAIN}/ai-forecasts?limit=1" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")

if [ "$FORECASTS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ AI Forecasts: ${FORECASTS_COUNT} forecasts found${NC}"
else
    echo -e "${YELLOW}⚠️  AI Forecasts: No data (chạy seed script để thêm data)${NC}"
fi

echo ""
echo -e "${PURPLE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment hoàn tất! Happy coding! 🚀${NC}"
echo -e "${PURPLE}════════════════════════════════════════════${NC}"
