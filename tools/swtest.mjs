// Diagnostic only: pokes chrome.windows from inside the extension service
// worker so we can see whether window-level fullscreen is actually available.
import { Session, targets, sleep, connect } from './cdp.mjs';

// MV3 workers idle out, so poke the extension through the page first to make
// sure the worker is running and therefore has a debug target.
const page = await connect('youtube.com');
await page.press('confirm'); // make sure we are in player mode
await sleep(700);
await page.press('y');
await sleep(1500); // element-fullscreen attempt, then the worker fallback
page.close();

const list = await targets();
const sw = list.find((t) => t.type === 'service_worker' && t.url.includes('background.js'));
if (!sw) {
  console.log('no CouchTube service worker target found');
  process.exit(1);
}

const s = await Session.open(sw.webSocketDebuggerUrl);
const q = (expr) => s.eval(expr);

console.log('before:', await q('chrome.windows.getAll().then(w => JSON.stringify(w.map(x => ({id:x.id, state:x.state, h:x.height, w:x.width}))))'));

const id = await q('chrome.windows.getAll().then(w => w[0].id)');
console.log('target window id:', id);

console.log(
  'update ->',
  await q(`chrome.windows.update(${id}, {state:'fullscreen'}).then(w => JSON.stringify({state:w.state, h:w.height})).catch(e => 'ERR ' + e.message)`)
);

await sleep(1800);
console.log('after :', await q('chrome.windows.getAll().then(w => JSON.stringify(w.map(x => ({id:x.id, state:x.state, h:x.height}))))'));

await sleep(1200);
console.log(
  'restore ->',
  await q(`chrome.windows.update(${id}, {state:'normal'}).then(w => JSON.stringify({state:w.state})).catch(e => 'ERR ' + e.message)`)
);

s.close();
