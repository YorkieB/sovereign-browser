# HOLLY

A lightweight experimental web browser built with Electron. Includes tabs, address bar, back/forward/reload, bookmarks, history, and basic downloads.

## Prerequisites
- Node.js 18+

## Run
```powershell
cd Holly
npm install
npm start
```

## Notes
- Bookmarks and history are stored in your Electron userData folder.
- Downloads save to your system Downloads folder.

## Development
One change = one commit; split stacked work with `git add -p`.

Before starting a change, run `bash scripts/ai-checkpoint "label"` to mark a restore point. It commits whatever's currently staged/unstaged first (so the checkpoint reflects a real, complete state), tags it `checkpoint-<timestamp>`, and prints the resulting commit hash. If there's nothing to commit, it says so and tags the current HEAD as-is rather than creating an empty commit.

Actions and their outcomes are recorded in `logs/ai-action-log.md` / `logs/ai-action-log.jsonl` via `scripts/log-action.mjs` — append-only, never edited by hand.
