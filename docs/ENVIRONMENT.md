# Environment reference — production `.env` (repo root)

Copy `.env.example` to `.env` and fill every `REPLACE_WITH_…` value.
`.env` is git-ignored and also mounted into the api container
(`env_file`), so it is the single source of truth for deploy secrets.

## Variables

| Name | Required | Default | Example | What breaks if wrong |
|---|---|---|---|---|
| `NODE_ENV` | yes | `development` | `production` | `secure` cookies need `production`+TLS; dev values leak debug behaviour |
| `PORT` | no | `5000` | `5000` | Must match compose/gateway expectation (`api:5000`); change all three together or not at all |
| `VITE_API_URL` | no | `""` | *(empty)* | Keep empty: same-origin `/api`. Only set for split-domain hosting (not this deployment) |
| `CLIENT_ORIGIN` | yes | dev URL | `https://designtree.local` | CORS rejects browser calls; must equal the URL users type, `https` included |
| `HTTP_PORT` / `HTTPS_PORT` | no | `80` / `443` | `80` / `443` | Host port bindings for gateway |
| `JWT_SECRET` | yes | — | 64-char hex | App refuses to boot without it; rotating logs everyone out (by design) |
| `JWT_EXPIRES_IN` | no | `1d` | `1d` | Session lifetime |
| `COOKIE_NAME` | no | `token` | `token` | Must match across deploys or all sessions invalidate |
| `MONGO_ROOT_USER` / `MONGO_ROOT_PASSWORD` | yes | — | `dtadmin` / strong pw | Mongo + api + express all derive from these; password with `@ : / ? # [ ]` must be URL-encoded — safest is letters/digits/`_`-`-` |
| `HOST_UPLOADS_DIR` | yes | — | `D:/designtree-uploads` | Uploads bind mount; forward slashes in compose; folder must exist and be Docker-shared |
| `HOST_BACKUPS_DIR` | yes | — | `D:/backups` | `mongodump` archives land here; scripts read it too |
| `SEED_NAME` / `SEED_EMAIL` / `SEED_PASSWORD` | one-shot | — | FD details | `npm run seed` upserts the founding-director login; rotate the password in-app right after |
| `ME_CONFIG_BASICAUTH_USERNAME` / `_PASSWORD` | yes | — | FD-only creds | mongo-express login screen (gate 3 of 3 for `/dbadmin`) |
| `DBADMIN_USER` | doc | — | `founding-director` | Username baked into `gateway/.htpasswd` (nginx gate 2); keep identical to express user for sanity |
| `DBADMIN_ALLOW_IP` | doc | — | `192.168.1.50` | Reminder of the FD PC address mirrored in `gateway/nginx.conf` (nginx gate 1) |

## Notes

- `MONGO_URI` is **not** set in `.env` — compose assembles it from
  `MONGO_ROOT_*` (`...?authSource=admin`), so credentials exist in one place.
- `UPLOAD_DIR=/data/uploads` is fixed in `api/Dockerfile` (container path);
  the host side is `HOST_UPLOADS_DIR`. Do not set `UPLOAD_DIR` in `.env`.
- Generate secrets with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- Local development keeps using `api/.env` (localhost Mongo, dev origin) —
  the root `.env` is production-only and must never be copied back into `api/`.
