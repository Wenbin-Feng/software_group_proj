#!/usr/bin/env bash
set -Eeuo pipefail
version=${1:?Usage: run.sh COMMIT_SHA}
[[ $version =~ ^[0-9a-f]{40,64}$ ]] || { echo 'Invalid commit SHA' >&2; exit 2; }
folio_root=${FOLIO_ROOT:-/srv/folio}
docker run -d --name folio-api --restart unless-stopped --init \
  --env-file "$folio_root/server.env" \
  --env NODE_ENV=production --env DATA_DIR=/data --env PORT=3001 --env "APP_VERSION=$version" \
  --publish 127.0.0.1:3001:3001 \
  --mount "type=bind,src=$folio_root/data,dst=/data" \
  --read-only --tmpfs /tmp:rw,nosuid,size=192m \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 1536m --cpus 1.5 --pids-limit 160 \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  "folio-api:$version" >/dev/null
