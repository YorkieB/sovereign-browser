# AI Action Log

Human-readable log of every file-changing action taken under the One Change, One Commit discipline. Append-only — entries are never edited or removed once written, including during a revert (a revert gets its own new entry).

Machine-readable twin: `logs/ai-action-log.jsonl` (one JSON object per line). Both are written by `scripts/log-action.mjs` going forward.

**Actions 001–003 below are backfilled.** They happened before this log existed, so these entries were written after the fact from the actual git history rather than in real time. Everything from Action 004 onward is logged as it happens.

### 2026-08-05T20:43:31+01:00 — 001
Instruction: Preserve the renderer.js flicker fix as a standalone action; verify and commit only that change
Commit: f2b3cd542c74ead5c0c91aa0ebd490cec5dae8ff  Status: success

### 2026-08-05T20:49:26+01:00 — 002
Instruction: Phase 0: freeze and safety net — record HEAD, full backup outside the repo, required folders, .gitignore update
Commit: 7c0b9a2d8d198425d8680c3b9b51858cf8908345  Status: success

### 2026-08-05T20:58:29+01:00 — 003
Instruction: Reconcile local main with origin/main before Phase 1 (merge, not rebase)
Commit: ba26f16137785cd8bcb36ce34db14ae6ff7dcc9f  Status: success

### 2026-08-05T21:17:59+01:00 — 004
Instruction: create append-only AI action log foundation
Commit: 9a4c6acfd729684371bd6bd00c22251b77a79bf6  Status: success

### 2026-08-05T21:27:54+01:00 — 006
Instruction: add checkpoint script and commit discipline docs
Commit: 26e3d8eca95cd9a1cde1f1fd048137f9b393d6f5  Status: success

### 2026-08-05T21:38:41+01:00 — 008
Instruction: Remove checkpoint-2026-08-05_212737 (created during ai-checkpoint script testing, not a real pre-action safe point)
Commit: -  Status: success

### 2026-08-05T21:44:25+01:00 — 010
Instruction: Fix scripts/ai-checkpoint so checkpoint purpose is explicit even when no commit is created; require a non-empty label
Commit: 6053eed05b95effcc9bdb108887402ce4233baeb  Status: success

### 2026-08-05T21:52:53+01:00 — 012
Instruction: Add verification ladder foundation (Phase 3, smallest piece): lightweight check script in package.json
Commit: 09bbdae4e2ee060a409cad63014e9e4c5b787d24  Status: success

### 2026-08-05T22:09:58+01:00 — 014
Instruction: Add Tier 2 main-process smoke hook to main.js only (--smoke-test detection, smokeFail helper, catch-block branch, did-fail-load/render-process-gone/did-finish-load/timeout listeners)
Commit: b02624049b5daada204e0cf3a7dfd92e05c10f57  Status: success

### 2026-08-05T22:45:57+01:00 — 016
Instruction: Guard tab view cleanup in destroyTab() when the parent BrowserWindow is already destroyed, per the read-only diagnosis of the post-smoke-PASS warning
Commit: dd1dd886e11a973effb0c2ef6b0edcb180f6f58d  Status: success

### 2026-08-05T22:56:01+01:00 — 018
Instruction: Add npm smoke script to package.json now that the main-process hook is proven and the smoke-only tab:load/tab:activate IPC noise is understood and accepted as-is
Commit: 54dbf6ff0c9b42f1470a823d90cdf4e9d5e20f97  Status: success

### 2026-08-05T23:07:35+01:00 — 020
Instruction: Add scripts/ai-revert as a read-only revert inspector - Phase 4 foundation, no mutating capability yet
Commit: 09f16b45aff3e314d4d0bbb2ec6ea81ff15379ab  Status: success

### 2026-08-05T23:14:02+01:00 — 022
Instruction: Extend scripts/ai-revert from read-only inspection to dry-run revert planning only - still no actual git revert/reset/stash/commit capability
Commit: c51fe04c1af755254ad4ade041e7e92c5b523bb3  Status: success

### 2026-08-05T23:23:56+01:00 — 024
Instruction: Add confirmed git-revert execution (execute mode) to scripts/ai-revert - reuses plan-mode eligibility checks, adds dirty-tree/revert-in-progress refusal, requires typed REVERT, runs check+smoke after, judged by output text
Commit: 703e87706c0e71c855d2f1da9dae9c2936624fa3  Status: success

