#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run release.sh with sudo' >&2; exit 2; }
version=${1:?Usage: release.sh COMMIT_SHA INCOMING_DIRECTORY}
incoming=${2:?Missing incoming directory}
[[ $version =~ ^[0-9a-f]{40,64}$ ]] || { echo 'Invalid commit SHA' >&2; exit 2; }
folio_root=${FOLIO_ROOT:-/srv/folio}
[[ -s $folio_root/server.env ]] || { echo 'Configure server.env before deployment' >&2; exit 2; }
[[ -s $incoming/api-image.tar.gz ]] || { echo 'Missing prebuilt image' >&2; exit 2; }
exec 9>"$folio_root/deployment.lock"
flock -w 300 9
old_version=$(cat "$folio_root/current" 2>/dev/null || true)
[[ -z $old_version || $old_version =~ ^[0-9a-f]{40,64}$ ]] || exit 2
docker load --input "$incoming/api-image.tar.gz" >/dev/null
docker image inspect "folio-api:$version" >/dev/null
install -d -m 755 "$folio_root/bin"
for helper in run.sh health.sh backup.sh rollback.sh; do
  install -m 755 "$incoming/deploy/$helper" "$folio_root/bin/$helper"
done
container_stopped=false
recover() {
  result=$?
  trap - EXIT
  if [[ $result != 0 && $container_stopped == true ]]; then
    echo 'Release failed; recovering the previous application. Database migrations are retained.' >&2
    docker rm -f folio-api >/dev/null 2>&1 || true
    if [[ -n $old_version ]]; then
      "$folio_root/bin/run.sh" "$old_version"
      "$folio_root/bin/health.sh" "$old_version" || true
    fi
  fi
  exit "$result"
}
trap recover EXIT
if docker inspect folio-api >/dev/null 2>&1; then docker stop --time 45 folio-api >/dev/null; fi
container_stopped=true
FOLIO_LOCK_HELD=1 "$folio_root/bin/backup.sh"
# The new image applies only unapplied migrations, including first deployment.
docker run --rm --env-file "$folio_root/server.env" \
  --env NODE_ENV=production --env DATA_DIR=/data \
  --mount "type=bind,src=$folio_root/data,dst=/data" \
  --read-only --tmpfs /tmp:rw,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  "folio-api:$version" node apps/api/dist/migrate.js
docker rm -f folio-api >/dev/null 2>&1 || true
"$folio_root/bin/run.sh" "$version"
"$folio_root/bin/health.sh" "$version"
if [[ -n $old_version && $old_version != "$version" ]]; then printf '%s\n' "$old_version" >"$folio_root/previous"; fi
printf '%s\n' "$version" >"$folio_root/current"
trap - EXIT
echo "Backend deployed: $version"
