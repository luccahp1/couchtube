// Owns the shadow root and the small always-there pieces: focus ring, hint bar,
// toasts, the big OSD and the status chip.
(function () {
  let host = null;
  let root = null;
  let layer = null;
  let ring = null;
  let hints = null;
  let toasts = null;
  let osd = null;
  let status = null;
  let osdTimer = null;
  let hintTimer = null;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount() {
    if (host && host.isConnected) return root;

    host = document.createElement('div');
    host.id = 'couchtube-root';
    // The host itself must never affect the page's own layout.
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;';
    root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    root.appendChild(style);
    fetch(chrome.runtime.getURL('src/overlay.css'))
      .then((r) => r.text())
      .then((css) => {
        style.textContent = css;
      })
      .catch((err) => console.error('[CouchTube] could not load overlay.css', err));

    layer = el('div', 'layer');
    ring = el('div', 'ring');
    hints = el('div', 'hints');
    toasts = el('div', 'toasts');
    status = el('div', 'status');
    osd = el('div', 'osd');
    osd.innerHTML = '<div class="icon"></div><div class="value"></div><div class="meter"><i></i></div>';

    layer.append(ring, hints, toasts, status, osd);
    root.appendChild(layer);
    (document.fullscreenElement || document.documentElement).appendChild(host);
    return root;
  }

  // When the page goes fullscreen the overlay has to live inside the fullscreen
  // element or the browser simply will not paint it.
  function reparent() {
    if (!host) return;
    const target = document.fullscreenElement || document.documentElement;
    if (host.parentElement !== target) target.appendChild(host);
  }
  document.addEventListener('fullscreenchange', reparent);
  document.addEventListener('webkitfullscreenchange', reparent);

  // Pins an overlay piece to a rect in viewport coordinates. Used to sit the
  // HUD and the OSD on top of the video instead of the whole window, which is
  // what makes it read as a player overlay when the page is not fullscreen.
  function frameTo(node, rect) {
    if (!node) return;
    if (!rect) {
      node.style.left = '0px';
      node.style.top = '0px';
      node.style.width = '100%';
      node.style.height = '100%';
      return;
    }
    node.style.left = rect.left + 'px';
    node.style.top = rect.top + 'px';
    node.style.width = rect.width + 'px';
    node.style.height = rect.height + 'px';
  }

  function centerOn(node, rect) {
    if (!node) return;
    if (!rect) {
      node.style.left = '50%';
      node.style.top = '50%';
      return;
    }
    node.style.left = rect.left + rect.width / 2 + 'px';
    node.style.top = rect.top + rect.height / 2 + 'px';
  }

  // ------------------------------------------------------------------ ring

  function showRing(target) {
    mount();
    const r = CT.rectOf(target);
    if (!r) {
      ring.classList.remove('on');
      return;
    }
    const pad = 6;
    ring.style.width = r.width + pad * 2 + 'px';
    ring.style.height = r.height + pad * 2 + 'px';
    ring.style.transform = `translate(${r.left - pad}px, ${r.top - pad}px)`;
    ring.classList.add('on');
  }

  function hideRing() {
    if (ring) ring.classList.remove('on');
  }

  function pulseRing() {
    if (!ring) return;
    ring.classList.add('pressed');
    setTimeout(() => ring && ring.classList.remove('pressed'), 130);
  }

  // ------------------------------------------------------------- hint bar

  function glyphNode(action) {
    const g = CT.mapping.glyph(action);
    const node = el('span', 'glyph' + (g.wide ? ' wide' : ''), g.label);
    node.style.background = g.color;
    if (action === 'dpad') node.style.color = '#0d0d10';
    return node;
  }

  // items: [['confirm', 'Play'], ['back', 'Back'], ...]
  function setHints(items) {
    mount();
    hints.textContent = '';
    for (const [action, label] of items) {
      const hint = el('div', 'hint');
      hint.appendChild(glyphNode(action));
      hint.appendChild(el('span', null, label));
      hints.appendChild(hint);
    }
    hints.classList.add('on');
    armIdle();
  }

  function bumpHints() {
    if (!hints) return;
    hints.classList.add('on');
    if (status) status.classList.add('on');
    armIdle();
  }

  // Hints and the status chip both fade once you stop touching the pad, so the
  // overlay never permanently covers the site's own chrome.
  function armIdle() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      if (hints) hints.classList.remove('on');
      if (status) status.classList.remove('on');
    }, CT.settings.values.hudTimeout + 1200);
  }

  function hideHints() {
    clearTimeout(hintTimer);
    if (hints) hints.classList.remove('on');
  }

  // ---------------------------------------------------------------- toast

  function toast(text, sub, ms) {
    mount();
    const node = el('div', 'toast');
    node.appendChild(el('span', null, text));
    if (sub) node.appendChild(el('span', 'sub', sub));
    toasts.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 260);
    }, ms || 2200);
  }

  // ------------------------------------------------------------------ OSD

  // pct is 0..1 and draws the meter; pass null for a value-only readout.
  function showOsd(icon, value, pct, ms) {
    mount();
    centerOn(osd, CT.site && CT.site.playerRect ? CT.site.playerRect() : null);
    const iconNode = osd.querySelector('.icon');
    // Anything longer than a glyph or two is a word, so set it small and
    // lettered rather than blown up to glyph size.
    iconNode.className = 'icon' + (icon.length > 2 ? ' label' : '');
    iconNode.textContent = icon;
    osd.querySelector('.value').textContent = value;
    const meter = osd.querySelector('.meter');
    if (pct == null) {
      meter.style.display = 'none';
    } else {
      meter.style.display = '';
      meter.querySelector('i').style.width = CT.clamp(pct, 0, 1) * 100 + '%';
    }
    osd.classList.add('on');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osd && osd.classList.remove('on'), ms || 1100);
  }

  // --------------------------------------------------------------- status

  function setStatus(mode, on) {
    mount();
    status.textContent = '';
    const dot = el('span', 'dot');
    status.append(dot, el('span', null, 'COUCHTUBE'), el('span', 'mode', mode));
    status.classList.toggle('on', on !== false);
    if (on !== false) armIdle();
  }

  function hideStatus() {
    if (status) status.classList.remove('on');
  }

  CT.ui = {
    mount,
    get root() {
      return mount();
    },
    get layer() {
      mount();
      return layer;
    },
    el,
    glyphNode,
    frameTo,
    centerOn,
    showRing,
    hideRing,
    pulseRing,
    setHints,
    bumpHints,
    hideHints,
    toast,
    showOsd,
    setStatus,
    hideStatus,
    reparent,
  };
})();
