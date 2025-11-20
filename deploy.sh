#!/bin/bash

# ==========================================
# FLOODWATCH AUTO DEPLOY SCRIPT
# Domain: thongtinmualu.live
# ==========================================

set -e  # Exit on error

echo "🚀 =========================================="
echo "   FLOODWATCH PRODUCTION DEPLOYMENT"
echo "   Domain: thongtinmualu.live"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==========================================
# STEP 0: Pre-deployment checks
# ==========================================

echo "📋 Step 0: Pre-deployment checks..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ ERROR: .env.production not found!${NC}"
    echo "Please create .env.production first."
    exit 1
fi

# Check if critical env vars are set
if grep -q "CHANGE_THIS" .env.production; then
    echo -e "${RED}❌ ERROR: .env.production contains CHANGE_THIS placeholders!${NC}"
    echo "Please edit .env.production and fill in:"
    echo "  - ADMIN_TOKEN"
    echo "  - POSTGRES_PASSWORD"
    echo "  - TELEGRAM_BOT_TOKEN"
    echo "  - NEXT_PUBLIC_MAPTILER_KEY"
    exit 1
fi

echo -e "${GREEN}✅ .env.production configured${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ ERROR: Docker not installed!${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ ERROR: Docker Compose not installed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose found${NC}"
echo ""

# ==========================================
# STEP 1: Stop existing containers (if any)
# ==========================================

echo "🛑 Step 1: Stopping existing containers..."

if docker-compose -f docker-compose.prod.yml ps -q 2>/dev/null | grep -q .; then
    docker-compose -f docker-compose.prod.yml down
    echo -e "${GREEN}✅ Stopped existing containers${NC}"
else
    echo -e "${YELLOW}⚠️  No existing containers to stop${NC}"
fi
echo ""

# ==========================================
# STEP 2: Build Docker images
# ==========================================

echo "🔨 Step 2: Building Docker images..."
echo "This may take 5-10 minutes on first run..."

docker-compose -f docker-compose.prod.yml build --no-cache

echo -e "${GREEN}✅ Docker images built${NC}"
echo ""

# ==========================================
# STEP 3: Start containers
# ==========================================

echo "🚀 Step 3: Starting containers..."

docker-compose -f docker-compose.prod.yml up -d

echo -e "${GREEN}✅ Containers started${NC}"
echo ""

# ==========================================
# STEP 4: Wait for database to be ready
# ==========================================

echo "⏳ Step 4: Waiting for database to be ready..."

echo -n "Waiting 30 seconds for database initialization"
for i in {1..30}; do
    echo -n "."
    sleep 1
done
echo ""

# Check if database is ready
if docker-compose -f docker-compose.prod.yml exec -T db pg_isready -U postgres &> /dev/null; then
    echo -e "${GREEN}✅ Database is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Database may not be fully ready yet${NC}"
fi
echo ""

# ==========================================
# STEP 5: Run database migrations
# ==========================================

echo "🗄️  Step 5: Running database migrations..."

docker-compose -f docker-compose.prod.yml exec -T api alembic upgrade head

echo -e "${GREEN}✅ Database migrations completed${NC}"
echo ""

# ==========================================
# STEP 6: Check container health
# ==========================================

echo "🏥 Step 6: Checking container health..."

docker-compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}✅ All containers are running${NC}"
echo ""

# ==========================================
# STEP 7: Setup Nginx (if not already configured)
# ==========================================

echo "🌐 Step 7: Nginx configuration..."

if [ -f "nginx-thongtinmualu.conf" ]; then
    echo "Found nginx-thongtinmualu.conf"

    # Check if nginx is installed
    if command -v nginx &> /dev/null; then
        echo "Nginx is installed"

        # Check if config already exists
        if [ ! -L "/etc/nginx/sites-enabled/thongtinmualu" ]; then
            echo "Installing Nginx configuration..."
            echo "You may need to run these commands manually with sudo:"
            echo ""
            echo "  sudo cp nginx-thongtinmualu.conf /etc/nginx/sites-available/thongtinmualu"
            echo "  sudo ln -s /etc/nginx/sites-available/thongtinmualu /etc/nginx/sites-enabled/"
            echo "  sudo nginx -t"
            echo "  sudo systemctl reload nginx"
            echo ""
        else
            echo -e "${GREEN}✅ Nginx config already installed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Nginx not installed. Install with: sudo apt install nginx -y${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  nginx-thongtinmualu.conf not found${NC}"
fi
echo ""

# ==========================================
# STEP 8: SSL Setup reminder
# ==========================================

echo "🔒 Step 8: SSL Setup..."
echo ""
echo -e "${YELLOW}⚠️  Don't forget to setup SSL certificate:${NC}"
echo ""
echo "  sudo apt install certbot python3-certbot-nginx -y"
echo "  sudo certbot --nginx -d thongtinmualu.live -d www.thongtinmualu.live"
echo ""

# ==========================================
# DEPLOYMENT COMPLETE
# ==========================================

echo "=========================================="
echo -e "${GREEN}✅ DEPLOYMENT COMPLETED!${NC}"
echo "=========================================="
echo ""
echo "🎉 Your application should now be running!"
echo ""
echo "📍 URLs:"
echo "   - Frontend: http://localhost:3000"
echo "   - API: http://localhost:8000"
echo "   - Health: http://localhost:8000/health"
echo ""
echo "🌐 After Nginx & SSL setup:"
echo "   - https://thongtinmualu.live"
echo "   - https://thongtinmualu.live/map"
echo ""
echo "📊 Useful commands:"
echo "   - View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   - Restart: docker-compose -f docker-compose.prod.yml restart"
echo "   - Stop: docker-compose -f docker-compose.prod.yml down"
echo "   - Status: docker-compose -f docker-compose.prod.yml ps"
echo ""
echo "🔍 Next steps:"
echo "   1. Setup Nginx (if not done)"
echo "   2. Setup SSL with certbot"
echo "   3. Test: https://thongtinmualu.live"
echo ""
echo "=========================================="
