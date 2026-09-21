// One command for the whole suite, headless, so nothing steals the screen.
//
//   node tools/run-e2e.mjs            # both sites
//   node tools/run-e2e.mjs netflix    # fixtures only, works offline
//   node tools/run-e2e.mjs youtube    # the live YouTube suite
//
// Packs a copy of the extension that also matches localhost, starts the fixture
// server, launches a throwaway headless Brave with that copy loaded, runs the
// suites against it and tears everything down again. Never touches the real
// browser profile.

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rm, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CT_FIXTURE_PORT || 8787);
const BRAVE =
  process.env.CT_BRAVE || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const which = (process.argv[2] || 'all').toLowerCase();
const wantNetflix = which === 'all' || which === 'netflix';
const wantYoutube = which === 'all' || which === 'youtube';

const kids = [];
let profile = null;

function bg(cmd, args, name) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => process.env.CT_VERBOSE && process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.env.CT_VERBOSE && process.stderr.write(`[${name}] ${d}`));
  kids.push(child);
  return child;
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function waitForCdp() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const list = await res.json();
      if (list.some((t) => t.type === 'page')) return true;
    } catch (err) {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function cleanup() {
  // Kill by pid and tree, never by image name. Brave forks a pile of child
  // processes and a blanket taskkill would take the real browser with it.
  for (const child of kids) {
    if (!child.pid) continue;
    try {
      await promisify(execFile)('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true });
    } catch (err) {
      try {
        child.kill();
      } catch (err2) {
        /* already gone */
      }
    }
  }
  if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
}

const { stdout: packed } = await promisify(execFile)(process.execPath, [join(HERE, 'pack-test-ext.mjs')]);
const ext = packed.trim();
console.log('test extension:', ext);

bg(process.execPath, [join(HERE, 'fixture-server.mjs')], 'fixtures');

profile = await mkdtemp(join(tmpdir(), 'couchtube-e2e-'));
bg(
  BRAVE,
  [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${profile}`,
    `--load-extension=${ext}`,
    `--disable-extensions-except=${ext}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1600,900',
    `http://localhost:${PORT}/browse`,
  ],
  'brave'
);

if (!(await waitForCdp())) {
  console.error('Brave never opened a debuggable page');
  await cleanup();
  process.exit(1);
}

let failed = 0;

if (wantNetflix) {
  console.log('\n=== netflix (fixtures) ===');
  failed += await run(process.execPath, [join(HERE, 'e2e-netflix.mjs')]);
}

if (wantYoutube) {
  console.log('\n=== youtube (live) ===');
  // e2e.mjs attaches to a page whose url already says youtube, so send the tab
  // there before handing over.
  const { connect, sleep } = await import('./cdp.mjs');
  const s = await connect(wantNetflix ? 'localhost' : '');
  await s.navigate('https://www.youtube.com/');
  await sleep(2500);
  s.close();
  failed += await run(process.execPath, [join(HERE, 'e2e.mjs')]);
}

await cleanup();
process.exit(failed ? 1 : 0);
