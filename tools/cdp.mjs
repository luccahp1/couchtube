// Minimal Chrome DevTools Protocol client. Enough to drive the dev Brave
// instance: navigate, run JS in the page, fire CouchTube actions and grab
// screenshots. Node 22+ (global WebSocket, no dependencies).

const HOST = process.env.CT_CDP || 'http://127.0.0.1:9222';

export async function targets() {
  const res = await fetch(`${HOST}/json/list`);
  return res.json();
}

export async function pageTarget(match = 'youtube.com') {
  for (let i = 0; i < 40; i++) {
    const list = await targets();
    const page = list.find((t) => t.type === 'page' && t.url.includes(match));
    if (page) return page;
    await sleep(500);
  }
  throw new Error(`no page target matching ${match}`);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  static async open(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Session(ws);
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30000);
    });
  }

  // Runs in the page's main world. That is enough to see CouchTube's shadow
  // root (it is open) and to fire actions through the inject bridge.
  async eval(expression, contextId) {
    const params = { expression, returnByValue: true, awaitPromise: true };
    if (contextId) params.contextId = contextId;
    const res = await this.send('Runtime.evaluate', params);
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'eval failed');
    }
    return res.result.value;
  }

  // Content scripts live in an isolated world, so CT is invisible to eval().
  // Chromium names that world after the extension; find its context id so we
  // can poke the extension's own objects directly.
  async isolatedContext(nameMatch = 'CouchTube') {
    this.contexts = [];
    const collect = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.executionContextCreated') this.contexts.push(msg.params.context);
    };
    this.ws.addEventListener('message', collect);
    // Enabling Runtime replays every existing context, but only on the way from
    // off to on, so toggle it. Otherwise a second call after a navigation sees
    // nothing and hands back the context id of a page that is already gone.
    await this.send('Runtime.disable');
    await this.send('Runtime.enable');
    await sleep(400);
    const hit = this.contexts.find((c) => (c.name || '').includes(nameMatch));
    this.ws.removeEventListener('message', collect);
    return hit ? hit.id : null;
  }

  async press(action, times = 1, gap = 260) {
    for (let i = 0; i < times; i++) {
      await this.eval(
        `document.dispatchEvent(new CustomEvent('couchtube:inject',{detail:${JSON.stringify(action)}})), 1`
      );
      await sleep(gap);
    }
  }

  async navigate(url) {
    await this.send('Page.enable');
    await this.send('Page.navigate', { url });
    await sleep(1500);
    for (let i = 0; i < 30; i++) {
      const state = await this.eval('document.readyState');
      if (state === 'complete') break;
      await sleep(400);
    }
  }

  async shot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, Buffer.from(data, 'base64'));
    return path;
  }

  close() {
    this.ws.close();
  }
}

export async function connect(match = 'youtube.com') {
  const target = await pageTarget(match);
  return Session.open(target.webSocketDebuggerUrl);
}
