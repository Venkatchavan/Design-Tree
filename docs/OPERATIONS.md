# Operations manual — day-to-day running (production server)

All commands run in PowerShell from the repo root (`C:\DesignTree`).

## Routine commands

| Task | Command |
|---|---|
| Start / stop | `docker compose up -d` / `docker compose down` (keeps all data) |
| Status | `docker compose ps` (want: `mongo` + `api` healthy, `gateway` + `dbadmin` running) |
| Logs | `docker compose logs -f api`, `docker compose logs --tail=100 gateway` |
| Update to a new build | backup first → `git pull` → `docker compose up -d --build` → smoke-test |
| Re-seed superuser login | `docker compose run --rm api npm run seed` (upsert — safe to re-run) |
| Rotate app secret | set new `JWT_SECRET` in `.env` → `up -d` (logs everyone out, by design) |
| Change dbadmin password | regenerate `gateway/.htpasswd` line → `docker compose restart gateway` |

## Access map

- App: `https://<server>` (all roles, normal sign-in; nav is per-role from
  `GET /api/meta/bootstrap` — `superuser` sees HR only, `client`/`architect`
  see the project portal only).
- Topbar project search appears for roles with dashboard access (≥2 chars,
  top 8 hits).
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
| Late sign-in modal (`You signed in after 9:45`) | Working-day login after 09:45 IST requires a late reason (`PATCH /api/attendance/reason`); Sundays/holidays exempt — fill the reason and continue |
| Sign-out blocked (man-hour / attendance reason) | Engineer/Drafter + Coordinator need today's hours (`My work` / `My coordination`); late (>09:45) or short (<8h) days need a reason on the sign-out modal — not an error |
| Uploaded file 404 after redeploy | Uploads bind broken (`HOST_UPLOADS_DIR` wrong / `D:\` unshared) — files went to the container layer; fix mount, restore from backup |
| `mongo` unhealthy | Wrong `MONGO_ROOT_*` (special chars must be URL-encoded); check `docker compose logs mongo` |
| `/dbadmin` 403 on FD PC | PC address changed (DHCP) → update `allow` line in `gateway/nginx.conf`, rebuild gateway |
| `/dbadmin` asks twice | Normal: nginx basic-auth first, express login second — three gates total |
| `down -v` was run | Harmless for data (binds only, no named volumes) — just `up -d` again. Still keep the backup habit before upgrades |
| Backup/restore aborts on `CLIENT_ORIGIN` | Root `.env` holds development (`localhost`) values — likely copied from `api/.env`; refill it from `.env.example` with production values |

## What NOT to do

- Never commit `.env`, `certs/*.{crt,key}`, or `gateway/.htpasswd`.
- Never store files in `api/uploads/` on the server — that path is the dev
  default; production writes to the mounted `/data/uploads` (host `D:\`).
