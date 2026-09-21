// Picks the adapter for whatever site we landed on. Everything outside the
// adapters talks to CT.site and never needs to know which one it got.
(function () {
  const ADAPTERS = [CT.nf, CT.yt].filter(Boolean);

  function pick() {
    const host = location.hostname;
    for (const a of ADAPTERS) {
      if (a.handles(host)) return a;
    }
    return null;
  }

  const site = pick();
  if (!site) {
    // Content script matched something we have no adapter for. Bail loudly in
    // debug, quietly otherwise, rather than throwing on every page event.
    CT.log('no adapter for', location.hostname);
  }

  CT.site = site;
  CT.sites = ADAPTERS;
})();
