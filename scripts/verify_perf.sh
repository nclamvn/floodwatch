#!/usr/bin/env bash

# ====== CONFIG ======
WEB_BASE="https://thongtinmualu.live"
API_BASE="https://api.thongtinmualu.live"

# Danh sach endpoint can do
# Dinh dang: "Label|URL"
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

echo "FloodWatch Performance Verification"
echo "Base Web: $WEB_BASE"
echo "Base API: $API_BASE"
echo

# Header bang
printf "%-22s %-50s %12s %12s %12s\n" "Endpoint" "URL" "TTFB (ms)" "Total (ms)" "Status"
echo "------------------------------------------------------------------------------------------------------------------------------"

# Ham do 1 endpoint
measure_endpoint() {
  local label="$1"
  local url="$2"

  # dung curl do timing (namelookup, connect, ttfb, total)
  local result
  result=$(curl -o /dev/null -s -w "%{http_code} %{time_starttransfer} %{time_total}" --max-time 30 "$url")

  local http_code ttfb total
  read -r http_code ttfb total <<<"$result"

  # convert giay -> ms
  local ttfb_ms total_ms
  ttfb_ms=$(awk "BEGIN {printf \"%.0f\", $ttfb * 1000}")
  total_ms=$(awk "BEGIN {printf \"%.0f\", $total * 1000}")

  local status="OK"
  if [[ "$http_code" -ge 400 ]]; then
    status="ERR($http_code)"
  else
    # danh dau WARN neu > 1000ms
    if (( total_ms > 1000 )); then
      status="SLOW"
    fi
  fi

  printf "%-22s %-50s %12s %12s %12s\n" "$label" "$url" "$ttfb_ms" "$total_ms" "$status"
}

# Loop qua cac endpoint
for item in "${ENDPOINTS[@]}"; do
  label="${item%%|*}"
  url="${item#*|}"
  measure_endpoint "$label" "$url"
done

echo
echo "Nguong chap nhan:"
echo "- Web: TTFB < 500ms, Total < 2000ms"
echo "- API: TTFB < 300ms, Total < 800ms"
echo "- Neu thay SLOW hoac ERR, xem log API + X-Response-Time de khoanh vung."
