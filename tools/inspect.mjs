// Diagnostic only: evaluates an expression inside CouchTube's own isolated
// world, where CT and the chrome.* APIs actually live.
//   node tools/inspect.mjs "CT.app.mode"
import { connect, sleep } from './cdp.mjs';

const s = await connect('youtube.com');
const ctx = await s.isolatedContext('CouchTube');
if (!ctx) {
  console.log('could not find the CouchTube isolated world');
  console.log('worlds seen:', (s.contexts || []).map((c) => c.name || '(main)'));
  process.exit(1);
}

const expr = process.argv[2] || 'JSON.stringify({mode: CT.app.mode, fs: CT.yt.isAnyFullscreen()})';
try {
  console.log(await s.eval(expr, ctx));
} catch (err) {
  console.log('ERR', err.message);
}
await sleep(300);
s.close();
