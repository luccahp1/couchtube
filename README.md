# CouchTube

A Brave/Chromium extension that turns YouTube into a console-style interface you
can drive entirely with a game controller. Built for watching from bed or the
couch, where a mouse is not within reach.

Plug in an Xbox/PlayStation/8BitDo pad, press a button, and YouTube grows a focus
ring, a 10-foot player HUD and an on-screen keyboard.

## What it does

**Browsing** — a focus ring moves around the page by geometry (not tab order), so
the d-pad goes where you'd expect. A takes you into a video, B goes back, X opens
a big on-screen keyboard for search, Y toggles a page zoom for reading from
across the room.

**Player** — on a watch page the pad drives the video directly: play/pause, seek
(hold to accelerate), volume, captions, speed, next video. A custom HUD frames
the video with the title, a scrubber and state pills, and YouTube's own control
bar is hidden while the pad is in charge so there aren't two of everything.

**Controls sheet** — the Menu/Start button shows every binding for the mode you're
in, so nothing has to be memorised.

Everything fades out a few seconds after you stop touching the pad. Move the
mouse and the overlay steps aside immediately.

## Install

It is not on any store. Load it unpacked:

1. Go to `brave://extensions` (or `chrome://extensions`)
2. Turn on **Developer mode**
3. **Load unpacked** → pick this folder
4. Open YouTube, press a button on the controller

The pad is only visible to a page after you press a button on it while that page
has focus. That is a browser rule, not something the extension can work around.

## Controls

| Browsing | | Player | |
|---|---|---|---|
| D-pad / left stick | Move focus | A | Play / pause |
| A | Open | D-pad ← → | Seek (hold to scrub faster) |
| B | Back | D-pad ↑ ↓ | Volume |
| X | Search keyboard | X | Captions |
| Y | Couch zoom | Y | Fullscreen |
| LB / RB | Page up / down | LB / RB | Seek 60s |
| L3 | Show the mouse again | LT / RT | Speed |
| View | Jump to the player | L3 / R3 | Mute / next video |
| Guide | YouTube home | View | Switch to browsing |
| Menu | Controls sheet | B | Leave fullscreen, then browsing |

B walks back out one layer at a time: fullscreen → player mode → browser history.

## Settings

Click the toolbar icon for the quick toggles, or open the full settings page for
deadzone, repeat rate, seek steps, HUD timeout and a live controller tester that
shows exactly which buttons your pad reports.

**Keyboard fallback** is off by default. Turn it on and arrow keys, Enter and
Backspace act like the pad — handy when the controller is charging, and it also
makes fullscreen work properly (see below).

## Known limitations

**Fullscreen.** Chromium does not treat gamepad input as a user gesture, so
`requestFullscreen()` from a controller press is refused. CouchTube tries it
anyway and, when it is refused, falls back to fullscreening the whole browser
window through the extension API and switching YouTube to theater mode. The
result is the same thing you want — video edge to edge, no browser chrome — it
just gets there differently. With keyboard fallback on, real element fullscreen
works because key events do count as a gesture.

**Autoplay.** Same root cause. On a profile with no history on YouTube, the
browser can refuse `play()` from a pad press. CouchTube tells you when that
happens; one click on the video is enough to unblock the session.

**Shorts** are treated as normal watch pages. They work, but the vertical feed is
not specifically designed for.

## Development

```bash
pwsh tools/dev-brave.ps1 -Fresh
```

Launches a throwaway Brave on your secondary monitor with the extension
side-loaded and remote debugging on. It only ever touches processes started from
its own dev profile, so your everyday browser is safe.

```bash
node tools/e2e.mjs
```

Drives the extension through its inject bridge — the same code path a real button
press takes — and asserts against the overlay's real DOM on a live YouTube page.

See [HANDOFF.md](HANDOFF.md) for where things stand and what is worth doing next.
