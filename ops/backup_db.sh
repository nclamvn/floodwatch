#!/bin/bash
#
# Database Backup Script
# Tự động backup PostgreSQL database hàng ngày
#

set -euo pipefail

# Cấu hình
PROJECT_DIR="/root/floodwatch"
BACKUP_DIR="/var/backups/floodwatch"
RETENTION_DAYS=7  # Giữ backup trong 7 ngày
COMPOSE_FILE="docker-compose.yml"

# Database info (từ .env)
DB_NAME="${POSTGRES_DB:-floodwatch_prod}"
DB_USER="${POSTGRES_USER:-postgres}"

# Tạo backup directory
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/floodwatch_${TIMESTAMP}.sql"

echo "[$(date)] Starting database backup..."

cd "$PROJECT_DIR"

# Chạy pg_dump trong db container
if docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"; then
    echo "[$(date)] ✅ Backup successful: $BACKUP_FILE"

    # Compress backup
    gzip "$BACKUP_FILE"
    echo "[$(date)] 📦 Compressed to: ${BACKUP_FILE}.gz"

    # Xóa backup cũ
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "[$(date)] 🧹 Cleaned up backups older than $RETENTION_DAYS days"

    # Hiển thị kích thước backup
    du -h "${BACKUP_FILE}.gz"

    exit 0
else
    echo "[$(date)] ❌ Backup failed!"
    exit 1
fi
