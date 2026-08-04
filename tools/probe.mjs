// Ad-hoc inspector: fires whatever actions you pass and prints CouchTube's
// visible state after each one.
//   node tools/probe.mjs down down right confirm
import { connect, sleep } from './cdp.mjs';

const STATE = `(() => {
  const host = document.getElementById('couchtube-root');
  if (!host) return { mounted: false };
  const sr = host.shadowRoot;
  const ring = sr.querySelector('.ring');
  const hints = sr.querySelector('.hints');
  const hud = sr.querySelector('.hud');
  const osk = sr.querySelector('.panel.osk');
  const menu = sr.querySelector('.panel.menu');
  const status = sr.querySelector('.status');
  const osd = sr.querySelector('.osd');
  const r = ring && ring.classList.contains('on') ? ring.getBoundingClientRect() : null;

  // Work out what the ring is sitting on by hit-testing its centre.
  let over = null;
  if (r) {
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (el) {
      const card = el.closest('ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-guide-entry-renderer, a, button');
      const t = (card || el).innerText || (card || el).getAttribute('aria-label') || (card||el).tagName;
      over = String(t).replace(/\\s+/g, ' ').trim().slice(0, 70);
    }
  }

  return {
    mounted: true,
    ring: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    over,
    hints: hints && hints.classList.contains('on') ? hints.innerText.replace(/\\s+/g, ' ').trim() : null,
    hud: hud && hud.classList.contains('on') ? hud.innerText.replace(/\\s+/g, ' ').trim().slice(0, 90) : null,
    osd: osd && osd.classList.contains('on') ? osd.innerText.replace(/\\s+/g, ' ').trim() : null,
    osk: !!osk,
    oskText: osk ? osk.innerText.replace(/\\s+/g, ' ').trim().slice(0, 60) : null,
    oskSel: osk ? (osk.querySelector('.key.sel') || {}).textContent : null,
    menu: !!menu,
    status: status && status.classList.contains('on') ? status.innerText.replace(/\\s+/g, ' ').trim() : null,
    url: location.pathname + location.search,
    scrollY: Math.round(scrollY),
  };
})()`;

const session = await connect('youtube.com');
const actions = process.argv.slice(2);

console.log('initial:', await session.eval(STATE));

for (const action of actions) {
  await session.press(action, 1, 60);
  await sleep(700);
  console.log(`after ${action}:`, await session.eval(STATE));
}

if (process.env.CT_SHOT) {
  await session.shot(process.env.CT_SHOT);
  console.log('shot ->', process.env.CT_SHOT);
}

session.close();
