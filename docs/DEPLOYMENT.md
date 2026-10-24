# Deployment run sheet — in-house Windows server via UltraViewer

Target: single Windows 10/11 host, Docker Desktop, direct IP access on
HTTP **80** and HTTPS **443**. No domain name, no Cloudflare tunnel.

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
5. Copy `.env.example` → `.env`, fill every `REPLACE_WITH_…` value. Set:
   - `CLIENT_ORIGIN=https://103.169.236.122,http://103.169.236.122,http://192.168.1.50`
   - `PUBLIC_IP=103.169.236.122`
   - `CERTBOT_EMAIL=<admin email>`
   - `HTTP_PORT=80`, `HTTPS_PORT=443`, `HTTPS_PUBLIC_PORT=4433`,
     `COOKIE_SECURE=false`
6. Make sure these host folders exist (certbot writes into them):
   `certs/letsencrypt`, `certs/acme-webroot`.
7. Database admin is disabled by default. No gateway password file is required.
   Temporary loopback-only access uses the explicit `dbadmin` profile; see
   `CONTAINER_SECURITY_UPDATE.md` before enabling the legacy image.
8. Remove any old Cloudflare tunnel container/service — not used.

## Phase 2 — reboot and reconnect

Docker/WSL2 setup forces a reboot, which drops the UltraViewer session.
Reboot, then reconnect with a fresh UltraViewer session (keep ID/password handy).

## Phase 3 — deploy

```powershell
cd C:\DesignTree
docker compose up -d --build --remove-orphans
docker compose ps                       # mongo + api: healthy; gateway/certbot: running; dbadmin disabled
docker compose run --rm api npm run seed  # one-shot superuser login (upsert, safe to re-run)
docker compose logs -f certbot          # watch the IP certificate request
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
- [ ] `https://<server>/dbadmin` and `/dbadmin/` return 403 for every client.
      The optional admin profile is off after the maintenance session.
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
