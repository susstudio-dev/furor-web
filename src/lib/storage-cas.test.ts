import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { readDocWithVersion, writeDocIfMatch } from './storage';

// Integration test against the real filesystem backend (NODE_ENV is not
// 'production' under vitest, so storage resolves to `data/`). This is the
// behaviour the whole concurrency story rests on, so it is exercised for real
// rather than mocked.

const KEY = 'cas-integration-test.json';
const DATA_DIR = path.join(process.cwd(), 'data');

async function cleanup() {
  await fs.rm(path.join(DATA_DIR, KEY), { force: true });
  await fs.rm(path.join(DATA_DIR, '.meta', `${KEY}.json`), { force: true });
}

// Storage resolves to the repo's data/ directory, so the scratch document is
// removed after every test AND once more at the end, in case a run is
// interrupted between them.
afterEach(cleanup);
afterAll(cleanup);

describe('compare-and-swap against the filesystem backend', () => {
  it('returns null for a document that does not exist', async () => {
    expect(await readDocWithVersion(KEY)).toBeNull();
  });

  it('round-trips a document and increments the revision', async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, KEY), '{"n":1}', 'utf8');

    const first = await readDocWithVersion(KEY);
    expect(first?.version.rev).toBe(0); // pre-versioning document

    const written = await writeDocIfMatch(KEY, '{"n":2}', first!.version);
    expect(written?.rev).toBe(1);

    const second = await readDocWithVersion(KEY);
    expect(second?.text).toBe('{"n":2}');
    expect(second?.version.rev).toBe(1);
    expect(second?.version.lineage).toBe(first!.version.lineage);
  });

  // The lost update this whole design exists to prevent.
  it('refuses a second write based on the same stale version', async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, KEY), '{"n":1}', 'utf8');

    const base = (await readDocWithVersion(KEY))!.version;

    const a = await writeDocIfMatch(KEY, '{"n":"from A"}', base);
    expect(a).not.toBeNull();

    // B loaded the same base as A and saves afterwards: it must lose, not
    // silently overwrite A.
    const b = await writeDocIfMatch(KEY, '{"n":"from B"}', base);
    expect(b).toBeNull();

    expect((await readDocWithVersion(KEY))?.text).toBe('{"n":"from A"}');
  });

  it('starts a new lineage on request, so stale version tokens cannot match', async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, KEY), '{"n":1}', 'utf8');

    const base = (await readDocWithVersion(KEY))!.version;
    const restored = await writeDocIfMatch(KEY, '{"n":"restored"}', base, { lineage: 'L-new' });

    expect(restored?.lineage).toBe('L-new');
    expect(restored?.rev).toBe(base.rev + 1);
  });
});
