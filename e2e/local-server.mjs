import { writeFile } from 'node:fs/promises';
import { startLocalFixture } from './local-fixture.mjs';
const fixture = await startLocalFixture(Number(process.env.TEST_API_PORT || 5000));
const { models, stop, ...state } = fixture;
const path = process.env.TEST_FIXTURE_FILE || '/tmp/designtree-local-fixture.json';
await writeFile(path, JSON.stringify(state), { mode: 0o600 });
console.log(`Isolated local test API ready: ${fixture.base}; fixture saved for tests.`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await stop(); process.exit(0); });
