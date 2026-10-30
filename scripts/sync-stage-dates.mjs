// API and web have independent Docker contexts; generate both from one source.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const banner = '// Generated from shared/stageDates.js. Run node scripts/sync-stage-dates.mjs; do not edit this copy.\n';
const source = banner + (await readFile(resolve(root, 'shared/stageDates.js'), 'utf8'));
for (const target of ['api/src/utils/stageDates.js', 'web/src/lib/stageTimeline.js']) {
  if (process.argv.includes('--check')) {
    if ((await readFile(resolve(root, target), 'utf8')) !== source) throw new Error(`Stale generated stage dates: ${target}`);
  } else await writeFile(resolve(root, target), source);
}
