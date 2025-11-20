#!/bin/bash
# Database restore script for production

set -e

# Load environment
if [ -f .env.prod ]; then
    export $(cat .env.prod | grep -v '^#' | xargs)
fi

BACKUP_DIR="./infra/backups"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: ./prod_restore.sh <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh ${BACKUP_DIR}/floodwatch_*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "⚠️  WARNING: This will overwrite the current database!"
echo "Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure? (type 'yes' to continue): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo "🔄 Restoring database from backup..."

# Stop API service to prevent connections
docker-compose -f docker-compose.prod.yml stop api

# Restore database
gunzip -c ${BACKUP_FILE} | docker-compose -f docker-compose.prod.yml exec -T db psql \
    -U ${POSTGRES_USER} \
    -d ${POSTGRES_DB}

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
else
    echo "❌ Restore failed!"
    exit 1
fi

# Restart API service
echo "▶️  Restarting API service..."
docker-compose -f docker-compose.prod.yml start api

echo "✅ Restore complete!"
