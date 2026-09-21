// Everything that knows what YouTube's DOM looks like lives here, so when they
// reshuffle their markup there is exactly one file to fix. Same shape as
// src/nf.js: both implement the adapter interface that CT.site hands out.
(function () {
  function video() {
    return (
      document.querySelector('#movie_player video.html5-main-video') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('video.html5-main-video') ||
      null
    );
  }

  function player() {
    return document.querySelector('#movie_player');
  }

  // Where the video actually is on screen. The HUD frames this, so in windowed
  // mode the overlay sits on the video rather than across the whole page.
  function playerRect() {
    const p = player() || video();
    if (!p) return null;
    const r = p.getBoundingClientRect();
    if (r.width < 120 || r.height < 90) return null;
    return r;
  }

  function isWatch() {
    return location.pathname === '/watch' || location.pathname.startsWith('/shorts');
  }

  function isLive() {
    const v = video();
    if (v && !isFinite(v.duration)) return true;
    const badge = document.querySelector('.ytp-live-badge');
    return !!(badge && CT.isVisible(badge) && !badge.classList.contains('ytp-live-badge-is-livehead'));
  }

  function title() {
    const node =
      document.querySelector('#above-the-fold #title h1 yt-formatted-string') ||
      document.querySelector('h1.ytd-watch-metadata') ||
      document.querySelector('.ytp-title-link');
    return node ? node.textContent.trim() : document.title.replace(/ - YouTube$/, '');
  }

  function subtitle() {
    const node =
      document.querySelector('#owner #channel-name a') ||
      document.querySelector('ytd-channel-name a') ||
      document.querySelector('.ytp-title-expanded-title');
    return node ? node.textContent.trim() : '';
  }

  // Clicking YouTube's own controls is more reliable than reimplementing them,
  // so anything with a button gets driven through the real button.
  function clickControl(selector) {
    const btn = document.querySelector(selector);
    if (!btn) return false;
    btn.click();
    return true;
  }

  function togglePlay() {
    const v = video();
    if (!v) return null;
    if (v.paused) {
      const p = v.play();
      // A gamepad press is not user activation as far as Chromium is concerned,
      // so on a profile with no history on this site autoplay can be refused.
      if (p && p.catch) p.catch(() => CT.bus.emit('playblocked'));
      return true;
    }
    v.pause();
    return false;
  }

  function seekBy(delta) {
    const v = video();
    if (!v || !isFinite(v.duration)) return null;
    v.currentTime = CT.clamp(v.currentTime + delta, 0, v.duration);
    return v.currentTime;
  }

  function seekTo(t) {
    const v = video();
    if (!v) return null;
    v.currentTime = CT.clamp(t, 0, v.duration || t);
    return v.currentTime;
  }

  function volumeBy(delta) {
    const v = video();
    if (!v) return null;
    if (v.muted && delta > 0) v.muted = false;
    v.volume = CT.clamp(v.volume + delta / 100, 0, 1);
    return Math.round(v.volume * 100);
  }

  function toggleMute() {
    const v = video();
    if (!v) return null;
    v.muted = !v.muted;
    return v.muted;
  }

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  function speedBy(dir) {
    const v = video();
    if (!v) return null;
    let i = SPEEDS.indexOf(v.playbackRate);
    if (i === -1) i = SPEEDS.indexOf(1);
    i = CT.clamp(i + dir, 0, SPEEDS.length - 1);
    v.playbackRate = SPEEDS[i];
    return SPEEDS[i];
  }

  function toggleCaptions() {
    const btn = document.querySelector('.ytp-subtitles-button');
    if (!btn) return null;
    btn.click();
    return btn.getAttribute('aria-pressed') === 'true';
  }

  const isFullscreen = CT.isElementFullscreen;
  const windowFullscreen = (on) => CT.win.set(on);
  const syncWindowState = () => CT.win.sync();

  // Element fullscreen and window fullscreen both count as "we are big now".
  function isAnyFullscreen() {
    return isFullscreen() || CT.win.fullscreen;
  }

  // Try the real thing first: if we happen to have user activation (keyboard
  // fallback, or the user just clicked) element fullscreen is the nicer result.
  // A gamepad press gives us no activation, so check whether it actually took
  // and fall back to fullscreening the window.
  function toggleFullscreen() {
    if (isAnyFullscreen()) {
      exitFullscreen();
      return false;
    }

    // Deliberately not clicking .ytp-fullscreen-button: without user activation
    // YouTube just parks a "Full screen is unavailable" tooltip on the video.
    // Ask the browser directly and let it fail quietly instead.
    const p = player();
    if (p && p.requestFullscreen) {
      const req = p.requestFullscreen();
      if (req && req.catch) req.catch(() => {});
    }

    setTimeout(() => {
      if (!isFullscreen()) {
        if (!isTheater()) toggleTheater();
        windowFullscreen(true);
      }
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

  function toggleTheater() {
    return clickControl('.ytp-size-button');
  }

  function isTheater() {
    const flexy = document.querySelector('ytd-watch-flexy');
    return !!(flexy && flexy.hasAttribute('theater'));
  }

  // Returns a label to toast, or null if there was nothing to go to. Netflix's
  // adapter uses the same contract to say whether it skipped or advanced.
  function nextVideo() {
    if (clickControl('.ytp-next-button:not([aria-disabled="true"])')) return 'Next video';
    // Fall back to the first thing in the up-next rail.
    const up = document.querySelector('ytd-compact-video-renderer a#thumbnail');
    if (up) {
      up.click();
      return 'Next video';
    }
    return null;
  }

  function prevVideo() {
    return clickControl('.ytp-prev-button:not([aria-disabled="true"])') ? 'Previous video' : null;
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

  function search(query) {
    const q = String(query || '').trim();
    if (!q) return false;
    location.assign('/results?search_query=' + encodeURIComponent(q));
    return true;
  }

  function goHome() {
    location.assign('/');
  }

  // Kills YouTube's own keyboard shortcuts stealing focus while we drive.
  function blurActive() {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
  }

  // What browse mode should treat as one focusable tile. One entry per card,
  // otherwise every thumbnail offers three near-identical targets.
  const CARDS = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-renderer',
    'ytd-radio-renderer',
    'ytd-channel-renderer',
    'ytd-reel-item-renderer',
    'ytd-rich-grid-slim-media',
    'ytd-guide-entry-renderer',
    'ytd-mini-guide-entry-renderer',
    'ytd-comment-thread-renderer',
  ];

  const EXCLUDE = ['.ytp-chrome-bottom', '.ytp-chrome-top', '#movie_player', 'tp-yt-iron-overlay-backdrop'];

  // Our HUD replaces YouTube's control bar while the pad is driving, otherwise
  // you get two scrubbers stacked on top of each other.
  const CHROME_CSS = `
    html.couchtube-player .ytp-chrome-bottom,
    html.couchtube-player .ytp-gradient-bottom,
    html.couchtube-player .ytp-chrome-top {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 160ms linear;
    }`;

  CT.yt = {
    key: 'youtube',
    label: 'YouTube',
    handles: (host) => /(^|\.)youtube\.com$/.test(host),

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
    toggleTheater,
    isTheater,
    nextVideo,
    prevVideo,
    bufferedEnd,
    search,
    goHome,
    blurActive,
    SPEEDS,

    // Browse tuning. YouTube's shelves keep off-screen tiles in the DOM but the
    // nav has always coped with them, so the horizontal band stays wide open.
    cards: CARDS,
    exclude: EXCLUDE,
    band: { top: -1.5, bottom: 2.5, left: -Infinity, right: Infinity },
    chromeCss: CHROME_CSS,
    // YouTube's router fires this, and it is faster than waiting for the URL poll.
    navEvents: ['yt-navigate-finish'],
    labels: { next: 'Next video', home: 'YouTube home', search: 'Search YouTube' },
  };
})();
