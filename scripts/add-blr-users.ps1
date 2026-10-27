# Adds the BLR employees as logins (password designtree@123).
# Run with Docker Desktop and the stack (docker compose up -d) running.
# Existing emails are skipped.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\add-blr-users.ps1

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

$source = Join-Path $root 'api\src\scripts\add-blr-users.js'
docker cp $source designtree-api:/app/src/scripts/add-blr-users.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

docker compose exec api node src/scripts/add-blr-users.js
exit $LASTEXITCODE
