#!/usr/bin/env node
// revert-dashboard.mjs — localhost-only dashboard for scripts/ai-revert.
//
// Routes:
//   GET  /                 -> node scripts/ai-revert               (list)
//   GET  /inspect/<target> -> node scripts/ai-revert <target>      (inspect)
//   GET  /plan/<target>    -> node scripts/ai-revert plan <target> (dry-run plan)
//   POST /execute/<target> -> STUB ONLY. Reads the typed confirmation and
//                             always replies "execution is not enabled" -
//                             it never calls ai-revert execute or any git
//                             command. This proves the confirmation UI and
//                             wording ahead of a later action that wires
//                             this route to the real, gated CLI execute path.
// No other route exists. This file never calls ai-revert's execute mode,
// and never calls git directly at all.
//
// Usage (run from the repo root, same convention as every other script here):
//   node scripts/revert-dashboard.mjs
// Then open http://127.0.0.1:4597/

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = 4597;
const MAX_BODY_BYTES = 2000;

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

// Shared by /inspect/<target>, /plan/<target>, and /execute/<target>: decode,
// then validate against the same strict pattern for all three routes.
function parseTarget(pathname, prefix) {
	const raw = pathname.slice(prefix.length);
	let target;
	try {
		target = decodeURIComponent(raw);
	} catch {
		return { ok: false };
	}
	if (!TARGET_PATTERN.test(target)) {
		return { ok: false };
	}
	return { ok: true, target };
}

function badTarget(res) {
	res.writeHead(400, { "Content-Type": "text/plain" });
	res.end("400 Bad Request - target must be a simple action id or commit-like hash (letters/digits only, max 40 chars).");
}

function readBody(req, maxBytes) {
	return new Promise((resolve, reject) => {
		let data = "";
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > maxBytes) {
				reject(new Error("body too large"));
				req.destroy();
				return;
			}
			data += chunk;
		});
		req.on("end", () => resolve(data));
		req.on("error", reject);
	});
}

// The confirmation form itself. Only shown for a plan that ai-revert judged
// eligible (detected from its own output text, not re-decided here). Posts
// to /execute/<target>, which in this build only ever replies that
// execution isn't enabled - see handleRequest below.
function confirmationFormHtml(target) {
	const safeTarget = escapeHtml(target);
	return `
<div class="confirm-box">
  <h2>Revert ${safeTarget}</h2>
  <p class="note">Execution is <strong>not enabled</strong> in this build. This form proves the confirmation wording only - submitting it cannot revert anything.</p>
  <form method="POST" action="/execute/${safeTarget}">
    <label>Type <code>REVERT</code> to confirm:<br>
      <input type="text" name="confirm" autocomplete="off">
    </label>
    <button type="submit">Request revert (not yet enabled)</button>
  </form>
</div>`;
}

function renderPage(title, bodyHtml, showBackLink, extraLinksHtml, afterBodyHtml) {
	const back = showBackLink ? '<p><a href="/">&larr; back to list</a></p>' : "";
	const extra = extraLinksHtml || "";
	const after = afterBodyHtml || "";
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - revert dashboard (read-only)</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
  h1 { font-size: 1.2rem; }
  h2 { font-size: 1rem; margin-top: 0; }
  p.note { color: #f5a623; }
  pre { background: #1b1b1b; color: #dfdfdf; padding: 1rem; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; }
  a { color: #7ec6ff; }
  .confirm-box { margin-top: 1.5rem; padding: 1rem; border: 1px solid #444; border-radius: 6px; }
  input[type="text"] { padding: 0.4rem; margin: 0.4rem 0; width: 12rem; }
  button { padding: 0.4rem 0.8rem; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="note">No revert button here or anywhere in this build can actually change anything.</p>
${back}
${extra}
<pre>${bodyHtml}</pre>
${after}
</body>
</html>`;
}

async function handleRequest(req, res) {
	const url = new URL(req.url, `http://${HOST}`);
	const pathname = url.pathname;

	if (pathname.startsWith("/execute/")) {
		if (req.method !== "POST") {
			res.writeHead(405, { "Content-Type": "text/plain" });
			res.end("405 Method Not Allowed - /execute/<target> only accepts POST, and it does not execute anything in this build.");
			return;
		}
		const parsed = parseTarget(pathname, "/execute/");
		if (!parsed.ok) {
			badTarget(res);
			return;
		}
		const { target } = parsed;
		let body;
		try {
			body = await readBody(req, MAX_BODY_BYTES);
		} catch {
			res.writeHead(400, { "Content-Type": "text/plain" });
			res.end("400 Bad Request - could not read form body.");
			return;
		}
		const params = new URLSearchParams(body);
		const confirm = (params.get("confirm") || "").trim();

		// STUB: this never calls ai-revert execute, git revert, or anything
		// else that mutates state, no matter what was submitted above.
		let message;
		if (confirm !== "REVERT") {
			message =
				`Typed confirmation was "${confirm || "(empty)"}", not exactly "REVERT". ` +
				`Execution is not enabled in this build regardless, so nothing would have happened either way.`;
		} else {
			message =
				`Confirmation "REVERT" received for ${target}. ` +
				`Execution is not enabled in this build. No revert has been run, no files were changed, nothing was committed.`;
		}
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(renderPage(`Execute request: ${target}`, escapeHtml(message), true));
		return;
	}

	if (req.method !== "GET") {
		res.writeHead(405, { "Content-Type": "text/plain" });
		res.end("405 Method Not Allowed - only GET is accepted here, except the non-executing POST /execute/<target> stub.");
		return;
	}

	if (pathname === "/") {
		const text = runAiRevert([]);
		const linked = linkifyListOutput(escapeHtml(text));
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(renderPage("Revert candidates", linked, false));
		return;
	}

	if (pathname.startsWith("/inspect/")) {
		const parsed = parseTarget(pathname, "/inspect/");
		if (!parsed.ok) {
			badTarget(res);
			return;
		}
		const { target } = parsed;
		const text = runAiRevert([target]);
		const safeTarget = escapeHtml(target);
		const planLink = `<p><a href="/plan/${safeTarget}">view dry-run plan for ${safeTarget}</a></p>`;
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(renderPage(`Inspect: ${target}`, escapeHtml(text), true, planLink));
		return;
	}

	if (pathname.startsWith("/plan/")) {
		const parsed = parseTarget(pathname, "/plan/");
		if (!parsed.ok) {
			badTarget(res);
			return;
		}
		const { target } = parsed;
		const text = runAiRevert(["plan", target]);
		const eligible = !text.includes("PLAN REFUSED");
		const confirmHtml = eligible ? confirmationFormHtml(target) : "";
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(renderPage(`Plan: ${target}`, escapeHtml(text), true, "", confirmHtml));
		return;
	}

	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("404 Not Found - only GET /, GET /inspect/<target>, GET /plan/<target>, and POST /execute/<target> exist in this build.");
}

const server = createServer((req, res) => {
	handleRequest(req, res).catch((err) => {
		console.error(`[revert-dashboard] Unexpected error handling ${req.method} ${req.url}: ${err.message}`);
		if (!res.headersSent) {
			res.writeHead(500, { "Content-Type": "text/plain" });
			res.end("500 Internal Server Error.");
		}
	});
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
		`[revert-dashboard] Listening on http://${HOST}:${PORT}/ (GET /, /inspect/<target>, /plan/<target>; POST /execute/<target> is a non-executing stub)`,
	);
});
