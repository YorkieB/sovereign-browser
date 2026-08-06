#!/usr/bin/env node
// install-githooks.mjs — installs (or previews installing) this repo's
// tracked .githooks/ directory as the active Git hooks path.
//
// Default: dry-run. Prints what would happen, confirms the hook files
// exist, and never touches git config.
// With --enable: actually runs `git config core.hooksPath .githooks`.
//
// Usage:
//   node scripts/install-githooks.mjs            -> dry-run / status only
//   node scripts/install-githooks.mjs --enable    -> actually enables hooks

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const HOOKS_DIR = ".githooks";
const REQUIRED_HOOKS = ["commit-msg", "pre-commit", "pre-push"];

function git(args) {
	return execFileSync("git", args, { encoding: "utf-8" }).trim();
}

function currentHooksPath() {
	try {
		return git(["config", "--get", "core.hooksPath"]);
	} catch {
		return null;
	}
}

function main() {
	const enable = process.argv.includes("--enable");

	console.log(`=== install-githooks (${enable ? "ENABLE" : "dry-run"}) ===\n`);

	let allPresent = true;
	for (const h of REQUIRED_HOOKS) {
		const p = `${HOOKS_DIR}/${h}`;
		if (existsSync(p)) {
			console.log(`  ok       ${p} present`);
		} else {
			console.log(`  missing  ${p} not found`);
			allPresent = false;
		}
	}

	const current = currentHooksPath();
	console.log(`\nCurrent core.hooksPath: ${current || "(not set - using default .git/hooks)"}`);

	if (!allPresent) {
		console.log("\nINSTALL-GITHOOKS: BLOCKED - one or more hook files are missing. Nothing changed.");
		return;
	}

	if (!enable) {
		console.log(`\nThis would run:  git config core.hooksPath ${HOOKS_DIR}`);
		console.log("Nothing has been changed. Re-run with --enable to actually apply it.");
		console.log("\nINSTALL-GITHOOKS: DRY-RUN COMPLETE (no git config changed)");
		return;
	}

	git(["config", "core.hooksPath", HOOKS_DIR]);
	const after = currentHooksPath();
	if (after === HOOKS_DIR) {
		console.log(`\ncore.hooksPath is now "${after}".`);
		console.log("\nINSTALL-GITHOOKS: ENABLED");
	} else {
		console.log(`\nSomething went wrong - core.hooksPath is "${after}", expected "${HOOKS_DIR}".`);
		console.log("\nINSTALL-GITHOOKS: ENABLE FAILED");
	}
}

main();
