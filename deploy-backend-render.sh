#!/bin/bash

# ========================================
# Script tự động deploy Backend lên Render
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
echo "║        Render Auto Deployment              ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# ========================================
# Step 1: Check Git Remote
# ========================================
echo -e "${BLUE}[1/5]${NC} Kiểm tra Git repository..."

if ! git remote -v | grep -q "origin"; then
    echo -e "${RED}❌ Không tìm thấy Git remote 'origin'${NC}"
    exit 1
fi

REPO_URL=$(git config --get remote.origin.url)
echo -e "${GREEN}✅ Repository: ${REPO_URL}${NC}"

# Extract GitHub username and repo name
if [[ $REPO_URL =~ github.com[:/]([^/]+)/([^/.]+) ]]; then
    GITHUB_USER="${BASH_REMATCH[1]}"
    GITHUB_REPO="${BASH_REMATCH[2]}"
    echo -e "${GREEN}→${NC} GitHub: ${GITHUB_USER}/${GITHUB_REPO}"
else
    echo -e "${RED}❌ Invalid GitHub URL${NC}"
    exit 1
fi

echo ""

# ========================================
# Step 2: Push Code to GitHub
# ========================================
echo -e "${BLUE}[2/5]${NC} Đẩy code lên GitHub..."

CURRENT_BRANCH=$(git branch --show-current)
echo -e "${GREEN}→${NC} Branch hiện tại: ${CURRENT_BRANCH}"

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Có thay đổi chưa commit${NC}"
    git status -s
    read -p "$(echo -e ${GREEN}→${NC} Commit tất cả thay đổi? [Y/n]: )" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git add .
        git commit -m "Deploy backend to Render

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
        echo -e "${GREEN}✅ Đã commit thay đổi${NC}"
    fi
fi

echo -e "${GREEN}→${NC} Đang push lên GitHub..."
git push origin $CURRENT_BRANCH
echo -e "${GREEN}✅ Code đã được push lên GitHub${NC}"

echo ""

# ========================================
# Step 3: Install Render CLI (optional)
# ========================================
echo -e "${BLUE}[3/5]${NC} Cài đặt Render CLI..."

if ! command -v render &> /dev/null; then
    echo -e "${YELLOW}⚠️  Render CLI chưa được cài đặt${NC}"
    read -p "$(echo -e ${GREEN}→${NC} Cài đặt Render CLI? [Y/n]: )" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${GREEN}→${NC} Đang cài đặt..."
        brew tap render-oss/render
        brew install render
        echo -e "${GREEN}✅ Đã cài đặt Render CLI${NC}"
    else
        echo -e "${YELLOW}⏭️  Bỏ qua cài đặt CLI (sẽ dùng Dashboard)${NC}"
    fi
else
    echo -e "${GREEN}✅ Render CLI đã được cài đặt${NC}"
fi

echo ""

# ========================================
# Step 4: Create Render Service
# ========================================
echo -e "${BLUE}[4/5]${NC} Tạo Render service..."

echo ""
echo -e "${PURPLE}════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📋 HƯỚNG DẪN DEPLOY TRÊN RENDER DASHBOARD${NC}"
echo -e "${PURPLE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}1.${NC} Mở Render Dashboard:"
echo -e "   ${BLUE}https://dashboard.render.com/create?type=web${NC}"
echo ""

echo -e "${GREEN}2.${NC} Connect GitHub Repository:"
echo -e "   - Click 'New +' → 'Web Service'"
echo -e "   - Select 'Build and deploy from a Git repository'"
echo -e "   - Connect repository: ${PURPLE}${GITHUB_USER}/${GITHUB_REPO}${NC}"
echo -e "   - Branch: ${PURPLE}${CURRENT_BRANCH}${NC}"
echo ""

echo -e "${GREEN}3.${NC} Cấu hình Service:"
echo -e "   ${YELLOW}Name:${NC} floodwatch-api"
echo -e "   ${YELLOW}Environment:${NC} Python 3"
echo -e "   ${YELLOW}Build Command:${NC}"
echo -e "   ${BLUE}pip install -r apps/api/requirements.txt${NC}"
echo ""
echo -e "   ${YELLOW}Start Command:${NC}"
echo -e "   ${BLUE}cd apps/api && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port \$PORT${NC}"
echo ""

echo -e "${GREEN}4.${NC} Thêm PostgreSQL Database:"
echo -e "   - Trong service settings, scroll down → 'Environment'"
echo -e "   - Click 'Add Database'"
echo -e "   - Select 'PostgreSQL'"
echo -e "   - Name: floodwatch-db"
echo -e "   - Plan: Free"
echo ""

echo -e "${GREEN}5.${NC} Environment Variables:"
echo -e "   Render sẽ tự động set DATABASE_URL từ PostgreSQL"
echo -e "   Thêm thêm:"
echo -e "   ${YELLOW}PYTHON_VERSION${NC} = ${BLUE}3.11${NC}"
echo ""

