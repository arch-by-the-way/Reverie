#!/usr/bin/env bash
# Simple healthcheck: hits /health, fails (non-zero exit) if not 200
set -euo pipefail

URL="${1:-http://localhost:3000/health}"

response=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$response" != "200" ]; then
  echo "Healthcheck failed: got HTTP $response from $URL"
  exit 1
fi

echo "Healthcheck OK: $URL"