### 2026-08-06T09:41:12+01:00 — 026
Instruction: Create a harmless dummy change (checkpoints/revert-test-2026-08-05.txt) specifically to prove the real revert engine end-to-end on a real, disposable commit
Commit: d1eb9ebb6e79729bbe39738e727969562c388c36  Status: success

### 2026-08-06T09:45:56+01:00 — 028
Instruction: Revert the harmless Action 026 test commit using scripts/ai-revert execute, to prove the real revert engine end-to-end against the real repo
Commit: 928188bf17c7976c12eed1d7ec871df2ad141a70  Status: success

### 2026-08-06T10:32:28+01:00 — 030
Instruction: Add the first read-only local revert dashboard - scripts/revert-dashboard.mjs, GET / only, wraps node scripts/ai-revert list mode, no mutation capability
Commit: 3f59a75b0c26b45dc6b687bb9e4325f21b0842cc  Status: success

### 2026-08-06T10:40:45+01:00 — 032
Instruction: Add a read-only candidate-detail route (GET /inspect/<target>) to the dashboard, wrapping node scripts/ai-revert <target>, with strict target validation and links from the list view
Commit: e8de99f17084da4f92206011242c0d217c13b19f  Status: success

### 2026-08-06T10:47:58+01:00 — 034
Instruction: Add a read-only dashboard plan view (GET /plan/<target>), wrapping node scripts/ai-revert plan <target>, plus a link from the inspect view; reused inspect's target validation via a shared parseTarget helper
Commit: 49ff858bccc199d6d1db62b1aae912fc796a7107  Status: success

### 2026-08-06T10:59:29+01:00 — 036
Instruction: Wire the read-only revert dashboard into normal usage: add npm run dashboard script and a README note covering what it can and cannot do
Commit: 44cfcfdebab132d6c7527189b7568b8ce7936c56  Status: success

### 2026-08-06T11:15:22+01:00 — 038
Instruction: Push safety-system branch history to origin/main
Commit: -  Status: success

### 2026-08-06T11:36:46+01:00 — 042
Instruction: Add the dashboard revert-confirmation UI on the plan page (typed REVERT required) with a POST /execute/<target> stub that always refuses to execute - proves the UI/wording before any real execute route is wired up
Commit: f1eb2c9b06fbd44dabd8ea8413ab113852b1bf59  Status: success

### 2026-08-06T12:07:53+01:00 — 044
Instruction: Enable dashboard POST /execute/<target> to call the real CLI (node scripts/ai-revert execute <target>) when confirm=REVERT exactly, tested against refusal/non-mutation cases only - no successful eligible revert performed in this action
Commit: 80d237bc539aade2f9e0737b101b529e388ec1d6  Status: success

### 2026-08-06T12:12:11+01:00 — 046
Instruction: Create a harmless dummy change (checkpoints/dashboard-revert-test-2026-08-06.txt) specifically to prove the dashboard revert button end-to-end next
Commit: 0fc5fe88a3ac563ff567f5b18b2120475036ac34  Status: success

### 2026-08-06T12:18:20+01:00 — 048
Instruction: Prove the dashboard revert button end-to-end on the harmless Action 046 commit via the real HTTP flow: GET /plan/046, then POST /execute/046 with confirm=REVERT
Commit: 01a42992cea4fe05c873990c7d8290f8b8285062  Status: success

### 2026-08-06T12:47:22+01:00 — 050
Instruction: Update README to document the now-proven dashboard revert button: list/inspect/plan/execute, localhost-only, typed REVERT required, same CLI path, refusal rules, check/smoke verification, text-not-exit-code judging, scratch-file hygiene, and the general (not browser-only) framing of the whole discipline
Commit: 721ef7d824348bc31f3da2cdc45198f580ea1bbb  Status: success

### 2026-08-06T12:53:44+01:00 — 052
Instruction: Push completed Phase 5 dashboard revert work to origin/main
Commit: -  Status: success

