# DesignTree — Datum workspace

Role-based workspace for DesignTree Service Consultants: project delivery,
coordination, billing, HR, work tracking, transmittals, meetings and more.
Single source of truth for roles/navigation is
`api/src/config/roles.js` (served to the SPA via `GET /api/meta/bootstrap`).

## Repos & layout

| Path | What it is |
|---|---|
| `api/` | Express 5 + Mongoose API (`node server.js`, default `:5000`). Routes in `api/src/routes/`, logic in `api/src/controllers/`, models in `api/src/models/` |
| `web/` | React 19 + Vite SPA (dev `:5173`, `/api` + `/socket.io` proxied to `:5000` in dev). See `web/README.md` |
| `gateway/` | nginx reverse proxy + TLS + `/dbadmin` gates (production). `gateway/nginx.conf` |
| `scripts/` | Manual `backup.ps1` / `restore.ps1` (production data safety) |
| `docs/` | Deployment, operations, backup and environment guides |
| `e2e/` | Playwright UI + API suite (serial `specs/01-09`, isolated `designtree-e2e` DB). See `e2e/README.md` |
| `project-reference/` | Source design mockup (not shipped in images) |
| `certs/` | TLS cert + key (host-local, never committed) |

## Roles & auth (summary)

- 27 login roles (`api/src/config/roles.js` `ROLE_KEYS`): directors
  (`founding_director`, `working_director`, `executive_director`,
  `associate_director`, `technical_director`, `assoc_technical_director`),
  `admin_billing`, `hr`, `superuser`, `design_mgmt_head`, `team_lead`,
  `coordinator`, `engineer_drafter`, `qs`, `qaqc`, `bim`, `gbs`, `marketing`,
  `finance`, function heads (`qaqc_head`, `bim_head`, `gbs_head`,
  `peer_review_head`, `qs_head`), `peer_reviewer`, plus external
  `client` / `architect`.
- Auth is HttpOnly cookie JWT (`POST /api/auth/login`, `GET /api/auth/me`,
  `POST /api/auth/logout`). The SPA renders only the nav/views from
  `GET /api/meta/bootstrap` for the signed-in role.
- Notable scoping: `superuser` sees HR only (provisioning account created by
  `npm run seed`); `client`/`architect` see the project portal (`/portal`)
  only; only `admin_billing` can create projects and manage branches;
  directors are read-only on projects. Engineers/drafters + coordinators hit
  a man-hour gate at sign-out; sign-in after 09:45 IST / sign-out before 8h
  needs a reason (Sundays/holidays exempt).
- Realtime bell via socket.io (`/socket.io/`, cookie-authenticated) with a
  60 s REST fallback.

## Quick start — local development

```powershell
# terminal 1 — api (local MongoDB via api/.env MONGO_URI)
cd api
Copy-Item .env.example .env   # then set JWT_SECRET + SEED_* for seed
npm install
npm run dev        # http://localhost:5000, health at /api/health

# terminal 2 — web
cd web
npm install
npm run dev        # http://localhost:5173, /api proxied to :5000
```

Seed once on an empty dev DB (creates/updates the `superuser` login only):

```powershell
cd api
npm run seed
```

End-to-end suite (isolated `designtree-e2e` DB, never production):

```powershell
cd e2e
Copy-Item .env.example .env   # set E2E_SU_PASSWORD = api SEED_PASSWORD
npm install
npx playwright install chromium
npm run test                  # api + web must already be running (see e2e/README.md)
```

## Production deployment (in-house Windows server, Docker)

```
browser ──443──▶ gateway ─┬─ /          SPA static files
                           ├─ /api/      api:5000 (cookie auth untouched)
                           ├─ /socket.io/ api:5000 (bell pushes, Upgrade headers)
                           └─ /dbadmin/  mongo-express (IP allowlist + basic-auth + app login)
```

Full run sheet: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
Day-to-day running: [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
Backups: [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md).
Every env var: [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).
Frontend guide: [`web/README.md`](web/README.md).
E2E guide: [`e2e/README.md`](e2e/README.md).

Short version (on the server, repo root):

```powershell
Copy-Item .env.example .env   # then fill in secrets
# ... place certs/server.crt + server.key in certs/, gateway/.htpasswd per docs ...
docker compose up -d --build
docker compose run --rm api npm run seed   # one-shot superuser login (upsert, safe to re-run)
```

Expect `docker compose ps` to show `mongo` + `api` as `healthy` and
`gateway` + `dbadmin` as `running`.

## Data safety rules (read before touching docker)

1. Uploads live on the **host HDD bind** (`D:\designtree-uploads`), never inside
   containers or images — they survive rebuilds *and* volume deletion.
   API cap is 10 MB per file; nginx allows 20 MB.
2. MongoDB lives in the **host bind** `C:\DesignTree\mongo-data` — it survives
   container removal/rebuild *and* `down -v` / `volume prune` (compose never
   deletes bind-mounted host paths).
3. Back up with `.\scripts\backup.ps1` before every upgrade (binds protect
   against volume deletion, not content damage — manual by design).
