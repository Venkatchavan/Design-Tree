# DesignTree — Datum workspace

Role-based workspace for DesignTree Service Consultants: project delivery,
coordination, billing, HR, work tracking, transmittals, meetings and more.
See `REQUIREMENT.md` for the consolidated functional specification.

## Repos & layout

| Path | What it is |
|---|---|
| `api/` | Express + Mongoose API (`node server.js`, default `:5000`) |
| `web/` | React + Vite SPA (dev `:5173`, proxied `/api` in dev) |
| `gateway/` | nginx reverse proxy + TLS + `/dbadmin` gates (production) |
| `scripts/` | Manual `backup.ps1` / `restore.ps1` (production data safety) |
| `docs/` | Deployment, operations, backup and environment guides |
| `project-reference/` | Source design/docs (not shipped in images) |
| `certs/` | TLS cert + key (host-local, never committed) |

## Quick start — local development (unchanged)

```powershell
# terminal 1
cd api
npm install
npm run dev        # needs MONGO_URI in api/.env (local MongoDB)

# terminal 2
cd web
npm install
npm run dev        # http://localhost:5173, /api proxied to :5000
```

## Production deployment (in-house Windows server, Docker)

```
browser ──443──▶ gateway ─┬─ /          SPA static files
                           ├─ /api/      api:5000 (cookie auth untouched)
                           └─ /dbadmin/  mongo-express (Founding Director only)
```

Full run sheet: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
Day-to-day running: [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
Backups: [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md).
Every env var: [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

Short version (on the server, repo root):

```powershell
Copy-Item .env.example .env   # then fill in secrets
# ... place certs/server.crt + server.key in certs/, gateway/.htpasswd per docs ...
docker compose up -d --build
docker compose run --rm api npm run seed   # one-shot superuser login
```

## Data safety rules (read before touching docker)

1. Uploads live on the **host HDD bind** (`D:\designtree-uploads`), never inside
   containers or images — they survive rebuilds *and* volume deletion.
2. MongoDB lives in the `mongo-data` named volume (on C:/SSD) — survives
   container removal/rebuild, but is **deleted by `down -v` / `volume prune`**.
3. Tear down with `docker compose down` (keeps volumes). **Never `-v`.**
4. Back up with `.\scripts\backup.ps1` before every upgrade (manual by design).