### 2026-08-06T13:38:03+01:00 — 054
Instruction: Make scripts/ai-revert read post-revert verification commands from .onecommit.json instead of hardcoding npm run check / npm run smoke - Phase 6's smallest first action, prerequisite for a portable bootstrap kit
Commit: 29861e0be062b9399935cc4e5edc66d6289aab53  Status: success

### 2026-08-06T13:47:45+01:00 — 056
Instruction: Add scripts/agent-preflight.mjs - a read-only watchdog that loudly reports PREFLIGHT: PASS or PREFLIGHT: FAIL with specific reasons, checking git-repo status, branch/upstream/ahead-behind, tree cleanliness, .onecommit.json validity, action log validity, safety-script presence, .gitignore protected paths, and dashboard port status
Commit: ca6274f6f63c66625fe7d42c8183c10f2b7fbce3  Status: success

### 2026-08-06T13:54:03+01:00 — 058
Instruction: Wire agent-preflight into normal usage: npm run agent-preflight script, plus README documentation on when/why to run it, what PASS/FAIL mean, that it applies generally not just to the browser, and the logs/ vs .gitignore protection note
Commit: 85698bf14a7b823cb48faabd4f944de45c6894b7  Status: success

### 2026-08-06T14:03:38+01:00 — 060
Instruction: Add scripts/audit-actions.mjs - a read-only drift audit checking JSONL validity, logged-commit resolution, unlogged-commit detection against a recent window with merge/protected-path exemptions explained not silently ignored, tree cleanliness, .onecommit.json, safety scripts, checkpoint tag well-formedness, and dashboard port state
Commit: a3d1461629ce2e2a0fa9298185284250b0eda276  Status: success

### 2026-08-06T14:10:52+01:00 — 062
Instruction: Wire drift audit into normal usage: npm run audit-actions script, plus README documentation on when to run it, PASS/FAIL meaning, what it detects, and how it complements agent-preflight (before vs after/between work)
Commit: 96d4460325bd938a36cb591c5f6b7df94c4c5a0e  Status: success

### 2026-08-06T14:23:34+01:00 — 064
Instruction: Add tracked Git hook watchdog files (.githooks/commit-msg, pre-commit, pre-push) plus scripts/install-githooks.mjs, without enabling hooks - core.hooksPath left untouched
Commit: d2f3c49eb83b03cf9805ed6d717a19fde7e67fbb  Status: success

### 2026-08-06T14:32:30+01:00 — 066
Instruction: Wire the Git hook installer into normal usage without enabling hooks: npm run install-githooks and npm run enable-githooks scripts, plus README docs covering that hooks live in .githooks/, are inactive until core.hooksPath is set, install-githooks is dry-run only, what enabling activates, that --no-verify bypasses hooks so audit-actions still matters, and that pre-push is slower since it runs check and smoke
Commit: 886dec24acf515038e9e5b49a235d9c85f042ace  Status: success

### 2026-08-06T14:39:43+01:00 — 068
Instruction: Enable the tracked Git hooks in the real repo (npm run enable-githooks, sets core.hooksPath to .githooks) and prove commit-msg, pre-commit, and pre-push all actually block unsafe actions through real git invocation, not just direct script calls
Commit: -  Status: success

### 2026-08-06T14:50:17+01:00 — 070
Instruction: Push watchdog enforcement work to origin/main
Commit: -  Status: success

### 2026-08-06T15:03:08+01:00 — 072
Instruction: Create the permanent Sandbox-First root on the PC: C:\YorkieB\_sandbox\, C:\YorkieB\_sandbox\_results\, and a README.md explaining the convention, result-file template, and the two exact greppable marker lines
Commit: -  Status: success

### 2026-08-06T15:11:55+01:00 — 074
Instruction: Add Sandbox-First config to .onecommit.json: sandboxRoot and requireSandboxFor (hooks, watchdog-scripts, git-mutation, filesystem-mutation, automation, service-control, generated-code), leaving the existing verify block unchanged
Commit: 18958bb29f0516d4d757f083043a06a1c9458222  Status: success

### 2026-08-06T15:18:24+01:00 — 076
Instruction: Update agent-preflight to read sandboxRoot and requireSandboxFor from .onecommit.json and report sandbox readiness - missing sandboxRoot or _results are warnings, invalid .onecommit.json remains a hard failure, existing checks unchanged
Commit: 284698c30af7691fe0b417eda5687a3841a3bfed  Status: success

