# Operations manual — day-to-day running (production server)

All commands run in PowerShell from the repo root (`C:\DesignTree`).

## Routine commands

| Task | Command |
|---|---|
| Start / stop | `docker compose up -d` / `docker compose down` (keeps all data) |
| Status | `docker compose ps` (want: `mongo` + `api` healthy, `gateway` + `dbadmin` + `certbot` running) |
| Logs | `docker compose logs -f api`, `docker compose logs --tail=100 gateway`, `docker compose logs -f certbot` |
| Update to a new build | backup first → `git pull` → `docker compose up -d --build` → smoke-test |
| Re-seed superuser login | `docker compose run --rm api npm run seed` (upsert — safe to re-run) |
| Rotate app secret | set new `JWT_SECRET` in `.env` → `up -d` (logs everyone out, by design) |
| Change dbadmin password | set new `ME_CONFIG_BASICAUTH_PASSWORD` in `.env` → `docker compose up -d --no-deps mongo-express` (only dbadmin restarts, no app downtime) |

## Access map

- App: public `http://103.169.236.122` / `https://103.169.236.122`
  (trusted Let's Encrypt cert, router WAN:443 → host 4433) or LAN
  `http://192.168.1.50` / `https://192.168.1.50` (internal bootstrap cert;
  use HTTP on LAN or run `rollout\install-designtree-ca.bat` once per PC).
  All roles, normal sign-in; nav is per-role from
  `GET /api/meta/bootstrap` — `superuser` sees HR only, `client`/`architect`
  see the project portal only.
- Topbar project search appears for roles with dashboard access (≥2 chars,
  top 8 hits).
- Health: `<scheme>://<server>/api/health` → `{"ok":true}` (first check when
  anything looks wrong).
- DB admin: `http://127.0.0.1:18081/dbadmin/` on the server itself (express login
  with `ME_CONFIG_BASICAUTH_*` from root `.env`). Loopback-bound only — LAN/WAN
  cannot reach it. FD remote: `ssh -N -L 18081:127.0.0.1:18081 <user>@192.168.1.50`
  then open the same URL locally. `<scheme>://<server>/dbadmin` via gateway stays
  `403` (Docker Desktop NAT masks all clients as `172.18.0.1`, so its nginx
  `allow` never matches — closed by design).
- MongoDB port is **not published** — there is no direct DB access from the LAN.

## Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Signed in, then immediately logged out / API 401 | `COOKIE_SECURE=true` while browsing over HTTP → set `COOKIE_SECURE=false` in `.env` and `docker compose up -d --no-deps api` |
| Public IP unreachable, LAN works | Router WAN forwards missing → WAN:80 → `192.168.1.50:80` and WAN:443 → `192.168.1.50:4433`; also allow TCP 80/443/4433 in Windows Firewall |
| Public HTTPS still shows the mail webmail | WAN:443 is forwarded to the mail server, not this host - move it to `192.168.1.50:4433` or put a shared reverse proxy in front |
| Certbot logs `Invalid response ... 404` | WAN:80 reaches another web server → point WAN:80 at `192.168.1.50:80`; certbot retries hourly |
| HTTPS warning on LAN (`192.168.1.50`) | Expected: public CAs cannot certify private IPs → use `http://192.168.1.50`, or run `rollout\install-designtree-ca.bat` as admin and restart the browser |
| HTTPS warning on public IP | Let's Encrypt cert not issued yet → check `docker compose logs certbot`, WAN:80, and WAN:443 → host 4433 |
| API calls fail / CORS errors | `CLIENT_ORIGIN` allowlist doesn't include the URL in the address bar (each entry needs scheme+host, comma-separated for dual LAN+public) |
| File upload fails | `client_max_body_size` (nginx, 20m) or API 10 MB cap; check `docker compose logs api` |
| Bell badge doesn't update live | Socket push down — check `wss`/`/socket.io/` reaches api (nginx `Upgrade` headers; ad-blockers/VPNs sometimes block WS). Bell still refreshes every 60s via REST fallback, so nothing is lost |
| Late sign-in modal (`You signed in after 9:45`) | Working-day login after 09:45 IST requires a late reason (`PATCH /api/attendance/reason`); Sundays/holidays exempt — fill the reason and continue |
| Sign-out blocked (man-hour / attendance reason) | Engineer/Drafter + Coordinator need today's hours (`My work` / `My coordination`); late (>09:45) or short (<8h) days need a reason on the sign-out modal — not an error |
| Uploaded file 404 after redeploy | Uploads bind broken (`HOST_UPLOADS_DIR` wrong / `D:\` unshared) — files went to the container layer; fix mount, restore from backup |
| `mongo` unhealthy | Wrong `MONGO_ROOT_*` (special chars must be URL-encoded); check `docker compose logs mongo` |
| `/dbadmin` 403 via gateway | Expected: nginx `allow` cannot see real IPs under Docker Desktop NAT (all clients appear as `172.18.0.1`) → use loopback `http://127.0.0.1:18081/dbadmin/` on the server or SSH tunnel |
| `/dbadmin` asks twice | Normal: nginx basic-auth first, express login second — three gates total |
| `down -v` was run | Database volume DELETED (named volume, not a bind) — restore from the newest backup pair per `BACKUP_RESTORE.md`. Uploads (host bind) survive; the DB does not. Never run `down -v` / `volume prune` again without a verified backup |
| Backup/restore aborts on `CLIENT_ORIGIN` | Root `.env` holds development (`localhost`) values — likely copied from `api/.env`; refill it from `.env.example` with production values |

## What NOT to do

- Never commit `.env`, `gateway/.htpasswd`, or certificate material.
- Do not edit `certs/letsencrypt/` by hand — the `certbot` container owns it.
  Keep `certs/server.crt` + `server.key` as the bootstrap pair.
- Never store files in `api/uploads/` on the server — that path is the dev
  default; production writes to the mounted `/data/uploads` (host `D:\`).
