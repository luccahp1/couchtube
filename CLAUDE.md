# CouchTube — Claude context

## Overview

Brave/Chromium MV3 extension that turns YouTube and Netflix into a
controller-driven 10-foot console UI. Personal project — Lucca wants to run them
from bed with a gamepad. Not published, loaded unpacked.

## Stack

Plain JavaScript, no build step, no dependencies, no package manager. Manifest
V3. Node 22+ is only needed for the dev/test scripts in `tools/`.

## Layout

- `manifest.json` — MV3; content script bundle + service worker
- `src/util.js` — `CT` global, event bus, rect/visibility helpers, `CT.win`
- `src/settings.js` — `chrome.storage.sync` wrapper and defaults
- `src/mapping.js` — button index → action, glyph sets, keyboard fallback map
- `src/gamepad.js` — polling loop, auto-repeat, `couchtube:inject` test bridge
- `src/spatial.js` — focus candidate collection and directional scoring
- `src/ui.js` — shadow root, focus ring, hint bar, toasts, OSD, status chip
- `src/hud.js` — player overlay, sized to the video every frame
- `src/osk.js` — on-screen keyboard
- `src/menu.js` — controls cheat sheet
- `src/yt.js` — the YouTube adapter, the only file that knows YouTube's DOM
- `src/nf.js` — the Netflix adapter, likewise
- `src/nfx.js` — MAIN world shim over Netflix's own player API
- `src/site.js` — picks the adapter for this hostname and exposes `CT.site`
- `src/app.js` — mode machine (browse/player), wiring, SPA navigation
- `src/background.js` — service worker, window-level fullscreen
- `src/overlay.css` — all overlay styling, fetched into the shadow root
- `popup/`, `options/` — settings UIs
- `tools/` — dev launcher, Netflix fixtures and CDP test harness (not shipped)

Content scripts are ordinary scripts sharing one `CT` global, loaded in the order
listed in the manifest. No modules — MV3 content scripts cannot use `import`.
`src/nfx.js` is the exception: it runs in the page's main world (where
`window.netflix` is visible) and talks to the rest over CustomEvents and a data
attribute on `<html>`.

## Setup

No install step. Load unpacked from `brave://extensions` with Developer mode on.
No env vars, no services.

## Run / Build / Test

```bash
node tools/run-e2e.mjs              # both suites headless, ~90s, cleans up after itself
node tools/run-e2e.mjs netflix      # fixtures only, no network needed
pwsh tools/dev-brave.ps1 -Fresh     # throwaway Brave on monitor 2, CDP on :9222
node tools/probe.mjs down right confirm   # fire actions, print overlay state
node tools/inspect.mjs "CT.app.mode"      # eval inside the isolated world
```

`run-e2e.mjs` is the one to reach for. It packs a copy of the extension that also
matches localhost (`tools/pack-test-ext.mjs`), serves `tools/fixtures`, runs the
21-check YouTube suite against the live site and the 39-check Netflix suite
against the fixtures, then kills only its own process tree.

Netflix cannot be tested live because it needs a login. The fixtures reproduce
the markup `src/nf.js` queries plus a stub of Netflix's player API.

There is no single-test runner; each suite is one file, edit the action list to
narrow it. `node --check src/*.js` is the closest thing to a linter.

## Conventions

- Comments are short, casual and explain *why*, never what. No dashes in prose.
- No `Co-Authored-By` trailers in commits.
- One responsibility per file; anything site-DOM-specific goes in that site's
  adapter so a redesign has one place to fix. Nothing outside an adapter should
  name a selector, and nothing outside `src/site.js` should name an adapter.
- Overlay UI lives in a shadow root so YouTube's CSS cannot reach it and ours
  cannot leak out.

## Architecture

`gamepad.js` polls on rAF and emits semantic actions (`confirm`, `back`, `up`…)
on `CT.bus`. `app.js` is the only subscriber that matters: it routes each action
by mode (BROWSE / PLAYER) and by whether an overlay (keyboard, controls sheet) is
open and should eat the input. BROWSE moves a focus ring via `spatial.js`; PLAYER
drives playback through `CT.site`.

`CT.site` is the site adapter, picked by hostname in `src/site.js`. Beyond the
playback and navigation calls, an adapter supplies its browse tuning (`cards`,
`exclude`, `band`, optional `onEdge`), the CSS that hides the site's own player
chrome (`chromeCss`), the SPA navigation events worth listening to (`navEvents`)
and the strings that name the site in the UI (`labels`). Adding a site means
writing one of these and adding its match patterns to the manifest.

Nothing else calls `navigator.getGamepads`, and nothing outside an adapter
queries site selectors.

## Gotchas

- **Never filter focus candidates on `aria-hidden`.** YouTube wraps every video
  thumbnail in an `aria-hidden` container. Doing so makes thumbnails unfocusable
  and breaks d-pad navigation in a way that looks like a scoring bug.
- **Gamepad input is not user activation.** `requestFullscreen()` and sometimes
  `play()` get refused. Fullscreen falls back to
  `chrome.windows.update({state:'fullscreen'})` from the service worker. Do not
  click `.ytp-fullscreen-button` programmatically — YouTube leaves a "Full screen
  is unavailable" tooltip on the video.
- **Window fullscreen state must come from the service worker.** Page metrics
  (`outerHeight` vs `screen.height`) are wrong on multi-monitor setups with
  mixed DPI scaling.
- **Reparent the overlay on `fullscreenchange`** into `document.fullscreenElement`
  or it will not paint.
- **The HUD is framed to `#movie_player`, not the viewport**, every frame.
- Brave refuses `chrome-extension://` URLs typed into the omnibox
  (ERR_BLOCKED_BY_CLIENT) — reach the options page through the popup.
- Unpacked extension IDs are not derivable from the folder path; read the real
  one off `brave://extensions`.
- YouTube is an SPA and so is Netflix: `app.js` polls the URL every 700ms,
  because YouTube's `yt-navigate-finish` is not always fired and Netflix emits
  nothing at all.
- **Netflix rows keep their other pages in the DOM**, clipped by the slider's
  overflow. They pass every visibility check, so the adapter's `band` clamps
  candidates to the viewport. YouTube's is deliberately wide open.
- **Writing `video.currentTime` on Netflix does not stick** — their player puts
  it back. Seek through the player API in `src/nfx.js`.
- **A CustomEvent's object `detail` does not reliably cross between the isolated
  and main worlds.** Both directions pass a JSON string.
- `Runtime.enable` only replays execution contexts off-to-on, so `cdp.mjs`
  toggles it. Otherwise looking up the isolated world after a navigation returns
  a dead context id.
- `tools/dev-brave.ps1` kills only Brave processes whose command line contains
  its own dev profile path. Keep it that way — a blanket `Stop-Process brave`
  would close Lucca's real browser.

## Known issues / TODO

Never validated against a physical controller; the button-index mapping in
`src/mapping.js` is the standard W3C layout but unconfirmed on real hardware.

The Netflix adapter has never run against netflix.com, only the fixtures. See
HANDOFF.md for what to check first if it misbehaves there.

## Project memory (required)
This project's memory lives in `.assistant/`. Read `goal.md` and `state.md` before starting work.
Before you finish work that changed files, update:
- `state.md`: the new current state
- `issues.md`: add new issues; move fixed ones to Fixed with today's date
- `roadmap.md`: check off completed items, add new ones
- `history.md`: one dated line describing what changed
Keep entries short. These files are how the Assistant knows what's going on.