### 2026-08-06T15:27:35+01:00 — 078
Instruction: Update audit-actions to read sandboxRoot/requireSandboxFor from .onecommit.json and report readiness, and to verify any sandboxResult reference in the JSONL log points to a file that actually exists on disk - missing sandboxRoot/_results are warnings, a missing referenced sandboxResult file is a hard failure, invalid .onecommit.json remains a hard failure, not every action is required to have a sandboxResult
Commit: 3ef24a1883f93c45bcc7a948224cd85b7c1d0117  Status: success

### 2026-08-06T15:36:55+01:00 — 080
Instruction: Document Sandbox-First as part of the One Change, One Commit watchdog system in README: root/results paths, risk categories, result-file marker lines, agent-preflight/audit-actions integration, promotion discipline, and the broader (not browser-only) framing
Commit: 10fd7bce2a97ec64ea26dde51912df90513f02d4  Status: success

### 2026-08-06T15:55:30+01:00 — 082
Instruction: Push Sandbox-First watchdog integration to origin/main
Commit: -  Status: success

### 2026-08-06T16:46:31+01:00 — 084
Instruction: Remove dead front-end remnants of the old DOM #menu-bar (markup removed in f1184d3): orphaned menu-bar CSS blocks, renderBookmarksMenu() and both call sites, the document-level .menu-option wiring loop, the bookmarks-menu-list fold-in branch and dead menu-separator check inside popupNativeMenu, and the bookmarksMenuList lookup. Live overflow menu, #tab-context-menu, #webview-context-menu, native menu handling, and nav buttons untouched.
Commit: 7c07f8dc6b2fc2526b4a7f2d79e3d3c07644e8ef  Status: success

### 2026-08-06T17:16:01+01:00 — 086
Instruction: Revert action 084 (7c07f8d) as a user-directed diagnostic reset after a flicker report in the freshly launched post-084 instance. git revert only via scripts/ai-revert execute 084 with typed REVERT confirmation; no manual edits; logs untouched by the revert commit; Action 085 not reverted.
Commit: 0eb6c4c110449d9a0a0a5810d08d1778f32b5cd9  Status: success

### 2026-08-21T17:45:44+01:00 — 088
Instruction: Register the crx:// protocol handler on the browsing session so <browser-action-list> toolbar icons resolve instead of falling back to lettered tiles.
Commit: 272e8c71439155778ccede04b738a7925aef3124  Status: success

### 2026-08-21T17:52:57+01:00 — 090
Instruction: Add a single-instance lock so a duplicate HOLLY launch exits and focuses the running window instead of contending for the profile's LevelDB locks.
Commit: 4c8051450aa091b1729d44c32f29a3f5ddfe0d6d  Status: success

### 2026-08-21T20:22:06+01:00 — 092
Instruction: Promote the sandbox-proven vault core into the HOLLY repo as vault/vault-crypto.mjs, vault/vault-service.mjs and vault/vault-ipc.mjs. Files only - no wiring into main.js, no behaviour change to the running browser.
Commit: a545e2511f536e0146ce39f7475899dee38f45fc  Status: success

### 2026-08-21T20:26:46+01:00 — 094
Instruction: Add the vault window's preload as vault/vault-preload.js. File only - not referenced by any BrowserWindow yet, so no behaviour change.
Commit: 22b6714cee6b83a2112e6ad7ff9bb780682a580c  Status: success

### 2026-08-21T20:31:51+01:00 — 096
Instruction: Wire the vault into main.js: instantiate VaultService against the profile directory and register the vault IPC channels behind an identity guard. No window yet, so no sender can be authorised.
Commit: 819b558885bfc79228bf9950c57cb8f94f293cb8  Status: success

### 2026-08-21T20:37:39+01:00 — 098
Instruction: Clear the pre-existing 'No handler registered for tab:activate' defect recorded in Action 096, so it is not carried forward into the vault window work.
Commit: df1d0c8497662bd90597ae8472a6d73e96002427  Status: success

### 2026-08-21T20:53:40+01:00 — 100
Instruction: Vendor the built Keychain vault UI into the HOLLY repo at vault/ui/, so the vault window created in the next action opens onto a working interface rather than a blank page. Files only - nothing loads them yet.
Commit: c715a8b2f9830acf65a66e66e8b4525df53beb4a  Status: success

