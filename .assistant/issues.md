# Issues — CouchTube

## Open

- Never validated against a physical controller. The button-index mapping in src/mapping.js is the standard W3C layout but unconfirmed on real hardware.
- The Netflix adapter has never run against netflix.com, only tools/fixtures, because the real site needs a login. HANDOFF.md lists the three things to check first if it misbehaves there.
- Captions on Netflix depend on reaching netflix.appContext from the main world. If that ever moves, everything else falls back to the video element but captions just stop.

## Fixed

- Nothing recorded yet. Move items here with the date they were fixed.
