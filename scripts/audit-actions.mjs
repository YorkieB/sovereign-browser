#!/usr/bin/env node
// audit-actions.mjs — detects drift between Git history, the action log,
// and the One Change, One Commit rules. Read-only: never writes to git,
// never touches files, never calls ai-revert, ai-checkpoint, or
// agent-preflight.
//
// Output is the source of truth, not the process exit code. The report
// ends with exactly one of:
//   AUDIT: PASS
// or
//   AUDIT: FAIL
//   - <specific reason>
//   - <specific reason>
//
// Usage: node scripts/audit-actions.mjs   (run from the repo root)

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";

const JSONL_PATH = "logs/ai-action-log.jsonl";
const PROTECTED_PREFIXES = ["logs/", ".env", "backups/"];
const RECENT_WINDOW = 20;

const failures = [];
const warnings = [];
const passes = [];
const infos = [];

function fail(label, detail) {
	failures.push(`${label}: ${detail}`);
}
function warn(label, detail) {
	warnings.push(`${label}: ${detail}`);
}
function pass(label, detail) {
	passes.push(detail ? `${label}: ${detail}` : label);
}
function info(label, detail) {
	infos.push(`${label}: ${detail}`);
}

function git(args) {
	return execFileSync("git", args, { encoding: "utf-8" }).trim();
}

// --- independent, deliberately duplicated copies of small ai-revert logic -
// not imported, since ai-revert is not being touched for this action.

function parents(hash) {
	const out = git(["rev-list", "--parents", "-1", hash]);
	return out.split(" ").filter(Boolean).slice(1);
}

function touchedFiles(hash) {
	const p = parents(hash);
	if (p.length > 1) {
		const out = git(["diff", "--name-only", p[0], hash]);
		return out ? out.split("\n").filter(Boolean) : [];
	}
	const out = git(["show", "--name-only", "--format=", hash]);
	return out ? out.split("\n").filter(Boolean) : [];
}

function protectedPathHits(files) {
	return files.filter((f) => PROTECTED_PREFIXES.some((p) => f === p.replace(/\/$/, "") || f.startsWith(p)));
}

function recentCommits(count) {
	const sep = "\x1f";
	const out = git(["log", `-${count}`, `--format=%H${sep}%h${sep}%s`]);
	if (!out) return [];
	return out.split("\n").map((line) => {
		const [hash, short, subject] = line.split(sep);
		return { hash, short, subject };
	});
}

function readActionLog() {
	let raw;
	try {
		raw = readFileSync(JSONL_PATH, "utf-8");
	} catch (err) {
		return { ok: false, reason: `${JSONL_PATH} not found or unreadable: ${err.message}` };
	}
	const byCommit = new Map();
	const byActionId = new Map();
	const lines = raw.split("\n").filter((l) => l.trim().length > 0);
	for (const [i, line] of lines.entries()) {
		let entry;
		try {
			entry = JSON.parse(line);
		} catch (err) {
			return { ok: false, reason: `${JSONL_PATH} line ${i + 1} is not valid JSON: ${err.message}` };
		}
		if (entry.action_id != null) byActionId.set(String(entry.action_id), entry);
		if (entry.commit) byCommit.set(entry.commit, entry);
	}
	return { ok: true, byCommit, byActionId, lineCount: lines.length };
}

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
	return { ok: true, detail: `valid, ${parsed.verify.length} verify command(s) configured` };
}

function checkDashboardPort() {
	return new Promise((resolve) => {
		const probe = createServer();
		probe.once("error", (err) => {
			resolve(err.code === "EADDRINUSE" ? { inUse: true } : { inUse: false });
		});
		probe.once("listening", () => {
			probe.close(() => resolve({ inUse: false }));
		});
		probe.listen(4597, "127.0.0.1");
	});
}

function checkpointTagInfo() {
	let out;
	try {
		out = git(["tag", "--list", "checkpoint-*"]);
	} catch {
		return { tags: [], malformed: [] };
	}
	const tags = out ? out.split("\n").filter(Boolean) : [];
	const pattern = /^checkpoint-\d{4}-\d{2}-\d{2}_\d{6}$/;
	const malformed = tags.filter((t) => !pattern.test(t));
	return { tags, malformed };
}

function printReport() {
	console.log("=== audit-actions ===\n");
	for (const p of passes) console.log(`  ok    ${p}`);
	if (infos.length) {
		console.log("");
		for (const i of infos) console.log(`  info  ${i}`);
	}
	if (warnings.length) {
		console.log("");
		for (const w of warnings) console.log(`  warn  ${w}`);
	}
	console.log("");
	if (failures.length === 0) {
		console.log("AUDIT: PASS");
	} else {
		console.log("AUDIT: FAIL");
		for (const f of failures) console.log(`  - ${f}`);
	}
}

