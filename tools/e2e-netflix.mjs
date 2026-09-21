// End-to-end suite for the Netflix adapter, run against tools/fixtures rather
// than netflix.com because the real site needs a login and this does not.
//
//   node tools/fixture-server.mjs          # terminal 1
//   node tools/pack-test-ext.mjs           # prints a folder
//   pwsh tools/dev-brave.ps1 -Fresh -Ext <that folder> -Url http://localhost:8787/browse
//   node tools/e2e-netflix.mjs             # terminal 2
//
// tools/run-netflix-e2e.mjs does all four in one go, headless.
//
// Everything here goes through the inject bridge, which is the same code path a
// real controller button takes, and asserts on the overlay's real DOM plus the
// call log of the stubbed Netflix player.

import { connect, sleep } from './cdp.mjs';

const BASE = process.env.CT_FIXTURE_URL || 'http://localhost:8787';

const STATE = `(() => {
  const host = document.getElementById('couchtube-root');
  if (!host) return { mounted: false };
  const sr = host.shadowRoot;
  const on = (sel) => { const n = sr.querySelector(sel); return n && n.classList.contains('on') ? n : null; };
  const ring = on('.ring');
  const r = ring ? ring.getBoundingClientRect() : null;
  const v = document.querySelector('.watch-video video');
  const slid = [...document.querySelectorAll('.slider-content')].map((n) => n.style.transform).filter(Boolean);
  return {
    mounted: true,
    ring: r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left) } : null,
    hints: on('.hints') ? on('.hints').innerText.replace(/\\s+/g,' ').trim() : null,
    hud: on('.hud') ? on('.hud').innerText.replace(/\\s+/g,' ').trim() : null,
    osd: on('.osd') ? on('.osd').innerText.replace(/\\s+/g,' ').trim() : null,
    osk: !!sr.querySelector('.panel.osk'),
    oskHead: (sr.querySelector('.panel.osk h2') || {}).textContent || null,
    menu: !!sr.querySelector('.panel.menu'),
    menuText: sr.querySelector('.panel.menu') ? sr.querySelector('.panel.menu').innerText.replace(/\\s+/g,' ') : null,
    status: on('.status') ? on('.status').innerText.replace(/\\s+/g,' ').trim() : null,
    url: location.pathname,
    time: v ? Math.round(v.currentTime) : null,
    duration: v && isFinite(v.duration) ? Math.round(v.duration) : null,
    volume: v ? Math.round(v.volume * 100) : null,
    muted: v ? v.muted : null,
    rate: v ? v.playbackRate : null,
    paused: v ? v.paused : null,
    bridge: document.documentElement.dataset.ctnfx || null,
    apiCalls: (window.nfxStub ? window.nfxStub.calls : []).map((c) => c[0]),
    track: window.nfxStub ? window.nfxStub.track : null,
    clicks: window.fixture ? window.fixture.clicks.slice() : [],
    slid,
  };
})()`;

