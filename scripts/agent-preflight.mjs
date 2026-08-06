#!/usr/bin/env node
// agent-preflight.mjs — loudly reports whether this repo is safe for AI
// coding work before edits begin. Read-only: this script never writes to
// git, never touches files, and never calls ai-revert or ai-checkpoint. It
// only inspects and reports.
//
// Output is the source of truth, not the process exit code (exit codes
// have proven unreliable through the remote channel this whole project was
// built over). The last lines are always exactly one of:
//   PREFLIGHT: PASS
// or
//   PREFLIGHT: FAIL
//   - <specific reason>
//   - <specific reason>
//
// Usage: node scripts/agent-preflight.mjs   (run from the repo root)

import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";

const failures = [];
const warnings = [];
const passes = [];

function fail(label, detail) {
	failures.push(`${label}: ${detail}`);
}
function warn(label, detail) {
	warnings.push(`${label}: ${detail}`);
}
function pass(label, detail) {
	passes.push(detail ? `${label}: ${detail}` : label);
}

function git(args) {
	return execFileSync("git", args, { encoding: "utf-8" }).trim();
}

function isDirectory(p) {
	try {
		return statSync(p).isDirectory();
	} catch {
		return false;
	}
}

// Independent, deliberately duplicated copy of the same validation
// ai-revert applies to .onecommit.json - not imported from ai-revert,
// since ai-revert is not being touched for this action. Small, simple
// schema; the duplication is a known, acceptable tradeoff, not an oversight.
// Returns the parsed config on success too, so callers can read fields
// (like the Sandbox-First ones) beyond just "verify".
function checkOneCommitConfig() {
	let raw;
	try {
		raw = readFileSync(".onecommit.json", "utf-8");
	} catch (err) {
		return { ok: false, detail: `not found or unreadable: ${err.message}` };
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		return { ok: false, detail: `not valid JSON: ${err.message}` };
	}
	if (!Array.isArray(parsed.verify)) {
		return { ok: false, detail: `must have a "verify" array (found ${typeof parsed.verify})` };
	}
	for (const [i, step] of parsed.verify.entries()) {
		if (!step || typeof step.name !== "string" || typeof step.command !== "string" || typeof step.successText !== "string") {
			return { ok: false, detail: `verify[${i}] must have string name/command/successText` };
		}
	}
	return { ok: true, detail: `valid, ${parsed.verify.length} verify command(s) configured`, config: parsed };
}

function checkActionLog() {
	let raw;
	try {
		raw = readFileSync("logs/ai-action-log.jsonl", "utf-8");
	} catch (err) {
		return { ok: false, detail: `logs/ai-action-log.jsonl not found or unreadable: ${err.message}` };
	}
	const lines = raw.split("\n").filter((l) => l.trim().length > 0);
	for (const [i, line] of lines.entries()) {
		try {
			JSON.parse(line);
		} catch (err) {
			return { ok: false, detail: `logs/ai-action-log.jsonl line ${i + 1} is not valid JSON: ${err.message}` };
		}
	}
	return { ok: true, detail: `${lines.length} of ${lines.length} lines parse as valid JSON` };
}

// Probes port availability by trying to bind it directly, rather than
// shelling out to netstat (Windows-only) - this stays portable.
function checkDashboardPort() {
	return new Promise((resolve) => {
		const probe = createServer();
		probe.once("error", (err) => {
			resolve(err.code === "EADDRINUSE" ? { inUse: true } : { inUse: false, note: err.message });
		});
		probe.once("listening", () => {
			probe.close(() => resolve({ inUse: false }));
		});
		probe.listen(4597, "127.0.0.1");
	});
}

function printReport() {
	console.log("=== agent-preflight ===\n");
	for (const p of passes) console.log(`  ok    ${p}`);
	if (warnings.length) {
		console.log("");
		for (const w of warnings) console.log(`  warn  ${w}`);
	}
	console.log("");
	if (failures.length === 0) {
		console.log("PREFLIGHT: PASS");
	} else {
		console.log("PREFLIGHT: FAIL");
		for (const f of failures) console.log(`  - ${f}`);
	}
}

