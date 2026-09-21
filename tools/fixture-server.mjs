// Serves tools/fixtures over http so the extension can be tested against
// Netflix-shaped markup without a Netflix login.
//
//   node tools/fixture-server.mjs        # blocks, Ctrl-C to stop
//
// Any path that looks like a Netflix route serves the same page, which decides
// what to render from location.pathname exactly as the real site does.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, 'fixtures');
const PORT = Number(process.env.CT_FIXTURE_PORT || 8787);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mp4': 'video/mp4',
};

// The clip is generated rather than committed. It is 30 seconds of ffmpeg test
// pattern, which is all the seek and scrub checks need.
async function ensureClip() {
  const clip = join(ROOT, 'clip.mp4');
  try {
    await stat(clip);
    return;
  } catch (err) {
    /* not there yet */
  }
  const ffmpeg = process.env.CT_FFMPEG || 'ffmpeg';
  await promisify(execFile)(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=duration=30:size=640x360:rate=25',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    clip,
  ]);
  console.log('generated fixtures/clip.mp4');
}

function isRoute(path) {
  return /^\/(browse|watch|search|title|latest|my-list)/.test(path) || path === '/';
}

await ensureClip();

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = isRoute(path) ? 'netflix.html' : path.replace(/^\//, '');

  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found: ' + file);
  }
}).listen(PORT, () => console.log(`fixtures on http://localhost:${PORT}/browse`));
