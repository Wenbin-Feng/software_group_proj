#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run enable-https.sh with sudo' >&2; exit 2; }
public_ip=$(cat /etc/folio/ip-address)
python3 -c 'import ipaddress,sys; ipaddress.ip_address(sys.argv[1])' "$public_ip"
account_args=(--register-unsafely-without-email)
if [[ -n ${ACME_EMAIL:-} ]]; then account_args=(--email "$ACME_EMAIL"); fi
# Certbot >= 5.4 supports IP addresses with webroot. The short-lived profile is required.
/opt/folio-certbot/bin/certbot certonly --non-interactive --agree-tos \
  "${account_args[@]}" --preferred-profile shortlived \
  --webroot --webroot-path /var/www/folio-acme --ip-address "$public_ip" \
  --cert-name "$public_ip" --keep-until-expiring \
  --deploy-hook /usr/local/libexec/folio-certbot-reload
sed "s/FOLIO_IP/$public_ip/g" /etc/folio/nginx-https.conf >/etc/nginx/sites-available/folio
nginx -t
systemctl reload nginx
systemctl enable --now folio-certbot-renew.timer
echo "Trusted HTTPS configured: https://$public_ip/api/health"
