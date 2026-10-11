# Deployment run sheet — in-house Windows server via UltraViewer

Target: single Windows 10/11 host, Docker Desktop, LAN access over
`https://<server>` with an internal trusted certificate. Read
`ENVIRONMENT.md` first; every `EDIT-ME` below is marked in its file.

## Phase 0 — before the remote session

- [ ] Admin Windows account + password at hand (installs, firewall, reboot).
- [ ] Repo checked out on the server (e.g. `C:\DesignTree`), on the agreed
      release branch with a clean working tree.
- [ ] Decide the names users will type (public IP + LAN IP when serving both
      in parallel, e.g. `103.169.236.122` + `192.168.1.50`). Every entry must
      match `CLIENT_ORIGIN` (comma-separated), nginx `server_name`, and the cert SANs.

## Phase 1 — host prep (admin, pre-reboot)

1. Install **Docker Desktop** (WSL2 backend), enable virtualization if prompted.
2. Docker Settings → Resources → File sharing: add `D:\` (uploads bind)
   and `E:\` (backups bind).
3. Windows Firewall: allow inbound TCP **80**, **443** (LAN) and **8443**
   (WAN scope — the public alt-port; the office WAN's 443 is taken by the
   mail server's webmail, so the router forwards WAN:8443 → server:443).
4. Create host folders: `D:\designtree-uploads`,
   `E:\DesignTree\backup\mongo`, `E:\DesignTree\backup\uploads`.
   (The database lives in the Docker named volume `designtree_mongo-data`,
   not a host folder — no folder needed for it.)
5. Copy `.env.example` → `.env`, fill every `REPLACE_WITH_…` value.
6. TLS cert (`certs/`): self-signed via openssl on the server (mkcert is not
   installed; the original internal CA key is not on this machine):
   `openssl req -x509 -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 825 -nodes -subj "/C=IN/ST=Karnataka/L=Bengaluru/O=DesignTree/OU=IT/CN=192.168.1.50" -addext "subjectAltName=IP:192.168.1.50,IP:103.169.236.122" -addext "keyUsage=digitalSignature,keyEncipherment" -addext "extendedKeyUsage=serverAuth" -addext "basicConstraints=CA:FALSE"`.
   Back up the previous pair first (`prev-<date>-server.crt/.key`).
   List every IP in the SANs. Install `server.crt` into Trusted Root once per
   office PC to silence warnings (LAN). Note: bare-IP certs still warn for
   outsiders (no public CA for bare IPs) — expected. Ports are never part of
   certs, so the `:8443` public URL needs no cert change.
7. DB-admin password file: `docker run --rm httpd:2.4-alpine htpasswd -nbB <user>`
   → save the printed line as `gateway/.htpasswd`.
8. Edit `gateway/nginx.conf` EDIT-ME spots: `server_name` (= CLIENT_ORIGIN hosts,
   space-separated, e.g. `103.169.236.122 192.168.1.50`)
   and the `allow 192.168.1.50;` line (= FD office PC address).

## Phase 2 — reboot and reconnect

Docker/WSL2 setup forces a reboot, which drops the UltraViewer session.
Reboot, then reconnect with a fresh UltraViewer session (keep ID/password handy).

## Phase 3 — deploy

```powershell
cd C:\DesignTree
docker compose up -d --build
docker compose ps                       # mongo + api: healthy; gateway + dbadmin: running
docker compose run --rm api npm run seed  # one-shot superuser login (upsert, safe to re-run)
```

## Phase 4 — verification checklist (do not skip)

- [ ] LAN: `https://192.168.1.50/api/health` → `{"ok":true}` (accept the cert trust on first hit).
- [ ] Public (after the WAN:8443 forward): `https://103.169.236.122:8443/api/health`
      → `{"ok":true}` (bare-IP warning expected). Bare `https://103.169.236.122`
      (no port) must still serve webmail `/mail/` — do not "fix" that.
- [ ] Sign in as superuser → change the seed password immediately.
- [ ] Bell pushes live (socket.io via `/socket.io/`); if blocked by VPN/ad-blocker
      the bell still refreshes every 60 s via REST — no data loss.
- [ ] Upload a file (e.g. meeting reference doc), then
      `docker compose down` → `docker compose up -d` → file still downloadable
      (proves the HDD bind mount works).
- [ ] `https://<server>/dbadmin` from the FD PC: nginx password prompt →
      express login → tables visible. From any other PC: blocked.
- [ ] `.\scripts\backup.ps1` runs clean; both artifacts listed with sizes.
- [ ] `docker compose logs --tail=50 api gateway` shows no errors.

## Phase 5 — handover

- Record (outside the repo): FD app password, dbadmin passwords, `JWT_SECRET`
  custodian, backup location + cadence owner.
- State the runbook rule to the operator: uploads live on host binds
  (survive everything), but the database is a Docker NAMED VOLUME
  (`designtree_mongo-data`) — `down -v` / `volume prune` would delete it,
  so backups first before upgrades, always.
- Leave this repo on the release branch, working tree clean.
