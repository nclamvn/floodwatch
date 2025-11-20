#!/bin/bash
# Production startup script

set -e

echo "🚀 Starting FloodWatch in production mode..."

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ .env.prod not found!"
    echo "Copy .env.example to .env.prod and configure for production"
    exit 1
fi

# Load environment
export $(cat .env.prod | grep -v '^#' | xargs)

# Create necessary directories
mkdir -p infra/certbot/conf
mkdir -p infra/certbot/www
mkdir -p infra/backups
mkdir -p infra/nginx/conf.d

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

# Build services
echo "🔨 Building services..."
docker-compose -f docker-compose.prod.yml build

# Start services
echo "▶️  Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for database
echo "⏳ Waiting for database..."
sleep 10

# Run migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T api alembic upgrade head

# Show status
echo ""
echo "✅ FloodWatch is running!"
echo ""
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "📊 View logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🔧 Health check:"
echo "  curl http://localhost/health"
