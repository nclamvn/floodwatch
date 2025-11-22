#!/bin/bash

# ============================================
# FloodWatch - AI Voice News Setup Script
# ============================================

set -e

echo "🎙️  FloodWatch AI Voice News - Setup Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  File .env đã tồn tại!${NC}"
    read -p "Bạn có muốn ghi đè? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Bỏ qua tạo .env mới."
        ENV_CREATED=false
    else
        ENV_CREATED=true
    fi
else
    ENV_CREATED=true
fi

# Create .env from template
if [ "$ENV_CREATED" = true ]; then
    echo ""
    echo -e "${BLUE}📝 Tạo file .env từ template...${NC}"
    cp .env.example .env

    echo ""
    echo -e "${YELLOW}⚠️  QUAN TRỌNG: Bạn cần điền các thông tin sau vào file .env:${NC}"
    echo ""
    echo "1. OPENAI_API_KEY - OpenAI API key (https://platform.openai.com/api-keys)"
    echo "2. CLOUDINARY_CLOUD_NAME - Cloudinary cloud name"
    echo "3. CLOUDINARY_API_KEY - Cloudinary API key"
    echo "4. CLOUDINARY_API_SECRET - Cloudinary API secret"
    echo ""

    read -p "Bạn đã có đầy đủ thông tin trên? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Vui lòng chuẩn bị đầy đủ thông tin trước khi tiếp tục.${NC}"
        exit 1
    fi

    # Prompt for OpenAI API key
    echo ""
    read -p "Nhập OPENAI_API_KEY: " OPENAI_KEY
    if [ -z "$OPENAI_KEY" ]; then
        echo -e "${RED}❌ OpenAI API key không được để trống!${NC}"
        exit 1
    fi

    # Prompt for Cloudinary credentials
    echo ""
    read -p "Nhập CLOUDINARY_CLOUD_NAME: " CLOUD_NAME
    read -p "Nhập CLOUDINARY_API_KEY: " CLOUD_KEY
    read -p "Nhập CLOUDINARY_API_SECRET: " CLOUD_SECRET

    # Update .env file
    sed -i.bak "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_KEY|" .env
    sed -i.bak "s|CLOUDINARY_CLOUD_NAME=.*|CLOUDINARY_CLOUD_NAME=$CLOUD_NAME|" .env
    sed -i.bak "s|CLOUDINARY_API_KEY=.*|CLOUDINARY_API_KEY=$CLOUD_KEY|" .env
    sed -i.bak "s|CLOUDINARY_API_SECRET=.*|CLOUDINARY_API_SECRET=$CLOUD_SECRET|" .env

    # Clean up backup
    rm .env.bak

    echo ""
    echo -e "${GREEN}✅ File .env đã được tạo thành công!${NC}"
fi

# Install Python dependencies
echo ""
echo -e "${BLUE}📦 Cài đặt Python dependencies...${NC}"
pip install -r requirements.txt

echo ""
echo -e "${GREEN}✅ Dependencies đã được cài đặt!${NC}"

# Test OpenAI connection
echo ""
echo -e "${BLUE}🧪 Kiểm tra kết nối OpenAI...${NC}"

python3 << 'EOF'
import os
import sys
from dotenv import load_dotenv

load_dotenv()

openai_key = os.getenv('OPENAI_API_KEY')

if not openai_key or openai_key == 'sk-proj-your_new_key_here':
    print("❌ OPENAI_API_KEY chưa được cấu hình đúng!")
    sys.exit(1)

try:
    import openai
    # Test connection
    response = openai.models.list()
    print("✅ Kết nối OpenAI thành công!")
    print(f"   API Key: {openai_key[:20]}...{openai_key[-4:]}")
except Exception as e:
    print(f"❌ Lỗi kết nối OpenAI: {e}")
    sys.exit(1)
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ OpenAI connection OK!${NC}"
else
    echo -e "${RED}❌ OpenAI connection FAILED!${NC}"
    exit 1
fi

# Test Cloudinary connection
echo ""
echo -e "${BLUE}🧪 Kiểm tra kết nối Cloudinary...${NC}"

python3 << 'EOF'
import os
import sys
from dotenv import load_dotenv

load_dotenv()

cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')

if not cloud_name or cloud_name == 'your_cloud_name':
    print("❌ Cloudinary chưa được cấu hình đúng!")
    sys.exit(1)

try:
    import cloudinary
    cloudinary.config(
        cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
        api_key=os.getenv('CLOUDINARY_API_KEY'),
        api_secret=os.getenv('CLOUDINARY_API_SECRET')
    )
    print("✅ Cloudinary đã được cấu hình!")
    print(f"   Cloud Name: {cloud_name}")
except Exception as e:
    print(f"❌ Lỗi cấu hình Cloudinary: {e}")
    sys.exit(1)
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cloudinary connection OK!${NC}"
else
    echo -e "${RED}❌ Cloudinary connection FAILED!${NC}"
    exit 1
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}🎉 Setup hoàn tất!${NC}"
echo "=========================================="
echo ""
echo "Các bước tiếp theo:"
echo ""
echo "1. Khởi động API server:"
echo "   uvicorn app.main:app --reload --port 8000"
echo ""
echo "2. Test API endpoint:"
echo "   curl http://localhost:8000/ai-news/latest"
echo ""
echo "3. Khởi động frontend:"
echo "   cd ../web && npm run dev"
echo ""
echo "4. Mở trình duyệt:"
echo "   http://localhost:3000/map"
echo ""
echo -e "${BLUE}📚 Xem log để theo dõi voice alternation:${NC}"
echo "   tail -f logs/floodwatch.log | grep voice"
echo ""