### 2026-08-21T21:02:02+01:00 — 102
Instruction: Create the vault window: its own session, vault-preload.js attached, VAULT_WINDOW_ID pinned on creation and cleared on close, opened with Ctrl+Shift+K. This is the action that makes the vault reachable.
Commit: e524037bedcf4c533b1ff8f9a5ede531e17c3c0d  Status: success

### 2026-08-21T21:21:00+01:00 — 104
Instruction: Add Keychain to HOLLY's overflow menu. Ctrl+Shift+K was the only way to reach the vault, which is not discoverable - there was no visible way to launch the password manager.
Commit: 5e61943cceb3ce2648a903a00c2300681ed6d915  Status: success

### 2026-08-21T22:15:13+01:00 — 106
Instruction: Promote the sandbox-proven page-integration layer into the HOLLY repo: origin matching, the page-facing vault surface, the page IPC, the page agent, and the save prompt. Files only - nothing imports or injects them yet.
Commit: 4097596fced36af573754043f65cc32697d1ccfa  Status: success

### 2026-08-21T22:23:55+01:00 — 108
Instruction: Attach vault/page-preload.js to tab webContents so web pages can reach the narrow page-vault bridge. Non-incognito tabs only. Nothing answers the channels yet - the page IPC is registered in the next action.
Commit: 46b9b1f936d05a8326579842ae19a57b12c0609b  Status: success

### 2026-08-21T22:35:14+01:00 — 110
Instruction: Wire page autofill into HOLLY: create the page-facing vault surface, register the pagevault IPC behind a tab-identity guard, inject the page agent into tabs, and hand save offers to a browser-drawn prompt. Completes the autofill sequence - the feature is live after this.
Commit: ec93ec302b376d54f37dba61fa597534f36f85a5  Status: success

### 2026-08-21T22:44:33+01:00 — 112
Instruction: Make the auto-lock policy survive a restart. It previously reset to 15 minutes on every launch because HOLLY had no settings layer, so the Never option and any chosen window were effectively cosmetic.
Commit: 4c0a840ac4059b6c01457daa5a2b6902dca358c0  Status: success

### 2026-08-22T09:00:16+01:00 — 114
Instruction: Rebuild the autofill suggestion panel to match the layout Yorkie asked for (a Proton Pass style saved-passwords list): titled header with a close button, one row per credential showing username, site and a masked password, a 'Manage passwords' footer, and a count badge on the field.
Commit: d8c8d43254bb439404e9e8f4516a6c83308ddb75  Status: success

### 2026-08-22T09:13:47+01:00 — 116
Instruction: Make the autofill badge always present on login fields, and have the panel state why it is empty rather than silently not appearing - matching Proton Pass behaviour. Prompted by Yorkie seeing nothing at all on https://github.com/login.
Commit: 1bcd872fe3f45c81b3b52c4e65e5f89dd93295a2  Status: success

### 2026-08-22T09:20:11+01:00 — 118
Instruction: Fix the two matcher defects found in Yorkie's real vault during Action 116: entries holding several URLs only ever matched the first, and www was treated as a different host from the apex.
Commit: 5c82347c33d8e769fad9af2d0b6eb91dc9463f96  Status: success

### 2026-08-22T09:46:47+01:00 — 120
Instruction: Stop the vault locking when the Keychain window is closed. Yorkie reported unlocking, closing the window, and finding the vault locked again - which makes autofill unusable.
Commit: 3be1f8a44793075d8947180c1c1d2d0255ee657b  Status: success

### 2026-08-22T10:01:43+01:00 — 122
Instruction: No badge appeared on the Namecheap sign-in dropdown. Detect login forms that are present in the DOM at load but hidden, and revealed later without any element being inserted.
Commit: 06cc01afbc7aa47729340116108ebf11d155b3a1  Status: success

### 2026-08-22T10:21:40+01:00 — 124
Instruction: Reduce the chance of sites treating HOLLY as an anomaly, after Namecheap temporarily locked Yorkie's registrar account for 'unusual activity' following a sign-in from HOLLY.
Commit: dd4dd01cc5578ee9fb66d3d5137ad98b2d05c9cd  Status: success
