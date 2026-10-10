# Operations manual — day-to-day running (production server)

All commands run in PowerShell from the repo root (`C:\DesignTree`).

## Routine commands

| Task | Command |
|---|---|
| Start / stop | `docker compose up -d` / `docker compose down` (keeps all data) |
| Status | `docker compose ps` (want: 4 services, healthy/running) |
| Logs | `docker compose logs -f api`, `docker compose logs --tail=100 gateway` |
| Update to a new build | backup first → `git pull` → `docker compose up -d --build` → smoke-test |
| Re-seed superuser login | `docker compose run --rm api npm run seed` (upsert — safe to re-run) |
| Rotate app secret | set new `JWT_SECRET` in `.env` → `up -d` (logs everyone out, by design) |
| Change dbadmin password | regenerate `gateway/.htpasswd` line → `docker compose restart gateway` |

## Access map

- App: `https://<server>` (all roles, normal sign-in).
- Health: `https://<server>/api/health` → `{"ok":true}` (first check when anything looks wrong).
- DB admin: `https://<server>/dbadmin` — nginx password, then express login.
  Reachable only from allowlisted IPs; everyone else gets `403`.
- MongoDB port is **not published** — there is no direct DB access from the LAN.

## Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Browser cert warning | mkcert CA not installed on that PC → `mkcert -install` (once per PC) |
| Signed in, then immediately logged out / API 401 | `NODE_ENV=production` serves `secure` cookies → plain-HTTP access; always use `https://` |
| API calls fail / CORS errors | `CLIENT_ORIGIN` doesn't match the URL in the address bar (scheme/host included) |
| File upload fails | `client_max_body_size` (nginx, 20m) or API 10 MB cap; check `docker compose logs api` |
| Bell badge doesn't update live | Socket push down — check `wss`/`/socket.io/` reaches api (nginx `Upgrade` headers; ad-blockers/VPNs sometimes block WS). Bell still refreshes every 60s via REST fallback, so nothing is lost |
| Uploaded file 404 after redeploy | Uploads bind broken (`HOST_UPLOADS_DIR` wrong / `D:\` unshared) — files went to the container layer; fix mount, restore from backup |
| `mongo` unhealthy | Wrong `MONGO_ROOT_*` (special chars must be URL-encoded); check `docker compose logs mongo` |
| `/dbadmin` 403 on FD PC | PC address changed (DHCP) → update `allow` line in `gateway/nginx.conf`, rebuild gateway |
| `/dbadmin` asks twice | Normal: nginx basic-auth first, express login second — three gates total |
| `down -v` was run | Database volume deleted → `.\scripts\restore.ps1 -Backup <latest>` immediately; uploads are safe on `D:\` |
| Backup/restore aborts on `CLIENT_ORIGIN` | Root `.env` holds development (`localhost`) values — likely copied from `api/.env`; refill it from `.env.example` with production values |

## What NOT to do

- Never `docker compose down -v` / `docker volume prune` without a fresh backup.
- Never commit `.env`, `certs/*.{crt,key}`, or `gateway/.htpasswd`.
- Never store files in `api/uploads/` on the server — that path is the dev
  default; production writes to the mounted `/data/uploads` (host `D:\`).
