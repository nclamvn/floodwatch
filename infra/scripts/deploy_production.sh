#!/usr/bin/env bash
# FloodWatch – One-shot Production Deploy
# Usage:
#   chmod +x infra/scripts/deploy_production.sh
#   ./infra/scripts/deploy_production.sh
#
# Optional:
#   DRY_RUN=1 ./infra/scripts/deploy_production.sh

set -euo pipefail

# --- CONFIG ---------------------------------------------------------------
COMPOSE="docker compose -f docker-compose.prod.yml"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${ROOT_DIR}/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${LOG_DIR}/deploy_${TIMESTAMP}.log"
WARM_URL="https://floodwatch.vn"
API_URL="https://api.floodwatch.vn"

# Expects these to be present in environment or .env.prod used by services:
# ADMIN_TOKEN, (seed script prints API key), CORS_ORIGINS, DATABASE_URL, ...
# -------------------------------------------------------------------------

mkdir -p "${LOG_DIR}"

# --- helpers --------------------------------------------------------------
color() { # $1=code, $2=msg
  case "$1" in
    green) printf "\033[32m%s\033[0m\n" "$2" ;;
    yellow) printf "\033[33m%s\033[0m\n" "$2" ;;
    red) printf "\033[31m%s\033[0m\n" "$2" ;;
    blue) printf "\033[34m%s\033[0m\n" "$2" ;;
    *) echo "$2" ;;
  esac
}
log() { echo "[$(date '+%F %T')] $*" | tee -a "${LOG_FILE}"; }
run() {
  if [[ "${DRY_RUN:-0}" = "1" ]]; then
    color yellow "[DRY-RUN] $*"
  else
    eval "$@" 2>&1 | tee -a "${LOG_FILE}"
  fi
}
require_file() { [[ -f "$1" ]] || { color red "Missing file: $1"; exit 1; }; }
require_dir() { [[ -d "$1" ]] || { color red "Missing dir: $1"; exit 1; }; }

# --- preflight ------------------------------------------------------------
log "==> Step 0: Preflight checks"
require_file "${ROOT_DIR}/infra/scripts/preflight.sh"
run "bash ${ROOT_DIR}/infra/scripts/preflight.sh"

log "==> Step 1: Bring up stack"
require_file "${ROOT_DIR}/infra/scripts/prod_up.sh"
run "bash ${ROOT_DIR}/infra/scripts/prod_up.sh"

log "==> Step 2: Check containers"
run "${COMPOSE} ps"

log "==> Step 3: Run DB migrations (to head)"
run "${COMPOSE} exec -T api alembic upgrade head"

# Optional seed (idempotent; script should upsert)
log '==> Step 4: Seed API keys (capture key)'
SEED_OUTPUT="$(${COMPOSE} exec -T api python ops/scripts/seed_api_keys.py 2>/dev/null || true)"
echo "${SEED_OUTPUT}" | tee -a "${LOG_FILE}"
API_KEY="$(echo "${SEED_OUTPUT}" | grep -Eo 'X-API-Key: *[A-Za-z0-9_:-]+' | awk -F': *' '{print $2}' | tail -n1)"

if [[ -z "${API_KEY}" ]]; then
  color yellow "No API key parsed from seed output; you may export API_KEY manually for smoke tests."
else
  color green "Captured API_KEY: ${API_KEY}"
fi

log "==> Step 5: Warm-up cache (5 hits per endpoint)"
for i in {1..5}; do
  run "curl -s -o /dev/null -w '%{http_code}\n' ${WARM_URL}/health"
done
for i in {1..5}; do
  run "curl -s -o /dev/null -w '%{http_code}\n' ${WARM_URL}/lite"
done
if [[ -n "${API_KEY:-}" ]]; then
  for i in {1..5}; do
    run "curl -s -o /dev/null -w '%{http_code}\n' -H 'X-API-Key: ${API_KEY}' '${API_URL}/api/v1/reports?limit=5'"
  done
fi

log "==> Step 6: Automated smoke tests (7 checks)"
export API_KEY ADMIN_TOKEN
run "bash ${ROOT_DIR}/infra/scripts/smoke_test.sh || true"

log "==> Step 7: Verify cron (timezone + jobs)"
CRON_SNIPPET=$(cat <<'CRON'
CRON_TZ=Asia/Ho_Chi_Minh
5 * * * *  cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/kttv_scraper.py >> logs/kttv.log 2>&1
35 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/roads_press_watch.py >> logs/roads.log 2>&1
*/2 * * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/alerts_dispatcher.py >> logs/alerts.log 2>&1
55 23 * * * cd /opt/floodwatch && docker compose -f docker-compose.prod.yml exec -T api python ops/cron/daily_snapshot.py >> logs/snapshot.log 2>&1
CRON
)
echo "----- BEGIN CRON TEMPLATE -----" | tee -a "${LOG_FILE}"
echo "${CRON_SNIPPET}" | tee -a "${LOG_FILE}"
echo "------ END CRON TEMPLATE ------" | tee -a "${LOG_FILE}"
color yellow "Reminder: run 'crontab -e' and paste the above (if not already configured)."

log "==> Step 8: Security headers quick check"
run "curl -sI ${WARM_URL}/ | grep -E 'strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy' || true"

log "==> DONE. Log saved at ${LOG_FILE}"
color green "Deployment steps finished."
