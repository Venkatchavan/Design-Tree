# Import the final Bengaluru employee list + team hierarchy into the running stack.
# Run from any folder on the machine that runs Docker, after:
#   git pull ; docker compose up -d --build
#
#   .\scripts\import-blr-employees.ps1                 # dry run: shows what would change, writes nothing
#   .\scripts\import-blr-employees.ps1 -Apply          # writes
#   .\scripts\import-blr-employees.ps1 -Apply -File "D:\updated list.xlsx"   # add emails received later
#   .\scripts\import-blr-employees.ps1 -Branch "DT-Bengaluru"                 # only if the dry run asks for it
#
# Existing employees, logins, roles, passwords and filled fields are never
# duplicated or overwritten; re-running is safe. New logins get -Password.
param(
  [switch]$Apply,
  [string]$File,
  [string]$Branch,
  [string]$Password = 'designtree@123'
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Error 'Docker is not running. Start Docker first.'; exit 1 }

$running = docker ps --filter 'name=^designtree-api$' --filter 'status=running' --format '{{.Names}}'
if (-not $running) { Write-Error 'designtree-api is not running. Start the stack first: docker compose up -d --build'; exit 1 }

docker compose exec -T api test -f src/scripts/import-blr-employees.js
if ($LASTEXITCODE -ne 0) { Write-Error 'The API image is out of date. Rebuild it first: docker compose up -d --build api'; exit 1 }

if ($Password.Length -lt 8) { Write-Error 'Password must be at least 8 characters.'; exit 1 }

$scriptArgs = @(if ($Apply) { '--apply' } else { '--dry-run' })
if ($File) {
  if (-not (Test-Path -LiteralPath $File)) { Write-Error "File not found: $File"; exit 1 }
  docker cp "$File" designtree-api:/tmp/blr-employee-update.xlsx
  if ($LASTEXITCODE -ne 0) { exit 1 }
  $scriptArgs += @('--file', '/tmp/blr-employee-update.xlsx')
}
if ($Branch) { $scriptArgs += @('--branch', $Branch) }

$env:BLR_INITIAL_PASSWORD = $Password
docker compose exec -T -e BLR_INITIAL_PASSWORD api node src/scripts/import-blr-employees.js @scriptArgs
$code = $LASTEXITCODE
Remove-Item Env:\BLR_INITIAL_PASSWORD
exit $code
