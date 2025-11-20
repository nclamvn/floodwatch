#!/usr/bin/env bash
#
# FloodWatch - Generate Production Secrets
#
# This script generates all required secrets for .env.prod
#
# Usage:
#   ./infra/scripts/generate_secrets.sh
#
# Output:
#   - Displays all generated secrets (copy to .env.prod)
#   - Optionally creates .env.prod from .env.prod.example with secrets filled in
#

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "FloodWatch - Secret Generator"
echo "========================================"
echo ""

# Generate secrets
ADMIN_TOKEN=$(openssl rand -hex 32)
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
WEBHOOK_SECRET=$(openssl rand -hex 32)

echo -e "${GREEN}Generated secrets:${NC}"
echo ""
echo "ADMIN_TOKEN=${ADMIN_TOKEN}"
echo "SECRET_KEY=${SECRET_KEY}"
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo "WEBHOOK_SECRET=${WEBHOOK_SECRET}"
echo ""

# Ask if user wants to create .env.prod
echo "========================================"
read -p "Create .env.prod with these secrets? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f ".env.prod" ]; then
        echo -e "${YELLOW}Warning: .env.prod already exists!${NC}"
        read -p "Overwrite? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Aborted. No files changed."
            exit 0
        fi
    fi

    if [ ! -f ".env.prod.example" ]; then
        echo "Error: .env.prod.example not found!"
        exit 1
    fi

    # Create .env.prod from .env.prod.example
    cp .env.prod.example .env.prod

    # Replace placeholders with generated secrets
    # macOS compatible sed (use '' for in-place without backup)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/REPLACE_WITH_RANDOM_64_HEX/${ADMIN_TOKEN}/" .env.prod
        sed -i '' "s/REPLACE_WITH_RANDOM_64_HEX/${SECRET_KEY}/" .env.prod
        sed -i '' "s/CHANGE_ME_STRONG_PASSWORD/${POSTGRES_PASSWORD}/g" .env.prod
        # WEBHOOK_SECRET is optional, only replace if user wants it
        if [ -n "${WEBHOOK_SECRET}" ]; then
            sed -i '' "s/^WEBHOOK_SECRET=$/WEBHOOK_SECRET=${WEBHOOK_SECRET}/" .env.prod
        fi
    else
        # Linux sed
        sed -i "s/REPLACE_WITH_RANDOM_64_HEX/${ADMIN_TOKEN}/" .env.prod
        sed -i "s/REPLACE_WITH_RANDOM_64_HEX/${SECRET_KEY}/" .env.prod
        sed -i "s/CHANGE_ME_STRONG_PASSWORD/${POSTGRES_PASSWORD}/g" .env.prod
        if [ -n "${WEBHOOK_SECRET}" ]; then
            sed -i "s/^WEBHOOK_SECRET=$/WEBHOOK_SECRET=${WEBHOOK_SECRET}/" .env.prod
        fi
    fi

    # Set secure permissions
    chmod 600 .env.prod

    echo -e "${GREEN}✓ Created .env.prod${NC}"
    echo -e "${GREEN}✓ Set permissions to 600${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env.prod and fill in remaining placeholders:"
    echo "   - NEXT_PUBLIC_MAPBOX_TOKEN"
    echo "   - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
    echo "   - (Optional) TELEGRAM_BOT_TOKEN"
    echo ""
    echo "2. Verify configuration:"
    echo "   grep -E 'REPLACE_|CHANGE_ME_|your_production_|your_cloud_' .env.prod"
    echo ""
    echo "3. Run deployment:"
    echo "   ./infra/scripts/deploy_production.sh"
else
    echo ""
    echo "No file created. Copy the secrets above manually to .env.prod"
fi

echo ""
echo "========================================"
echo "Done!"
echo "========================================"