// Run inside the extension's own world, where CT lives.
const CANDIDATES = `JSON.stringify({
  site: CT.site && CT.site.key,
  api: CT.site.hasApi(),
  total: CT.spatial.collect().length,
  offscreen: CT.spatial.collect().filter((c) => c.rect.right <= 0 || c.rect.left >= window.innerWidth).length,
  cards: document.querySelectorAll('.title-card').length,
})`;

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail !== undefined ? ' -> ' + JSON.stringify(detail) : ''}`);
  }
}

const s = await connect('localhost:8787');
const ctx = await s.isolatedContext('CouchTube');

console.log('\nbrowse mode');
await s.navigate(`${BASE}/browse`);
await sleep(1500);

let st = await s.eval(STATE);
check('content script mounted', st.mounted === true, st);
check('no ring before any input', st.ring === null, st);

let iso = JSON.parse(await s.eval(CANDIDATES, await s.isolatedContext('CouchTube')));
check('the Netflix adapter claimed the page', iso.site === 'netflix', iso);
check('the main world bridge is connected', iso.api === true, iso);
check('the fixture really does clip cards off screen', iso.cards > iso.total, iso);
check('no off-screen card is a focus candidate', iso.offscreen === 0, iso);

await s.press('down');
st = await s.eval(STATE);
check('ring appears on first press', st.ring !== null, st);
check('status chip says BROWSE', /BROWSE/.test(st.status || ''), st);

await s.press('down');
st = await s.eval(STATE);
check('focus reaches a title card', st.ring && st.ring.w > 120 && st.ring.h > 70, st);

console.log('\nrow paging');
await s.press('right', 7, 220);
await sleep(700);
st = await s.eval(STATE);
check('running out of row pages the slider', st.slid.length > 0, st.slid);
check('focus stays on a real card after paging', st.ring !== null && st.ring.w > 120, st);

iso = JSON.parse(await s.eval(CANDIDATES, await s.isolatedContext('CouchTube')));
check('still no off-screen candidates after paging', iso.offscreen === 0, iso);

console.log('\noverlays');
await s.press('x');
st = await s.eval(STATE);
check('keyboard opens', st.osk === true, st);
check('keyboard is branded for this site', /Search Netflix/.test(st.oskHead || ''), st.oskHead);
await s.press('back');

await s.press('start');
st = await s.eval(STATE);
check('controls sheet opens', st.menu === true, st);
check('controls sheet names Netflix', /Netflix home/.test(st.menuText || ''), st.menuText);
await s.press('back');

console.log('\nplayer mode');
await s.navigate(`${BASE}/watch/80100172`);
await sleep(2500);
await s.eval('window.nfxStub.reset(), 1');

// The first press is also what wakes the overlay up, so opening the HUD and
// starting playback are the same button.
await s.press('confirm');
await sleep(700);
st = await s.eval(STATE);
check('a watch page lands straight in player mode', /PLAYER/.test(st.status || ''), st.status);
check('HUD is up', st.hud !== null, st);
check('HUD shows the title', /Fixture Show/.test(st.hud || ''), st.hud);
check('HUD shows the episode line', /S1:E3/.test(st.hud || ''), st.hud);
check('duration loaded', st.duration > 0, st.duration);
check('play goes through the Netflix player API', st.apiCalls.includes('play'), st.apiCalls);
check('the video is actually playing', st.paused === false, st.paused);

await s.press('confirm');
await sleep(400);
st = await s.eval(STATE);
check('pause goes through the API too', st.apiCalls.includes('pause'), st.apiCalls);

const t0 = (await s.eval(STATE)).time;
await s.press('right');
await sleep(500);
st = await s.eval(STATE);
check('seek uses the API', st.apiCalls.includes('seek'), st.apiCalls);
check('seek moves the playhead', st.time > t0, { t0, t1: st.time });

const vol0 = (await s.eval(STATE)).volume;
await s.press('down');
st = await s.eval(STATE);
check('volume down lowers the volume', st.volume < vol0, { vol0, vol1: st.volume });
check('volume uses the API', st.apiCalls.includes('setVolume'), st.apiCalls);
check('volume OSD appears', /%/.test(st.osd || ''), st.osd);

await s.press('r2');
st = await s.eval(STATE);
check('speed up sets the rate', st.rate === 1.25, st.rate);
check('speed uses the API', st.apiCalls.includes('setPlaybackRate'), st.apiCalls);
await s.press('l2');

await s.press('l3');
st = await s.eval(STATE);
check('mute uses the API', st.apiCalls.includes('setMuted'), st.apiCalls);
check('the video is muted', st.muted === true, st);
await s.press('l3');

console.log('\ncaptions');
await s.press('x');
await sleep(300);
st = await s.eval(STATE);
check('captions turn on through the track list', st.track === 'English', st.track);
check('captions OSD says On', /On/.test(st.osd || ''), st.osd);
await s.press('x');
await sleep(300);
st = await s.eval(STATE);
check('captions turn back off', st.track === 'Off', st.track);

console.log('\nskip intro');
await s.eval('window.fixture.clicks.length = 0, window.fixture.showSkip(true), 1');
await sleep(300);
await s.press('r3');
await sleep(400);
st = await s.eval(STATE);
check('skip intro is what r3 presses when it is there', st.clicks.includes('player-skip-intro'), st.clicks);

await s.eval('window.fixture.clicks.length = 0, window.fixture.showSkip(false), 1');
await sleep(300);
await s.press('r3');
await sleep(400);
st = await s.eval(STATE);
check('with no skip button r3 goes to the next episode', st.clicks.includes('control-next'), st.clicks);

await s.press('back');
st = await s.eval(STATE);
check('back leaves player mode for browse', /BROWSE/.test(st.status || ''), st);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('failed: ' + failures.join(', '));
  process.exitCode = 1;
}
s.close();
