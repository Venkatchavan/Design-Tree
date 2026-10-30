// Generate service-local copies so api and web retain their isolated Docker contexts.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const banner =
  '// Generated from shared/travelBooking.js. Run node scripts/sync-travel-booking.mjs; do not edit this copy.\n';
const source =
  banner + (await readFile(resolve(root, 'shared/travelBooking.js'), 'utf8'));
for (const target of [
  'api/src/utils/travelBooking.js',
  'web/src/lib/travelBooking.js',
]) {
  if (process.argv.includes('--check')) {
    if ((await readFile(resolve(root, target), 'utf8')) !== source)
      throw new Error(`Stale generated travel utility: ${target}`);
  } else await writeFile(resolve(root, target), source);
}
