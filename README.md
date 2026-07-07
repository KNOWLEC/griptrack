# GripTrack 🏋️🥋

A local-first, mobile PWA workout tracker built around Brazilian Jiu-Jitsu. Ships with a
BJJ-specific strength program (lunchtime lifting before evening rolling), per-set logging
with RPE and rest timers, a BJJ-fatigue rating per session, and an AI coach (Claude via a
tiny AWS Lambda) that reviews your logs and adjusts upcoming targets.

**Live app:** https://knowlec.github.io/griptrack/

## Highlights

- **Local-first**: all data lives in IndexedDB on your phone; JSON export/import for backup.
- **Offline-capable PWA**: install to home screen; logging works with zero signal.
- **Built-in progression**: double-progression engine suggests weights from your logs, with a
  fatigue gate that holds loads when BJJ is beating you up.
- **AI coach**: sends the last 28 days of logs to Claude, gets back structured target
  adjustments + coaching notes. Every change is a program revision you can revert.

## Development

```sh
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build
node --experimental-strip-types scripts/test-progression.ts   # progression engine checks
```

## Backend (coach)

`backend/` contains a Python 3.12 AWS Lambda (Function URL, CORS locked to the Pages
origin, shared-secret header). See `backend/deploy.ps1` for packaging and the one-time
AWS setup commands. Test locally with `python backend/test_local.py`.
