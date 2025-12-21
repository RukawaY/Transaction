#!/usr/bin/env bash
# Simple latency tester for backend APIs (simulates frontend calls).
# Usage:
#   chmod +x api_latency_test.sh
#   ./api_latency_test.sh            # defaults: BASE_URL=http://127.0.0.1:8000, ITERATIONS=3
#   ./api_latency_test.sh http://127.0.0.1 5   # override base URL and iterations

set -euo pipefail

BASE_URL="${1:-${BASE_URL:-http://127.0.0.1:8000}}"
ITERATIONS="${2:-${ITERATIONS:-3}}"

echo "Target base URL: $BASE_URL"
echo "Iterations per endpoint: $ITERATIONS"
echo

endpoints=(
  "/api/health"
  "/api/db-check"
  "/api/price-data"
  "/api/arbitrage/statistics"
  "/api/arbitrage/behaviors?page=1&page_size=5"
  "/api/arbitrage/opportunities?min_profit_rate=0"
)

for ep in "${endpoints[@]}"; do
  echo "==> $ep"
  url="${BASE_URL}${ep}"
  for i in $(seq 1 "$ITERATIONS"); do
    out="$(curl -s -o /dev/null -w "http_code=%{http_code} time_total=%{time_total}s time_connect=%{time_connect}s time_starttransfer=%{time_starttransfer}s" "$url")"
    printf "  [#%02d] %s\n" "$i" "$out"
  done
  echo
done
