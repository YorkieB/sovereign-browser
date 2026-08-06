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

Before any AI coding or automation-codebase work begins, run `npm run agent-preflight`. It checks whether this repo is actually safe to work in right now — git status, `.onecommit.json`, the action log, the safety scripts themselves, `.gitignore`, and whether anything's already listening on the dashboard's port — and ends with exactly one of two lines: `PREFLIGHT: PASS`, meaning it's fine to proceed, or `PREFLIGHT: FAIL` with the specific reasons listed underneath. A FAIL means stop and resolve what's listed before making any edits, not push through it. This applies to any real coding project or automation codebase generally, not just this browser — Holly, Sovereign, YorkieGPT scripts and training work, KM Records automation, n8n workflows, and similar tracked repos. One detail worth knowing going in: `logs/` is tracked on purpose, not gitignored — an append-only log needs real git history to be worth anything — so its protection comes from `ai-revert`'s own protected-path refusal, not from `.gitignore`. Only `.env` and `backups/` are meant to be gitignored.

After work happens — or any time it's worth double-checking nothing has drifted — run `npm run audit-actions`. Where `agent-preflight` is a gate before work starts, `audit-actions` is the check for after or between changes: it walks recent Git history against the action log looking for commits that touch real files but have no matching log entry, confirms every logged commit still resolves in Git, validates the JSONL itself, flags a dirty or untracked working tree, confirms `.onecommit.json` and the safety scripts are present, and checks checkpoint tags for obviously malformed names. Log-only commits (the "append Action N" ones) and merge commits are recognized and explained as exempt, not silently ignored — they're expected to exist without a log entry of their own. It ends with `AUDIT: PASS` if nothing's wrong, or `AUDIT: FAIL` with the specific reasons listed underneath, same as `agent-preflight` — a FAIL means stop and resolve what's listed.

Before starting a change, run `bash scripts/ai-checkpoint "label"` to mark a restore point. It commits whatever's currently staged/unstaged first (so the checkpoint reflects a real, complete state), tags it `checkpoint-<timestamp>`, and prints the resulting commit hash. If there's nothing to commit, it says so and tags the current HEAD as-is rather than creating an empty commit.

Actions and their outcomes are recorded in `logs/ai-action-log.md` / `logs/ai-action-log.jsonl` via `scripts/log-action.mjs` — append-only, never edited by hand.

`npm run dashboard` starts a local revert dashboard at `http://127.0.0.1:4597/` (bound to `127.0.0.1` only). It supports listing recent actions, inspecting a candidate, viewing a dry-run plan, and — as of this build — executing a revert with typed confirmation. Executing requires typing `REVERT` exactly; anything else cancels and nothing is attempted. A confirmed revert calls the same CLI path directly — `node scripts/ai-revert execute <target>` — the dashboard has no separate revert logic of its own. Merge commits, protected paths (`logs/`, `.env`, `backups/`), and a dirty working tree are all refused by `ai-revert` itself, exactly as they are from the CLI. A successful revert runs `npm run check` and `npm run smoke` and is judged by their output text, never by exit codes. Keep any temporary test or scratch files outside the repo when exercising this by hand — an untracked file left inside the repo is enough on its own to trip the dirty-tree check.

This whole system — checkpoints, the action log, the revert engine, this dashboard — isn't specific to this browser. The browser is just where it was first built and proven. The same one-change-one-commit discipline applies by default to any real coding project or automation codebase: Holly, Sovereign, YorkieGPT scripts and training work, KM Records automation, n8n workflows, and similar tracked repos.
