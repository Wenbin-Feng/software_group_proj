#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run rollback.sh with sudo' >&2; exit 2; }
folio_root=${FOLIO_ROOT:-/srv/folio}
exec 9>"$folio_root/deployment.lock"
flock -w 300 9
current=$(cat "$folio_root/current")
if [[ -n ${1:-} && $current != "$1" ]]; then echo 'Another version is active; rollback stopped' >&2; exit 2; fi
previous=$(cat "$folio_root/previous" 2>/dev/null || true)
[[ $previous =~ ^[0-9a-f]{40,64}$ && $previous != "$current" ]] || { echo 'No previous version is available' >&2; exit 2; }
docker image inspect "folio-api:$previous" >/dev/null
docker stop --time 45 folio-api >/dev/null || true
docker rm -f folio-api >/dev/null 2>&1 || true
"$folio_root/bin/run.sh" "$previous"
"$folio_root/bin/health.sh" "$previous"
printf '%s\n' "$previous" >"$folio_root/current"
echo "Backend rolled back to $previous; data and migrations were retained."
