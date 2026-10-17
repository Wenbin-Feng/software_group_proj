#!/usr/bin/env bash
# Run once on the VM as root. Re-running preserves certificates and application data.
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run provision.sh with sudo' >&2; exit 2; }
deploy_user=${1:-azureuserwjh}
public_ip=${2:-20.164.17.72}
[[ $deploy_user =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 2
python3 -c 'import ipaddress,sys; ipaddress.ip_address(sys.argv[1])' "$public_ip"
getent passwd "$deploy_user" >/dev/null
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io nginx sqlite3 python3-venv curl ca-certificates openssl
systemctl enable --now docker nginx
install -d -m 755 -o "$deploy_user" -g "$deploy_user" /srv/folio /srv/folio/incoming
install -d -m 755 /srv/folio/bin
install -d -m 700 /srv/folio/backups /etc/folio
install -d -m 750 -o 1000 -g 1000 /srv/folio/data
install -d -m 755 /var/www/folio-acme/.well-known/acme-challenge
for helper in run.sh health.sh backup.sh rollback.sh enable-https.sh; do
  install -m 755 "$script_dir/$helper" "/srv/folio/bin/$helper"
done
install -m 644 "$script_dir/nginx-http.conf" /etc/folio/nginx-http.conf
install -m 644 "$script_dir/nginx-https.conf" /etc/folio/nginx-https.conf
printf '%s\n' "$public_ip" >/etc/folio/ip-address
if [[ ! -f /etc/nginx/sites-available/folio ]]; then
  sed "s/FOLIO_IP/$public_ip/g" /etc/folio/nginx-http.conf >/etc/nginx/sites-available/folio
fi
ln -sfn /etc/nginx/sites-available/folio /etc/nginx/sites-enabled/folio
nginx -t
systemctl reload nginx
if [[ ! -x /opt/folio-certbot/bin/certbot ]]; then python3 -m venv /opt/folio-certbot; fi
/opt/folio-certbot/bin/python -m pip install --disable-pip-version-check 'certbot>=5.4,<6'
install -d -m 755 /usr/local/libexec
cat >/usr/local/libexec/folio-certbot-reload <<'HOOK'
#!/usr/bin/env sh
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
HOOK
chmod 755 /usr/local/libexec/folio-certbot-reload
cat >/etc/systemd/system/folio-certbot-renew.service <<'SERVICE'
[Unit]
Description=Renew Folio short-lived IP TLS certificate
After=network-online.target nginx.service
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/opt/folio-certbot/bin/certbot renew --quiet --deploy-hook /usr/local/libexec/folio-certbot-reload
SERVICE
cat >/etc/systemd/system/folio-certbot-renew.timer <<'TIMER'
[Unit]
Description=Check Folio IP certificate renewal four times daily
[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
RandomizedDelaySec=45m
Persistent=true
[Install]
WantedBy=timers.target
TIMER
cat >/etc/systemd/system/folio-backup.service <<'SERVICE'
[Unit]
Description=Consistent Folio SQLite and file backup
After=docker.service
[Service]
Type=oneshot
ExecStart=/srv/folio/bin/backup.sh
TimeoutStartSec=15min
SERVICE
cat >/etc/systemd/system/folio-backup.timer <<'TIMER'
[Unit]
Description=Back up Folio daily and retain seven days
[Timer]
OnCalendar=*-*-* 02:15:00
RandomizedDelaySec=15m
Persistent=true
[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
systemctl enable --now folio-certbot-renew.timer folio-backup.timer
printf 'folio-http-preflight\n' >/var/www/folio-acme/.well-known/acme-challenge/folio-preflight
echo "Provisioned. Test this URL from outside Azure before issuing TLS: http://$public_ip/.well-known/acme-challenge/folio-preflight"
echo 'Next: configure /srv/folio/server.env (mode 600), then run /srv/folio/bin/enable-https.sh.'
