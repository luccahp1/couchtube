// Copies the extension somewhere temporary and teaches the copy that localhost
// counts as Netflix, so the fixture server can be driven through the real
// extension: real isolated world, real MAIN world script, real service worker.
//
//   node tools/pack-test-ext.mjs   # prints the folder to hand to --load-extension
//
// The shipped manifest stays clean. Only two things change in the copy, both
// narrow enough that the suite still asserts on real behaviour: the match
// patterns, and the hostname test in the Netflix adapter.

import { cp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = dirname(HERE);
const OUT = process.env.CT_TEST_EXT || join(tmpdir(), 'couchtube-test-ext');
const PORT = Number(process.env.CT_FIXTURE_PORT || 8787);
const LOCAL = `http://localhost:${PORT}/*`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const dir of ['src', 'popup', 'options', 'icons']) {
  await cp(join(SRC, dir), join(OUT, dir), { recursive: true });
}

const manifest = JSON.parse(await readFile(join(SRC, 'manifest.json'), 'utf8'));
for (const entry of manifest.content_scripts) entry.matches.push(LOCAL);
for (const entry of manifest.web_accessible_resources) entry.matches.push(LOCAL);
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

const nf = await readFile(join(SRC, 'src', 'nf.js'), 'utf8');
const patched = nf.replace(
  'handles: (host) => /(^|\\.)netflix\\.com$/.test(host),',
  'handles: (host) => /(^|\\.)netflix\\.com$/.test(host) || host === \'localhost\','
);
if (patched === nf) {
  console.error('could not find the hostname test in src/nf.js, the copy will not claim localhost');
  process.exitCode = 1;
}
await writeFile(join(OUT, 'src', 'nf.js'), patched);

console.log(OUT);
