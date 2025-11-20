#!/bin/bash
# Database backup script for production

set -e

# Load environment
if [ -f .env.prod ]; then
    export $(cat .env.prod | grep -v '^#' | xargs)
fi

BACKUP_DIR="./infra/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/floodwatch_${TIMESTAMP}.sql.gz"

echo "🗄️  Starting database backup..."

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Perform backup
docker-compose -f docker-compose.prod.yml exec -T db pg_dump \
    -U ${POSTGRES_USER} \
    -d ${POSTGRES_DB} \
    --format=plain \
    --clean \
    --if-exists \
    | gzip > ${BACKUP_FILE}

# Check if backup was successful
if [ -f ${BACKUP_FILE} ]; then
    SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
    echo "✅ Backup completed: ${BACKUP_FILE} (${SIZE})"

    # Keep only last 7 days of backups
    find ${BACKUP_DIR} -name "floodwatch_*.sql.gz" -mtime +7 -delete
    echo "🧹 Cleaned up old backups (kept last 7 days)"

    # Log backup
    echo "$(date +'%Y-%m-%d %H:%M:%S') | Backup: ${BACKUP_FILE} | Size: ${SIZE}" >> ${BACKUP_DIR}/backup.log
else
    echo "❌ Backup failed!"
    exit 1
fi
