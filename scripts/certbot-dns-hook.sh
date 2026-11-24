#!/bin/sh
# certbot manual DNS-01 hook for a DNS provider without an API.
#
#   auth:    publish the TXT record someone must add at the DNS provider, then
#            wait until public resolvers return it (up to DNS_WAIT_HOURS, 72 by
#            default). certbot sets CERTBOT_DOMAIN and CERTBOT_VALIDATION.
#   cleanup: clear the pending file. The old TXT record may then be deleted.
#
# Pending value: /etc/letsencrypt/dns-challenge/PENDING.txt (host: certs/letsencrypt/dns-challenge/PENDING.txt)
set -u

DIR="/etc/letsencrypt/dns-challenge"
PENDING="$DIR/PENDING.txt"
NAME="_acme-challenge.${CERTBOT_DOMAIN:?}"
mkdir -p "$DIR"

case "${1:-}" in
  auth)
    VALUE="${CERTBOT_VALIDATION:?}"
    cat > "$PENDING" <<EOF
DNS record to add for the DT-MIS SSL certificate (requested $(date -u '+%Y-%m-%d %H:%M UTC')):

  Type:  TXT
  Name:  $NAME
  Value: $VALUE
  TTL:   300 (or the lowest allowed)

Replace any older TXT record with the same name. The certificate is issued
automatically a few minutes after the record is visible.
EOF
    echo "==== ACTION NEEDED: add DNS TXT record ===="
    cat "$PENDING"
    echo "==========================================="

    deadline=$(( $(date +%s) + ${DNS_WAIT_HOURS:-72} * 3600 ))
    while [ "$(date +%s)" -lt "$deadline" ]; do
      found=0
      for resolver in 8.8.8.8 1.1.1.1; do
        if nslookup -type=TXT "$NAME" "$resolver" 2>/dev/null | grep -q -- "$VALUE"; then
          found=$((found + 1))
        fi
      done
      # One public resolver is enough: Let's Encrypt asks the domain's own
      # DNS servers, and a resolver may still cache the earlier "not found".
      if [ "$found" -ge 1 ]; then
        echo "TXT record for $NAME is visible; giving DNS 2 more minutes."
        sleep 120
        exit 0
      fi
      sleep 60
    done
    echo "TXT record for $NAME did not appear in time."
    exit 1
    ;;
  cleanup)
    rm -f "$PENDING"
    ;;
  *)
    echo "usage: $0 auth|cleanup" >&2
    exit 2
    ;;
esac
