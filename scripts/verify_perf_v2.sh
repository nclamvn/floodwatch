#!/usr/bin/env bash

# ====== FloodWatch Performance Verification v2 ======
# Features:
# - Chay moi endpoint 3 lan, tinh trung binh
# - Ghi ket qua ra file report co timestamp
# - Hien thi min/max/avg

# ====== CONFIG ======
WEB_BASE="https://thongtinmualu.live"
API_BASE="https://api.thongtinmualu.live"
RUNS=3  # So lan chay moi endpoint
REPORT_DIR="/Users/mac/floodwatch/scripts/perf_reports"

# Tao thu muc report neu chua co
mkdir -p "$REPORT_DIR"

# Ten file report
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/perf_report_$TIMESTAMP.txt"

# Danh sach endpoint
ENDPOINTS=(
  "Web Home|$WEB_BASE/"
  "Web Map|$WEB_BASE/map"
  "Web Help|$WEB_BASE/help"
  "API Health|$API_BASE/health"
  "API Hazards|$API_BASE/hazards?limit=50"
  "API Reports|$API_BASE/reports?limit=50"
  "API Distress|$API_BASE/distress?limit=20"
  "API Routes|$API_BASE/routes?limit=20"
)

# Header
header() {
  echo "=============================================="
  echo "FloodWatch Performance Report"
  echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Runs per endpoint: $RUNS"
  echo "Base Web: $WEB_BASE"
  echo "Base API: $API_BASE"
  echo "=============================================="
  echo
}

# In header ra console va file
header | tee "$REPORT_FILE"

# Table header
printf "%-18s %-10s %-10s %-10s %-10s %s\n" "Endpoint" "Min(ms)" "Avg(ms)" "Max(ms)" "Status" "Notes" | tee -a "$REPORT_FILE"
echo "--------------------------------------------------------------------------------" | tee -a "$REPORT_FILE"

# Ham do 1 endpoint nhieu lan
measure_endpoint() {
  local label="$1"
  local url="$2"

  local times=()
  local statuses=()
  local errors=0

  for ((i=1; i<=RUNS; i++)); do
    local result
    result=$(curl -o /dev/null -s -w "%{http_code} %{time_total}" --max-time 30 "$url")

    local http_code total
    read -r http_code total <<<"$result"

    # Convert giay -> ms
    local total_ms
    total_ms=$(awk "BEGIN {printf \"%.0f\", $total * 1000}")

    times+=("$total_ms")
    statuses+=("$http_code")

    if [[ "$http_code" -ge 400 ]]; then
      ((errors++))
    fi

    # Delay nho giua cac request
    sleep 0.5
  done

  # Tinh min/max/avg
  local min max sum avg
  min=${times[0]}
  max=${times[0]}
  sum=0

  for t in "${times[@]}"; do
    sum=$((sum + t))
    if ((t < min)); then min=$t; fi
    if ((t > max)); then max=$t; fi
  done

  avg=$((sum / RUNS))

  # Xac dinh status
  local status notes
  if ((errors == RUNS)); then
    status="ERR"
    notes="HTTP ${statuses[0]}"
  elif ((errors > 0)); then
    status="FLAKY"
    notes="$errors/$RUNS failed"
  elif ((avg > 1000)); then
    status="SLOW"
    notes="avg > 1000ms"
  elif ((avg > 500)); then
    status="WARN"
    notes="avg > 500ms"
  else
    status="OK"
    notes=""
  fi

  printf "%-18s %-10s %-10s %-10s %-10s %s\n" "$label" "$min" "$avg" "$max" "$status" "$notes" | tee -a "$REPORT_FILE"
}

# Chay tat ca endpoints
for item in "${ENDPOINTS[@]}"; do
  label="${item%%|*}"
  url="${item#*|}"
  measure_endpoint "$label" "$url"
done

# Summary
echo | tee -a "$REPORT_FILE"
echo "=============================================="  | tee -a "$REPORT_FILE"
echo "Nguong chap nhan:" | tee -a "$REPORT_FILE"
echo "- Web: Avg < 500ms = OK, < 2000ms = WARN" | tee -a "$REPORT_FILE"
echo "- API: Avg < 500ms = OK, < 800ms = WARN" | tee -a "$REPORT_FILE"
echo "=============================================="  | tee -a "$REPORT_FILE"
echo | tee -a "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE"
