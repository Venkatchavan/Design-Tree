#!/usr/bin/env sh
# Import the final Bengaluru employee list + team hierarchy into the running stack.
# Run on the machine that runs Docker, after:  git pull && docker compose up -d --build
#
#   sh scripts/import-blr-employees.sh                       # dry run, writes nothing
#   sh scripts/import-blr-employees.sh --apply               # writes
#   sh scripts/import-blr-employees.sh --apply --file "/path/updated list.xlsx"   # add emails received later
#   sh scripts/import-blr-employees.sh --branch "DT-Bengaluru"                     # only if the dry run asks
#   PASSWORD=... sh scripts/import-blr-employees.sh --apply   # initial password for NEW logins (default designtree@123)
#
# Existing employees, logins, roles, passwords and filled fields are never
# duplicated or overwritten; re-running is safe.
set -eu
cd "$(dirname "$0")/.."

docker info >/dev/null 2>&1 || { echo 'Docker is not running. Start Docker first.' >&2; exit 1; }
[ -n "$(docker ps --filter 'name=^designtree-api$' --filter 'status=running' --format '{{.Names}}')" ] \
  || { echo 'designtree-api is not running. Start the stack first: docker compose up -d --build' >&2; exit 1; }
docker compose exec -T api test -f src/scripts/import-blr-employees.js \
  || { echo 'The API image is out of date. Rebuild it first: docker compose up -d --build api' >&2; exit 1; }

MODE=--dry-run
ARGS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) MODE=--apply ;;
    --dry-run) MODE=--dry-run ;;
    --file)
      [ -f "$2" ] || { echo "File not found: $2" >&2; exit 1; }
      docker cp "$2" designtree-api:/tmp/blr-employee-update.xlsx
      ARGS="$ARGS --file /tmp/blr-employee-update.xlsx"; shift ;;
    --branch) BRANCH="$2"; shift ;;
    *) echo "Unknown option $1" >&2; exit 1 ;;
  esac
  shift
done

BLR_INITIAL_PASSWORD="${PASSWORD:-designtree@123}"
[ ${#BLR_INITIAL_PASSWORD} -ge 8 ] || { echo 'Password must be at least 8 characters.' >&2; exit 1; }
export BLR_INITIAL_PASSWORD
if [ -n "${BRANCH:-}" ]; then
  # shellcheck disable=SC2086
  exec docker compose exec -T -e BLR_INITIAL_PASSWORD api node src/scripts/import-blr-employees.js $MODE $ARGS --branch "$BRANCH"
fi
# shellcheck disable=SC2086
exec docker compose exec -T -e BLR_INITIAL_PASSWORD api node src/scripts/import-blr-employees.js $MODE $ARGS
