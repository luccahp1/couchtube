// The 10-foot player overlay: title, scrub bar, times, state pills.
(function () {
  let node = null;
  let parts = null;
  let raf = 0;
  let visible = false;
  let hideTimer = null;
  let scrubUntil = 0;

  function build() {
    if (node && node.isConnected) return node;
    const el = CT.ui.el;
    node = el('div', 'hud');
    node.innerHTML = `
      <div class="title"></div>
      <div class="channel"></div>
      <div class="bar">
        <div class="buffered"></div>
        <div class="played"></div>
        <div class="knob"></div>
      </div>
      <div class="times">
        <span class="elapsed">0:00</span>
        <span class="state"></span>
        <span class="duration">0:00</span>
      </div>`;
    CT.ui.layer.appendChild(node);
    parts = {
      title: node.querySelector('.title'),
      channel: node.querySelector('.channel'),
      buffered: node.querySelector('.buffered'),
      played: node.querySelector('.played'),
      knob: node.querySelector('.knob'),
      elapsed: node.querySelector('.elapsed'),
      duration: node.querySelector('.duration'),
      state: node.querySelector('.state'),
    };
    return node;
  }

  function pill(text, cls) {
    const p = CT.ui.el('span', 'pill' + (cls ? ' ' + cls : ''), text);
    return p;
  }

  function paint() {
    if (!visible) return;
    raf = requestAnimationFrame(paint);

    const v = CT.yt.video();
    if (!v) return;

    // Track the player every frame so the HUD stays glued to the video through
    // theater toggles, window resizes and fullscreen.
    CT.ui.frameTo(node, CT.yt.playerRect());

    const live = CT.yt.isLive();
    const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    const pct = dur ? CT.clamp(v.currentTime / dur, 0, 1) : 1;
    const buf = dur ? CT.clamp(CT.yt.bufferedEnd() / dur, 0, 1) : 1;

    parts.played.style.width = pct * 100 + '%';
    parts.buffered.style.width = buf * 100 + '%';
    parts.knob.style.left = pct * 100 + '%';
    parts.elapsed.textContent = CT.fmtTime(v.currentTime);
    parts.duration.textContent = live ? 'LIVE' : CT.fmtTime(dur);

    // The duration slot already reads LIVE, so no second live badge here.
    parts.state.textContent = '';
    if (v.paused) parts.state.appendChild(pill('Paused'));
    if (v.muted) parts.state.appendChild(pill('Muted'));
    if (v.playbackRate !== 1) parts.state.appendChild(pill(v.playbackRate + '×'));

    node.classList.toggle('scrubbing', performance.now() < scrubUntil);
  }

  function refreshMeta() {
    if (!parts) return;
    parts.title.textContent = CT.yt.title();
    parts.channel.textContent = CT.yt.channel();
  }

  function show(sticky) {
    build();
    refreshMeta();
    if (!visible) {
      visible = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    }
    node.classList.add('on');
    clearTimeout(hideTimer);
    if (!sticky) {
      hideTimer = setTimeout(hide, CT.settings.values.hudTimeout);
    }
  }

  function hide() {
    clearTimeout(hideTimer);
    if (node) node.classList.remove('on');
    visible = false;
    cancelAnimationFrame(raf);
  }

  function destroy() {
    hide();
    if (node) node.remove();
    node = null;
    parts = null;
  }

  function markScrub() {
    scrubUntil = performance.now() + 650;
  }

  CT.hud = {
    show,
    hide,
    destroy,
    refreshMeta,
    markScrub,
    get visible() {
      return visible;
    },
  };
})();
