// Everything that knows what Netflix's DOM looks like. Same adapter shape as
// src/yt.js.
//
// Two differences from YouTube worth knowing before you edit this. Netflix
// drives playback through its own player object, which only exists in the
// page's main world, so the interesting calls go out through src/nfx.js and we
// read the <video> element for state. And every row on the browse page is a
// paginated slider that keeps the pages either side of it in the DOM, clipped
// off screen, which is why this adapter clamps the focus search to the viewport
// and drives the slider arrows itself.
(function () {
  const SKIP = [
    '[data-uia="player-skip-intro"]',
    '[data-uia="player-skip-recap"]',
    '[data-uia="player-skip-preplay"]',
    '[data-uia^="player-skip"]',
  ].join(',');

  const NEXT_EPISODE = [
    '[data-uia="control-next"]',
    '[data-uia="next-episode-seamless-button"]',
    '[data-uia="next-episode-seamless-button-draining"]',
    '[data-uia="watch-video-next-episode"]',
  ].join(',');

  // ------------------------------------------------------------ main world

  function bridge() {
    try {
      return JSON.parse(document.documentElement.dataset.ctnfx || 'null');
    } catch (err) {
      return null;
    }
  }

  function hasApi() {
    const st = bridge();
    return !!(st && st.api);
  }

  // Returns whether the command actually went anywhere, so every caller can
  // fall back to driving the <video> element itself.
  function send(op, arg) {
    if (!hasApi()) return false;
    document.dispatchEvent(new CustomEvent('couchtube:nfx', { detail: JSON.stringify({ op, arg }) }));
    return true;
  }

  // ----------------------------------------------------------------- page

  function isWatch() {
    return /^\/watch(\/|$)/.test(location.pathname);
  }

  function video() {
    const scoped =
      document.querySelector('.watch-video video') || document.querySelector('[data-uia="player"] video');
    if (scoped) return scoped;

    // Browse pages autoplay a billboard trailer, so when there are several take
    // the biggest one rather than whichever is first in the DOM.
    let best = null;
    let bestArea = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > bestArea) {
        bestArea = area;
        best = v;
      }
    }
    return best;
  }

  function player() {
    const v = video();
    return (
      document.querySelector('.watch-video--player-view') ||
      document.querySelector('.watch-video') ||
      document.querySelector('[data-uia="player"]') ||
      (v && v.parentElement) ||
      null
    );
  }

  function playerRect() {
    const p = player() || video();
    if (!p) return null;
    const r = p.getBoundingClientRect();
    if (r.width < 120 || r.height < 90) return null;
    return r;
  }

  function isLive() {
    const v = video();
    return !!(v && !isFinite(v.duration));
  }

  function titleNode() {
    return document.querySelector('[data-uia="video-title"]') || document.querySelector('.video-title') || null;
  }

  function title() {
    const node = titleNode();
    const h = node && node.querySelector('h4');
    if (h && h.textContent.trim()) return h.textContent.trim();
    if (node && node.textContent.trim()) return node.textContent.trim().split('\n')[0];
    return document.title.replace(/\s*-\s*Netflix$/, '');
  }

  // The HUD's second line. For a series this is the season, episode number and
  // episode title. For a film there is nothing to say.
  function subtitle() {
    const node = titleNode();
    if (!node) return '';
    return [...node.querySelectorAll('span')]
      .map((s) => s.textContent.trim())
      .filter(Boolean)
      .join(' · ');
  }

  // -------------------------------------------------------------- playback

  function togglePlay() {
    const v = video();
    if (!v) return null;
    const wantPlay = v.paused;

    if (send(wantPlay ? 'play' : 'pause')) return wantPlay;

    if (wantPlay) {
      const p = v.play();
      // A gamepad press is not user activation, so this can be refused outright.
      if (p && p.catch) p.catch(() => CT.bus.emit('playblocked'));
      return true;
    }
    v.pause();
    return false;
  }

  function seekTo(t) {
    const v = video();
    if (!v) return null;
    const target = CT.clamp(t, 0, v.duration || t);
    // Netflix's player will quietly undo a raw currentTime write, so ask it
    // properly when we can and only poke the element as a last resort.
    if (!send('seek', Math.round(target * 1000))) v.currentTime = target;
    return target;
  }

  function seekBy(delta) {
    const v = video();
    if (!v || !isFinite(v.duration)) return null;
    return seekTo(v.currentTime + delta);
  }

  function volumeBy(delta) {
    const v = video();
    if (!v) return null;
    if (v.muted && delta > 0) {
      v.muted = false;
      send('muted', false);
    }
    const next = CT.clamp(v.volume + delta / 100, 0, 1);
    v.volume = next;
    send('volume', next);
    return Math.round(next * 100);
  }

  function toggleMute() {
    const v = video();
    if (!v) return null;
    const next = !v.muted;
    v.muted = next;
    send('muted', next);
    return next;
  }

  // Netflix tops out well below YouTube. Anything past 1.5 on their player
  // stutters badly enough that it is not worth offering.
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

  function speedBy(dir) {
    const v = video();
    if (!v) return null;
    let i = SPEEDS.indexOf(v.playbackRate);
    if (i === -1) i = SPEEDS.indexOf(1);
    i = CT.clamp(i + dir, 0, SPEEDS.length - 1);
    const rate = SPEEDS[i];
    v.playbackRate = rate;
    send('rate', rate);
    return rate;
  }

  // Netflix has no caption button, only a track picker, so this goes through
  // the player's text track list in the main world. Without that bridge there
  // is nothing sensible to toggle.
  function toggleCaptions() {
    const st = bridge();
    if (!st || !st.api || st.captions === 'none') return null;
    send('captions');
    return st.captions !== 'on';
  }

  function bufferedEnd() {
    const v = video();
    if (!v || !v.buffered || !v.buffered.length) return 0;
    try {
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.currentTime >= v.buffered.start(i) && v.currentTime <= v.buffered.end(i)) {
          return v.buffered.end(i);
        }
      }
      return v.buffered.end(v.buffered.length - 1);
    } catch (err) {
      return 0;
    }
  }

  // ---------------------------------------------------------- presentation

  const isFullscreen = CT.isElementFullscreen;
  const windowFullscreen = (on) => CT.win.set(on);
  const syncWindowState = () => CT.win.sync();

  function isAnyFullscreen() {
    return isFullscreen() || CT.win.fullscreen;
  }

  function toggleFullscreen() {
    if (isAnyFullscreen()) {
      exitFullscreen();
      return false;
    }

    const p = player();
    if (p && p.requestFullscreen) {
      const req = p.requestFullscreen();
      if (req && req.catch) req.catch(() => {});
    }

    // Same story as YouTube: no user activation from a pad, so check whether it
    // took and put the whole window fullscreen if it did not. Netflix has no
    // theater mode to widen first, the player already fills the page.
    setTimeout(() => {
      if (!isFullscreen()) windowFullscreen(true);
    }, 350);
    return true;
  }

  function exitFullscreen() {
    let did = false;
    if (isFullscreen() && document.exitFullscreen) {
      document.exitFullscreen();
      did = true;
    }
    if (CT.win.fullscreen) {
      windowFullscreen(false);
      did = true;
    }
    return did;
  }

  // ----------------------------------------------------------- navigation

  function clickIfThere(selector) {
    const btn = document.querySelector(selector);
    if (!btn || !CT.isVisible(btn)) return false;
    btn.click();
    return true;
  }

  function skipLabel(el) {
    const uia = el.getAttribute('data-uia') || '';
    if (uia.indexOf('recap') !== -1) return 'Skipped recap';
    if (uia.indexOf('intro') !== -1) return 'Skipped intro';
    return 'Skipped';
  }

  // Whatever "get me past this" means right now. A skip button beats going to
  // the next episode, because if one is on screen it is the thing you meant.
  function nextVideo() {
    const skip = document.querySelector(SKIP);
    if (skip && CT.isVisible(skip)) {
      const label = skipLabel(skip);
      skip.click();
      return label;
    }
    if (clickIfThere(NEXT_EPISODE)) return 'Next episode';
    return null;
  }

  function prevVideo() {
    return null;
  }

  function skipAvailable() {
    const skip = document.querySelector(SKIP);
    return !!(skip && CT.isVisible(skip));
  }

  function search(query) {
    const q = String(query || '').trim();
    if (!q) return false;
    location.assign('/search?q=' + encodeURIComponent(q));
    return true;
  }

  function goHome() {
    location.assign('/browse');
  }

  function blurActive() {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
  }

  // -------------------------------------------------------------- browsing

  const CARDS = [
    '.title-card',
    '.title-card-container',
    '[data-uia="title-card"]',
    '.slider-item',
    '.previewModal--container',
    '.billboard-row',
  ];

  // The player's own chrome. Everything else on a watch page is fair game.
  const EXCLUDE = [
    '.watch-video--bottom-controls-container',
    '[data-uia="controls-standard"]',
    '.watch-video--back-container',
  ];

  // Netflix keeps the pages either side of a row in the DOM, clipped by the
  // row's overflow. Without this clamp "right" walks onto a card nobody can see.
  const BAND = { top: -1.5, bottom: 2.5, left: 0, right: 1 };

  const ROW = '.lolomoRow, .rowContainer, .slider, .ptrack-container';
  const HANDLE_NEXT = '.handleNext, [data-uia="next-slider-handle"], .handle.handleNext';
  const HANDLE_PREV = '.handlePrev, [data-uia="previous-slider-handle"], .handle.handlePrev';

  // Called when the focus search runs out of row. Paging the slider is what a
  // person would do next, so do that and let app.js re-aim afterwards.
  function onEdge(dir, from) {
    if (dir !== 'left' && dir !== 'right') return false;
    if (!from || !from.closest) return false;
    const row = from.closest(ROW);
    if (!row) return false;
    const handle = row.querySelector(dir === 'right' ? HANDLE_NEXT : HANDLE_PREV);
    if (!handle || !CT.isVisible(handle)) return false;
    handle.click();
    return true;
  }

  // Our HUD stands in for Netflix's control bar while the pad is driving. The
  // skip button stays visible because it is the one thing worth reacting to.
  const CHROME_CSS = `
    html.couchtube-player .watch-video--bottom-controls-container,
    html.couchtube-player .watch-video--back-container,
    html.couchtube-player [data-uia="controls-standard"] {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 160ms linear;
    }
    html.couchtube-player [data-uia^="player-skip"] {
      opacity: 1 !important;
    }`;

  CT.nf = {
    key: 'netflix',
    label: 'Netflix',
    handles: (host) => /(^|\.)netflix\.com$/.test(host),

    video,
    player,
    playerRect,
    isWatch,
    isLive,
    title,
    subtitle,
    togglePlay,
    seekBy,
    seekTo,
    volumeBy,
    toggleMute,
    speedBy,
    toggleCaptions,
    isFullscreen,
    isAnyFullscreen,
    windowFullscreen,
    syncWindowState,
    toggleFullscreen,
    exitFullscreen,
    nextVideo,
    prevVideo,
    skipAvailable,
    bufferedEnd,
    search,
    goHome,
    blurActive,
    hasApi,
    SPEEDS,

    cards: CARDS,
    exclude: EXCLUDE,
    band: BAND,
    onEdge,
    chromeCss: CHROME_CSS,
    // Netflix's router fires nothing we can hook, so the URL poll in app.js is
    // the only thing that notices a navigation.
    navEvents: [],
    labels: { next: 'Next episode', home: 'Netflix home', search: 'Search Netflix' },
  };
})();
