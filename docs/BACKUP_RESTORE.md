# Backup & restore — manual, command-driven (by design)

No scheduler runs backups. A person runs `backup.ps1` — weekly, and always
**before** upgrades, `-v`/prune operations, or risky changes. Both scripts
live in `scripts/` and read paths from the root `.env`.

## What a backup contains

`.\scripts\backup.ps1` (repo root, PowerShell) produces one timestamped pair:

- `D:\backups\mongo\<yyyyMMdd-HHmmss>.gz` — full `mongodump --gzip` archive,
  written straight into the mongo container's `/backups` bind (no temp copies).
- `D:\backups\uploads\<yyyyMMdd-HHmmss>\` — versioned `/MIR` copy of the live
  uploads dir (`D:\designtree-uploads`).

The script prints both locations, the dump size, and the file count. Keep the
last ~8 weekly pairs on `D:\` plus a monthly copy off-machine (external disk);
delete anything older to bound disk use.

## Why this shape

- Uploads already live on the host HDD bind, so even `docker compose down -v`
  or `docker volume prune` cannot delete them. The versioned copy additionally
  protects against *content* damage (accidental delete/overwrite), which a
  bind mount alone does not.
- The database lives in the `mongo-data` named volume (fast, stable on
  Windows) — and a named volume **is** deleted by `down -v`/prune. The dump
  archive is its only protection. Hence the runbook rule below.

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

1. **Tear down with `docker compose down`. Never `-v`.** `down -v` and
   `volume prune` delete the database volume; only a fresh backup makes that safe.
2. **Restore drill quarterly:** pick the newest pair, restore to a scratch
   check (or off-hours), verify, note the result. An untested backup is not
   a backup.
3. **Before every upgrade:** backup → upgrade → smoke-test (sign-in, one upload,
   one download) → keep the pre-upgrade pair until the next cycle.
