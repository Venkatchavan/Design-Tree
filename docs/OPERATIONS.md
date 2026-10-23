# Operations manual — day-to-day running (production server)

All commands run in PowerShell from the repo root (`C:\DesignTree`).

## Routine commands

| Task | Command |
|---|---|
| Start / stop | `docker compose up -d` / `docker compose down` (keeps all data) |
| Status | `docker compose ps` (want: `mongo` + `api` healthy, `gateway` running; `dbadmin` disabled) |
| Logs | `docker compose logs -f api`, `docker compose logs --tail=100 gateway` |
| Update to a new build | follow `CONTAINER_SECURITY_UPDATE.md`: backup → pull pinned images/build → smoke-test |
| Re-seed superuser login | `docker compose run --rm api node src/scripts/seed.js` (upsert — safe to re-run) |
| Rotate app secret | set new `JWT_SECRET` in `.env` → `up -d` (logs everyone out, by design) |
| Change dbadmin password | set new `ME_CONFIG_BASICAUTH_PASSWORD` in `.env` → `docker compose up -d --no-deps mongo-express` (only dbadmin restarts, no app downtime) |

## Access map

- App: `https://<server>` (all roles, normal sign-in; nav is per-role from
  `GET /api/meta/bootstrap` — `superuser` sees HR only, `client`/`architect`
  see the project portal only).
- Topbar project search appears for roles with dashboard access (≥2 chars,
  top 8 hits).
- Health: `https://<server>/api/health` → `{"ok":true}` (first check when anything looks wrong).
- DB admin: disabled by default. Explicit temporary activation:
  `docker compose --profile dbadmin up -d mongo-express`; stop after use with
  `docker compose stop mongo-express`. The legacy image has an EOL runtime;
  see `CONTAINER_SECURITY_UPDATE.md`. When enabled, use
  `http://127.0.0.1:18081/dbadmin/` on the server itself (express login
  with `ME_CONFIG_BASICAUTH_*` from root `.env`). Loopback-bound only — LAN/WAN
  cannot reach it. FD remote: `ssh -N -L 18081:127.0.0.1:18081 <user>@192.168.1.50`
  then open the same URL locally. `https://<server>/dbadmin` via gateway stays
  `403` by explicit policy for every client.
- MongoDB port is **not published** — there is no direct DB access from the LAN.

## Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Browser cert warning (LAN) | `ca.crt` not installed on that PC → install into Trusted Root once (Firefox: enable `security.enterprise_roots.enabled`); outsiders always warn (bare IP, expected) |
| Signed in, then immediately logged out / API 401 | `NODE_ENV=production` serves `secure` cookies → plain-HTTP access; always use `https://` |
| API calls fail / CORS errors | `CLIENT_ORIGIN` allowlist doesn't include the URL in the address bar (each entry needs scheme+host, comma-separated for dual LAN+public) |
| File upload fails | `client_max_body_size` (nginx, 20m) or API 10 MB cap; check `docker compose logs api` |
| Bell badge doesn't update live | Socket push down — check `wss`/`/socket.io/` reaches api (nginx `Upgrade` headers; ad-blockers/VPNs sometimes block WS). Bell still refreshes every 60s via REST fallback, so nothing is lost |
| Late sign-in modal (`You signed in after 9:45`) | Working-day login after 09:45 IST requires a late reason (`PATCH /api/attendance/reason`); Sundays/holidays exempt — fill the reason and continue |
| Sign-out blocked (man-hour / attendance reason) | Engineer/Drafter + Coordinator need today's hours (`My work` / `My coordination`); late (>09:45) or short (<8h) days need a reason on the sign-out modal — not an error |
| Uploaded file 404 after redeploy | Uploads bind broken (`HOST_UPLOADS_DIR` wrong / `D:\` unshared) — files went to the container layer; fix mount, restore from backup |
| `mongo` unhealthy | Wrong `MONGO_ROOT_*` (special chars must be URL-encoded); check `docker compose logs mongo` |
| `/dbadmin` 403 via gateway | Expected: gateway explicitly blocks DB admin for every client → use the temporary profile and loopback `http://127.0.0.1:18081/dbadmin/` on the server or SSH tunnel |
| `/dbadmin` on gateway | Always blocked; temporary maintenance uses loopback and mongo-express basic authentication |
| `down -v` was run | Database volume DELETED (named volume, not a bind) — restore from the newest backup pair per `BACKUP_RESTORE.md`. Uploads (host bind) survive; the DB does not. Never run `down -v` / `volume prune` again without a verified backup |
| Backup/restore aborts on `CLIENT_ORIGIN` | Root `.env` holds development (`localhost`) values — likely copied from `api/.env`; refill it from `.env.example` with production values |

## What NOT to do

- Never commit `.env`, `certs/*.{crt,key}`, or `gateway/.htpasswd`.
- Never store files in `api/uploads/` on the server — that path is the dev
  default; production writes to the mounted `/data/uploads` (host `D:\`).
