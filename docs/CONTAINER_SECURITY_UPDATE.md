# Container security update — 23 October 2026

Prepared on `codex/docker-security-refresh`, based on `dev/vishwa` commit
`32ef0ff2ae4e9920f647f8d20be9a59c8b15b4a8`. These are local changes for
review. No production server, host Docker installation or remote branch was changed.

## Changes

| Component | Updated version | Implementation |
| --- | --- | --- |
| API and web build runtime | Node 22.23.4 on Alpine | Exact multi-platform image digest in both Dockerfiles |
| Gateway | Nginx 1.30.6 on Alpine | Exact multi-platform image digest |
| Database | MongoDB 7.0.45 | Exact image digest; stays on database major 7 |
| Spreadsheet parser | SheetJS 0.20.3 | Official CDN tarball in both package manifests; SHA512 integrity in both lockfiles |
| API runtime tooling | npm, npx, Corepack and Yarn removed | Dependencies install in a separate build stage; final runtime starts with `node` |
| Database admin | Explicit `dbadmin` Compose profile | Legacy stable image pinned; excluded from default deployments; gateway always returns 403 |

The application libraries pass npm's current advisory checks. The new API and
gateway runtime images also have no findings in the recorded Trivy scan.
This is a scan result at a point in time, not a guarantee against future issues.

The MongoDB vendor image still has scanner findings in its bundled `gosu`,
MongoDB Database Tools, `js-yaml` and Ubuntu packages. The recorded scan has
1 critical, 68 high, 171 medium, 27 low and 9 unknown findings, including
repeated Go-library findings across separate tools. Exploitability through
this application's request paths has not been established. The critical
finding is in the Go runtime bundled with `gosu`, not a confirmed database
server exploit. These remaining findings require review before production
promotion; the stack is not certified vulnerability-free.

The optional mongo-express 1.0.2 image still uses unsupported Node 18.
Its default-off profile avoids silently deploying that runtime. A maintained
replacement remains future work. Never enable it as a public-facing service.

## Local verification

The images were built and run as `linux/amd64`, matching the company's expected
Docker Desktop Linux-container deployment. Tests used a separate Compose
project, fresh named volumes, temporary credentials, a disposable TLS
certificate and loopback-only ports. No production `.env`, database, upload
folder or certificate supplied the tests.

- Both Docker builds passed, including the production web/PWA build.
- MongoDB and API became healthy. Nginx accepted the TLS and proxy configuration.
- API production and frontend/build-tool npm audits reported zero vulnerabilities.
- Trivy 0.76.1 scanned the exact final image contents. The API and gateway
  have zero reported vulnerabilities; the MongoDB residual findings above remain.
- New spreadsheet tests exercised real XLSX, legacy XLS and CSV project
  imports, invalid-row handling, transmittal preview and XLSX export.
- Real-browser checks covered secure HttpOnly-cookie login, authenticated
  WebSockets, live notifications, announcement acknowledgment, frontend
  spreadsheet parsing, upload/download, and blocked gateway database admin.
- Upload and database survival were checked across API/database restarts.
- The existing workflow suite has a known pre-existing Associate Technical
  Director QS navigation assertion: its test expects `qs-log`, while the
  unchanged role registry supplies `qs-head`. This update does not change
  that policy or mask the failure. Two memory-fixture-only tests are skipped
  when using the external container fixture.

The detailed machine-readable results and logs are saved outside Git in
`../security-review-2026-10-23/verification/` in the shared workspace.

### Repeating the checks

1. Build the verification tags from the repository root:

   ```sh
   docker build --platform linux/amd64 --pull -t designtree-api:security-review api
   docker build --platform linux/amd64 --pull -t designtree-gateway:security-review -f gateway/Dockerfile .
   ```

2. Create a private temporary environment file with `VERIFY_DB_PASSWORD`,
   `VERIFY_JWT_SECRET`, and `VERIFY_CERTS_DIR`. Use hex secrets so the test
   MongoDB URI needs no extra escaping. The certificate directory must contain
   disposable `server.crt` and `server.key` files for `localhost`/`127.0.0.1`.
   Default loopback ports are 19443 (HTTPS) and 19500 (API).
3. Start only the separate verification file with an explicit project name:

   ```sh
   docker compose --env-file /absolute/path/verify.env -p designtree-security-review -f docker-compose.verify.yml up -d --wait
   ```

4. Run `node /checks/container-fixture.mjs` with `compose exec -T api` to seed
   the empty verification database. Save its JSON output privately. It
   contains temporary test credentials, not a report. The script refuses a
   non-verification database or an already seeded one.
5. Provide that JSON file as `TEST_FIXTURE_FILE` to the existing
   `node --test e2e/required-workflows.test.mjs` suite. For the in-container
   spreadsheet tests, change the fixture base to `http://127.0.0.1:5000`,
   copy it into the test container readable by user `node`, and run
   `node --test /checks/container-spreadsheets.test.mjs` with its file path
   in `TEST_FIXTURE_FILE`.
6. Run `node e2e/container-browser.mjs` on the test host with private
   `TEST_FIXTURE_FILE`, `TEST_PERSISTENCE_FILE`, `TEST_CERTIFICATE`, and
   `TEST_ARTIFACT_DIR` paths. Optionally set `CHROMIUM_EXECUTABLE`.
   The browser exception trusts only the disposable certificate's public key.
   After restarting the test API/database, run it again with
   `VERIFY_RESTART_CHECK_ONLY=1` to check the uploaded file.
7. Tear down that explicit verification project, removing only its temporary
   volumes. Never run the verification commands against `docker-compose.yml`
   or the production project name.

## Production review and rollout

Review the remaining MongoDB image findings and the known navigation failure
before scheduling promotion. Assess the company host's Docker Desktop/Engine
version separately; updating application images does not update the host or
its certificate trust. The Docker Desktop 4.96.3 release includes the recent
eMudhra trust changes, but the actual company host version was not inspected.

Once the reviewed patch is committed and transferred to the company checkout:

1. Follow `BACKUP_RESTORE.md` and verify the database and upload backup pair.
   Record the current application image IDs, MongoDB image ID, source commit
   and host mount settings for rollback.
2. Stop any already-running legacy admin container explicitly:
   `docker compose stop mongo-express`. A newly disabled profile does not
   guarantee that an older container has stopped.
3. Pull/build the reviewed, pinned images:

   ```powershell
   docker compose pull mongo
   docker compose build --pull api gateway
   docker compose up -d mongo api gateway
   docker compose ps
   ```

4. Verify `/api/health`, sign-in with real test roles, the project list,
   spreadsheet imports, upload/download, live bell delivery and both LAN/WAN
   origins. Confirm `/dbadmin` and `/dbadmin/` return 403. Retain old images
   and the backup until the review period has finished.
5. If initialization is actually required, use
   `docker compose run --rm api node src/scripts/seed.js`; the production
   runtime intentionally has no npm executable.

The database remains the existing `designtree_mongo-data` named volume and
uploads remain the existing host bind. Do not remove either or change the
database major version during this patch rollout. If reverting MongoDB is
necessary, follow its supported downgrade/restore procedure with the saved
backup; do not blindly start an older database binary against the live files.

## Sources

- [Node October security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Nginx security advisories](https://nginx.org/en/security_advisories.html)
- [MongoDB 7.0 patch release notes](https://www.mongodb.com/docs/v7.0/release-notes/7.0/)
- [Official SheetJS installation source](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
- [Docker Desktop release notes](https://docs.docker.com/desktop/release-notes/)
- [gosu security guidance](https://github.com/tianon/gosu/security)
