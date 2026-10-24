#!/bin/sh
# 443 keeps the bootstrap certificate (LAN IP + public IP SANs) so LAN HTTPS
# stays trusted by PCs that installed the DesignTree LAN CA. 4433 uses the
# Let's Encrypt IP certificate for public traffic when it exists, otherwise
# the bootstrap certificate. Watch the public pair and reload nginx
# automatically (short-lived IP certs are renewed every ~3 days).
set -eu

LE_DIR="/etc/letsencrypt/live/${PUBLIC_IP:?PUBLIC_IP is required}"
BOOT_CERT="/etc/nginx/bootstrap/server.crt"
BOOT_KEY="/etc/nginx/bootstrap/server.key"
TEMPLATE="/etc/nginx/designtree/nginx.conf.template"
TARGET="/etc/nginx/conf.d/default.conf"

public_pair() {
  if [ -s "$LE_DIR/fullchain.pem" ] && [ -s "$LE_DIR/privkey.pem" ]; then
    printf '%s %s' "$LE_DIR/fullchain.pem" "$LE_DIR/privkey.pem"
  else
    printf '%s %s' "$BOOT_CERT" "$BOOT_KEY"
  fi
}

# Detect renewals too: the file paths stay the same, only the bytes change.
public_hash() {
  if [ -s "$LE_DIR/fullchain.pem" ]; then
    md5sum "$LE_DIR/fullchain.pem" | cut -d' ' -f1
  else
    printf 'bootstrap'
  fi
}

render() {
  set -- $(public_pair)
  sed "s|__CERT_PATH__|$BOOT_CERT|g; s|__KEY_PATH__|$BOOT_KEY|g; s|__PUBLIC_CERT_PATH__|$1|g; s|__PUBLIC_KEY_PATH__|$2|g" "$TEMPLATE" > "$TARGET"
}

render
LAST="$(public_hash)"

nginx -g 'daemon off;' &
NGINX_PID=$!

trap 'kill -TERM "$NGINX_PID" 2>/dev/null || true; wait "$NGINX_PID" 2>/dev/null || true; exit 0' TERM INT

while kill -0 "$NGINX_PID" 2>/dev/null; do
  NOW="$(public_hash)"
  if [ "$NOW" != "$LAST" ]; then
    render
    nginx -s reload || true
    LAST="$NOW"
  fi
  sleep 60 & wait $! || true
done

wait "$NGINX_PID"
