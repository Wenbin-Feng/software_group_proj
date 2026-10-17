#!/usr/bin/env bash
# Exercise the actual Linux image without credentials, published ports, or VM access.
set -Eeuo pipefail
image=${1:-folio-api:verify}
version=${GITHUB_SHA:-$(git rev-parse HEAD)}
container="folio-image-verify-$$"
cleanup() {
  result=${1:-0}
  trap - EXIT
  if [[ $result != 0 ]]; then docker logs --tail 80 "$container" 2>/dev/null || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  exit "$result"
}
trap 'cleanup "$?"' EXIT
docker build --platform linux/amd64 --tag "$image" .
# Run the same migration entry point used by production releases as the image's non-root user.
docker run --rm --network none --read-only \
  --tmpfs /data:rw,nosuid,uid=1000,gid=1000,mode=0750,size=128m \
  --tmpfs /tmp:rw,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  "$image" node apps/api/dist/migrate.js
docker run -d --name "$container" --network none --read-only --init \
  --tmpfs /data:rw,nosuid,uid=1000,gid=1000,mode=0750,size=128m \
  --tmpfs /tmp:rw,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  --env "APP_VERSION=$version" --env APP_PUBLIC_URL=https://folio-ci.invalid \
  --env ORIGIN_SECRET=ci-only-image-verification \
  "$image" >/dev/null
for ((attempt=1; attempt<=30; attempt++)); do
  if docker exec "$container" node -e '
    if(process.getuid()!==1000)process.exit(1);
    fetch("http://127.0.0.1:3001/api/health").then(async response=>{
      const value=await response.json();
      process.exit(response.ok&&value.status==="ok"&&value.version===process.env.APP_VERSION?0:1);
    }).catch(()=>process.exit(1));
  ' 2>/dev/null; then
    echo 'Linux backend image verified: native SQLite migrations, non-root startup, and health/version.'
    cleanup 0
  fi
  if [[ $(docker inspect --format '{{.State.Running}}' "$container") != true ]]; then break; fi
  sleep 1
done
echo 'Linux backend image failed its health check' >&2
exit 1
