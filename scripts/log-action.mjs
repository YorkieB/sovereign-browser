#!/usr/bin/env node
// Append-only AI action logger.
//
// Usage (reads one JSON action object from stdin — never from argv, so
// Windows/PowerShell quoting of embedded quotes never comes into play):
//   Get-Content entry.json -Raw | node scripts/log-action.mjs
//   '{"timestamp":"...","action_id":"005","instruction":"...","status":"success"}' | node scripts/log-action.mjs
//
// Never rewrites logs/ai-action-log.jsonl or logs/ai-action-log.md.
// Both are opened in append mode only — there is no code path in this
// file that opens either log for writing/truncation.

import { appendFileSync } from "node:fs";

const REQUIRED_FIELDS = ["timestamp", "action_id", "instruction", "status"];
const JSONL_PATH = "logs/ai-action-log.jsonl";
const MD_PATH = "logs/ai-action-log.md";

function readStdin() {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", (err) => reject(err));
	});
}

function parseEntry(raw) {
	if (!raw || !raw.trim()) {
		throw new Error("No input received on stdin. Pipe a single JSON action object in.");
	}
	let entry;
	try {
		entry = JSON.parse(raw);
	} catch (err) {
		throw new Error(`Input was not valid JSON: ${err.message}`);
	}
	const missing = REQUIRED_FIELDS.filter((field) => !(field in entry));
	if (missing.length > 0) {
		throw new Error(`Entry is missing required field(s): ${missing.join(", ")}`);
	}
	return entry;
}

function appendJsonl(entry) {
	appendFileSync(JSONL_PATH, JSON.stringify(entry) + "\n", { encoding: "utf-8" });
}

function appendMarkdown(entry) {
	const commit = entry.commit ?? "-";
	const block =
		`\n### ${entry.timestamp} — ${entry.action_id}\n` +
		`Instruction: ${entry.instruction}\n` +
		`Commit: ${commit}  Status: ${entry.status}\n`;
	appendFileSync(MD_PATH, block, { encoding: "utf-8" });
}

async function main() {
	let entry;
	try {
		const raw = await readStdin();
		entry = parseEntry(raw);
	} catch (err) {
		console.error(`[log-action] FAILED before writing anything: ${err.message}`);
		process.exitCode = 1;
		return;
	}

	try {
		appendJsonl(entry);
	} catch (err) {
		console.error(`[log-action] FAILED to append JSONL (${JSONL_PATH}): ${err.message}`);
		process.exitCode = 1;
		return;
	}

	try {
		appendMarkdown(entry);
	} catch (err) {
		console.error(
			`[log-action] JSONL entry was written, but appending Markdown (${MD_PATH}) failed: ${err.message}. ` +
				`The logs are now out of sync — check ${MD_PATH} manually.`,
		);
		process.exitCode = 1;
		return;
	}

	console.log(`[log-action] Logged action ${entry.action_id} (${entry.status}) to ${JSONL_PATH} and ${MD_PATH}.`);
}

main();
