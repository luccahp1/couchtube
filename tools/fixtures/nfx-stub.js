// Stands in for Netflix's own player object, which is the thing src/nfx.js
// reaches for in the page's main world. Backed by the fixture's real <video>
// so the adapter sees real state come back, and it logs every call so the
// suite can prove the bridge was used instead of the element fallback.
(function () {
  const calls = [];
  const TRACKS = [
    { trackId: 'None', displayName: 'Off' },
    { trackId: 'en', displayName: 'English', bcp47: 'en' },
    { trackId: 'fr', displayName: 'French', bcp47: 'fr' },
  ];

  let current = TRACKS[0];

  function el() {
    return document.getElementById('clip');
  }

  const player = {
    seek(ms) {
      calls.push(['seek', ms]);
      const v = el();
      if (v) v.currentTime = ms / 1000;
    },
    play() {
      calls.push(['play']);
      const v = el();
      if (v) v.play().catch(() => {});
    },
    pause() {
      calls.push(['pause']);
      const v = el();
      if (v) v.pause();
    },
    setVolume(x) {
      calls.push(['setVolume', x]);
      const v = el();
      if (v) v.volume = x;
    },
    getVolume() {
      const v = el();
      return v ? v.volume : 1;
    },
    setMuted(on) {
      calls.push(['setMuted', on]);
      const v = el();
      if (v) v.muted = !!on;
    },
    isMuted() {
      const v = el();
      return !!(v && v.muted);
    },
    setPlaybackRate(r) {
      calls.push(['setPlaybackRate', r]);
      const v = el();
      if (v) v.playbackRate = r;
    },
    getPlaybackRate() {
      const v = el();
      return v ? v.playbackRate : 1;
    },
    getCurrentTime() {
      const v = el();
      return v ? v.currentTime * 1000 : 0;
    },
    getDuration() {
      const v = el();
      return v && isFinite(v.duration) ? v.duration * 1000 : 0;
    },
    getTextTrackList() {
      return TRACKS;
    },
    getTextTrack() {
      return current;
    },
    setTextTrack(t) {
      calls.push(['setTextTrack', t && t.trackId]);
      current = t;
    },
  };

  window.netflix = {
    appContext: {
      state: {
        playerApp: {
          getAPI: () => ({
            videoPlayer: {
              getAllPlayerSessionIds: () => ['preview-1234', 'watch-80100172'],
              getVideoPlayerBySessionId: (id) => (id === 'watch-80100172' ? player : null),
            },
          }),
        },
      },
    },
  };

  window.nfxStub = {
    get calls() {
      return calls;
    },
    get track() {
      return current && current.displayName;
    },
    reset() {
      calls.length = 0;
    },
  };
})();
