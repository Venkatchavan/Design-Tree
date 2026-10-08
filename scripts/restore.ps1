# DesignTree manual restore -- run from the repo root on the server:
#     .\scripts\restore.ps1 -Backup 20260117-103000
# Restores the pair created by .\scripts\backup.ps1:
#   1. database: mongorestore from D:\backups\mongo\<Backup>.gz (REPLACES live data)
#   2. uploads:  mirrored copy from D:\backups\uploads\<Backup>\ back to the live dir
# Interactive confirmation is required -- this cannot run by accident.
# Full procedure (stop order, verification): docs/BACKUP_RESTORE.md
param(
  [Parameter(Mandatory = $true)][string]$Backup,
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
  throw "MONGO_ROOT_USER / MONGO_ROOT_PASSWORD not found in .env - cannot authenticate mongorestore."
}

$dumpWin = Join-Path (Join-Path $backupsRootWin "mongo") "$Backup.gz"
$snapWin = Join-Path (Join-Path $backupsRootWin "uploads") $Backup
if (-not (Test-Path -LiteralPath $dumpWin)) { throw "Database archive not found: $dumpWin" }
if (-not (Test-Path -LiteralPath $snapWin)) { throw "Uploads snapshot not found: $snapWin" }

Write-Host "About to REPLACE live data with backup: $Backup" -ForegroundColor Red
Write-Host "  database : $dumpWin"
Write-Host "  uploads  : $snapWin  ->  $uploadsDirWin"
$answer = Read-Host "Type RESTORE to continue"
if ($answer -ne "RESTORE") { Write-Host "Aborted - nothing changed."; exit 0 }

Write-Host "==> [1/2] Restoring database (drops current collections first)..."
& docker compose -f $ComposeFile exec -T mongo mongorestore `
  --username $mongoUser --password $mongoPass --authenticationDatabase admin `
  --drop --archive=/backups/mongo/$Backup.gz --gzip
if ($LASTEXITCODE -ne 0) { throw "mongorestore failed (exit $LASTEXITCODE)." }

Write-Host "==> [2/2] Restoring uploads..."
& robocopy $snapWin $uploadsDirWin /MIR /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)." }

Write-Host ""
Write-Host "Restore complete. Restart the stack and verify sign-in + a file download:"
Write-Host "  docker compose -f $ComposeFile restart api"
Write-Host "See docs/BACKUP_RESTORE.md for the post-restore checklist."
