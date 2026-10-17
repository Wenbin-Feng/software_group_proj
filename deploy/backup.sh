#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
folio_root=${FOLIO_ROOT:-/srv/folio}
if [[ ${FOLIO_LOCK_HELD:-0} != 1 ]]; then
  exec 9>"$folio_root/deployment.lock"
  flock -w 300 9
fi
was_running=false
if [[ $(docker inspect --format '{{.State.Running}}' folio-api 2>/dev/null || true) == true ]]; then
  was_running=true
  docker stop --time 45 folio-api >/dev/null
fi
resume() { if [[ $was_running == true ]]; then docker start folio-api >/dev/null; fi; }
trap resume EXIT
stamp=$(date -u +%Y%m%dT%H%M%S)-$RANDOM
snapshot="$folio_root/backups/$stamp"
mkdir -p "$snapshot"
if [[ -f $folio_root/data/folio.sqlite ]]; then
  sqlite3 "$folio_root/data/folio.sqlite" ".timeout 30000" ".backup '$snapshot/folio.sqlite'"
  [[ $(sqlite3 "$snapshot/folio.sqlite" 'PRAGMA quick_check;') == ok ]] || { echo 'SQLite backup integrity check failed' >&2; exit 1; }
fi
# Writers are stopped so file metadata and database references form one snapshot.
tar --exclude='./folio.sqlite' --exclude='./folio.sqlite-*' --exclude='./folio.sqlite-journal' \
  -czf "$snapshot/files.tar.gz" -C "$folio_root/data" .
if [[ -f $folio_root/current ]]; then cp "$folio_root/current" "$snapshot/version"; fi
date -u +%FT%TZ >"$snapshot/completed"
# Keep seven full days. Never prune an incomplete snapshot automatically.
find "$folio_root/backups" -mindepth 2 -maxdepth 2 -name completed -mtime +6 -print0 |
  while IFS= read -r -d '' completed; do rm -rf -- "${completed%/completed}"; done
echo "Backup complete: $snapshot"
