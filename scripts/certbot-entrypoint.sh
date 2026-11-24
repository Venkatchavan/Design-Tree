#!/bin/sh
# Request and renew a publicly trusted Let's Encrypt certificate.
#
# PUBLIC_DOMAIN set (e.g. mis.designtreeconsultants.com): certificate for the
# domain, verified with a DNS TXT record (DNS-01). Ports 80/443 are not needed,
# so this works while another service owns them. The TXT value to add is
# written to /etc/letsencrypt/dns-challenge/PENDING.txt and to the log; the
# hook waits until public DNS shows it. See scripts/certbot-dns-hook.sh.
#
# Otherwise: certificate for the public IP (no domain), verified over HTTP on
# port 80. IP certificates are short-lived (~6 days), `shortlived` profile.
set -u

: "${CERTBOT_EMAIL:?CERTBOT_EMAIL is required}"

WEBROOT="/var/www/certbot"
HOOK="/opt/designtree/certbot-dns-hook.sh"

if [ "${CERTBOT_STAGING:-0}" = "1" ]; then
  STAGING_FLAG="--staging"
else
  STAGING_FLAG=""
fi

if [ -n "${PUBLIC_DOMAIN:-}" ]; then
  CERT_NAME="$PUBLIC_DOMAIN"
  request_cert() {
    certbot certonly \
      --manual --preferred-challenges dns \
      --manual-auth-hook "sh $HOOK auth" \
      --manual-cleanup-hook "sh $HOOK cleanup" \
      -d "$PUBLIC_DOMAIN" \
      --cert-name "$PUBLIC_DOMAIN" \
      --email "$CERTBOT_EMAIL" \
      --agree-tos --non-interactive \
      $STAGING_FLAG
  }
  renew_cert() {
    # Renews ~30 days before expiry; the stored hooks ask for a new TXT value.
    certbot renew --quiet
  }
else
  : "${PUBLIC_IP:?PUBLIC_IP is required}"
  CERT_NAME="$PUBLIC_IP"
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
  renew_cert() {
    certbot renew --webroot -w "$WEBROOT" --preferred-profile shortlived --quiet
  }
fi

LE_DIR="/etc/letsencrypt/live/$CERT_NAME"

if [ ! -s "$LE_DIR/fullchain.pem" ]; then
  until request_cert; do
    echo "Certificate request for $CERT_NAME failed; retrying in 1 hour."
    sleep 3600
  done
fi

while true; do
  renew_cert
  sleep 21600
done
