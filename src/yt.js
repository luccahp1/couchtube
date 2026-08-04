// Everything that knows what YouTube's DOM looks like lives here, so when they
// reshuffle their markup there is exactly one file to fix.
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

  function channel() {
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

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  // Cache of the browser window's own fullscreen state. Only ever written from
  // what the service worker reports back, never guessed from page metrics.
  let windowFs = false;

  function tellWorker(message) {
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        void chrome.runtime.lastError;
        if (resp && resp.ok) windowFs = !!resp.fullscreen;
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  function windowFullscreen(on) {
    return tellWorker({ type: 'window-fullscreen', on });
  }

  function syncWindowState() {
    return tellWorker({ type: 'window-state' });
  }

  // Re-check after the user may have changed things behind our back (F11).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncWindowState();
  });

  // Element fullscreen and window fullscreen both count as "we are big now".
  function isAnyFullscreen() {
    return isFullscreen() || windowFs;
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
    if (windowFs) {
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

  function nextVideo() {
    if (clickControl('.ytp-next-button:not([aria-disabled="true"])')) return true;
    // Fall back to the first thing in the up-next rail.
    const up = document.querySelector('ytd-compact-video-renderer a#thumbnail');
    if (up) {
      up.click();
      return true;
    }
    return false;
  }

  function prevVideo() {
    return clickControl('.ytp-prev-button:not([aria-disabled="true"])');
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

  CT.yt = {
    video,
    player,
    playerRect,
    isWatch,
    isLive,
    title,
    channel,
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
  };
})();
