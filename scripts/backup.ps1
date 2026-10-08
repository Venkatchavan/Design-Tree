# DesignTree manual backup -- run from the repo root on the server:
#     .\scripts\backup.ps1
# Produces a timestamped pair under the host backup dir (default D:\backups):
#   mongo\<timestamp>.gz      database archive (mongodump, gzip)
#   uploads\<timestamp>\      versioned copy of D:\designtree-uploads
# See docs/BACKUP_RESTORE.md for cadence, retention and restore steps.
param(
  [string]$ComposeFile = "docker-compose.yml"
)

$ErrorActionPreference = "Stop"

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    $t = $line.Trim()
    if ($t -eq "" -or $t.StartsWith("#")) { continue }
    $i = $t.IndexOf("=")
    if ($i -lt 1) { continue }
    $map[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
  }
  return $map
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$env_map = Read-DotEnv (Join-Path $Root ".env")
$backupsRoot = $env_map["HOST_BACKUPS_DIR"]
if (-not $backupsRoot) { $backupsRoot = "D:/backups" }
$backupsRootWin = $backupsRoot -replace "/", "\"
$uploadsDir = $env_map["HOST_UPLOADS_DIR"]
if (-not $uploadsDir) { $uploadsDir = "D:/designtree-uploads" }
$uploadsDirWin = $uploadsDir -replace "/", "\"

$mongoUser = $env_map["MONGO_ROOT_USER"]
$mongoPass = $env_map["MONGO_ROOT_PASSWORD"]
if (-not $mongoUser -or -not $mongoPass) {
  throw "MONGO_ROOT_USER / MONGO_ROOT_PASSWORD not found in .env - cannot authenticate mongodump."
}

# Guard against deploying/operating with development values: the production
# .env must never be a copy of api/.env (localhost Mongo/origin).
$origin = $env_map["CLIENT_ORIGIN"]
if ($origin -match "localhost|127\.0\.0\.1") {
  throw "CLIENT_ORIGIN is '$origin' - this looks like api/.env (development) values. Aborting: use the production root .env."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$mongoDir = Join-Path $backupsRootWin "mongo"
$uploadsDest = Join-Path (Join-Path $backupsRootWin "uploads") $stamp
New-Item -ItemType Directory -Path $mongoDir -Force | Out-Null
New-Item -ItemType Directory -Path $uploadsDest -Force | Out-Null

Write-Host "==> [1/2] Database dump -> $mongoDir\$stamp.gz"
& docker compose -f $ComposeFile exec -T mongo mongodump `
  --username $mongoUser --password $mongoPass --authenticationDatabase admin `
  --archive=/backups/mongo/$stamp.gz --gzip
if ($LASTEXITCODE -ne 0) { throw "mongodump failed (exit $LASTEXITCODE)." }

Write-Host "==> [2/2] Uploads copy  $uploadsDirWin -> $uploadsDest"
& robocopy $uploadsDirWin $uploadsDest /MIR /NFL /NDL /NJH /NJS
# robocopy exit codes 0-7 mean success (copied / extra files / mismatch tolerated).
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)." }

$dump = Get-Item (Join-Path $mongoDir "$stamp.gz")
$files = (Get-ChildItem -LiteralPath $uploadsDest -Recurse -File | Measure-Object).Count
Write-Host ""
Write-Host "Backup complete: $stamp"
Write-Host "  database : $($dump.FullName)  ($([math]::Round($dump.Length/1MB,1)) MB)"
Write-Host "  uploads  : $uploadsDest  ($files files)"
Write-Host "Spot-check with: Get-Item '$mongoDir\$stamp.gz'  (and practice restores per docs/BACKUP_RESTORE.md)"
