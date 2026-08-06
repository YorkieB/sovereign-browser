#!/usr/bin/env node
// revert-dashboard.mjs — read-only, localhost-only view of scripts/ai-revert.
//
// GET / is the only route. It shells out to `node scripts/ai-revert` (list
// mode, no args) - the exact same command a person would run directly - and
// renders its captured text output as an HTML-escaped <pre> block. There is
// no other route: no candidate detail, no plan, no execute, no POST handler
// of any kind. This file never calls ai-revert's execute mode, and never
// calls git directly at all - it only displays text that ai-revert already
// produced.
//
// Usage (run from the repo root, same convention as every other script here):
//   node scripts/revert-dashboard.mjs
// Then open http://127.0.0.1:4597/

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 4597;

function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function getCandidateListText() {
	try {
		return execFileSync("node", ["scripts/ai-revert"], { encoding: "utf-8" });
	} catch (err) {
		const out =
			(err.stdout ? err.stdout.toString() : "") +
			(err.stderr ? err.stderr.toString() : "") +
			(err.message || "");
		return `[revert-dashboard] scripts/ai-revert did not run cleanly:\n${out}`;
	}
}

function renderPage(bodyText) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Revert dashboard (read-only)</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
  h1 { font-size: 1.2rem; }
  p.note { color: #f5a623; }
  pre { background: #1b1b1b; color: #dfdfdf; padding: 1rem; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>Revert dashboard - read only</h1>
<p class="note">No revert button here. This mirrors "node scripts/ai-revert" exactly - nothing on this page can change anything.</p>
<pre>${escapeHtml(bodyText)}</pre>
</body>
</html>`;
}

const server = createServer((req, res) => {
	if (req.method !== "GET") {
		res.writeHead(405, { "Content-Type": "text/plain" });
		res.end("405 Method Not Allowed - this dashboard is read-only and has no routes that accept anything but GET.");
		return;
	}
	if (req.url !== "/") {
		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("404 Not Found - only GET / exists in this build.");
		return;
	}
	const text = getCandidateListText();
	res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
	res.end(renderPage(text));
});

server.on("error", (err) => {
	if (err.code === "EADDRINUSE") {
		console.error(
			`[revert-dashboard] Port ${PORT} on ${HOST} is already in use. Stop whatever else is using it, or pick a different port.`,
		);
		process.exitCode = 1;
		return;
	}
	console.error(`[revert-dashboard] Server error: ${err.message}`);
	process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
	console.log(`[revert-dashboard] Listening on http://${HOST}:${PORT}/ (read-only, GET / only)`);
});
