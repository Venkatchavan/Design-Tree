# Backup & restore — manual, command-driven (by design)

No scheduler runs backups. A person runs `backup.ps1` — weekly, and always
**before** upgrades, `-v`/prune operations, or risky changes. Both scripts
live in `scripts/` and read paths from the root `.env`. Both abort if
`CLIENT_ORIGIN` looks like localhost (wrong `.env` — refill root `.env`
from `.env.example` with production values).

## What a backup contains

`.\scripts\backup.ps1` (repo root, PowerShell) produces one timestamped pair:

- `E:\DesignTree\backup\mongo\<yyyyMMdd-HHmmss>.gz` — full `mongodump --gzip` archive,
  written straight into the mongo container's `/backups` bind (no temp copies).
- `E:\DesignTree\backup\uploads\<yyyyMMdd-HHmmss>\` — versioned `/MIR` copy of the live
  uploads dir (`D:\designtree-uploads`).

The script prints both locations, the dump size, and the file count. Keep the
last ~8 weekly pairs in `E:\DesignTree\backup` plus a monthly copy off-machine
(external disk); delete anything older to bound disk use. `robocopy` exits 0–7
count as success; the script treats 8+ as failure.

## Why this shape

- Uploads already live on a host bind, so even `docker compose down -v`
  or `docker volume prune` cannot delete them. The versioned copy additionally
  protects against *content* damage (accidental delete/overwrite), which a
  bind mount alone does not.
- The database lives in the NAMED VOLUME `designtree_mongo-data` — `down -v` /
  `volume prune` WOULD delete it (compose removes named volumes). The dump
  archive protects against content damage, host-disk failure, AND volume
  deletion. Hence the runbook rule below.

## Restore (interactive, cannot run by accident)

```powershell
.\scripts\restore.ps1 -Backup 20260117-103000
```

It verifies both artifacts exist, asks you to type `RESTORE`, then
`mongorestore --drop` (replaces live collections) and mirrors the uploads
snapshot back. Afterwards: `docker compose restart api`, sign in, open a
meeting with attachments, confirm counts. Procedure detail is echoed by the
script itself — follow it.

## Runbook rules

1. **`down -v` and `volume prune` DELETE the database volume** (named volume,
   not a bind) — never run either without a verified backup. Uploads (host
   bind) survive them; the DB does not.
2. **Restore drill quarterly:** pick the newest pair, restore to a scratch
   check (or off-hours), verify, note the result. An untested backup is not
   a backup.
3. **Before every upgrade:** backup → upgrade → smoke-test (sign-in, one upload,
   one download) → keep the pre-upgrade pair until the next cycle.
