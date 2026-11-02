// The API and web use independent container build contexts.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source = '// Generated from shared/workHours.js. Run node scripts/sync-work-hours.mjs; do not edit this copy.\n' + await readFile(resolve(root, 'shared/workHours.js'), 'utf8');
for (const target of ['api/src/utils/workHours.js', 'web/src/lib/workHours.js']) {
  if (process.argv.includes('--check')) {
    if (await readFile(resolve(root, target), 'utf8') !== source) throw new Error(`Stale work hours utility: ${target}`);
  } else await writeFile(resolve(root, target), source);
}
