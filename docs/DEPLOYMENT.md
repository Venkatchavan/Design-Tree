# Deployment run sheet — in-house Windows server via UltraViewer

Target: single Windows 10/11 host, Docker Desktop, LAN access over
`https://<server>` with an internal trusted certificate. Read
`CONTAINER_SECURITY_UPDATE.md` and `ENVIRONMENT.md` first; every `EDIT-ME` below is marked in its file.

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

## Phase 2 — reboot and reconnect

Docker/WSL2 setup forces a reboot, which drops the UltraViewer session.
Reboot, then reconnect with a fresh UltraViewer session (keep ID/password handy).

## Phase 3 — deploy

```powershell
cd C:\DesignTree
docker compose up -d --build
docker compose ps                       # mongo + api: healthy; gateway: running; dbadmin disabled
docker compose run --rm api node src/scripts/seed.js  # one-shot superuser login (upsert, safe to re-run)
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
- [ ] `https://<server>/dbadmin` and `/dbadmin/` return 403 for every client.
      The optional admin profile is off after the maintenance session.
- [ ] `.\scripts\backup.ps1` runs clean; both artifacts listed with sizes.
- [ ] `docker compose logs --tail=50 api gateway` shows no errors.

## Phase 5 — handover

- Record (outside the repo): FD app password, dbadmin passwords, `JWT_SECRET`
  custodian, **`certs/ca.key` custodian** (loss = re-trust every PC),
  backup location + cadence owner.
- State the runbook rule to the operator: uploads live on host binds
  (survive everything), but the database is a Docker NAMED VOLUME
  (`designtree_mongo-data`) — `down -v` / `volume prune` would delete it,
  so backups first before upgrades, always.
- Leave this repo on the release branch, working tree clean.
