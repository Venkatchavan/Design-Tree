# Deployment run sheet — in-house Windows server via UltraViewer

<<<<<<< HEAD
Target: single Windows 10/11 host, Docker Desktop, direct IP access on
HTTP **80** and HTTPS **443**. No domain name, no Cloudflare tunnel.
=======
Target: single Windows 10/11 host, Docker Desktop, LAN access over
`https://<server>` with an internal trusted certificate. Read
`CONTAINER_SECURITY_UPDATE.md` and `ENVIRONMENT.md` first; every `EDIT-ME` below is marked in its file.
>>>>>>> ebf855a0b34d7337a162904c96f0600c409a1610

- Public IP: `103.169.236.122`
- LAN IP: `192.168.1.50`

HTTPS is split into two listeners so both IPs work:

| Listener | Certificate | Used by |
|---|---|---|
| `443` | internal CA (SANs: LAN IP + public IP) | LAN `https://192.168.1.50` |
| `4433` | Let's Encrypt public-IP cert | public `https://103.169.236.122` |

The router forwards **WAN:443 → host:4433**, so visitors still type the bare
public IP with no port. The `certbot` sidecar requests/renews the Let's
Encrypt IP certificate; the gateway starts `4433` on the bootstrap cert and
swaps to Let's Encrypt automatically when issued.

Read `ENVIRONMENT.md` first; every `EDIT-ME` below is marked in its file.

## Phase 0 — network prerequisites (critical)

The server can only be reached from outside if the router forwards the WAN
ports to it. Required:

