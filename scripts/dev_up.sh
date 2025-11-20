#!/bin/bash
# FloodWatch - Start Development Environment

set -e

echo "🌊 Starting FloodWatch Development Environment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration (especially NEXT_PUBLIC_MAPBOX_TOKEN)"
fi

# Build and start services
echo "🐳 Building Docker containers..."
docker compose -f infra/compose/docker-compose.yml build

echo "🚀 Starting services..."
docker compose -f infra/compose/docker-compose.yml up -d

echo ""
echo "✅ FloodWatch is starting up!"
echo ""
echo "📊 Services:"
echo "  - PostgreSQL:  http://localhost:5432"
echo "  - API:         http://localhost:8000"
echo "  - API Docs:    http://localhost:8000/docs"
echo "  - Web:         http://localhost:3000"
echo ""
echo "📝 Check logs:"
echo "  docker compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "  docker compose down"
echo ""
echo "⚠️  Don't forget to add your MAPBOX_TOKEN to .env!"
echo "   Get free token: https://account.mapbox.com/auth/signup"
