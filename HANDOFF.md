# CouchTube — handoff

Last touched: 2026-09-21

## State

Working v0.2.0. YouTube and Netflix, one adapter each behind a common interface.

Suites: 21 checks on live YouTube, 39 checks on the Netflix fixtures. Both pass
headless in one command:

```bash
node tools/run-e2e.mjs
```

What is built and verified:

- [x] Gamepad polling with deadzone, auto-repeat and hold acceleration
- [x] Geometry-based focus navigation over YouTube's grid, sidebar and chips
- [x] Geometry-based focus navigation over Netflix's rows, with slider paging
- [x] Player mode on both sites: play/pause, seek, volume, captions, speed, next
- [x] Netflix playback driven through Netflix's own player API
- [x] Context-sensitive R3 on Netflix: skip intro/recap, else next episode
- [x] 10-foot HUD framed to the video element (not the viewport)
- [x] On-screen keyboard for search, named for whichever site you are on
- [x] Controls cheat sheet on the Menu button
- [x] Toolbar popup + full settings page with a live controller tester
- [x] Fullscreen with a window-level fallback (see below)
- [x] Couch zoom, cursor hiding, site control-bar suppression

## What has not been checked against the real thing

Two gaps, both worth knowing before trusting a bug report.

**Netflix has never been run against netflix.com.** It needs a login, so the
suite runs against `tools/fixtures`, which reproduces the markup `src/nf.js`
queries (the `data-uia` control attributes, the title block, the skip button,
rows that clip their off-screen pages) plus a stub of Netflix's player API. That
covers the adapter's logic and both of the failure modes that seemed most likely,
but it cannot catch Netflix having renamed something. If it misbehaves on the
real site, check in this order:

1. `document.documentElement.dataset.ctnfx` on a watch page. Missing or
   `{"api":false...}` means `src/nfx.js` could not find
   `netflix.appContext.state.playerApp`, and everything falls back to the
   `<video>` element with captions disabled.
2. `CT.site.title()` and `CT.site.video()` from the extension's console context.
3. `CT.spatial.collect().length` on a browse page against the number of
   `.title-card` elements. Equal numbers mean the off-screen clamp stopped
   working and focus will walk onto invisible cards.

**No physical controller, still.** Everything goes through the
`couchtube:inject` bridge and the keyboard fallback, which share the same code
path from `fire()` onward. The raw polling loop in `src/gamepad.js` (axes, button
indices) is the one part only real hardware can confirm. Plug one in and check
the controller tester on the settings page first, it shows exactly which index
each button reports.

## Layout

```
manifest.json         MV3, content script bundle + service worker
src/
  util.js             helpers, event bus, visibility/rect logic, window fullscreen
  settings.js         chrome.storage.sync wrapper, defaults
  mapping.js          button index -> action, glyph sets, key fallback
  gamepad.js          polling loop, repeat, the couchtube:inject test bridge
  spatial.js          focus candidate collection + directional scoring
  ui.js               shadow root, focus ring, hints, toasts, OSD, status chip
  hud.js              player overlay
  osk.js              on-screen keyboard
  menu.js             controls sheet
  yt.js               the YouTube adapter
  nf.js               the Netflix adapter
  nfx.js              MAIN world shim over Netflix's own player API
  site.js             picks the adapter for this hostname, exposes CT.site
  app.js              mode machine, wiring, SPA navigation
  background.js       service worker: window-level fullscreen
  overlay.css         all overlay styling (fetched into the shadow root)
popup/  options/      settings UIs
tools/                dev launcher, fixtures and the CDP test harness
```

Content scripts are plain scripts sharing a `CT` global, loaded in manifest
order. No build step, no dependencies. `src/nfx.js` is the exception: it runs in
the page's main world and talks to the rest over events and a data attribute.

## Gotchas learned the hard way

- **YouTube marks video thumbnails `aria-hidden`.** The title link carries the
  label for screen readers, so the thumbnail's wrapper is hidden from a11y. An
  `aria-hidden` check in the visibility filter silently made every thumbnail
  unfocusable, and focus fell through to the far-right title text — which made
  "down" from the filter chips jump back to the sidebar. Do not reintroduce it.
- **Netflix rows keep their other pages in the DOM**, clipped by the slider's
  overflow rather than hidden. They pass every visibility check, so without the
  adapter's `band` clamp the focus ring walks onto cards nobody can see. This is
  why `band` exists and why YouTube's is deliberately wide open.
- **Writing `video.currentTime` on Netflix does not stick.** Their player owns
  playback position and will put it back. Seek through the player API.
- **A CustomEvent's object `detail` does not reliably survive the hop between
  the isolated and main worlds.** Both directions pass a JSON string instead.
- **Gamepad input is not user activation in Chromium.** `requestFullscreen()` and
  sometimes `play()` are refused. Fullscreen falls back to
  `chrome.windows.update({state:'fullscreen'})` from the service worker. Do not
  click `.ytp-fullscreen-button` programmatically, YouTube leaves a "Full screen
  is unavailable" tooltip on the video.
- **Do not infer window fullscreen from page metrics.** With two displays at
  different scaling, `outerHeight` vs `screen.height` lies in both directions.
  The service worker owns that state and `CT.win` only caches what it reports.
- **The overlay must be reparented into the fullscreen element** on
  `fullscreenchange` or the browser will not paint it.
- **Brave blocks typing a `chrome-extension://` URL into the omnibox**
  (ERR_BLOCKED_BY_CLIENT). Open the options page from the popup instead.
- **Unpacked extension IDs are not the SHA-256-of-path value** you may have seen
  documented, read the real ID off `brave://extensions`.
- **An unpacked extension is a pointer at a path.** Moving the project folder
  unloads it and it has to be loaded again from the new location.
- The HUD is sized to the player element every frame. Anchoring it to the
  viewport puts it under the video and on top of the page's metadata.
- `Runtime.enable` only replays execution contexts on the transition from off to
  on, so `cdp.mjs` toggles it. Without that, looking up the isolated world a
  second time after a navigation returns a dead context id.

## Testing

```bash
node tools/run-e2e.mjs            # both suites, headless, ~90s
node tools/run-e2e.mjs netflix    # fixtures only, works with no network
node tools/run-e2e.mjs youtube    # live YouTube only
```

By hand, with a window to look at:

```bash
node tools/pack-test-ext.mjs                  # prints a folder
node tools/fixture-server.mjs                 # serves the Netflix fixtures
pwsh tools/dev-brave.ps1 -Fresh -Ext <folder> -Url http://localhost:8787/browse
node tools/probe.mjs down right confirm       # fire actions, print overlay state
node tools/inspect.mjs "CT.app.mode"          # eval inside the isolated world
```

`tools/pack-test-ext.mjs` copies the extension somewhere temporary and adds
localhost to its match patterns and to the Netflix adapter's hostname test. The
shipped manifest stays clean.

There is no single-test runner. Both suites are one file each, edit the action
list to narrow. `node --check src/*.js` is the closest thing to a linter.

## Next

- Verify button indices against a real Xbox controller and a real DualSense.
- Run the Netflix adapter against the real site and fix whatever the fixtures
  could not predict.
- Give Shorts their own mode (up/down for previous/next short).
- Remember focus position per row so moving up and back down returns to the same
  tile.