echo -e "${GREEN}6.${NC} Deploy:"
echo -e "   - Click 'Create Web Service'"
echo -e "   - Đợi deploy hoàn tất (~5-10 phút)"
echo -e "   - Service URL sẽ có dạng: ${PURPLE}https://floodwatch-api.onrender.com${NC}"
echo ""

echo -e "${PURPLE}════════════════════════════════════════════${NC}"
echo ""

# ========================================
# Step 5: Wait for Deployment
# ========================================
echo -e "${BLUE}[5/5]${NC} Sau khi deploy xong..."

read -p "$(echo -e ${GREEN}→${NC} Nhấn Enter sau khi deploy xong trên Render Dashboard...)"
echo ""

echo -e "${GREEN}→${NC} Nhập Service URL từ Render:"
read -p "URL (vd: https://floodwatch-api.onrender.com): " RENDER_URL

# Remove trailing slash
RENDER_URL="${RENDER_URL%/}"

echo ""
echo -e "${GREEN}→${NC} Testing API endpoints..."

# Test health endpoint
echo -e "${BLUE}Testing /health...${NC}"
sleep 2
if curl -s "${RENDER_URL}/health" | grep -q "healthy\|ok\|status"; then
    echo -e "${GREEN}✅ Health check: PASSED${NC}"
else
    echo -e "${RED}❌ Health check: FAILED${NC}"
fi

echo ""

# Test ai-forecasts endpoint
echo -e "${BLUE}Testing /ai-forecasts...${NC}"
sleep 2
FORECASTS_RESPONSE=$(curl -s "${RENDER_URL}/ai-forecasts?limit=1")
if echo "$FORECASTS_RESPONSE" | grep -q "total"; then
    FORECASTS_COUNT=$(echo "$FORECASTS_RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
    if [ "$FORECASTS_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ AI Forecasts: ${FORECASTS_COUNT} forecasts found${NC}"
    else
        echo -e "${YELLOW}⚠️  AI Forecasts: No data (cần seed database)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  AI Forecasts: Endpoint có issue${NC}"
fi

echo ""

# ========================================
# Seed Data (if needed)
# ========================================
if [ "$FORECASTS_COUNT" -eq 0 ] || [ -z "$FORECASTS_COUNT" ]; then
    echo -e "${BLUE}[BONUS]${NC} Seed AI Forecasts..."
    echo ""
    read -p "$(echo -e ${GREEN}→${NC} Bạn có muốn seed 18 AI forecasts mẫu không? [Y/n]: )" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo -e "${GREEN}→${NC} Để seed data trên Render:"
        echo ""
        echo -e "1. Vào Render Dashboard → Service → Shell"
        echo -e "2. Chạy lệnh:"
        echo -e "   ${BLUE}psql \$DATABASE_URL < scripts/seed_ai_forecasts.sql${NC}"
        echo ""
        echo -e "3. Hoặc download SQL file và import:"
        echo -e "   ${BLUE}curl -o seed.sql https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${CURRENT_BRANCH}/scripts/seed_ai_forecasts.sql${NC}"
        echo -e "   ${BLUE}psql \$DATABASE_URL < seed.sql${NC}"
        echo ""
        read -p "$(echo -e ${GREEN}→${NC} Nhấn Enter sau khi seed xong...)"
    fi
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
echo -e "${GREEN}→${NC} Backend URL: ${PURPLE}${RENDER_URL}${NC}"
echo -e "${GREEN}→${NC} Database: PostgreSQL (Render)"
echo -e "${GREEN}→${NC} Status: ✅ Running"

echo ""
echo -e "${YELLOW}⚠️  BƯỚC TIẾP THEO (QUAN TRỌNG):${NC}"
echo ""
echo -e "${GREEN}1.${NC} Set environment variable trên Vercel/Netlify:"
echo -e "   ${BLUE}NEXT_PUBLIC_API_URL${NC} = ${PURPLE}${RENDER_URL}${NC}"
echo ""
echo -e "${GREEN}2.${NC} Redeploy frontend:"
echo -e "   - Vercel: Dashboard → Deployments → Redeploy"
echo -e "   - Netlify: Deploys → Trigger deploy"
echo ""
echo -e "${GREEN}3.${NC} Test API từ frontend:"
echo -e "   ${BLUE}https://thongtinmualu.live/map${NC}"
echo -e "   → Click button AI (tím)"
echo -e "   → Xem markers tím xuất hiện trên map"
echo ""
echo -e "${GREEN}4.${NC} Lưu Backend URL vào file .env:"
cat > .env.production <<EOF
# Backend API URL (Render)
NEXT_PUBLIC_API_URL=${RENDER_URL}
EOF
echo -e "   ${GREEN}✅ Đã tạo .env.production${NC}"
echo ""

echo -e "${PURPLE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment hoàn tất! Happy coding! 🚀${NC}"
echo -e "${PURPLE}════════════════════════════════════════════${NC}"
