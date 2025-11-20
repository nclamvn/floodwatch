#!/bin/bash
#
# FloodWatch Data Ingestion Runner
# Chạy các script thu thập dữ liệu mưa lũ
#
# Usage: ./run_ingestion.sh [job_name]
#   job_name: kttv | roads | all (default: all)
#

set -euo pipefail

# Cấu hình
PROJECT_DIR="/root/floodwatch"  # Thay đổi theo path thực tế trên server
LOG_DIR="/var/log/floodwatch"
COMPOSE_FILE="docker-compose.yml"  # Hoặc docker-compose.prod.yml

# Tạo log directory nếu chưa có
mkdir -p "$LOG_DIR"

# Function: log với timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/ingestion.log"
}

# Function: chạy KTTV alerts
run_kttv() {
    log "🔄 Starting KTTV alerts ingestion..."

    cd "$PROJECT_DIR"

    # Chạy script trong API container
    if docker compose -f "$COMPOSE_FILE" exec -T api python -c "
import sys
sys.path.insert(0, '/app/..')
from ops.cron.kttv_alerts import main
main()
" >> "$LOG_DIR/kttv.log" 2>&1; then
        log "✅ KTTV alerts completed successfully"
        return 0
    else
        log "❌ KTTV alerts failed (see $LOG_DIR/kttv.log)"
        return 1
    fi
}

# Function: chạy roads press watch
run_roads() {
    log "🔄 Starting roads press watch..."

    cd "$PROJECT_DIR"

    if docker compose -f "$COMPOSE_FILE" exec -T api python -c "
import sys
sys.path.insert(0, '/app/..')
from ops.cron.roads_press_watch import main
main()
" >> "$LOG_DIR/roads.log" 2>&1; then
        log "✅ Roads press watch completed successfully"
        return 0
    else
        log "❌ Roads press watch failed (see $LOG_DIR/roads.log)"
        return 1
    fi
}

# Main logic
JOB_NAME="${1:-all}"

case "$JOB_NAME" in
    kttv)
        run_kttv
        ;;
    roads)
        run_roads
        ;;
    all)
        run_kttv
        run_roads
        ;;
    *)
        log "❌ Unknown job: $JOB_NAME"
        echo "Usage: $0 [kttv|roads|all]"
        exit 1
        ;;
esac

log "🎉 Ingestion run completed"
