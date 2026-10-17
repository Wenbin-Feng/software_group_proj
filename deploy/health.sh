#!/usr/bin/env bash
set -Eeuo pipefail
version=${1:?Usage: health.sh COMMIT_SHA [URL]}
url=${2:-http://127.0.0.1:3001/api/health}
for ((attempt=1; attempt<=30; attempt++)); do
  if health=$(curl --fail --silent --show-error --connect-timeout 3 --max-time 5 "$url" 2>/dev/null) && \
     python3 -c 'import json,sys; h=json.load(sys.stdin); sys.exit(0 if h.get("status")=="ok" and h.get("version")==sys.argv[1] else 1)' "$version" <<<"$health"; then
    echo "Healthy: $version"
    exit 0
  fi
  sleep 2
done
echo "Health/version check failed: $url" >&2
exit 1