async function main() {
	let isGitRepo = false;
	try {
		isGitRepo = git(["rev-parse", "--is-inside-work-tree"]) === "true";
	} catch {
		isGitRepo = false;
	}
	if (!isGitRepo) {
		fail("git repository", "not inside a Git working tree");
		printReport();
		return;
	}
	pass("git repository", "confirmed");

	// 1. logs/ai-action-log.jsonl parses.
	const log = readActionLog();
	if (!log.ok) {
		fail("action log", log.reason);
		printReport();
		return; // nothing downstream can be checked meaningfully without this
	}
	pass("action log", `parses cleanly, ${log.lineCount} entries`);

	// 2. Every non-null commit in the log resolves in Git.
	const missingCommits = [];
	let checkedCommits = 0;
	for (const entry of log.byActionId.values()) {
		if (entry.commit) {
			checkedCommits++;
			try {
				git(["cat-file", "-e", entry.commit]);
			} catch {
				missingCommits.push(entry);
			}
		}
	}
	if (missingCommits.length === 0) {
		pass("logged commits resolve", `${checkedCommits} logged commit(s) all still resolve in Git`);
	} else {
		for (const e of missingCommits) {
			fail("logged commit missing", `action ${e.action_id} points to ${e.commit} which no longer resolves in Git`);
		}
	}

	// 3-5. Recent commits: unlogged real commits vs. exempt categories.
	const recent = recentCommits(RECENT_WINDOW);
	const unlogged = [];
	const logOnly = [];
	const merges = [];
	let loggedOkCount = 0;
	for (const c of recent) {
		const entry = log.byCommit.get(c.hash);
		const isMerge = parents(c.hash).length > 1;
		if (isMerge) {
			merges.push({ ...c, logged: !!entry });
			continue;
		}
		const files = touchedFiles(c.hash);
		const hits = protectedPathHits(files);
		const isProtectedOnly = files.length > 0 && hits.length === files.length;
		if (isProtectedOnly) {
			logOnly.push({ ...c, logged: !!entry });
			continue;
		}
		if (entry) {
			loggedOkCount++;
		} else {
			unlogged.push(c);
		}
	}
	if (unlogged.length === 0) {
		pass("recent commit logging", `all non-exempt commits in the last ${recent.length} have a matching log entry (${loggedOkCount} checked)`);
	} else {
		for (const c of unlogged) {
			fail("unlogged commit", `${c.short} "${c.subject}" touches non-protected paths but has no matching log entry`);
		}
	}
	info(
		"log-only/protected commits",
		`${logOnly.length} in the recent window - exempt by design, self-documenting via commit message and protected by ai-revert regardless of log status`,
	);
	info(
		"merge commits",
		`${merges.length} in the recent window - exempt by design, ai-revert refuses these regardless of log status (needs explicit -m handling, not implemented)`,
	);

	// Known no-commit exemptions: push actions and tag/no-commit actions.
	const nullCommitEntries = [...log.byActionId.values()].filter((e) => !e.commit);
	if (nullCommitEntries.length) {
		info(
			"commit:null log entries",
			`${nullCommitEntries.length} logged action(s) with no commit - expected for push/ref-update actions and tag-only or revertable:false actions (e.g. action ${nullCommitEntries
				.map((e) => e.action_id)
				.slice(0, 5)
				.join(", ")}${nullCommitEntries.length > 5 ? ", ..." : ""})`,
		);
	}

	// 6-7. Working tree and untracked files.
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

	// 8. Ahead/behind - a warning here, not a hard failure, per spec.
	let branch = null;
	try {
		branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
	} catch {
		/* handled below */
	}
	if (!branch || branch === "HEAD") {
		warn("branch", "could not determine current branch or in detached HEAD");
	} else {
		let upstream = null;
		try {
			upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
		} catch {
			warn("upstream", `branch "${branch}" has no upstream configured - ahead/behind cannot be resolved`);
		}
		if (upstream) {
			try {
				const out = git(["rev-list", "--left-right", "--count", `${upstream}...HEAD`]);
				const [behind, ahead] = out.split(/\s+/);
				if (Number(ahead) > 0) {
					warn("ahead/behind", `${ahead} ahead, ${behind} behind ${upstream} - not pushed yet`);
				} else {
					pass("ahead/behind", `${ahead} ahead, ${behind} behind ${upstream}`);
				}
			} catch (err) {
				warn("ahead/behind", `could not resolve: ${err.message}`);
			}
		}
	}

	// 9. .onecommit.json
	const configCheck = checkOneCommitConfig();
	if (configCheck.ok) {
		pass(".onecommit.json", configCheck.detail);
	} else {
		fail(".onecommit.json", configCheck.detail);
	}

	// 10. Safety scripts.
	for (const f of ["scripts/ai-checkpoint", "scripts/log-action.mjs", "scripts/ai-revert"]) {
		if (existsSync(f)) {
			pass("safety script", `${f} present`);
		} else {
			fail("safety script", `${f} is missing`);
		}
	}

	// 11. Checkpoint tags.
	const cpInfo = checkpointTagInfo();
	pass("checkpoint tags", `${cpInfo.tags.length} tag(s) found`);
	if (cpInfo.malformed.length) {
		fail("checkpoint tags", `${cpInfo.malformed.length} malformed tag name(s): ${cpInfo.malformed.join(", ")}`);
	}

	// 12. Dashboard port - informational.
	const portCheck = await checkDashboardPort();
	if (portCheck.inUse) {
		warn("dashboard", "something is currently listening on 127.0.0.1:4597");
	} else {
		pass("dashboard", "127.0.0.1:4597 is free (no listener)");
	}

	printReport();
}

main();
