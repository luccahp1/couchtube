# CouchTube — handoff

Last touched: 2026-08-04

## State

Working v0.1.0, loaded unpacked in Brave and tested on live YouTube. The 21-check
e2e suite passes. Not published anywhere, no store listing.

What is built and verified:

- [x] Gamepad polling with deadzone, auto-repeat and hold acceleration
- [x] Geometry-based focus navigation over YouTube's grid, sidebar and chips
- [x] Player mode: play/pause, seek, volume, captions, speed, mute, next
- [x] 10-foot HUD framed to the video element (not the viewport)
- [x] On-screen keyboard for search
- [x] Controls cheat sheet on the Menu button
- [x] Toolbar popup + full settings page with a live controller tester
- [x] Fullscreen with a window-level fallback (see below)
- [x] Couch zoom, cursor hiding, YouTube control-bar suppression

Never tested with an actual physical controller — everything went through the
inject bridge and the keyboard fallback, which share the same code path from
`fire()` onward. The raw polling loop in `src/gamepad.js` (axes, button indices)
is the one part only a real pad can confirm. **Plug one in and check the
controller tester on the settings page first** — it shows exactly which index
each button reports.

## Layout

```
manifest.json         MV3, content script + service worker
src/
  util.js             helpers, event bus, visibility/rect logic
  settings.js         chrome.storage.sync wrapper, defaults
  mapping.js          button index -> action, glyph sets, key fallback
  gamepad.js          polling loop, repeat, the couchtube:inject test bridge
  spatial.js          focus candidate collection + directional scoring
  ui.js               shadow root, focus ring, hints, toasts, OSD, status chip
  hud.js              player overlay
  osk.js              on-screen keyboard
  menu.js             controls sheet
  yt.js               everything that knows YouTube's DOM
  app.js              mode machine, wiring, SPA navigation
  background.js       service worker: window-level fullscreen
  overlay.css         all overlay styling (fetched into the shadow root)
popup/  options/      settings UIs
tools/                dev launcher + CDP test harness
```

Content scripts are plain scripts sharing a `CT` global, loaded in manifest
order. No build step, no dependencies.

## Gotchas learned the hard way

- **YouTube marks video thumbnails `aria-hidden`.** The title link carries the
  label for screen readers, so the thumbnail's wrapper is hidden from a11y. An
  `aria-hidden` check in the visibility filter silently made every thumbnail
  unfocusable, and focus fell through to the far-right title text — which made
  "down" from the filter chips jump back to the sidebar. Do not reintroduce it.
- **Gamepad input is not user activation in Chromium.** `requestFullscreen()` and
  sometimes `play()` are refused. Clicking `.ytp-fullscreen-button`
  programmatically is worse: YouTube parks a "Full screen is unavailable"
  tooltip on the video. The fallback is `chrome.windows.update({state:
  'fullscreen'})` from the service worker.
- **Do not infer window fullscreen from page metrics.** With two displays at
  different scaling, `outerHeight` vs `screen.height` lies in both directions.
  The service worker owns that state and the content script only caches what it
  reports back.
- **The overlay must be reparented into the fullscreen element** on
  `fullscreenchange` or the browser will not paint it.
- **Brave blocks typing a `chrome-extension://` URL into the omnibox**
  (ERR_BLOCKED_BY_CLIENT). Open the options page from the popup instead.
- **Unpacked extension IDs are not the SHA-256-of-path value** you may have seen
  documented — read the real ID off `brave://extensions`.
- The HUD is sized to `#movie_player` every frame. Anchoring it to the viewport
  puts it under the video and on top of YouTube's metadata.

## Testing

```bash
pwsh tools/dev-brave.ps1 -Fresh
node tools/e2e.mjs
```

`tools/` also has `probe.mjs` (fire actions, print overlay state), `inspect.mjs`
(evaluate anything inside the extension's isolated world) and `diag.mjs` /
`diag2.mjs` (dump what the focus engine sees on the current page). Those four are
diagnostics, not part of the product.

The test bridge is real product code, kept deliberately:

```js
document.dispatchEvent(new CustomEvent('couchtube:inject', { detail: 'confirm' }))
```

Anything on the page can fire an action that way, which is what makes the whole
thing testable without a physical pad.

## Worth doing next

- [ ] Verify button indices against a real Xbox and a real DualSense
- [ ] Shorts deserve their own mode (up/down = previous/next short)
- [ ] Remember focus position per row so moving up and back down returns to the
      same tile
- [ ] Playlist / queue navigation
- [ ] A first-run overlay the first time a pad connects
- [ ] Rebindable buttons — the mapping layer already supports it, there is just
      no UI