| WAN | Forward to | Purpose |
|---|---|---|
| TCP 80 | `192.168.1.50:80` | HTTP app + Let's Encrypt HTTP-01 validation |
| TCP 443 | `192.168.1.50:4433` | Public HTTPS app (Let's Encrypt cert) |

Host `443` is **not** forwarded from WAN; it is the LAN-only HTTPS listener
with the internal CA certificate. WAN:443 must map to host **4433**.

**Current blocker:** WAN:443 answers with the mail server's `/mail/` webmail,
and WAN:80 reaches a different nginx (not this server). Until both forwards
point at `192.168.1.50` (443 → **4433**), external access and certificate
issuance cannot work. The mail webmail must move to another port/IP or be
fronted by a reverse proxy on a different host; one WAN port can only map to
one internal host:port.

- [ ] Admin Windows account + password at hand (installs, firewall, reboot).
- [ ] Repo checked out on the server (e.g. `C:\DesignTree`), on the agreed
      release branch with a clean working tree.
- [ ] Confirm the public IP (`103.169.236.122`) has not changed.

## Phase 1 — host prep (admin, pre-reboot)

1. Install **Docker Desktop** (WSL2 backend), enable virtualization if prompted.
2. Docker Settings → Resources → File sharing: add `E:\` (uploads + backups
   bind in the current `.env`).
3. Windows Firewall: allow inbound TCP **80**, **443**, and **4433**
   (4433 receives the router's WAN:443 forward).
4. Create host folders: `E:\DesignTree\uploads`, `E:\DesignTree\backups`.
   (The database lives in the Docker named volume `designtree_mongo-data`,
   not a host folder — no folder needed for it.)
<<<<<<< HEAD
5. Copy `.env.example` → `.env`, fill every `REPLACE_WITH_…` value. Set:
   - `CLIENT_ORIGIN=https://103.169.236.122,http://103.169.236.122,http://192.168.1.50`
   - `PUBLIC_IP=103.169.236.122`
   - `CERTBOT_EMAIL=<admin email>`
   - `HTTP_PORT=80`, `HTTPS_PORT=443`, `HTTPS_PUBLIC_PORT=4433`,
     `COOKIE_SECURE=false`
6. Make sure these host folders exist (certbot writes into them):
   `certs/letsencrypt`, `certs/acme-webroot`.
7. DB-admin password file: `docker run --rm httpd:2.4-alpine htpasswd -nbB <user>`
   → save the printed line as `gateway/.htpasswd`.
8. Edit `gateway/locations.conf` EDIT-ME spot: the `allow 192.168.1.50;` line
   (= FD office PC address).
9. Remove any old Cloudflare tunnel container/service — not used.
=======
5. Copy `.env.example` → `.env`, fill every `REPLACE_WITH_…` value.
6. TLS (`certs/`, all host-local, never committed):
   - Internal CA (2026-10-11, v2): `certs/ca.key` (RSA 4096, keep secret) +
     `certs/ca.crt` (self-signed, 10y, `CN=DesignTree LAN CA`,
     SHA256 `93:49:40:FB:71:C3:BB:7B:8F:7B:15:4B:BA:29:DB:59:63:3D:D2:10:F1:0E:0F:B8:CE:39:A4:55:BD:2C:49:2E`).
     The CN is deliberately DIFFERENT from the pre-2026 `DesignTree Internal
     CA`: Firefox resolves issuers by subject name, and a same-name CA with a
     different key makes clients report "invalid signature" instead of trying
     the right CA. Never re-use an old CA subject for a new CA key.
     **Back up `ca.key` with the deploy secrets outside the repo** — losing it
     means rebuilding trust on every office PC. Distribute only `ca.crt`.
     (Superseded same-name CA archived as `ca-samename-20261011.*` — never install.)
   - Server cert: new `server.key` + CSR, signed by the CA (SANs =
     `IP:192.168.1.50,IP:103.169.236.122`, 825d, with SKID/AKID).
     SAN/extension list lives in `certs/server.ext`; verify with
     `openssl verify -CAfile certs/ca.crt certs/server.crt` (must say `OK`)
     plus a key↔cert modulus match before swapping into `server.crt/.key`.
     Back up the previous pair first.
   - Server cert: new `server.key` + CSR, signed by the CA (SANs =
     `IP:192.168.1.50,IP:103.169.236.122`, 825d). SAN list lives in
     `certs/server.ext`; verify with
     `openssl verify -CAfile certs/ca.crt certs/server.crt` (must say `OK`)
     plus a key↔cert modulus match before swapping into `server.crt/.key`.
     Back up the previous pair (`prev-<date>-*`) first.
   - After any cert swap: `docker compose restart gateway` (a plain `up -d`
     does nothing — image config is unchanged; nginx reads the mounted files
     at start). Confirm with
     `openssl s_client -connect 192.168.1.50:443 -CAfile certs/ca.crt`
     → `Verify return code: 0 (ok)`.
   - Trust (once per office PC): use the `rollout/` folder — copy
     `install-designtree-ca.bat` + `designtree-lan-ca.crt` together to the PC
     (USB/share), double-click the `.bat`, accept the UAC prompt. It verifies
     the CA file fingerprint, installs into Local Machine Trusted Root, sets
     the Firefox machine policy to use the Windows store, and verifies the
     install. Then fully restart the browser: clean padlock, no click-through.
     If the script reports a fingerprint mismatch, stop — the folder copy is
     stale. (Manual fallback: elevated `certutil -addstore root ca.crt` +
     Firefox `about:config security.enterprise_roots.enabled=true`.)
     Thereafter reissues stay trusted — no per-PC work until the CA itself
     expires (2036). Refresh `rollout/designtree-lan-ca.crt` if the CA is ever
     replaced (the installer refuses stale files).
   - Note: bare-IP certs still warn for outsiders (no public CA for bare IPs)
     — expected. Ports are never part of certs, so `:8443` needs no change.
7. Database admin is disabled by default. No gateway password file is required.
   Temporary loopback-only access uses the explicit `dbadmin` profile; see
   `CONTAINER_SECURITY_UPDATE.md` before enabling the legacy image.
8. Edit `gateway/nginx.conf` EDIT-ME spots: `server_name` (= CLIENT_ORIGIN hosts,
   space-separated, e.g. `103.169.236.122 192.168.1.50`)
   Database admin is never proxied through the gateway.
>>>>>>> ebf855a0b34d7337a162904c96f0600c409a1610

## Phase 2 — reboot and reconnect

Docker/WSL2 setup forces a reboot, which drops the UltraViewer session.
Reboot, then reconnect with a fresh UltraViewer session (keep ID/password handy).

## Phase 3 — deploy

```powershell
cd C:\DesignTree
<<<<<<< HEAD
docker compose up -d --build --remove-orphans
docker compose ps                       # mongo + api: healthy; gateway/dbadmin/certbot: running
docker compose run --rm api npm run seed  # one-shot superuser login (upsert, safe to re-run)
docker compose logs -f certbot          # watch the IP certificate request
=======
docker compose up -d --build
docker compose ps                       # mongo + api: healthy; gateway: running; dbadmin disabled
docker compose run --rm api node src/scripts/seed.js  # one-shot superuser login (upsert, safe to re-run)
>>>>>>> ebf855a0b34d7337a162904c96f0600c409a1610
```

The gateway starts immediately on HTTP/HTTPS. LAN `443` always uses the
internal bootstrap certificate. Public `4433` starts on the same bootstrap
certificate (warning) until certbot succeeds, then switches to the Let's
Encrypt certificate. Certbot retries hourly; when it succeeds, the gateway
reloads nginx automatically within 60 seconds.

## Phase 4 — verification checklist (do not skip)

- [ ] LAN HTTP: `http://192.168.1.50/api/health` → `{"ok":true}`.
- [ ] LAN HTTPS: `https://192.168.1.50/api/health` → `{"ok":true}` with the
      internal CA certificate. On each LAN PC, run
      `rollout\install-designtree-ca.bat` once (UAC prompt), then restart the
      browser. Private IPs cannot get public certificates; this CA is for
      LAN PCs only.
- [ ] Public HTTP (after WAN:80 → host 80): `http://103.169.236.122/api/health`
      → `{"ok":true}`.
- [ ] Public HTTPS (after WAN:443 → host **4433** + certificate issued):
      `https://103.169.236.122/api/health` → `{"ok":true}` with a valid
      public padlock. Check `docker compose logs certbot` for
      "Successfully received certificate".
- [ ] Sign in as superuser → change the seed password immediately.
- [ ] Bell pushes live (socket.io via `/socket.io/`); if blocked by VPN/ad-blocker
      the bell still refreshes every 60 s via REST — no data loss.
- [ ] Upload a file (e.g. meeting reference doc), then
      `docker compose down` → `docker compose up -d` → file still downloadable
      (proves the HDD bind mount works).
<<<<<<< HEAD
- [ ] `http://<server>/dbadmin` from the FD PC: nginx password prompt →
      express login → tables visible. From any other PC: blocked.
=======
- [ ] `https://<server>/dbadmin` and `/dbadmin/` return 403 for every client.
      The optional admin profile is off after the maintenance session.
>>>>>>> ebf855a0b34d7337a162904c96f0600c409a1610
- [ ] `.\scripts\backup.ps1` runs clean; both artifacts listed with sizes.
- [ ] `docker compose logs --tail=50 api gateway certbot` shows no errors.

## Phase 5 — handover

- Record (outside the repo): FD app password, dbadmin passwords,
  `JWT_SECRET` custodian, backup location + cadence owner.
- State the runbook rule to the operator: uploads live on host binds
  (survive everything), but the database is a Docker NAMED VOLUME
  (`designtree_mongo-data`) — `down -v` / `volume prune` would delete it,
  so backups first before upgrades, always.
- Certificates: Let's Encrypt IP certificates last ~6 days. The `certbot`
  container renews automatically every 6 hours; do not stop it. Renewal
  requires WAN:80 → host:80 to keep pointing at this server. Public HTTPS
  requires WAN:443 → host:4433. The LAN CA certificate on 443 is valid until
  January 2029.
- Leave this repo on the release branch, working tree clean.
