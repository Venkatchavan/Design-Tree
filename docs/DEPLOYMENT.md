# Deployment run sheet — in-house Windows server via UltraViewer

Target: single Windows 10/11 host, Docker Desktop, LAN access over
`https://<server>` with an internal trusted certificate. Read
`ENVIRONMENT.md` first; every `EDIT-ME` below is marked in its file.

## Phase 0 — before the remote session

- [ ] Admin Windows account + password at hand (installs, firewall, reboot).
- [ ] Repo checked out on the server (e.g. `C:\DesignTree`), on the `main` branch.
- [ ] Decide the LAN name users will type (e.g. `designtree.local` or the
      server IP). It must match `CLIENT_ORIGIN`, nginx `server_name`, and the cert.

## Phase 1 — host prep (admin, pre-reboot)

1. Install **Docker Desktop** (WSL2 backend), enable virtualization if prompted.
2. Docker Settings → Resources → File sharing: add `D:\` (needed for the
   uploads/backups bind mounts).
3. Windows Firewall: allow inbound TCP **80** and **443** (LAN scope is fine).
4. Create host folders: `D:\designtree-uploads`, `D:\backups\mongo`,
   `D:\backups\uploads`.
5. Copy `.env.example` → `.env`, fill every `REPLACE_WITH_…` value.
6. TLS cert (`certs/`): with `mkcert`, on the server:
   `mkcert -cert-file certs/server.crt -key-file certs/server.key <LAN-name> <server-IP>`.
   Install the mkcert CA once per office PC (`mkcert -install`) to silence warnings.
7. DB-admin password file: `docker run --rm httpd:2.4-alpine htpasswd -nbB <user>`
   → save the printed line as `gateway/.htpasswd`.
8. Edit `gateway/nginx.conf` EDIT-ME spots: `server_name` (= CLIENT_ORIGIN host)
   and the `allow 192.168.1.50;` line (= FD office PC address).

## Phase 2 — reboot and reconnect

Docker/WSL2 setup forces a reboot, which drops the UltraViewer session.
Reboot, then reconnect with a fresh UltraViewer session (keep ID/password handy).

## Phase 3 — deploy

```powershell
cd C:\DesignTree
docker compose up -d --build
docker compose ps                       # all four: healthy/running
docker compose run --rm api npm run seed  # one-shot superuser login (upsert, safe to re-run)
```

## Phase 4 — verification checklist (do not skip)

- [ ] `https://<server>/api/health` → `{"ok":true}` (accept the cert trust on first hit).
- [ ] Sign in as superuser → change the seed password immediately.
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
- State the runbook rule to the operator: `down` keeps data, **`down -v`
  deletes the database** — backups first, always.
- Leave this repo on `main`, working tree clean.
