# Audit BLR logins by default. Rebuild/recreate the API image before use.
# Use -Apply only after reviewing the audit. New-joiner emails remain pending.
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Docker is not running. Start Docker Desktop first.'
  exit 1
}

$running = docker ps --filter 'name=^designtree-api$' --filter 'status=running' --format '{{.Names}}'
if (-not $running) {
  Write-Error 'designtree-api is not running. Start the stack first: docker compose up -d'
  exit 1
}

# Use the rebuilt API image: the importer now includes shared audit and roster modules.
# Existing accounts are preserved; default execution only audits.
if ($Apply -and -not $env:BLR_INITIAL_PASSWORD) {
  Write-Error 'Set BLR_INITIAL_PASSWORD before using -Apply.'
  exit 1
}

if ($Apply) {
  docker compose exec -e BLR_INITIAL_PASSWORD api node src/scripts/add-blr-users.js --apply
} else {
  docker compose exec api node src/scripts/add-blr-users.js --dry-run
}
exit $LASTEXITCODE
