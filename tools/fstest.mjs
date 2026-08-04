// Diagnostic only: walks the fullscreen toggle in player mode and reports the
// real window state from the extension's own isolated world.
import { connect, sleep } from './cdp.mjs';

const s = await connect('youtube.com');
await s.navigate('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
await sleep(4000);

const ctx = await s.isolatedContext('CouchTube');
const state = () =>
  s.eval(
    `JSON.stringify({mode: CT.app.mode, elementFs: CT.yt.isFullscreen(), anyFs: CT.yt.isAnyFullscreen(), theater: CT.yt.isTheater()})`,
    ctx
  );

await s.press('confirm');
await sleep(700);
console.log('player mode :', await state());

await s.press('y');
await sleep(2200);
console.log('after Y     :', await state());

await s.press('back');
await sleep(2200);
console.log('after B     :', await state());

await sleep(500);
s.close();
