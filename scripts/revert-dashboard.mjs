#!/usr/bin/env node
// revert-dashboard.mjs — read-only, localhost-only view of scripts/ai-revert.
//
// Two routes, both GET, both read-only:
//   GET /                 -> node scripts/ai-revert            (list)
//   GET /inspect/<target> -> node scripts/ai-revert <target>   (inspect)
// Nothing else exists. No POST handler anywhere, no execute route, no plan
// route. This file never calls ai-revert's execute mode, and never calls
// git directly at all - it only displays text that ai-revert already
// produced, for exactly the two read-only CLI modes above.
//
// Usage (run from the repo root, same convention as every other script here):
//   node scripts/revert-dashboard.mjs
// Then open http://127.0.0.1:4597/

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 4597;

// Simple action ids ("018") or commit-like hashes (hex, up to 40 chars) only.
// No slashes, dots, spaces, or shell metacharacters can match this.
const TARGET_PATTERN = /^[a-zA-Z0-9]{1,40}$/;

function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function runAiRevert(args) {
	try {
		return execFileSync("node", ["scripts/ai-revert", ...args], { encoding: "utf-8" });
	} catch (err) {
		const out =
			(err.stdout ? err.stdout.toString() : "") +
			(err.stderr ? err.stderr.toString() : "") +
			(err.message || "");
		return `[revert-dashboard] scripts/ai-revert did not run cleanly:\n${out}`;
	}
}

// Turns the short hash / action-id at the start of lines ai-revert already
// produced into links, without deciding anything about what's eligible - it
// only wraps text ai-revert already computed. Operates on already
// HTML-escaped text, so it can't be tricked by content containing markup.
function linkifyListOutput(escapedText) {
	let out = escapedText.replace(/^([0-9a-f]{7})(  )/gm, '<a href="/inspect/$1">$1</a>$2');
	out = out.replace(/^action (\d+):/gm, 'action <a href="/inspect/$1">$1</a>:');
	return out;
}

function renderPage(title, bodyHtml, showBackLink) {
	const back = showBackLink ? '<p><a href="/">&larr; back to list</a></p>' : "";
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - revert dashboard (read-only)</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
  h1 { font-size: 1.2rem; }
  p.note { color: #f5a623; }
  pre { background: #1b1b1b; color: #dfdfdf; padding: 1rem; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
  a { color: #7ec6ff; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="note">Read only. No revert button here or anywhere in this build - nothing on this page can change anything.</p>
${back}
<pre>${bodyHtml}</pre>
</body>
</html>`;
}

function handleRequest(req, res) {
	if (req.method !== "GET") {
		res.writeHead(405, { "Content-Type": "text/plain" });
		res.end("405 Method Not Allowed - this dashboard is read-only and has no routes that accept anything but GET.");
		return;
	}

	const url = new URL(req.url, `http://${HOST}`);
	const pathname = url.pathname;

	if (pathname === "/") {
		const text = runAiRevert([]);
		const linked = linkifyListOutput(escapeHtml(text));
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(renderPage("Revert candidates", linked, false));
		return;
	}

	if (pathname.startsWith("/inspect/")) {
		const raw = pathname.slice("/inspect/".length);
		let target;
		try {
			target = decodeURIComponent(raw);
		} catch {
			res.writeHead(400, { "Content-Type": "text/plain" });
			res.end("400 Bad Request - malformed target.");
			return;
		}
		if (!TARGET_PATTERN.test(target)) {
			res.writeHead(400, { "Content-Type": "text/plain" });
			res.end(
				"400 Bad Request - target must be a simple action id or commit-like hash (letters/digits only, max 40 chars).",
			);
			return;
		}
		const text = runAiRevert([target]);
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(renderPage(`Inspect: ${target}`, escapeHtml(text), true));
		return;
	}

	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("404 Not Found - only GET / and GET /inspect/<target> exist in this build.");
}

const server = createServer((req, res) => {
	try {
		handleRequest(req, res);
	} catch (err) {
		console.error(`[revert-dashboard] Unexpected error handling ${req.method} ${req.url}: ${err.message}`);
		if (!res.headersSent) {
			res.writeHead(500, { "Content-Type": "text/plain" });
			res.end("500 Internal Server Error.");
		}
	}
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
	console.log(
		`[revert-dashboard] Listening on http://${HOST}:${PORT}/ (read-only, GET / and GET /inspect/<target> only)`,
	);
});
