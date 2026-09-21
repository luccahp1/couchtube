# State — CouchTube

_As of 2026-09-21._

**Status:** active
**Stack:** browser-extension, javascript, mv3
**Repo:** luccahp1/couchtube

## What works

- v0.2.0. Works on YouTube and Netflix, one adapter per site behind `CT.site`.
- 21 checks on live YouTube and 39 on the Netflix fixtures, all passing headless.
- Netflix playback goes through Netflix's own player API, not the video element.
- R3 on Netflix skips the intro when there is one, else next episode.
- Netflix rows page along when you run off the end.

## In progress

- Nothing mid-flight.

## How to run

```
node tools/run-e2e.mjs              # both suites, headless, ~90s
node tools/run-e2e.mjs netflix      # fixtures only, no network
pwsh tools/dev-brave.ps1 -Fresh     # throwaway Brave on monitor 2, CDP on :9222
```

## How to deploy

Loaded unpacked from C:\Projects\couchtube. No store listing. Moving the folder
unloads it, load it again from the new path.
