// CouchTube shared helpers. Everything hangs off one global so the content
// scripts can talk to each other without modules.
var CT = window.CT || {};
window.CT = CT;

CT.DEBUG = false;

CT.log = function (...args) {
  if (CT.DEBUG) console.log('%c[CouchTube]', 'color:#ff4d4d;font-weight:600', ...args);
};

CT.clamp = function (n, min, max) {
  return n < min ? min : n > max ? max : n;
};

CT.fmtTime = function (secs) {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const s = Math.floor(secs % 60);
  const m = Math.floor((secs / 60) % 60);
  const h = Math.floor(secs / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

// A rect we can trust. Elements that are hidden, collapsed or scrolled way off
// screen come back as null so the nav code can skip them.
CT.rectOf = function (el) {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  return r;
};

CT.isVisible = function (el) {
  if (!el || !el.isConnected) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (parseFloat(style.opacity) < 0.05) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
  // Deliberately no aria-hidden check. YouTube wraps every video thumbnail in
  // an aria-hidden container (the title link carries the label for screen
  // readers), and skipping those left the biggest target on the page unfocusable.
  return true;
};

CT.centerOf = function (r) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// Scrolls an element into the middle of the screen instead of just barely into
// view. From the couch you want the thing you picked to be front and centre.
CT.scrollIntoCenter = function (el, smooth) {
  const r = CT.rectOf(el);
  if (!r) return;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const targetY = r.top + r.height / 2 - vh / 2;
  const targetX = r.left + r.width / 2 - vw / 2;
  const opts = { behavior: smooth === false ? 'auto' : 'smooth' };
  // Only scroll the axis that actually needs it, otherwise horizontal rails
  // fight with the page scroll.
  if (Math.abs(targetY) > vh * 0.18) opts.top = targetY;
  if (Math.abs(targetX) > vw * 0.35) opts.left = targetX;
  if (opts.top === undefined && opts.left === undefined) return;
  opts.top = opts.top || 0;
  opts.left = opts.left || 0;
  window.scrollBy(opts);
};

CT.throttle = function (fn, ms) {
  let last = 0;
  return function (...args) {
    const now = performance.now();
    if (now - last < ms) return;
    last = now;
    return fn.apply(this, args);
  };
};

// Tiny event bus. Used for gamepad -> app and app -> ui chatter.
CT.bus = (function () {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name).delete(fn);
    },
    emit(name, payload) {
      const set = map.get(name);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(payload);
        } catch (err) {
          console.error('[CouchTube] listener failed for', name, err);
        }
      }
    },
  };
})();
