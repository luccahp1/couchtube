// End-to-end smoke test against a real YouTube page.
//
//   pwsh tools/dev-brave.ps1 -Url https://www.youtube.com/results?search_query=lofi
//   node tools/e2e.mjs
//
// Drives CouchTube through the inject bridge (the same code path a controller
// button takes) and asserts on the overlay's real DOM.

import { connect, sleep } from './cdp.mjs';

const STATE = `(() => {
  const host = document.getElementById('couchtube-root');
  if (!host) return { mounted: false };
  const sr = host.shadowRoot;
  const on = (sel) => { const n = sr.querySelector(sel); return n && n.classList.contains('on') ? n : null; };
  const ring = on('.ring');
  const r = ring ? ring.getBoundingClientRect() : null;
  const v = document.querySelector('#movie_player video') || document.querySelector('video.html5-main-video');
  return {
    mounted: true,
    ring: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
    hints: on('.hints') ? on('.hints').innerText.replace(/\\s+/g,' ').trim() : null,
    hud: on('.hud') ? on('.hud').innerText.replace(/\\s+/g,' ').trim() : null,
    osd: on('.osd') ? on('.osd').innerText.replace(/\\s+/g,' ').trim() : null,
    osk: !!sr.querySelector('.panel.osk'),
    oskField: (sr.querySelector('.panel.osk .txt') || {}).textContent || null,
    menu: !!sr.querySelector('.panel.menu'),
    status: on('.status') ? on('.status').innerText.replace(/\\s+/g,' ').trim() : null,
    url: location.pathname,
    time: v ? Math.round(v.currentTime) : null,
    volume: v ? Math.round(v.volume * 100) : null,
    paused: v ? v.paused : null,
  };
})()`;

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ' -> ' + JSON.stringify(detail) : ''}`);
  }
}

const s = await connect('youtube.com');

console.log('\nbrowse mode');
await s.navigate('https://www.youtube.com/results?search_query=lofi');
await sleep(2500);

let st = await s.eval(STATE);
check('content script mounted', st.mounted === true, st);
check('no ring before any input', st.ring === null, st);

await s.press('down');
st = await s.eval(STATE);
check('ring appears on first press', st.ring !== null, st);
check('hint bar shows browse hints', /Move/.test(st.hints || ''), st);
check('status chip says BROWSE', /BROWSE/.test(st.status || ''), st);

await s.press('right');
await s.press('down');
st = await s.eval(STATE);
check('focus reaches a video thumbnail', st.ring && st.ring.w > 200 && st.ring.h > 120, st);

console.log('\non-screen keyboard');
await s.press('x');
st = await s.eval(STATE);
check('keyboard opens', st.osk === true, st);
check('ring hidden behind keyboard', st.ring === null, st);

await s.press('confirm');
st = await s.eval(STATE);
check('typing puts a character in the field', (st.oskField || '').length === 1, st);

await s.press('back');
st = await s.eval(STATE);
check('back closes the keyboard', st.osk === false, st);
check('ring comes back', st.ring !== null, st);

console.log('\ncontrols sheet');
await s.press('start');
st = await s.eval(STATE);
check('controls sheet opens', st.menu === true, st);
await s.press('back');
st = await s.eval(STATE);
check('back closes the sheet', st.menu === false, st);

console.log('\nplayer mode');
await s.navigate('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
await sleep(4000);
await s.press('confirm');
await sleep(600);
st = await s.eval(STATE);
check('switches to player mode', /PLAYER/.test(st.status || ''), st);
check('HUD is up', st.hud !== null, st);
check('HUD shows the title', /Rick Astley/i.test(st.hud || ''), st);

const before = (await s.eval(STATE)).volume;
await s.press('down');
st = await s.eval(STATE);
check('volume down changes the video volume', st.volume < before, { before, after: st.volume });
check('volume OSD appears', /%/.test(st.osd || ''), st);

const t0 = (await s.eval(STATE)).time;
await s.press('right');
await sleep(400);
st = await s.eval(STATE);
check('seek forward moves the playhead', st.time > t0, { t0, t1: st.time });

await s.press('r2');
st = await s.eval(STATE);
check('speed OSD appears', /×/.test(st.osd || ''), st);
await s.press('l2');

await s.press('back');
st = await s.eval(STATE);
check('back leaves player mode for browse', /BROWSE/.test(st.status || ''), st);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('failed: ' + failures.join(', '));
  process.exitCode = 1;
}
s.close();