async function main() {
	// Git-repo check comes first and short-circuits everything else - every
	// other check depends on git commands that would just fail confusingly
	// if this isn't actually a repo at all.
	let isGitRepo = false;
	try {
		isGitRepo = git(["rev-parse", "--is-inside-work-tree"]) === "true";
	} catch {
		isGitRepo = false;
	}
	if (!isGitRepo) {
		fail("git repository", "not inside a Git working tree (git rev-parse --is-inside-work-tree failed)");
		printReport();
		return;
	}
	pass("git repository", "confirmed");

	// Branch and upstream.
	let branch = null;
	try {
		branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
	} catch (err) {
		fail("branch", `could not determine current branch: ${err.message}`);
	}
	if (branch === "HEAD") {
		fail("branch", "detached HEAD - no branch checked out");
		branch = null;
	} else if (branch) {
		pass("branch", `on "${branch}"`);
	}

	let upstream = null;
	if (branch) {
		try {
			upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
			pass("upstream", `tracking "${upstream}"`);
		} catch {
			fail("upstream", "no upstream configured for the current branch");
		}
	}

	if (upstream) {
		try {
			const out = git(["rev-list", "--left-right", "--count", `${upstream}...HEAD`]);
			const [behind, ahead] = out.split(/\s+/);
			pass("ahead/behind", `${ahead} ahead, ${behind} behind ${upstream}`);
			if (Number(ahead) > 10) {
				warn("ahead/behind", `${ahead} unpushed commits - consider pushing soon`);
			}
		} catch (err) {
			fail("ahead/behind", `could not resolve: ${err.message}`);
		}
	} else {
		fail("ahead/behind", "cannot resolve - no upstream configured");
	}

	// Working tree: modified/staged files and untracked files are reported
	// as two distinct failure reasons, not one blended "dirty" message.
	const statusOut = git(["status", "--porcelain"]);
	const statusLines = statusOut.split("\n").filter((l) => l.length > 0);
	const modifiedLines = statusLines.filter((l) => !l.startsWith("??"));
	const untrackedLines = statusLines.filter((l) => l.startsWith("??"));

	if (modifiedLines.length === 0) {
		pass("working tree", "clean, no modified/staged files");
	} else {
		fail("working tree", `${modifiedLines.length} modified/staged file(s) present`);
	}
	if (untrackedLines.length === 0) {
		pass("untracked files", "none present");
	} else {
		fail(
			"untracked files",
			`${untrackedLines.length} untracked file(s) present: ${untrackedLines.map((l) => l.slice(3)).join(", ")}`,
		);
	}

	// .onecommit.json, plus the Sandbox-First fields it may carry. Invalid
	// or missing config is still a hard failure - the sandbox checks below
	// only run once the config itself is confirmed valid, and are warnings
	// even then, since a missing sandbox doesn't make THIS repo unsafe by
	// itself - it only matters once risky logic/side-effect work is about
	// to happen, not for every small edit.
	const configCheck = checkOneCommitConfig();
	if (configCheck.ok) {
		pass(".onecommit.json", configCheck.detail);

		const sandboxRoot = configCheck.config.sandboxRoot;
		const requireSandboxFor = configCheck.config.requireSandboxFor;

		if (typeof sandboxRoot !== "string" || sandboxRoot.length === 0) {
			warn(
				"sandbox",
				"no sandboxRoot configured in .onecommit.json - sandbox-first testing can't be verified until one is set; only matters before risky logic/side-effect work, not every small edit",
			);
		} else if (!isDirectory(sandboxRoot)) {
			warn(
				"sandbox",
				`sandboxRoot "${sandboxRoot}" is configured but does not exist yet - create it before risky logic/side-effect work that should be sandbox-tested first`,
			);
		} else {
			pass("sandbox root", `${sandboxRoot} exists`);
			const resultsDir = path.join(sandboxRoot, "_results");
			if (isDirectory(resultsDir)) {
				pass("sandbox results", `${resultsDir} exists`);
			} else {
				warn(
					"sandbox",
					`sandboxRoot exists but its _results folder ("${resultsDir}") is missing - sandbox test results have nowhere durable to be written yet`,
				);
			}
		}

		if (!Array.isArray(requireSandboxFor)) {
			warn("sandbox", "requireSandboxFor is missing or not an array in .onecommit.json - no categories are currently declared as requiring sandbox-first testing");
		} else if (requireSandboxFor.length === 0) {
			warn("sandbox", "requireSandboxFor is an empty array - no categories currently require sandbox-first testing");
		} else {
			pass("sandbox categories", `requireSandboxFor: ${requireSandboxFor.join(", ")}`);
		}
	} else {
		fail(".onecommit.json", configCheck.detail);
	}

	// Action log
	const jsonlCheck = checkActionLog();
	if (jsonlCheck.ok) {
		pass("action log", jsonlCheck.detail);
	} else {
		fail("action log", jsonlCheck.detail);
	}

	// Safety scripts present
	for (const f of ["scripts/ai-checkpoint", "scripts/log-action.mjs", "scripts/ai-revert"]) {
		if (existsSync(f)) {
			pass("safety script", `${f} present`);
		} else {
			fail("safety script", `${f} is missing`);
		}
	}

	// Protected paths in .gitignore. logs/ is deliberately NOT gitignored in
	// this system - it's meant to be tracked so the action log has real git
	// history. Its protection comes from ai-revert's own protected-path
	// refusal, not from .gitignore. Only .env and backups/ belong here.
	const gitignoreContent = existsSync(".gitignore") ? readFileSync(".gitignore", "utf-8") : "";
	const gitignoreLines = gitignoreContent.split("\n").map((l) => l.trim());
	for (const pattern of [".env", "backups/"]) {
		if (gitignoreLines.includes(pattern)) {
			pass(".gitignore", `"${pattern}" present`);
		} else {
			fail(".gitignore", `"${pattern}" is missing from .gitignore`);
		}
	}
	pass("logs/ protection", "intentionally tracked, not gitignored - protected via ai-revert's protected-path refusal instead");

	// Dashboard port - informational, not a hard failure either way.
	const portCheck = await checkDashboardPort();
	if (portCheck.inUse) {
		warn("dashboard", "something is currently listening on 127.0.0.1:4597");
	} else {
		pass("dashboard", "127.0.0.1:4597 is free (no listener)");
	}

	printReport();
}

main();
