// Runs in the page's MAIN world, which is the only place window.netflix is
// visible. Netflix's own player API is far more reliable than poking the
// <video> element, because their state machine will happily undo what you did
// to the element behind its back.
//
// Talks to the content script two ways: commands arrive as couchtube:nfx
// events, and state we cannot read from the isolated world goes back out on a
// data attribute so the adapter can read it synchronously.
(function () {
  const STATE_ATTR = 'ctnfx';
  let lastTextTrack = null;

  function videoPlayer() {
    try {
      return window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
    } catch (err) {
      return null;
    }
  }

  function player() {
    const api = videoPlayer();
    if (!api) return null;
    try {
      const ids = api.getAllPlayerSessionIds() || [];
      // Trailers and the preview modal get their own sessions, so prefer the
      // real watch session and fall back to whatever is left.
      const watch = ids.filter((id) => String(id).startsWith('watch-'));
      const id = watch[watch.length - 1] || ids[ids.length - 1];
      return id ? api.getVideoPlayerBySessionId(id) : null;
    } catch (err) {
      return null;
    }
  }

  function offTrack(list) {
    return list.find(
      (t) =>
        t &&
        (String(t.displayName || '').toLowerCase() === 'off' ||
          String(t.trackId || '').indexOf('None') !== -1 ||
          (!t.bcp47 && !t.isForcedNarrative))
    );
  }

  function captionState(p) {
    try {
      const list = p.getTextTrackList() || [];
      if (!list.length) return 'none';
      const cur = p.getTextTrack();
      const off = offTrack(list);
      if (!cur) return 'off';
      if (off && (cur === off || cur.trackId === off.trackId)) return 'off';
      return 'on';
    } catch (err) {
      return 'none';
    }
  }

  function toggleCaptions(p) {
    const list = p.getTextTrackList() || [];
    if (!list.length) return;
    const off = offTrack(list);
    const cur = p.getTextTrack();
    const isOff = !cur || (off && (cur === off || cur.trackId === off.trackId));

    if (isOff) {
      const want = lastTextTrack || list.find((t) => t !== off && (!off || t.trackId !== off.trackId));
      if (want) p.setTextTrack(want);
      return;
    }
    lastTextTrack = cur;
    if (off) p.setTextTrack(off);
  }

  function publish() {
    const p = player();
    const state = { api: !!p, captions: 'none', rate: 1 };
    if (p) {
      state.captions = captionState(p);
      try {
        if (p.getPlaybackRate) state.rate = p.getPlaybackRate();
      } catch (err) {
        /* older build without the getter, the default is fine */
      }
    }
    document.documentElement.dataset[STATE_ATTR] = JSON.stringify(state);
  }

  const OPS = {
    seek: (p, ms) => p.seek(ms),
    play: (p) => p.play(),
    pause: (p) => p.pause(),
    volume: (p, v) => p.setVolume(v),
    muted: (p, on) => p.setMuted(!!on),
    rate: (p, r) => p.setPlaybackRate && p.setPlaybackRate(r),
    captions: (p) => toggleCaptions(p),
  };

  // The detail is a JSON string on purpose. An object created in the isolated
  // world does not always survive the hop into this one.
  document.addEventListener('couchtube:nfx', (ev) => {
    let detail = {};
    try {
      detail = JSON.parse(ev.detail) || {};
    } catch (err) {
      return;
    }
    const fn = OPS[detail.op];
    if (!fn) return;
    const p = player();
    if (!p) return publish();
    try {
      fn(p, detail.arg);
    } catch (err) {
      /* Netflix refused it. publish() below tells the adapter what really happened. */
    }
    publish();
  });

  publish();
  setInterval(publish, 900);
})();
