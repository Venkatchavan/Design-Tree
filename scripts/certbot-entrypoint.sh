#!/bin/sh
# Request and renew a publicly trusted Let's Encrypt certificate for the
# server's public IP (no domain required). IP certificates are short-lived
# (~6 days) and must use the `shortlived` profile.
set -u

: "${PUBLIC_IP:?PUBLIC_IP is required}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL is required}"

WEBROOT="/var/www/certbot"
LE_DIR="/etc/letsencrypt/live/$PUBLIC_IP"

if [ "${CERTBOT_STAGING:-0}" = "1" ]; then
  STAGING_FLAG="--staging"
else
  STAGING_FLAG=""
fi

request_cert() {
  certbot certonly \
    --webroot -w "$WEBROOT" \
    --preferred-profile shortlived \
    --ip-address "$PUBLIC_IP" \
    --cert-name "$PUBLIC_IP" \
    --email "$CERTBOT_EMAIL" \
    --agree-tos --non-interactive \
    $STAGING_FLAG
}

if [ ! -s "$LE_DIR/fullchain.pem" ]; then
  until request_cert; do
    echo "Certificate request failed; retrying in 1 hour."
    echo "Make sure WAN:80 is forwarded to this server and port 80 is reachable from the internet."
    sleep 3600
  done
fi

while true; do
  certbot renew --webroot -w "$WEBROOT" --preferred-profile shortlived --quiet
  sleep 21600
done
