# State — CouchTube

_As of 2026-09-11._

**Status:** paused
**Stack:** browser-extension, javascript, mv3
**Repo:** luccahp1/couchtube

## What works

- Working v0.1.0, loaded unpacked in Brave and tested on live YouTube.
- 21-check end-to-end suite passes.
- Gamepad polling with deadzone, auto-repeat and hold acceleration.

## In progress

- Nothing mid-flight.

## How to run

```
pwsh tools/dev-brave.ps1 -Fresh     # throwaway Brave on monitor 2, CDP on :9222
node tools/e2e.mjs                  # 21-check suite
node tools/probe.mjs down right confirm
```

## How to deploy

Loaded unpacked. No store listing.
