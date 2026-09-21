// Mode machine and wiring. Two modes: PLAYER drives the video directly,
// BROWSE moves a focus ring around the page. Overlays (keyboard, controls
// sheet) sit on top and eat input while they are open.
(function () {
  const MODE = { BROWSE: 'browse', PLAYER: 'player' };

  let mode = MODE.BROWSE;
  let focused = null;
  let active = false; // has a pad ever talked to us on this page
  let ringRaf = 0;
  let lastUrl = location.href;

  // ------------------------------------------------------------- page bits

  function docStyle() {
    let s = document.getElementById('couchtube-doc-style');
    if (!s) {
      s = document.createElement('style');
      s.id = 'couchtube-doc-style';
      s.textContent = `
        html.couchtube-nocursor, html.couchtube-nocursor * { cursor: none !important; }
        body.couchtube-big { zoom: var(--couchtube-zoom, 1.3); }
        ${(CT.site && CT.site.chromeCss) || ''}
      `;
      (document.head || document.documentElement).appendChild(s);
    }
    return s;
  }

  function applyCursor() {
    docStyle();
    const hide = active && CT.settings.values.hideCursor;
    document.documentElement.classList.toggle('couchtube-nocursor', hide);
  }

  function applyPlayerChrome() {
    docStyle();
    document.documentElement.classList.toggle('couchtube-player', active && mode === MODE.PLAYER);
  }

  // The moment a real mouse shows up, the site's own controls come back and the
  // cursor reappears. The pad takes over again on the next button press.
  function yieldToMouse() {
    document.documentElement.classList.remove('couchtube-nocursor', 'couchtube-player');
  }

  function applyBigMode() {
    docStyle();
    const on = !!CT.settings.values.bigMode;
    document.documentElement.style.setProperty('--couchtube-zoom', CT.settings.values.bigModeZoom);
    document.body && document.body.classList.toggle('couchtube-big', on);
  }

  window.addEventListener('mousemove', CT.throttle(yieldToMouse, 200), true);

  // ---------------------------------------------------------------- focus

  function setFocus(el, opts) {
    if (!el) return;
    focused = el;
    // Until a pad actually talks to us this is bookkeeping only. Nobody wants a
    // mystery red rectangle on a page because an extension is installed.
    if (!active) return;
    if (!opts || opts.scroll !== false) CT.scrollIntoCenter(el);
    CT.ui.showRing(el);
    startRingSync();
  }

  function startRingSync() {
    cancelAnimationFrame(ringRaf);
    const step = () => {
      if (!active || mode !== MODE.BROWSE || !focused || !focused.isConnected) return;
      CT.ui.showRing(focused);
      ringRaf = requestAnimationFrame(step);
    };
    ringRaf = requestAnimationFrame(step);
  }

  function ensureFocus() {
    if (focused && focused.isConnected && CT.rectOf(focused)) return focused;
    const first = CT.spatial.first();
    if (first) setFocus(first);
    return first;
  }

  function move(dir) {
    const from = focused && focused.isConnected ? focused : null;
    const next = CT.spatial.next(from, dir);
    if (next) {
      setFocus(next);
      return true;
    }

    // Ran out of row. On a site with paginated rows the adapter can turn the
    // page for us, and then we re-aim once the slide has finished.
    if (from && CT.site.onEdge && CT.site.onEdge(dir, from)) {
      setTimeout(() => {
        const again = CT.spatial.next(from.isConnected ? from : null, dir);
        if (again) setFocus(again);
        else {
          focused = null;
          ensureFocus();
        }
      }, 520);
      return true;
    }

    // Nothing that way, nudge the page so lazy-loaded rows can appear.
    if (dir === 'down' || dir === 'up') {
      window.scrollBy({ top: dir === 'down' ? window.innerHeight * 0.6 : -window.innerHeight * 0.6, behavior: 'smooth' });
    }
    return false;
  }

  function activate() {
    if (!focused || !focused.isConnected) return;
    CT.ui.pulseRing();
    // Anchors get a real click so the site's own router handles it.
    focused.click();
  }

  // ----------------------------------------------------------------- mode

  function setMode(next, quiet) {
    if (mode === next) return;
    mode = next;
    if (mode === MODE.PLAYER) {
      CT.ui.hideRing();
      cancelAnimationFrame(ringRaf);
      if (active) CT.hud.show();
      if (!quiet) CT.ui.toast('Player', 'Controls the video directly');
    } else {
      CT.hud.hide();
      ensureFocus();
      if (!quiet) CT.ui.toast('Browse', 'Move around the page');
    }
    refreshHints();
    applyPlayerChrome();
    CT.ui.setStatus(mode === MODE.PLAYER ? 'PLAYER' : 'BROWSE', active);
  }

  function refreshHints() {
    if (CT.osk.open || CT.menu.open) return;
    if (mode === MODE.PLAYER) {
      // A skip button on screen is the most useful thing we could be telling
      // you about, so it takes the slot while it is there.
      const skip = CT.site.skipAvailable && CT.site.skipAvailable();
      CT.ui.setHints([
        ['confirm', 'Play'],
        ['dpad', 'Seek / volume'],
        skip ? ['r3', 'Skip intro'] : ['y', 'Fullscreen'],
        ['select', 'Browse'],
        ['start', 'Controls'],
      ]);
    } else {
      CT.ui.setHints([
        ['dpad', 'Move'],
        ['confirm', 'Open'],
        ['back', 'Back'],
        ['x', 'Search'],
        ['start', 'Controls'],
      ]);
    }
  }

  // --------------------------------------------------------- player input

  function seekStep() {
    const base = CT.settings.values.seekStep;
    const held = Math.max(CT.gamepad.heldFor('left'), CT.gamepad.heldFor('right'));
    if (held > 3000) return base * 6;
    if (held > 1400) return base * 3;
    return base;
  }

  function playerAction(action) {
    const site = CT.site;
    const s = CT.settings.values;

    switch (action) {
      case 'confirm': {
        const playing = site.togglePlay();
        if (playing !== null) CT.ui.showOsd(playing ? '▶' : '❚❚', playing ? 'Play' : 'Pause', null, 800);
        CT.hud.show();
        return;
      }
      case 'left':
      case 'right': {
        const delta = (action === 'left' ? -1 : 1) * seekStep();
        const t = site.seekBy(delta);
        if (t !== null) {
          CT.hud.markScrub();
          CT.hud.show();
          CT.ui.showOsd(action === 'left' ? '◀◀' : '▶▶', (delta > 0 ? '+' : '') + Math.round(delta) + 's', null, 650);
        }
        return;
      }
      case 'l1':
      case 'r1': {
        const delta = (action === 'l1' ? -1 : 1) * s.seekStepBig;
        const t = site.seekBy(delta);
        if (t !== null) {
          CT.hud.markScrub();
          CT.hud.show();
          CT.ui.showOsd(action === 'l1' ? '◀◀' : '▶▶', (delta > 0 ? '+' : '') + delta + 's', null, 650);
        }
        return;
      }
      case 'up':
      case 'down': {
        const vol = site.volumeBy((action === 'up' ? 1 : -1) * s.volumeStep);
        if (vol !== null) CT.ui.showOsd('Volume', vol + '%', vol / 100);
        CT.hud.show();
        return;
      }
      case 'x': {
        const on = site.toggleCaptions();
        CT.ui.showOsd('Captions', on === null ? 'Unavailable' : on ? 'On' : 'Off', null, 900);
        CT.hud.show();
        return;
      }
      case 'y':
        site.toggleFullscreen();
        setTimeout(() => {
          CT.ui.reparent();
          CT.hud.show();
        }, 120);
        return;
      case 'l2':
      case 'r2': {
        const rate = site.speedBy(action === 'l2' ? -1 : 1);
        if (rate !== null) CT.ui.showOsd('Speed', rate + '×', null, 900);
        CT.hud.show();
        return;
      }
      case 'l3': {
        const muted = site.toggleMute();
        if (muted !== null) CT.ui.showOsd('Sound', muted ? 'Muted' : 'Unmuted', null, 900);
        return;
      }
      case 'r3': {
        // The adapter returns what it actually did, because on Netflix this
        // button is skip the intro right up until there is no intro to skip.
        const did = site.nextVideo();
        if (did) CT.ui.toast(typeof did === 'string' ? did : site.labels.next);
        return;
      }
      case 'back':
        // Back walks out one layer at a time: fullscreen, then player mode,
        // then the browser's own history.
        if (site.isAnyFullscreen()) {
          site.exitFullscreen();
          setTimeout(CT.ui.reparent, 120);
          return;
        }
        setMode(MODE.BROWSE);
        return;
      case 'select':
        setMode(MODE.BROWSE);
        return;
      default:
        CT.hud.show();
    }
  }

  // --------------------------------------------------------- browse input

  function browseAction(action) {
    switch (action) {
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        ensureFocus();
        move(action);
        return;
      case 'confirm':
        ensureFocus();
        activate();
        return;
      case 'back':
        if (history.length > 1) history.back();
        else CT.site.goHome();
        return;
      case 'x':
        openSearch();
        return;
      case 'y':
        CT.settings.set({ bigMode: !CT.settings.values.bigMode });
        applyBigMode();
        CT.ui.toast('Couch zoom', CT.settings.values.bigMode ? 'On' : 'Off');
        setTimeout(() => focused && CT.ui.showRing(focused), 260);
        return;
      case 'l1':
      case 'r1': {
        const dir = action === 'l1' ? -1 : 1;
        window.scrollBy({ top: dir * window.innerHeight * 0.85, behavior: 'smooth' });
        setTimeout(() => {
          focused = null;
          ensureFocus();
        }, 420);
        return;
      }
      case 'l3':
        document.documentElement.classList.remove('couchtube-nocursor');
        CT.ui.toast('Mouse', 'Cursor is back');
        return;
      case 'select':
        if (CT.site.isWatch() && CT.site.video()) setMode(MODE.PLAYER);
        return;
      case 'home':
        CT.site.goHome();
        return;
      default:
        return;
    }
  }

  function openSearch() {
    hideRing();
    CT.osk.show('', (q) => {
      CT.ui.toast('Searching', q);
      CT.site.search(q);
    });
  }

  // The ring must not sit behind the keyboard or the controls sheet.
  function hideRing() {
    cancelAnimationFrame(ringRaf);
    CT.ui.hideRing();
  }

  function restoreRing() {
    refreshHints();
    if (mode === MODE.BROWSE && focused && focused.isConnected) setFocus(focused, { scroll: false });
  }

  // -------------------------------------------------------------- routing

  function onAction({ action }) {
    if (!CT.settings.values.enabled) return;

    if (!active) {
      active = true;
      applyCursor();
      applyPlayerChrome();
      CT.ui.setStatus(mode === MODE.PLAYER ? 'PLAYER' : 'BROWSE', true);
      refreshHints();
      if (mode === MODE.PLAYER) CT.hud.show();
      else {
        focused = null;
        ensureFocus();
      }
    }

    CT.ui.bumpHints();
    // The pad is back in charge, undo anything yieldToMouse() turned off.
    applyCursor();
    applyPlayerChrome();

    if (CT.osk.open) return void CT.osk.handle(action);
    if (CT.menu.open) return void CT.menu.handle(action);

    if (action === 'start') {
      hideRing();
      CT.menu.show(mode);
      return;
    }

    // The site's own key handlers fight us if something in the page holds focus.
    CT.site.blurActive();

    if (mode === MODE.PLAYER) playerAction(action);
    else browseAction(action);
  }

  // Right stick scrolls the page freely while browsing.
  function onAnalog({ y }) {
    if (mode !== MODE.BROWSE || CT.osk.open || CT.menu.open) return;
    if (Math.abs(y) < CT.settings.values.deadzone) return;
    window.scrollBy({ top: y * 26, behavior: 'auto' });
    if (focused) CT.ui.showRing(focused);
  }

  // ------------------------------------------------------------ lifecycle

  function syncToPage(quiet) {
    focused = null;
    const site = CT.site;
    const watch = site.isWatch() && site.video();
    setMode(watch ? MODE.PLAYER : MODE.BROWSE, quiet);
    if (!watch) {
      // Give the page a beat to render its cards before we look for targets.
      setTimeout(() => {
        if (mode === MODE.BROWSE) ensureFocus();
      }, 400);
    } else {
      CT.hud.refreshMeta();
      // Only rearrange the page for someone who is actually on the pad, and
      // only where there is a theater mode to rearrange into.
      if (active && CT.settings.values.autoTheater && site.toggleTheater && !site.isTheater()) {
        site.toggleTheater();
      }
    }
    applyBigMode();
  }

  function watchNavigation() {
    const check = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      CT.log('navigated ->', location.href);
      setTimeout(() => syncToPage(true), 500);
    };
    // YouTube tells us directly and that is faster. Netflix tells us nothing,
    // so the poll below is the only thing that notices.
    for (const name of CT.site.navEvents || []) {
      document.addEventListener(name, () => setTimeout(() => syncToPage(true), 300));
    }
    window.addEventListener('popstate', () => setTimeout(() => syncToPage(true), 400));
    setInterval(check, 700);
  }

  function start() {
    CT.ui.mount();
    CT.gamepad.start();
    CT.bus.on('action', onAction);
    CT.bus.on('analog', onAnalog);
    CT.bus.on('osk:closed', restoreRing);
    CT.bus.on('menu:closed', restoreRing);
    CT.bus.on('playblocked', () => {
      CT.ui.toast('Playback blocked', 'Click the video once, then the pad works', 3600);
    });
    CT.bus.on('settings', () => {
      applyCursor();
      applyBigMode();
      refreshHints();
    });

    CT.bus.on('pads', ({ count, id, justConnected }) => {
      if (count > 0 && justConnected) {
        active = true;
        applyCursor();
        CT.ui.toast('Controller connected', id ? String(id).slice(0, 42) : 'CouchTube is live');
        CT.ui.setStatus(mode === MODE.PLAYER ? 'PLAYER' : 'BROWSE', true);
        refreshHints();
      } else if (count === 0) {
        CT.ui.hideStatus();
        CT.ui.hideRing();
        yieldToMouse();
      }
    });

    window.addEventListener('resize', () => focused && CT.ui.showRing(focused));

    CT.site.syncWindowState();
    syncToPage(true);
    watchNavigation();
    CT.log('ready');
  }

  CT.settings.load().then(() => {
    if (!CT.site) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  });

  CT.app = {
    get mode() {
      return mode;
    },
    get focused() {
      return focused;
    },
    setMode,
    syncToPage,
    openSearch,
    MODE,
  };
})();
