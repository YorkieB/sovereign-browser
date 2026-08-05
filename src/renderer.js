// [SovereignBrowser] showSuccess/showError were destroyed by the annotation
// tool; every toast call since has thrown an uncaught ReferenceError. Defined
// here at file scope, self-contained, so they resolve from any nesting depth.
function showSuccess(text) {
	try {
		var el = document.getElementById("status-text");
		if (el) { el.textContent = String(text); }
	} catch (err) { console.log("[holly]", text); }
}
function showError(text) {
	console.warn("[holly]", text);
	try {
		var el = document.getElementById("status-text");
		if (el) { el.textContent = String(text); }
	} catch (err) { /* logged above */ }
}

globalThis.addEventListener("error", (ev) => {
	globalThis.electronAPI?.invoke?.("sb:log", "UNCAUGHT", ev.message, "@", ev.filename, "line", ev.lineno);
});
globalThis.addEventListener("unhandledrejection", (ev) => {
	globalThis.electronAPI?.invoke?.("sb:log", "UNHANDLED-REJECTION", String(ev.reason));
});
// === Sovereign Browser: local LLM configuration =============================
// Chat runs against LM Studio on this machine. No cloud calls, no API key
// leaves this PC. Change LLM_MODEL to any model id LM Studio is serving.
const OPENAI_BASE = "http://localhost:1234/v1";
const LLM_MODEL = "qwen2.5-vl-7b-instruct-abliterated";

// [SovereignBrowser] Two-brain setup: a strong tool-caller drives the
// agent loop; the VL model handles anything with eyes. Auto-picked from
// whatever LM Studio has downloaded: download a better model, restart
// HOLLY, done.
let hollyAgentModel = LLM_MODEL;
let hollyVisionModel = LLM_MODEL;
let hollyModelIds = [];
async function hollyPickModels() {
	try {
		const resp = await fetch(OPENAI_BASE + "/models");
		if (resp.ok) {
			const data = await resp.json();
			hollyModelIds = (data.data || []).map((mm) => mm.id);
		}
	} catch (err) {
		console.warn("[Holly] model list failed, keeping last known:", err.message);
	}
	const ids = hollyModelIds;
	const pick = (patterns) => {
		for (const p of patterns) { const hit = ids.find((id) => p.test(id)); if (hit) { return hit; } }
		return null;
	};
	hollyAgentModel = pick([/qwen3(?!.*(vl|embed))/i, /gemma-?4/i, /glm/i, /mistral-?small/i, /qwen3(?!.*embed)/i, /qwen2\.5(?!.*(vl|embed)).*instruct/i]) || LLM_MODEL;
	hollyVisionModel = pick([/qwen3.*vl/i, /vl|vision/i]) || LLM_MODEL;
	const oAgent = localStorage.getItem("holly.agentModel");
	const oVision = localStorage.getItem("holly.visionModel");
	if (oAgent && oAgent !== "auto" && ids.includes(oAgent)) { hollyAgentModel = oAgent; }
	if (oVision && oVision !== "auto" && ids.includes(oVision)) { hollyVisionModel = oVision; }
	console.log("[Holly] brains - agent:", hollyAgentModel, "| vision:", hollyVisionModel);
	try { globalThis.electronAPI.invoke("sb:log", "[Holly] brains - agent:", hollyAgentModel, "| vision:", hollyVisionModel); } catch (err) { /* log only */ }
	hollyRefreshModelUI();
}
function hollyRefreshModelUI() {
	const line = document.getElementById("holly-brains-now");
	if (line) { line.textContent = "Brains now - agent: " + hollyAgentModel + " | vision: " + hollyVisionModel; }
	for (const kind of ["agent", "vision"]) {
		const sel = document.getElementById("holly-" + kind + "-select");
		if (!sel) { continue; }
		const stored = localStorage.getItem("holly." + kind + "Model") || "auto";
		sel.innerHTML = "";
		const auto = document.createElement("option");
		auto.value = "auto";
		auto.textContent = "Auto (recommended)";
		sel.appendChild(auto);
		for (const id of hollyModelIds) {
			if (/embed/i.test(id)) { continue; }
			const opt = document.createElement("option");
			opt.value = id;
			opt.textContent = id;
			sel.appendChild(opt);
		}
		sel.value = hollyModelIds.includes(stored) ? stored : "auto";
	}
}
hollyPickModels();
const hollyAgentSel = document.getElementById("holly-agent-select");
if (hollyAgentSel) { hollyAgentSel.addEventListener("change", () => { localStorage.setItem("holly.agentModel", hollyAgentSel.value); hollyPickModels(); }); }
const hollyVisionSel = document.getElementById("holly-vision-select");
if (hollyVisionSel) { hollyVisionSel.addEventListener("change", () => { localStorage.setItem("holly.visionModel", hollyVisionSel.value); hollyPickModels(); }); }
const hollyModelsRefresh = document.getElementById("holly-models-refresh");
if (hollyModelsRefresh) { hollyModelsRefresh.addEventListener("click", () => { hollyPickModels(); }); }
const OPENAI_API_KEY = "lm-studio"; // LM Studio ignores the value, header must exist
// ===========================================================================
/* eslint-disable no-undef, no-unused-vars, no-console */ // [NRS-1301]
(function () {
	// [NRS-1301]
	"use strict"; // [NRS-1301]

	// Global error handler for undefined variables // [NRS-1301]
	window.addEventListener("error", (event) => {
		// [NRS-1301]
		if (event.message.includes("is not defined")) {
			// [NRS-1301]
			console.warn("Undefined variable caught:", event.message); // [NRS-1304] Log undefined variable
			event.preventDefault(); // [NRS-1304] Prevent error propagation
			return true; // [NRS-1304] Mark error as handled
		} // [NRS-1301]
	}); // [NRS-1301]

	// Prevent unload policy violations // [NRS-1301]
	window.addEventListener("beforeunload", (event) => {
		// [NRS-1301]
		// Don't set returnValue to avoid policy violations // [NRS-1301]
	}); // [NRS-1304] Handle page unload

	// Global variable safety net for common undefined variables // [NRS-1301]
	window.sl_evt =
		window.sl_evt ||
		function () {
			// [NRS-1301]
			console.warn("sl_evt called but not properly initialized"); // [NRS-1304] Warn about missing tracker
		}; // [NRS-1301]
	window.fbq = window.fbq || function () {}; // [NRS-1304] Facebook pixel stub
	window.gtag = window.gtag || function () {}; // [NRS-1304] Google Analytics stub
	window.dataLayer = window.dataLayer || []; // [NRS-1304] Data layer stub

	const tabsEl = document.getElementById("tabs"); // Tabs container element // [NRS-1301]
	const contentEl = document.getElementById("content"); // Content area element // [NRS-1301]
	const omnibox = document.getElementById("omnibox"); // [NRS-1302] Address bar input
	const omniboxContainer = document.querySelector(".omnibox-container"); // [NRS-1302] Address bar container
	const lockIcon = document.getElementById("lock-icon"); // [NRS-1302] HTTPS lock icon
	const omniboxSuggestions = document.getElementById("omnibox-suggestions"); // [NRS-1302] URL suggestions list
	const btnBack = document.getElementById("btn-back"); // [NRS-1303] Back navigation button
	const btnForward = document.getElementById("btn-forward"); // [NRS-1303] Forward navigation button
	const btnReload = document.getElementById("btn-reload"); // [NRS-1303] Reload page button
const btnHome = document.getElementById("btn-home"); // [SovereignBrowser] Home button
	const btnNewWindow = document.getElementById("btn-new-window"); // [NRS-1303] New window button
	const btnNewIncognito = document.getElementById("btn-new-incognito"); // [NRS-1303] Incognito mode button
	const btnNewTab = document.getElementById("btn-new-tab"); // [NRS-1303] New tab button
	const btnBookmark = document.getElementById("btn-bookmark"); // [NRS-1303] Bookmark button
	const btnTabGroupA = document.getElementById("btn-tab-group-a"); // [NRS-1303] Tab group A button
	const btnTabGroupB = document.getElementById("btn-tab-group-b"); // [NRS-1303] Tab group B button
	const btnSplitView = document.getElementById("btn-split-view"); // [NRS-1303] Split view toggle
	const btnDevtools = document.getElementById("btn-devtools"); // [NRS-1303] DevTools button
	const btnDevtoolsAuto = document.getElementById("btn-devtools-auto"); // [NRS-1303] Auto DevTools button
	const btnJarvis = document.getElementById("btn-jarvis"); // [NRS-1001] Jarvis AI button
	const btnVoice = document.getElementById("btn-voice"); // [NRS-1001] Voice input button
	const btnSettings = document.getElementById("btn-settings"); // [NRS-1303] Settings button
	const settingsModal = document.getElementById("settings-modal"); // [NRS-1303] Settings modal
	const jarvisBar = document.getElementById("jarvis-bar"); // [NRS-1001] Jarvis chat panel
	const btnCloseJarvis = document.getElementById("btn-close-jarvis"); // [NRS-1001] Close Jarvis button
	const jarvisInput = document.getElementById("jarvis-input"); // [NRS-1001] Jarvis text input
	const btnSendJarvis = document.getElementById("btn-send-jarvis"); // [NRS-1001] Send Jarvis message button
	const jarvisMessages = document.getElementById("jarvis-messages"); // [NRS-1001] Jarvis message list
	const btnSetDefaultBrowser = document.getElementById("btn-set-default-browser"); // [NRS-1303]
	const btnCloseSettings = document.getElementById("btn-close-settings"); // [NRS-1303]
	const defaultBrowserStatus = document.getElementById("default-browser-status"); // [NRS-1303]
	const privacySiteLabel = document.getElementById("privacy-site-label"); // [NRS-1303]
	const toggleSiteNotifications = document.getElementById("toggle-site-notifications"); // [NRS-1303]
	const btnClearSiteData = document.getElementById("btn-clear-site-data"); // [NRS-1303]
	const btnClearAllData = document.getElementById("btn-clear-all-data"); // [NRS-1303]
	const bookmarkList = document.getElementById("bookmark-list"); // [NRS-1302]
	const historyList = document.getElementById("history-list"); // [NRS-1302]
	const btnClearHistory = document.getElementById("btn-clear-history"); // [NRS-1303]
	const jarvisSwirlOverlay = document.getElementById("jarvis-swirl-overlay"); // [NRS-1001]
	const bookmarksMenuList = document.getElementById("bookmarks-menu-list"); // [NRS-1302]
	const tabContextMenu = document.getElementById("tab-context-menu"); // [NRS-1302]
	const webviewContextMenu = document.getElementById("webview-context-menu"); // [NRS-1302]
	const findBar = document.getElementById("find-bar"); // [NRS-1302]
	const findInput = document.getElementById("find-input"); // [NRS-1302]
	const findCounter = document.getElementById("find-counter"); // [NRS-1302]
	const findPrev = document.getElementById("find-prev"); // [NRS-1302]
	const findNext = document.getElementById("find-next"); // [NRS-1302]
	const findClose = document.getElementById("find-close"); // [NRS-1302]
	const toggleAutoClear = document.getElementById("toggle-auto-clear"); // [NRS-1303]
	const toggleBlockThirdPartyCookies = document.getElementById("toggle-block-third-party-cookies"); // [NRS-1303]
	const toggleDoNotTrack = document.getElementById("toggle-do-not-track"); // [NRS-1303]
	const toggleTrackingProtection = document.getElementById("toggle-tracking-protection"); // [NRS-1303]
	const btnViewCookies = document.getElementById("btn-view-cookies"); // [NRS-1303]
	const cookieModal = document.getElementById("cookie-modal"); // [NRS-1303]
	const cookieList = document.getElementById("cookie-list"); // [NRS-1303]
	const btnDeleteSelectedCookies = document.getElementById("btn-delete-selected-cookies"); // [NRS-1303]
	const btnDeleteAllCookies = document.getElementById("btn-delete-all-cookies"); // [NRS-1303]
	const btnCloseCookies = document.getElementById("btn-close-cookies"); // [NRS-1303]
	const loadingProgress = document.getElementById("loading-progress"); // [NRS-1302]
	const statusBar = document.getElementById("status-bar"); // [NRS-1302]
	const statusText = document.getElementById("status-text"); // [NRS-1302]
	const statusSecure = document.getElementById("status-secure"); // [NRS-1302]
	const statusLoading = document.getElementById("status-loading"); // [NRS-1301]

	// Lightweight on-screen logger for surfacing silent errors // [NRS-1301]
	const logOverlay = (() => {
		// [NRS-1301]
		const wrap = document.createElement("div"); // [NRS-1301]
		wrap.style.position = "fixed"; // [NRS-1301]
		wrap.style.right = "12px"; // [NRS-1301]
		wrap.style.bottom = "12px"; // [NRS-1301]
		wrap.style.width = "360px"; // [NRS-1301]
		wrap.style.maxHeight = "220px"; // [NRS-1301]
		wrap.style.background = "rgba(20,20,20,0.92)"; // [NRS-1301]
		wrap.style.color = "#e5e7eb"; // [NRS-1301]
		wrap.style.fontFamily = "Consolas, Menlo, monospace"; // [NRS-1301]
		wrap.style.fontSize = "12px"; // [NRS-1301]
		wrap.style.padding = "10px"; // [NRS-1301]
		wrap.style.borderRadius = "10px"; // [NRS-1301]
		wrap.style.boxShadow = "0 10px 30px rgba(0,0,0,0.35)"; // [NRS-1301]
		wrap.style.zIndex = "12000"; // [NRS-1301]
		wrap.style.display = "none"; // [NRS-1301]

		const header = document.createElement("div"); // [NRS-1301]
		header.style.display = "flex"; // [NRS-1301]
		header.style.justifyContent = "space-between"; // [NRS-1301]
		header.style.alignItems = "center"; // [NRS-1301]
		header.style.marginBottom = "6px"; // [NRS-1301]
		header.innerHTML = '<strong style="color:#fbbf24;">Logger</strong>'; // [NRS-1301]

		const btnClose = document.createElement("button"); // [NRS-1301]
		btnClose.textContent = "�"; // [NRS-1301]
		btnClose.style.background = "transparent"; // [NRS-1301]
		btnClose.style.color = "#e5e7eb"; // [NRS-1301]
		btnClose.style.border = "none"; // [NRS-1301]
		btnClose.style.cursor = "pointer"; // [NRS-1301]
		btnClose.style.fontSize = "14px"; // [NRS-1301]
		btnClose.onclick = () => {
			wrap.style.display = "none";
		}; // [NRS-1301]
		header.appendChild(btnClose); // [NRS-1301]

		const body = document.createElement("pre"); // [NRS-1301]
		body.style.margin = "0"; // [NRS-1301]
		body.style.whiteSpace = "pre-wrap"; // [NRS-1301]
		body.style.wordBreak = "break-word"; // [NRS-1301]
		body.style.maxHeight = "170px"; // [NRS-1301]
		body.style.overflowY = "auto"; // [NRS-1301]

		wrap.appendChild(header); // [NRS-1301]
		wrap.appendChild(body); // [NRS-1301]
		document.body.appendChild(wrap); // [NRS-1301]

		function show(msg) {
			// [NRS-1301]
			const ts = new Date().toLocaleTimeString(); // [NRS-1301]
			body.textContent = `[${ts}] ${msg}`; // [NRS-1301]
			wrap.style.display = "block"; // [NRS-1301]
		} // [NRS-1301]

		return { show }; // [NRS-1301]
	})(); // [NRS-1301]

	// Expose a manual toggle and hotkey to surface the logger // [NRS-1301]
	window.__jarvisShowLog = (msg = "Logger opened (manual)") => logOverlay.show(msg); // [NRS-1301]
	window.addEventListener("keydown", (e) => {
		// [NRS-1301]
		if (e.ctrlKey && e.shiftKey && e.code === "KeyL") {
			// [NRS-1301]
			logOverlay.show("Logger opened via Ctrl+Shift+L"); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	// Global configuration and state variables // [NRS-1301]
	const DEFAULT_HOME = (globalThis.electronAPI && globalThis.electronAPI.homeUrl) || "https://duckduckgo.com"; // [SovereignBrowser] own home page, DuckDuckGo fallback

	// [SovereignBrowser] Which backing new tabs use. This branch defaults to
	// WebContentsView ("wcv"); set localStorage 'holly.tabBacking' to
	// "webview" to fall back to the legacy <webview> path.
	const TAB_BACKING_MODE = (() => {
		try { return localStorage.getItem("holly.tabBacking") || "wcv"; } catch (err) { return "wcv"; }
	})();
	const USE_WCV = TAB_BACKING_MODE === "wcv"
		&& !!(globalThis.electronAPI && typeof globalThis.electronAPI.invoke === "function" && typeof globalThis.electronAPI.on === "function")
		&& !!(globalThis.HollyTabBacking && typeof globalThis.HollyTabBacking.createWebContentsViewBacking === "function");
	let tabs = []; // [NRS-1301]
	let activeTabId = null; // [NRS-1301]
	let splitPartnerId = null; // [NRS-1301]
	let splitViewEnabled = false; // [NRS-1301]
	let nextId = 1; // [NRS-1301]

	// Storage keys // [NRS-1301]
	const AUTO_DEVTOOLS_KEY = "holly.autoDevtools"; // [NRS-1301]
	const SITE_SETTINGS_KEY = "holly.siteSettings"; // [NRS-1301]
	const SESSION_KEY = "holly.session"; // [NRS-1301]
	const PRIVACY_SETTINGS_KEY = "holly.privacySettings"; // [NRS-1301]
	const EXTENSIONS_KEY = "holly.extensions"; // [NRS-1301]
	const ADDON_PIN_KEY = "holly.addonPinned"; // [NRS-1301]

	// Auto devtools setting // [NRS-1301]
	let autoDevtools = (() => {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const v = localStorage.getItem(AUTO_DEVTOOLS_KEY); // [NRS-1301]
			return v ? v === "true" : false; // [NRS-1301]
		} catch {
			// [NRS-1301]
			return false; // [NRS-1301]
		} // [NRS-1301]
	})(); // [NRS-1301]

	// Site settings // [NRS-1301]
	let siteSettings = (() => {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const raw = localStorage.getItem(SITE_SETTINGS_KEY); // [NRS-1301]
			return raw ? JSON.parse(raw) : {}; // [NRS-1301]
		} catch {
			// [NRS-1301]
			return {}; // [NRS-1301]
		} // [NRS-1301]
	})(); // [NRS-1301]

	// Privacy settings // [NRS-1301]
	let privacySettings = (() => {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const raw = localStorage.getItem(PRIVACY_SETTINGS_KEY); // [NRS-1301]
			return raw
				? JSON.parse(raw)
				: {
						// [NRS-1301]
						autoClear: false, // [NRS-1301]
						blockThirdPartyCookies: false, // [NRS-1301]
						doNotTrack: true, // [NRS-1301]
						trackingProtection: true, // [NRS-1301]
					}; // [NRS-1301]
		} catch {
			// [NRS-1301]
			return {
				// [NRS-1301]
				autoClear: false, // [NRS-1301]
				blockThirdPartyCookies: false, // [NRS-1301]
				doNotTrack: true, // [NRS-1301]
				trackingProtection: true, // [NRS-1301]
			}; // [NRS-1301]
		} // [NRS-1301]
	})(); // [NRS-1301]

	// Devtools state // [NRS-1301]
	let devtoolsOpened = false; // [NRS-1301]

	// Extensions storage // [NRS-1301]
	let extensions = (() => {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const raw = localStorage.getItem(EXTENSIONS_KEY); // [NRS-1301]
			return raw ? JSON.parse(raw) : []; // [NRS-1301]
		} catch {
			return [];
		} // [NRS-1301]
	})(); // [NRS-1301]

	function normalizeExtensions(list) {
		// [NRS-1301]
		return (list || []).map((ext) => ({
			// [NRS-1301]
			id: ext.id ?? Date.now() + Math.random(), // [NRS-1301]
			name: ext.name || "Untitled Extension", // [NRS-1301]
			matches: Array.isArray(ext.matches) ? ext.matches : ext.matches ? [ext.matches] : [], // [NRS-1301]
			css: ext.css || "", // [NRS-1301]
			js: ext.js || "", // [NRS-1301]
			enabled: ext.enabled !== false, // [NRS-1301]
			pinned: !!ext.pinned, // [NRS-1301]
			icon: ext.icon || "", // [NRS-1301]
		})); // [NRS-1301]
	} // [NRS-1301]

	extensions = normalizeExtensions(extensions); // [NRS-1301]

	function saveExtensions() {
		// [NRS-1301]
		try {
			localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(extensions));
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	function matchesPattern(url, pattern) {
		// [NRS-1301]
		// Support simple Chrome-like match patterns: *://*.domain/* // [NRS-1301]
		try {
			// [NRS-1301]
			// Escape regex special chars except * // [NRS-1301]
			const esc = pattern.replace(/[.+?^${}()|\[\]\\]/g, "\\$&").replace(/\*/g, ".*"); // [NRS-1301]
			const re = new RegExp("^" + esc + "$"); // [NRS-1301]
			return re.test(url); // [NRS-1301]
		} catch {
			return false;
		} // [NRS-1301]
	} // [NRS-1301]

	function extensionMatchesUrl(ext, url) {
		// [NRS-1301]
		if (!ext.matches || !Array.isArray(ext.matches)) return false; // [NRS-1301]
		return ext.matches.some(m => matchesPattern(url, m)); // [RESTORED]
	} // [NRS-1301]

	async function applyExtensionsToWebview(webview, url) {
		if (!webview || !webview.__domReady) { return; } // [SovereignBrowser]
		// [NRS-1301]
		try {
			// [NRS-1301]
			for (const ext of extensions) {
				// [NRS-1301]
				if (!ext.enabled) continue; // [NRS-1301]
				if (extensionMatchesUrl(ext, url)) {
					// [NRS-1301]
					if (ext.css) {
						// [NRS-1301]
						try {
							await webview.insertCSS(ext.css);
						} catch {} // [NRS-1301]
					} // [NRS-1301]
					if (ext.js) {
						// [NRS-1301]
						try {
							await webview.executeJavaScript(ext.js);
						} catch {} // [NRS-1301]
					} // [NRS-1301]
					updateStatusBar(`Extension applied: ${ext.name}`, { persist: false }); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	// Search engine configuration // [NRS-1301]
	const searchEngines = {
		// [NRS-1301]
		bing: { name: "Bing", url: "https://www.bing.com/search?q=" }, // [NRS-1301]
		google: { name: "Google", url: "https://www.google.com/search?q=" }, // [NRS-1301]
		duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }, // [NRS-1301]
		brave: { name: "Brave", url: "https://search.brave.com/search?q=" }, // [SovereignBrowser]
	};
	let currentSearchEngine = "brave"; // [RESTORED] default changed from bing
	const SEARCH_ENGINE_KEY = "holly.searchEngine"; // [RESTORED]

	// Load saved search engine preference // [NRS-1301]
	try {
		// [NRS-1301]
		const saved = localStorage.getItem(SEARCH_ENGINE_KEY); // [NRS-1301]
		if (saved && searchEngines[saved]) {
			// [NRS-1301]
			currentSearchEngine = saved; // [NRS-1301]
			// [SovereignBrowser] selector UI removed; preference still honoured
		} // [NRS-1301]
	} catch {} // [NRS-1301]

	function updateAutoDevtoolsButton() {
		// [NRS-1301]
		btnDevtoolsAuto.textContent = autoDevtools ? "Auto DT: ON" : "Auto DT: OFF"; // [NRS-1301]
	} // [NRS-1301]

	// Session save/restore // [NRS-1301]
	function saveSession() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const session = {
				// [NRS-1301]
				tabs: tabs.map((tab) => ({
					// [NRS-1301]
					url: tab.webview.getURL?.() || tab.webview.src || DEFAULT_HOME, // [NRS-1301]
					title: tab.titleEl.textContent || "Tab", // [NRS-1301]
					group: tab.group, // [NRS-1301]
					pinned: tab.pinned, // [NRS-1301]
					muted: tab.muted, // [NRS-1301]
					incognito: tab.incognito, // [NRS-1301]
				})), // [NRS-1301]
				activeTabId: activeTabId, // [NRS-1301]
				splitPartnerId: splitPartnerId, // [NRS-1301]
				splitViewEnabled: splitViewEnabled, // [NRS-1301]
			}; // [NRS-1301]
			localStorage.setItem(SESSION_KEY, JSON.stringify(session)); // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Failed to save session:", err); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	function restoreSession() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const saved = localStorage.getItem(SESSION_KEY); // [NRS-1301]
			if (!saved) return false; // [NRS-1301]
			const session = JSON.parse(saved); // [NRS-1301]
			if (!session.tabs || session.tabs.length === 0) return false; // [NRS-1301]

			// Skip incognito tabs for privacy // [NRS-1301]
			const tabsToRestore = session.tabs.filter((t) => !t.incognito); // [NRS-1301]
			if (tabsToRestore.length === 0) return false; // [NRS-1301]

			// Restore tabs // [NRS-1301]
			const restoredTabIds = []; // [NRS-1301]
			tabsToRestore.forEach((savedTab, idx) => {
				// [NRS-1301]
				const tabId = createTab(savedTab.url, {
					// [NRS-1301]
					activate: false, // [NRS-1301]
					group: savedTab.group, // [NRS-1301]
				}); // [NRS-1301]
				restoredTabIds.push(tabId); // [NRS-1301]
				const tab = tabs.find((t) => t.id === tabId); // [NRS-1301]
				if (tab) {
					// [NRS-1301]
					if (savedTab.pinned) {
						// [NRS-1301]
						tab.pinned = true; // [NRS-1301]
						tab.tabEl.classList.add("pinned"); // [NRS-1301]
					} // [NRS-1301]
					if (savedTab.muted) {
						// [NRS-1301]
						tab.muted = true; // [NRS-1301]
						tab.tabEl.classList.add("muted"); // [NRS-1301]
					} // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]

			// Restore active tab // [NRS-1301]
			if (restoredTabIds.length > 0) {
				// [NRS-1301]
				const activeIdx = session.tabs.findIndex((t) => !t.incognito); // [NRS-1301]
				const tabToActivate =
					activeIdx >= 0 && activeIdx < restoredTabIds.length // [NRS-1301]
						? restoredTabIds[activeIdx] // [NRS-1301]
						: restoredTabIds[0]; // [NRS-1301]
				setActiveTab(tabToActivate); // [NRS-1301]
			} // [NRS-1301]

			// Restore split view if it was enabled // [NRS-1301]
			if (session.splitViewEnabled && restoredTabIds.length > 1) {
				// [NRS-1301]
				splitViewEnabled = session.splitViewEnabled; // [NRS-1301]
				splitPartnerId = restoredTabIds[1]; // [NRS-1301]
				updateTabVisibility(); // [NRS-1301]
			} // [NRS-1301]

			return true; // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Failed to restore session:", err); // [NRS-1301]
			return false; // [RESTORED]
		} // [NRS-1301]
	} // [NRS-1301]

	function setOmnibox(url) {
		// [NRS-1301]
		const value = url || ""; // [NRS-1301]
		omnibox.value = value; // [NRS-1301]
		const isSecure = /^https:\/\//i.test(value); // [RESTORED]
		if (omniboxContainer) omniboxContainer.classList.toggle("secure", isSecure); // [NRS-1301]
		if (lockIcon) lockIcon.style.display = isSecure ? "inline" : "none"; // [NRS-1301]
		updatePrivacyUI(value); // [NRS-1301]
	} // [NRS-1301]

	function getOrigin(url) {
		// [NRS-1301]
		try {
			// [NRS-1301]
			return new URL(url).origin; // [NRS-1301]
		} catch {
			return null;
		} // [NRS-1301]
	} // [NRS-1301]

	function loadSiteSetting(origin) {
		// [NRS-1301]
		if (!origin) return { notificationsAllowed: true }; // [NRS-1301]
		return siteSettings[origin] || { notificationsAllowed: true }; // [RESTORED]
	} // [NRS-1301]

	function saveSiteSetting(origin, setting) {
		// [NRS-1301]
		if (!origin) return; // [NRS-1301]
		siteSettings[origin] = setting; // [NRS-1301]
		try {
			localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(siteSettings));
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	function applySitePermissions(tab, origin) {
		if (!tab || !tab.webview || !tab.webview.__domReady) { return; } // [SovereignBrowser]
		// [NRS-1301]
		if (!tab || !origin) return; // [NRS-1301]
		const setting = loadSiteSetting(origin); // [RESTORED]
		if (setting.notificationsAllowed) return; // [NRS-1301]
		try {
			// [NRS-1301]
			tab.webview.executeJavaScript(`
        (() => {
          if (window.Notification) {
            Object.defineProperty(Notification, 'permission', { value: 'denied' }); // [NRS-1301]
            const Blocked = function() { return null; }; // [NRS-1301]
            Blocked.requestPermission = async () => 'denied'; // [NRS-1301]
            Object.setPrototypeOf(Blocked, Notification); // [NRS-1301]
            window.Notification = Blocked; // [NRS-1301]
          } // [NRS-1301]
        })(); // [NRS-1301]
      `); // Inject notification blocking script // [NRS-1301]
		} catch (err) {
			console.warn('[SovereignBrowser] applySitePermissions failed:', err.message);
		}
	}


			// Visual Status Indicators // [NRS-1301]
			function showLoadingProgress() {
				// [NRS-1301]
				if (loadingProgress) {
					// [NRS-1301]
					loadingProgress.classList.remove("complete"); // [NRS-1301]
					loadingProgress.classList.add("loading"); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]

			function hideLoadingProgress() {
				// [NRS-1301]
				if (loadingProgress) {
					// [NRS-1301]
					loadingProgress.classList.add("complete"); // [NRS-1301]
					setTimeout(() => {
						// [NRS-1301]
						loadingProgress.classList.remove("loading", "complete"); // [NRS-1301]
					}, 500); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]

			function updateStatusBar(text, options = {}) {
				// [NRS-1301]
				if (!statusBar || !statusText) return; // [NRS-1301]

				statusText.textContent = text; // [NRS-1301]

				if (options.secure) {
					// [NRS-1301]
					statusSecure?.classList.add("show"); // [NRS-1301]
					statusSecure.textContent = "?? Secure"; // [NRS-1301]
				} else {
					// [NRS-1301]
					statusSecure?.classList.remove("show"); // [NRS-1301]
				} // [NRS-1301]

				if (options.loading) {
					// [NRS-1301]
					statusLoading?.classList.add("show"); // [NRS-1301]
				} else {
					// [NRS-1301]
					statusLoading?.classList.remove("show"); // [NRS-1301]
				} // [NRS-1301]

				if (text) {
					// [NRS-1301]
					statusBar.classList.add("show"); // [NRS-1301]
					setTimeout(() => {
						// [NRS-1301]
						if (!options.persist) {
							// [NRS-1301]
							hideStatusBar(); // [NRS-1301]
						} // [NRS-1301]
					}, 3000); // [NRS-1301]
				} else {
					// [NRS-1301]
					hideStatusBar(); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]

			function hideStatusBar() {
				// [NRS-1301]
				statusBar?.classList.remove("show"); // [NRS-1301]
			} // [NRS-1301]

	function updatePrivacyUI(url) {
		// [NRS-1301]
		const origin = getOrigin(url || ""); // [NRS-1301]
		const setting = loadSiteSetting(origin); // [RESTORED]
		if (privacySiteLabel) privacySiteLabel.textContent = origin ? `Site: ${origin}` : "Site: �"; // [NRS-1301]
		if (toggleSiteNotifications)
			toggleSiteNotifications.checked = setting.notificationsAllowed !== false; // [NRS-1301]
	} // [NRS-1301]

	async function clearSiteDataForOrigin(origin) {
		// [NRS-1301]
		if (!origin) return "No site data to clear"; // [NRS-1301]
		const tab = tabs.find(t => t.id === activeTabId); // [RESTORED]
		try {
			// [NRS-1301]
			const wc = tab?.webview?.getWebContents?.(); // [NRS-1301]
			if (wc?.session) {
				// [NRS-1301]
				await wc.session.clearStorageData({ origin }); // [NRS-1301]
				await wc.session.clearCache(); // [RESTORED]
			} // [NRS-1301]
			tab?.webview?.reload?.(); // [NRS-1301]
			return `Cleared data for ${origin}`; // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			return `Failed to clear data: ${err.message}`; // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function clearAllBrowsingData() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const uniqueSessions = new Set(); // [NRS-1301]
			for (const t of tabs) {
				// [NRS-1301]
				const wc = t.webview?.getWebContents?.(); // [NRS-1301]
				if (wc?.session) uniqueSessions.add(wc.session); // [NRS-1301]
			} // [NRS-1301]
			for (const s of uniqueSessions) {
				// [NRS-1301]
				await s.clearStorageData(); // [NRS-1301]
				await s.clearCache(); // [RESTORED]
			} // [NRS-1301]
			try {
				await globalThis.electronAPI?.history?.clear?.();
				renderHistory();
			} catch {} // [NRS-1301]
			return "Cleared all browsing data"; // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			return `Failed to clear all data: ${err.message}`; // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	function savePrivacySettings() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			localStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(privacySettings)); // [NRS-1301]
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	function updatePrivacySettingsToggles() {
		// [NRS-1301]
		if (toggleAutoClear) toggleAutoClear.checked = privacySettings.autoClear; // [NRS-1301]
		if (toggleBlockThirdPartyCookies)
			toggleBlockThirdPartyCookies.checked = privacySettings.blockThirdPartyCookies; // [NRS-1301]
		if (toggleDoNotTrack) toggleDoNotTrack.checked = privacySettings.doNotTrack; // [NRS-1301]
		if (toggleTrackingProtection)
			toggleTrackingProtection.checked = privacySettings.trackingProtection; // [NRS-1301]
	} // [NRS-1301]

	async function getAllCookies() {
		// [NRS-1301]
		const allCookies = []; // [NRS-1301]
		try {
			// [NRS-1301]
			for (const tab of tabs) {
				// [NRS-1301]
				const wc = tab.webview?.getWebContents?.(); // [NRS-1301]
				if (wc?.session) {
					// [NRS-1301]
					const cookies = await wc.session.cookies.get({}); // [NRS-1301]
					cookies.forEach((cookie) => {
						// [NRS-1301]
						if (!allCookies.find((c) => c.name === cookie.name && c.domain === cookie.domain)) {
							// [NRS-1301]
							allCookies.push(cookie); // [NRS-1301]
						} // [NRS-1301]
					}); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Failed to get cookies:", err); // [NRS-1301]
		} // [NRS-1301]
		return allCookies; // [NRS-1301]
	} // [NRS-1301]

	async function showCookieManager() {
		// [NRS-1301]
		const cookies = await getAllCookies(); // [NRS-1301]
		cookieList.innerHTML = ""; // [NRS-1301]

		if (cookies.length === 0) {
			// [NRS-1301]
			cookieList.innerHTML = '<p style="padding: 20px; text-align: center;">No cookies found</p>'; // [NRS-1301]
		} else {
			// [NRS-1301]
			cookies.forEach((cookie, idx) => {
				// [NRS-1301]
				const cookieEl = document.createElement("div"); // [NRS-1301]
				cookieEl.className = "cookie-item"; // [NRS-1301]
				cookieEl.innerHTML = `
          <input type="checkbox" class="cookie-checkbox" data-index="${idx}" />
          <div class="cookie-info">
            <div class="cookie-name">${cookie.name}</div>
            <div class="cookie-domain">${cookie.domain}</div>
            <div class="cookie-value">${cookie.value.substring(0, 50)}${cookie.value.length > 50 ? "..." : ""}</div>
          </div>
          `; // Close cookie item template
				cookieList.appendChild(cookieEl); // [NRS-1301]
			}); // [NRS-1301]
		} // [NRS-1301]

		cookieModal.classList.add("show"); // [NRS-1301]
	} // [NRS-1301]

	async function deleteSelectedCookies() {
		// [NRS-1301]
		const checkboxes = cookieList.querySelectorAll(".cookie-checkbox:checked"); // [NRS-1301]
		const cookies = await getAllCookies(); // [RESTORED]

		for (const checkbox of checkboxes) {
			// [NRS-1301]
			const idx = parseInt(checkbox.dataset.index, 10); // [NRS-1301]
			const cookie = cookies[idx]; // [RESTORED]
			if (cookie) {
				// [NRS-1301]
				try {
					// [NRS-1301]
					for (const tab of tabs) {
						// [NRS-1301]
						const wc = tab.webview?.getWebContents?.(); // [NRS-1301]
						if (wc?.session) {
							// [NRS-1301]
							await wc.session.cookies.remove(
								`http${cookie.secure ? "s" : ""}://${cookie.domain}${cookie.path}`,
								cookie.name,
							); // [NRS-1301]
						} // [NRS-1301]
					} // [NRS-1301]
				} catch (err) {
					// [NRS-1301]
					console.error("Failed to delete cookie:", err); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]

		showCookieManager(); // Refresh the list // [NRS-1301]
	} // [NRS-1301]

	async function deleteAllCookies() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			for (const tab of tabs) {
				// [NRS-1301]
				const wc = tab.webview?.getWebContents?.(); // [NRS-1301]
				if (wc?.session) {
					// [NRS-1301]
					const cookies = await wc.session.cookies.get({}); // [NRS-1301]
					for (const cookie of cookies) {
						// [NRS-1301]
						await wc.session.cookies.remove(
							`http${cookie.secure ? "s" : ""}://${cookie.domain}${cookie.path}`,
							cookie.name,
						); // [NRS-1301]
					} // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
			showCookieManager(); // Refresh the list // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Failed to delete all cookies:", err); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	function applyTrackingProtection(webview) {
		// [SovereignBrowser] did-navigate fires before dom-ready, and
		// executeJavaScript throws if the webview is not ready yet. The
		// dom-ready handler re-applies this, so skipping here loses nothing.
		if (!webview || !webview.__domReady) { return; }
		// [NRS-1301]
		if (!privacySettings.trackingProtection) return; // [NRS-1301]

		// Known tracking domains to block // [NRS-1301]
		const trackingDomains = [
			// [NRS-1301]
			"google-analytics.com",
			"doubleclick.net",
			"facebook.com/tr", // [NRS-1301]
			"scorecardresearch.com",
			"googletagmanager.com",
			"google.com/analytics", // [NRS-1301]
			"facebook.net",
			"analytics.twitter.com",
			"ads-twitter.com", // [NRS-1301]
		]; // [NRS-1301]

		try {
			// [NRS-1301]
			webview.executeJavaScript(`
        (() => {
          const trackingDomains = ${JSON.stringify(trackingDomains)}; // [NRS-1301]
          const originalFetch = window.fetch; // [NRS-1301]
          window.fetch = function(...args) { // [NRS-1301]
            const url = args[0]; // [NRS-1301]
            if (typeof url === 'string' && trackingDomains.some(domain => url.includes(domain))) { // [NRS-1301]
              console.log('Blocked tracking request:', url); // [NRS-1301]
              return Promise.reject(new Error('Tracking blocked')); // [NRS-1301]
            } // [NRS-1301]
            return originalFetch.apply(this, args); // [NRS-1301]
          }; // [NRS-1301]
          const originalXHR = window.XMLHttpRequest.prototype.open; // [NRS-1301]
          window.XMLHttpRequest.prototype.open = function(method, url, ...rest) { // [NRS-1301]
            if (trackingDomains.some(domain => url.includes(domain))) { // [NRS-1301]
              console.log('Blocked XHR tracking request:', url); // [NRS-1301]
              this.abort(); // [NRS-1301]
              return; // [NRS-1301]
            } // [NRS-1301]
            return originalXHR.call(this, method, url, ...rest); // [NRS-1301]
          }; // [NRS-1301]
        })(); // [NRS-1301]
      `); // [NRS-1301] Inject tracking protection script
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	function normalizeUrl(input) {
		// [NRS-1301]
		const trimmed = input.trim(); // [NRS-1301]
		if (!trimmed) return DEFAULT_HOME; // [NRS-1301]
		if (/^[a-zA-Z]+:\/\//.test(trimmed)) return trimmed; // [NRS-1301]
		if (/^[\w.-]+\.[A-Za-z]{2,}/.test(trimmed)) return "https://" + trimmed; // [NRS-1301]
		const q = encodeURIComponent(trimmed); // [NRS-1301]
		const engine = searchEngines[currentSearchEngine]; // [NRS-1301]
		return engine ? engine.url + q : `https://www.bing.com/search?q=${q}`; // [NRS-1301]
	} // [NRS-1301]

	// Omnibox auto-suggestions // [NRS-1301]
	let currentSuggestionIndex = -1; // [NRS-1301]

// [SovereignBrowser] Autosuggest via the local backend, which holds the key.
// Short timeout and silent failure: the omnibox must never stall or break
// when the backend is not running.
const SUGGEST_ENDPOINT = "http://localhost:3001/api/suggest";
async function fetchBraveSuggestions(query) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 1200);
	try {
		const res = await fetch(SUGGEST_ENDPOINT + "?q=" + encodeURIComponent(query), { signal: controller.signal });
		if (!res.ok) { return []; }
		const data = await res.json();
		return Array.isArray(data.results) ? data.results : [];
	} catch (err) {
		if (err.name !== "AbortError") { console.warn("[omnibox] suggest fetch failed:", err.message); }
		return [];
	} finally {
		clearTimeout(timer);
	}
}

	async function getSuggestions(query) {
		// [NRS-1301]
		const trimmed = query.trim().toLowerCase(); // [NRS-1301]
		if (!trimmed) {
			// [NRS-1301]
			// Show recent history when empty // [NRS-1301]
			try {
				// [NRS-1301]
				const historyData = await globalThis.electronAPI?.history?.get?.(); // [NRS-1301]
				const suggestions = (historyData || []) // [NRS-1301]
					.slice(0, 8) // [NRS-1301]
					.map((item) => ({
						// [NRS-1301]
						text: item.title || item.url, // [NRS-1301]
						url: item.url, // [NRS-1301]
						type: "history", // [NRS-1301]
						icon: "?", // [NRS-1301]
				}));
				return suggestions; // [RESTORED]
			} catch {
				// [NRS-1301]
				return []; // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]

		// Combine history, bookmarks, and search suggestions // [NRS-1301]
		const suggestions = []; // [NRS-1301]

		// Get matching bookmarks // [NRS-1301]
		try {
			// [NRS-1301]
			const bookmarksData = await globalThis.electronAPI?.bookmarks?.get?.(); // [NRS-1301]
			(bookmarksData || []).forEach((bookmark) => {
				// [NRS-1301]
				if (
					bookmark.title.toLowerCase().includes(trimmed) ||
					bookmark.url.toLowerCase().includes(trimmed)
				) {
					// [NRS-1301]
					suggestions.push({
						// [NRS-1301]
						text: bookmark.title, // [NRS-1301]
						url: bookmark.url, // [NRS-1301]
						type: "bookmark", // [NRS-1301]
						icon: "?", // [NRS-1301]
					}); // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]
		} catch {} // [NRS-1301]

		// Get matching history // [NRS-1301]
		try {
			// [NRS-1301]
			const historyData = await globalThis.electronAPI?.history?.get?.(); // [NRS-1301]
			(historyData || []).forEach((item) => {
				// [NRS-1301]
				if (
					item.title?.toLowerCase().includes(trimmed) ||
					item.url.toLowerCase().includes(trimmed)
				) {
					// [NRS-1301]
					const isDuplicate = suggestions.some((s) => s.url === item.url); // [NRS-1301]
					if (!isDuplicate) {
						// [NRS-1301]
						suggestions.push({
							// [NRS-1301]
							text: item.title || item.url, // [NRS-1301]
							url: item.url, // [NRS-1301]
							type: "history", // [NRS-1301]
							icon: "?", // [NRS-1301]
						}); // [NRS-1301]
					} // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]
		} catch {} // [NRS-1301]

		// Add search suggestion // [NRS-1301]
		const engine = searchEngines[currentSearchEngine]; // [NRS-1301]
		if (engine) {
			// [NRS-1301]
			suggestions.push({
				// [NRS-1301]
				text: `Search for "${trimmed}" with ${engine.name}`, // [NRS-1301]
				url: engine.url + encodeURIComponent(trimmed), // [NRS-1301]
				type: "search", // [NRS-1301]
				icon: "??", // [NRS-1301]
			}); // [NRS-1301]
		} // [NRS-1301]

	// [SovereignBrowser] Live completions from Brave via the local backend.
	try {
		const remote = await fetchBraveSuggestions(trimmed);
		remote.forEach((text) => {
			if (!text || text.toLowerCase() === trimmed) { return; }
			if (suggestions.some((s) => s.text === text)) { return; }
			suggestions.push({
				text,
				url: (engine ? engine.url : "https://search.brave.com/search?q=") + encodeURIComponent(text),
				type: "suggest",
				icon: "\u203A",
			});
		});
	} catch (err) {
		console.warn("[omnibox] Brave suggestions unavailable:", err.message);
	}

		return suggestions.slice(0, 8); // [NRS-1301]
	} // [NRS-1301]

	function showSuggestions(suggestions) {
		// [NRS-1301]
		omniboxSuggestions.innerHTML = ""; // [NRS-1301]
		currentSuggestionIndex = -1; // [NRS-1301]

		if (!suggestions.length) {
			// [NRS-1301]
			omniboxSuggestions.classList.remove("show"); // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]

		suggestions.forEach((suggestion, idx) => {
			// [NRS-1301]
			const item = document.createElement("div"); // [NRS-1301]
			item.className = "suggestion-item"; // [NRS-1301]
			item.dataset.index = idx; // [NRS-1301]
			item.innerHTML = `
        <span class="suggestion-icon">${suggestion.icon}</span>
        <span class="suggestion-text">${suggestion.text}</span>
        <span class="suggestion-label">${suggestion.type}</span>
      `; // Close suggestion item template
			item.addEventListener("click", () => {
				// [NRS-1301]
				omnibox.value = suggestion.text; // [NRS-1301]
				hideSuggestions(); // [NRS-1301]
				const tab = tabs.find(t => t.id === activeTabId); // [RESTORED]
				if (tab) {
					// [NRS-1301]
					setOmnibox(suggestion.url); // [NRS-1301]
					tab.webview.src = suggestion.url; // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]
			item.addEventListener("mouseenter", () => {
				// [NRS-1301]
				selectSuggestion(idx); // [NRS-1301]
			}); // [NRS-1301]
			omniboxSuggestions.appendChild(item); // [NRS-1301]
		}); // [NRS-1301]

		omniboxSuggestions.classList.add("show"); // [NRS-1301]
	} // [NRS-1301]

	function hideSuggestions() {
		// [NRS-1301]
		omniboxSuggestions.classList.remove("show"); // [NRS-1301]
		currentSuggestionIndex = -1; // [NRS-1301]
	} // [NRS-1301]

	function selectSuggestion(idx) {
		// [NRS-1301]
		const items = omniboxSuggestions.querySelectorAll(".suggestion-item"); // [NRS-1301]
		items.forEach((item, i) => {
			// [NRS-1301]
			item.classList.toggle("selected", i === idx); // [NRS-1301]
		}); // [NRS-1301]
		currentSuggestionIndex = idx; // [NRS-1301]
	} // [NRS-1301]

	function navigateToSelectedSuggestion() {
		// [NRS-1301]
		const items = omniboxSuggestions.querySelectorAll(".suggestion-item"); // [NRS-1301]
		if (currentSuggestionIndex >= 0 && currentSuggestionIndex < items.length) {
			// [NRS-1301]
			items[currentSuggestionIndex].click(); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	// Tab Context Menu // [NRS-1301]
	let contextMenuTabId = null; // [NRS-1301]

	function showTabContextMenu(tabId, event) {
		// [NRS-1301]
		event.preventDefault(); // [NRS-1301]
		contextMenuTabId = tabId; // [NRS-1301]
		tabContextMenu.classList.add("show"); // [NRS-1301]

		// Position at click location with boundary checking // [NRS-1301]
		let x = event.clientX; // [NRS-1301]
		let y = event.clientY; // [NRS-1301]

		// Give menu a chance to render, then check bounds // [NRS-1301]
		setTimeout(() => {
			// [NRS-1301]
			const rect = tabContextMenu.getBoundingClientRect(); // [NRS-1301]
			const padding = 4; // [NRS-1301]

			// Check right boundary // [NRS-1301]
			if (x + rect.width + padding > window.innerWidth) {
				// [NRS-1301]
				x = window.innerWidth - rect.width - padding; // [NRS-1301]
			} // [NRS-1301]

			// Check bottom boundary // [NRS-1301]
			if (y + rect.height + padding > window.innerHeight) {
				// [NRS-1301]
				y = window.innerHeight - rect.height - padding; // [NRS-1301]
			} // [NRS-1301]

			// Ensure not negative // [NRS-1301]
			x = Math.max(padding, x); // [NRS-1301]
			y = Math.max(padding, y); // [NRS-1301]

			tabContextMenu.style.left = x + "px"; // [NRS-1301]
			tabContextMenu.style.top = y + "px"; // [NRS-1301]
		}, 0); // [NRS-1301]
	} // [NRS-1301]

	function hideTabContextMenu() {
		// [NRS-1301]
		tabContextMenu.classList.remove("show"); // [NRS-1301]
		contextMenuTabId = null; // [NRS-1301]
	} // [NRS-1301]

	function handleTabContextAction(action) {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === contextMenuTabId); // [NRS-1301]
		if (!tab) return; // [NRS-1301]

		switch (
			action // [NRS-1301]
		) {
			case "reload-tab": // [NRS-1301]
				tab.webview.reload(); // [NRS-1301]
				break; // [NRS-1301]
			case "duplicate-tab": {
				// [NRS-1301]
				const url = tab.webview.getURL?.() || tab.webview.src || DEFAULT_HOME; // [NRS-1301]
				const newTabId = createTab(url); // [NRS-1301]
				if (tab.group) {
					// [NRS-1301]
					const newTab = tabs.find((t) => t.id === newTabId); // [NRS-1301]
					if (newTab) applyGroup(newTab, tab.group); // [NRS-1301]
				} // [NRS-1301]
				break; // [NRS-1301]
			}
			case "pin-tab": // [NRS-1301]
				tab.tabEl.classList.toggle("pinned"); // [NRS-1301]
				tab.pinned = !tab.pinned; // [NRS-1301]
				break; // [NRS-1301]
			case "mute-tab": // [NRS-1301]
				tab.tabEl.classList.toggle("muted"); // [NRS-1301]
				tab.muted = !tab.muted; // [NRS-1301]
				if (tab.muted) {
					// [NRS-1301]
					try {
						// [NRS-1301]
						tab.webview.executeJavaScript(`
              (() => {
                const audios = document.querySelectorAll('audio, video'); // [NRS-1301]
                audios.forEach(a => a.muted = true); // [NRS-1301]
              })(); // [NRS-1301]
            `); // Apply mute script in page context // [NRS-1301]
					} catch {} // [NRS-1301]
				} // [NRS-1301]
				break; // [NRS-1301]
			case "close-tab-context": // [NRS-1301]
				closeTab(contextMenuTabId); // [NRS-1301]
				break; // [NRS-1301]
			case "close-other-tabs": {
				// [NRS-1301]
				const idsToClose = tabs.filter((t) => t.id !== contextMenuTabId).map((t) => t.id); // [NRS-1301]
				idsToClose.forEach((id) => closeTab(id)); // [NRS-1301]
				break; // [NRS-1301]
			}
		} // [NRS-1301]
		hideTabContextMenu(); // [NRS-1301]
	} // [NRS-1301]

	document.addEventListener("click", hideTabContextMenu); // [NRS-1301]
	document.addEventListener("contextmenu", (e) => {
		// [NRS-1301]
		if (!e.target.closest(".tab")) hideTabContextMenu(); // [NRS-1301]
	}); // [NRS-1301]

	tabContextMenu.querySelectorAll(".context-option").forEach((option) => {
		// [NRS-1301]
		option.addEventListener("click", (e) => {
			// [NRS-1301]
			const action = e.target.dataset.action; // [NRS-1301]
			if (action) handleTabContextAction(action); // [NRS-1301]
		}); // [NRS-1301]
	}); // [NRS-1301]

	// Webview Context Menu // [NRS-1301]
	let contextMenuWebviewId = null; // [NRS-1301]

	let contextMenuParams = null; // [SovereignBrowser] params of the last right-click

	function showWebviewContextMenu(tabId, event) {
		// [SovereignBrowser] The webview 'context-menu' event carries no
		// clientX/clientY - Electron puts the coordinates in event.params, and
		// they are relative to the webview, not the window. Reading clientX gave
		// undefined, so style.left became "undefinedpx" and the menu fell back
		// to the top-left corner.
		if (event.preventDefault) { event.preventDefault(); }
		const params = event.params || {};
		contextMenuParams = params;
		contextMenuWebviewId = tabId;

		const tab = tabs.find((t) => t.id === tabId);
		const flags = params.editFlags || {};
		const hasSelection = !!(params.selectionText && params.selectionText.trim());

		function toggle(selector, on) {
			webviewContextMenu.querySelectorAll(selector).forEach((el) => {
				el.style.display = on ? "" : "none";
			});
		}
		toggle(".ctx-link", !!params.linkURL);
		toggle(".ctx-image", params.mediaType === "image");
		toggle(".ctx-edit", !!params.isEditable);
		toggle(".ctx-copy", hasSelection || !!params.isEditable);
		toggle(".ctx-selectall", !!params.isEditable || hasSelection);
		toggle(".ctx-edit-sep", !!params.isEditable || hasSelection);
		toggle(".ctx-search", hasSelection);

		const cut = webviewContextMenu.querySelector('[data-action="cut"]');
		const copy = webviewContextMenu.querySelector('[data-action="copy"]');
		const paste = webviewContextMenu.querySelector('[data-action="paste"]');
		if (cut) { cut.classList.toggle("disabled", flags.canCut === false); }
		if (copy) { copy.classList.toggle("disabled", flags.canCopy === false); }
		if (paste) { paste.classList.toggle("disabled", flags.canPaste === false); }

		webviewContextMenu.classList.add("show");

		// params.x/y are relative to the webview, so offset by its position.
		const wvRect = tab && tab.webview ? tab.webview.getBoundingClientRect() : { left: 0, top: 0 };
		let x = (params.x || 0) + wvRect.left;
		let y = (params.y || 0) + wvRect.top;

		setTimeout(() => {
			const rect = webviewContextMenu.getBoundingClientRect();
			const padding = 4;
			if (x + rect.width + padding > window.innerWidth) {
				x = window.innerWidth - rect.width - padding;
			}
			if (y + rect.height + padding > window.innerHeight) {
				y = window.innerHeight - rect.height - padding;
			}
			x = Math.max(padding, x);
			y = Math.max(padding, y);
			webviewContextMenu.style.left = x + "px";
			webviewContextMenu.style.top = y + "px";
		}, 0);
	}

	function hideWebviewContextMenu() {
		// [NRS-1301]
		webviewContextMenu.classList.remove("show"); // [NRS-1301]
		contextMenuWebviewId = null; // [NRS-1301]
	} // [NRS-1301]

	function withWebviewFocus(tab, fn) {
		// [SovereignBrowser] Give focus back to the page, then run the command
		// once focus has landed.
		try {
			tab.webview.focus();
		} catch (err) {
			console.warn("[context-menu] could not focus webview:", err.message);
		}
		setTimeout(() => {
			try {
				fn();
			} catch (err) {
				console.warn("[context-menu] edit command failed:", err.message);
			}
		}, 30);
	}

	function handleWebviewContextAction(action) {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === contextMenuWebviewId); // [NRS-1301]
		if (!tab) return; // [NRS-1301]

		switch (
			action // [NRS-1301]
		) {
			// [SovereignBrowser] These act on whatever is focused INSIDE the
			// webview. Clicking an item in HOLLY's own menu moves focus out of
			// the page, so the command ran with nothing focused and silently did
			// nothing. Ctrl+V worked because focus never left the page.
			case "cut":
				withWebviewFocus(tab, () => tab.webview.cut());
				break;
			case "copy":
				withWebviewFocus(tab, () => tab.webview.copy());
				break;
			case "paste":
				withWebviewFocus(tab, () => tab.webview.paste());
				break;
			case "select-all":
				withWebviewFocus(tab, () => tab.webview.selectAll());
				break;
			case "copy-link": {
				const url = contextMenuParams && contextMenuParams.linkURL;
				if (url) {
					navigator.clipboard.writeText(url).catch((err) => {
						console.warn("[context-menu] clipboard write failed:", err.message);
					});
				}
				break;
			}
			case "copy-image-link": {
				const src = contextMenuParams && contextMenuParams.srcURL;
				if (src) {
					navigator.clipboard.writeText(src).catch((err) => {
						console.warn("[context-menu] clipboard write failed:", err.message);
					});
				}
				break;
			}
			case "open-link-new-tab": {
				const url = contextMenuParams && contextMenuParams.linkURL;
				if (url) { createTab(url); }
				break;
			}
			case "search-selection": {
				const text = contextMenuParams && contextMenuParams.selectionText;
				if (text && text.trim()) {
					createTab("https://search.brave.com/search?q=" + encodeURIComponent(text.trim()));
				}
				break;
			}
			case "go-back-page": // [NRS-1301]
				if (tab.webview.canGoBack?.()) tab.webview.goBack(); // [NRS-1301]
				break; // [NRS-1301]
			case "go-forward-page": // [NRS-1301]
				if (tab.webview.canGoForward?.()) tab.webview.goForward(); // [NRS-1301]
				break; // [NRS-1301]
			case "reload-page": // [NRS-1301]
				tab.webview.reload(); // [NRS-1301]
				break; // [NRS-1301]
			case "view-source": {
				// [NRS-1301]
				const currentUrl = tab.webview.getURL?.() || tab.webview.src || ""; // [NRS-1301]
				if (currentUrl) {
					// [NRS-1301]
					const sourceUrl = `view-source:${currentUrl}`; // [NRS-905] Build view-source target URL
					createTab(sourceUrl); // [NRS-1301]
				} // [NRS-1301]
				break; // [NRS-1301]
			} // [NRS-1301]
			case "open-devtools-page": // [NRS-1301]
				tab.webview.openDevTools({ mode: "detach" }); // [NRS-1301]
				break; // [NRS-1301]
			case "save-page": // [NRS-1301]
				try {
					// [NRS-1301]
					tab.webview.downloadURL(tab.webview.getURL?.() || tab.webview.src || ""); // [NRS-1301]
				} catch {
					// [NRS-1301]
					addJarvisThinking("Download feature not available"); // [NRS-1301]
				} // [NRS-1301]
				break; // [NRS-1301]
			case "print-page": // [NRS-1301]
				try {
					// [NRS-1301]
					tab.webview.print({ silent: false }); // [NRS-1301]
				} catch {
					// [NRS-1301]
					tab.webview.executeJavaScript("window.print()"); // [NRS-1301]
				} // [NRS-1301]
				break; // [NRS-1301]
		} // [NRS-1301]
		hideWebviewContextMenu(); // [NRS-1301]
	} // [NRS-1301]

	document.addEventListener("click", hideWebviewContextMenu); // [NRS-1301]

	// [SovereignBrowser] Keep focus inside the page while the menu is used.
	// Cut/copy/paste act on whatever is focused INSIDE the webview. A normal
	// click on host UI blurs the page first, leaving the command with no
	// target - which is why paste silently did nothing. Suppressing the
	// default mousedown behaviour stops the focus change; the click still
	// fires, so the menu keeps working.
	webviewContextMenu.addEventListener("mousedown", (e) => {
		e.preventDefault();
	});

	webviewContextMenu.querySelectorAll(".context-option").forEach((option) => {
		// [NRS-1301]
		option.addEventListener("click", (e) => {
			// [NRS-1301]
			const action = e.target.dataset.action; // [NRS-1301]
			if (action) handleWebviewContextAction(action); // [NRS-1301]
		}); // [NRS-1301]
	}); // [NRS-1301]

	// Find in Page // [NRS-1301]
	let currentFindResults = { requestId: 0, activeMatchOrdinal: 0, matches: 0 }; // [NRS-1301]

	function showFindBar() {
		// [NRS-1301]
		findBar.classList.add("show"); // [NRS-1301]
		findInput.focus(); // [NRS-1301]
		findInput.select(); // [NRS-1301]
	} // [NRS-1301]

	function hideFindBar() {
		// [NRS-1301]
		findBar.classList.remove("show"); // [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (tab) {
			// [NRS-1301]
			try {
				// [NRS-1301]
				tab.webview.stopFindInPage("clearSelection"); // [NRS-1301]
			} catch {} // [NRS-1301]
		} // [NRS-1301]
		findInput.value = ""; // [NRS-1301]
		findCounter.textContent = "0 of 0"; // [NRS-1301]
		currentFindResults = { requestId: 0, activeMatchOrdinal: 0, matches: 0 }; // [NRS-1301]
	} // [NRS-1301]

	function updateFindBar() {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return; // [NRS-1301]
		const searchText = findInput.value.trim(); // [RESTORED]
		if (!searchText) {
			// [NRS-1301]
			findCounter.textContent = "0 of 0"; // [NRS-1301]
			try {
				// [NRS-1301]
				tab.webview.stopFindInPage("clearSelection"); // [NRS-1301]
			} catch {} // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]

		try {
			// [NRS-1301]
			currentFindResults.requestId = tab.webview.findInPage(searchText, {
				findNext: false,
			}); // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Find in page error:", err); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	function findPreviousMatch() {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab || !findInput.value.trim()) return; // [NRS-1301]

		try {
			// [NRS-1301]
			tab.webview.findInPage(findInput.value, {
				findNext: false,
				forward: false,
			}); // [NRS-1301]
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	function findNextMatch() {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab || !findInput.value.trim()) return; // [NRS-1301]

		try {
			// [NRS-1301]
			tab.webview.findInPage(findInput.value, {
				findNext: true,
				forward: true,
			}); // [NRS-1301]
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	// Find bar event listeners // [NRS-1301]
	findInput.addEventListener("input", updateFindBar); // [NRS-1301]

	// Focus protection for find input // [NRS-1301]
	findInput.addEventListener("mousedown", (e) => {
		// [NRS-1301]
		e.stopPropagation(); // [NRS-1301]
		setTimeout(() => findInput.focus(), 0); // [NRS-1301]
	}); // [NRS-1301]

	findInput.addEventListener("click", (e) => {
		// [NRS-1301]
		e.stopPropagation(); // [NRS-1301]
		findInput.focus(); // [NRS-1301]
	}); // [NRS-1301]

	findInput.addEventListener("keydown", (e) => {
		// [NRS-1301]
		// Stop propagation to prevent global handlers from stealing input // [NRS-1301]
		e.stopPropagation(); // [NRS-1301]

		if (e.key === "Enter") {
			// [NRS-1301]
			if (e.shiftKey) {
				// [NRS-1301]
				findPreviousMatch(); // [NRS-1301]
			} else {
				// [NRS-1301]
				findNextMatch(); // [NRS-1301]
			} // [NRS-1301]
		} else if (e.key === "Escape") {
			// [NRS-1301]
			hideFindBar(); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	findPrev.addEventListener("click", findPreviousMatch); // [NRS-1301]
	findNext.addEventListener("click", findNextMatch); // [NRS-1301]
	findClose.addEventListener("click", hideFindBar); // [NRS-1301]

	document.addEventListener("keydown", (e) => {
		// [NRS-1301]
		// Skip global keydown handling when user is in an input/textarea // [NRS-1301]
		if (e.target.matches("input, textarea")) {
			// [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]
		if ((e.ctrlKey || e.metaKey) && e.key === "f") {
			// [NRS-1301]
			e.preventDefault(); // [NRS-1301]
			showFindBar(); // [NRS-1301]
		} else if (e.key === "Escape" && findBar.classList.contains("show")) {
			// [NRS-1301]
			hideFindBar(); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	// Update find counter when webview emits 'found-in-page' event // [NRS-1301]
	function addWebviewFindListener(webview) {
		// [NRS-1301]
		webview.addEventListener("found-in-page", (e) => {
			// [NRS-1301]
			currentFindResults.activeMatchOrdinal = e.result.activeMatchOrdinal || 0; // [NRS-1301]
			currentFindResults.matches = e.result.matches || 0; // [NRS-1301]
			const displayOrdinal = currentFindResults.activeMatchOrdinal > 0 ? currentFindResults.activeMatchOrdinal : "-"; // [RESTORED]
			findCounter.textContent = `${displayOrdinal} of ${currentFindResults.matches}`; // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	function createTab(initialUrl, options = {}) {
		// [NRS-1301]
		const activate = options.activate !== false; // [NRS-1301]
		const id = nextId++; // [RESTORED]
		const tabEl = document.createElement("div"); // [RESTORED]
		tabEl.className = "tab"; // [NRS-1301]
		tabEl.dataset.id = String(id); // [NRS-1301]
		const titleEl = document.createElement("span"); // [RESTORED]
		titleEl.className = "title"; // [NRS-1301]
		titleEl.textContent = "New Tab"; // [NRS-1301]
		const closeEl = document.createElement("button"); // [RESTORED]
		closeEl.className = "close"; // [NRS-1301]
		closeEl.textContent = "×"; // [RESTORED - was mojibake]
		closeEl.title = "Close Tab"; // [NRS-1301]
		tabEl.appendChild(titleEl); // [NRS-1301]
		tabEl.appendChild(closeEl); // [NRS-1301]
		tabsEl.appendChild(tabEl); // [NRS-1301]
		let webview; // real <webview> in the legacy path, compat shim otherwise
		let wcvBacking = null;
		if (USE_WCV) {
			// [SovereignBrowser] WebContentsView backing. The placeholder div
			// takes the <webview>'s place in the DOM - same class, same CSS,
			// same display toggling - and the layout pump mirrors its rect and
			// visibility to the main-process view.
			const placeholder = document.createElement("div");
			placeholder.className = "webview";
			placeholder.dataset.tabId = String(id);
			contentEl.appendChild(placeholder);
			wcvBacking = globalThis.HollyTabBacking.createWebContentsViewBacking({ id, incognito: !!options.incognito });
			webview = wcvBacking.compatElement(placeholder);
			ensureWcvLayoutPump();
		} else {
			webview = document.createElement("webview"); // [RESTORED]
			if (!options.incognito) {
				// [NRS-1301]
				// [SovereignBrowser] One shared persistent session for all normal
				// tabs. Previously each tab had its own partition, so cookies and
				// logins did not carry between tabs, and extensions (which load per
				// session) could never apply to any tab.
				webview.setAttribute("partition", "persist:holly");
			} else {
				// [NRS-1301]
				// Incognito tabs share one in-memory session: isolated from normal
				// browsing, but consistent with each other, as in Chrome and Edge.
				webview.setAttribute("partition", "holly-incognito");
			} // [NRS-1301]
			webview.setAttribute("allowpopups", ""); // [NRS-1301]
			webview.setAttribute("preload", "../preload.js"); // [NRS-1301]
			webview.setAttribute("websecurity", "yes"); // [NRS-1301]
			webview.setAttribute("nodeintegration", "no"); // [NRS-1301]
			webview.className = "webview"; // [NRS-1301]
			contentEl.appendChild(webview); // [NRS-1301]
		}

		// Enhanced error handling for webview // [NRS-1301]
		webview.addEventListener("console-message", (e) => {
			// [NRS-1301]
			if (e.message.includes("is not defined") || e.message.includes("ReferenceError")) {
				// [NRS-1301]
				console.warn("Webview script error caught and ignored:", e.message); // [NRS-1301]
			} // [NRS-1301]
			if (e.message.includes("Permissions policy violation")) {
				// [NRS-1301]
				console.info("Permissions policy violation caught (normal behavior)"); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]

		// Inject comprehensive error prevention script // [NRS-1301]
		webview.addEventListener("dom-ready", () => {
			webview.__domReady = true; // [SovereignBrowser] see readiness guards below
			// [NRS-1301]
			const script = `
        // Global error handler // [NRS-1301]
        window.addEventListener('error', function(e) { // [NRS-1301]
          if (e.message.includes('is not defined')) { // [NRS-1301]
            return true; // [NRS-1301]
          } // [NRS-1301]
          return false; // [NRS-1301]
        }); // [NRS-1301]

        // Prevent common undefined variables // [NRS-1301]
        window.sl_evt = window.sl_evt || function() {}; // [NRS-1301]
        window.fbq = window.fbq || function() {}; // [NRS-1301]
        window.gtag = window.gtag || function() {}; // [NRS-1301]
        window.dataLayer = window.dataLayer || []; // [NRS-1301]
        // [SovereignBrowser] Return nothing. The script's completion value
        // was window.dataLayer, an array analytics fills with functions and
        // DOM references. Electron must serialise the result across IPC and
        // fails with "An object could not be cloned".
        undefined;
      `; // [NRS-1301]

			try {
				// [NRS-1301]
				webview.executeJavaScript(script).catch((err) => {
					console.warn("[webview] guard script injection failed:", err.message);
				}); // [SovereignBrowser]
			} catch (err) {
				// [NRS-1301]
				console.log("Script injection skipped"); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]

		// Inject error prevention script // [NRS-1301]
		webview.addEventListener("dom-ready", () => {
			// [NRS-1301]
			webview
				.executeJavaScript(
					`
        // Global error handler for the webview // [NRS-1301]
        window.addEventListener('error', function(e) { // [NRS-1301]
          if (e.message.includes('is not defined')) { // [NRS-1301]
            console.warn('Caught undefined variable:', e.message); // [NRS-1301]
            return true; // [NRS-1301]
          } // [NRS-1301]
        }); // [NRS-1301]

        // Prevent common undefined variables // [NRS-1301]
        window.sl_evt = window.sl_evt || function() {}; // [NRS-1301]
        window.fbq = window.fbq || function() {}; // [NRS-1301]
        window.gtag = window.gtag || function() {}; // [NRS-1301]
        window.dataLayer = window.dataLayer || []; // [NRS-1301]
        // [SovereignBrowser] Return nothing. The script's completion value
        // was window.dataLayer, an array analytics fills with functions and
        // DOM references. Electron must serialise the result across IPC and
        // fails with "An object could not be cloned".
        undefined;
      `,
					true,
				)
				.catch(() => {}); // Inject error guard script with safe catch // [NRS-1301]
		}); // [NRS-1301]
		const tab = { id, tabEl, titleEl, webview, group: null, incognito: !!options.incognito, pinned: false, muted: false }; // [RESTORED]
		// [SovereignBrowser] Attach the backing abstraction alongside the raw
		// element. tab.webview is untouched, so no existing call site changes
		// and behaviour is identical. Call sites migrate to tab.backing
		// incrementally; once none reference tab.webview, the WebContentsView
		// backing can be swapped in from one place.
		try {
			tab.backing = wcvBacking || globalThis.HollyTabBacking.createWebviewBacking(webview);
		} catch (err) {
			console.error("[tab] could not create backing:", err && err.message);
			tab.backing = null;
		}
		tabs.push(tab); // [NRS-1301]

		if (options.group) applyGroup(tab, options.group); // [NRS-1301]

		tabEl.addEventListener("click", (e) => {
			// [NRS-1301]
			if (e.target === closeEl) {
				// [NRS-1301]
				closeTab(id); // [NRS-1301]
			} else {
				// [NRS-1301]
				setActiveTab(id); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]

		tabEl.addEventListener("contextmenu", (e) => {
			// [NRS-1301]
			showTabContextMenu(id, e); // [NRS-1301]
		}); // [NRS-1301]

		// Webview events // [NRS-1301]
		webview.addEventListener("page-title-updated", (e) => {
			// [NRS-1301]
			titleEl.textContent = e.title || "Tab"; // [NRS-1301]
			updateStatusBar(`${e.title || "Tab"}`, { persist: false }); // [NRS-1301]

			webview.addEventListener("did-start-loading", () => {
				// [NRS-1301]
				if (tab.id === activeTabId) {
					// [NRS-1301]
					showLoadingProgress(); // [NRS-1301]
					webview.classList.add("loading"); // [NRS-1301]
					updateStatusBar("Loading...", { loading: true, persist: true }); // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]

			webview.addEventListener("did-stop-loading", () => {
				// [NRS-1301]
				if (tab.id === activeTabId) {
					// [NRS-1301]
					hideLoadingProgress(); // [NRS-1301]
					webview.classList.remove("loading"); // [NRS-1301]
					const url = webview.getURL?.() || webview.src || ""; // [RESTORED]
					applyExtensionsToWebview(webview, url); // [NRS-1301]
					const isSecure = /^https:\/\//i.test(url); // [RESTORED]
					updateStatusBar("Page loaded", { secure: isSecure }); // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]
		}); // [NRS-1301]
		webview.addEventListener("did-navigate", (e) => {
			// [NRS-1301]
			setOmnibox(e.url); // [NRS-1301]
			applySitePermissions(tab, getOrigin(e.url)); // [NRS-1301]
			applyTrackingProtection(webview); // [NRS-1301]
			const isSecure = /^https:\/\//i.test(e.url); // [RESTORED]
			applyExtensionsToWebview(webview, e.url); // [NRS-1301]
			if (tab.id === activeTabId) {
				// [NRS-1301]
				updateStatusBar(`Navigated to ${e.url}`, { secure: isSecure }); // [NRS-1301]
			} // [NRS-1301]
			try {
				globalThis.electronAPI.history.add({
					title: titleEl.textContent,
					url: e.url,
				});
			} catch {} // [NRS-1301]
			renderHistory(); // [NRS-1301]
			saveSession(); // [NRS-1301]

			webview.addEventListener("did-fail-load", (e) => {
				// [NRS-1301]
				if (e.errorCode && e.errorCode !== -3) {
					// -3 is ERR_ABORTED (user cancelled) // [NRS-1301]
					hideLoadingProgress(); // [NRS-1301]
					webview.classList.remove("loading"); // [NRS-1301]
					if (tab.id === activeTabId) {
						// [NRS-1301]
						showError(`Failed to load page: ${e.errorDescription || "Unknown error"}`); // [NRS-1301]
					} // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]

			webview.addEventListener("dom-ready", () => {
				// [NRS-1301]
				if (tab.id === activeTabId) {
					// [NRS-1301]
					hideLoadingProgress(); // [NRS-1301]
					webview.classList.remove("loading"); // [NRS-1301]
					const url = webview.getURL?.() || webview.src || ""; // [RESTORED]
					applyExtensionsToWebview(webview, url); // [NRS-1301]
				} // [NRS-1301]
			}); // [NRS-1301]
		}); // [NRS-1301]

		webview.addEventListener("context-menu", (e) => {
			// [NRS-1301]
			showWebviewContextMenu(id, e); // [NRS-1301]
		}); // [NRS-1301]

		// Add find in page listener // [NRS-1301]
		addWebviewFindListener(webview); // [NRS-1301]

		// Apply Do Not Track if enabled // [NRS-1301]
		if (privacySettings.doNotTrack) {
			// [NRS-1301]
			try {
				// [NRS-1301]
				const wc = webview.getWebContents?.(); // [NRS-1301]
				if (wc?.session) {
					// [NRS-1301]
					wc.session.webRequest.onBeforeSendHeaders((details, callback) => {
						// [NRS-1301]
						details.requestHeaders["DNT"] = "1"; // [NRS-1301]
						callback({ requestHeaders: details.requestHeaders }); // [NRS-1301]
					}); // [NRS-1301]
				} // [NRS-1301]
			} catch {} // [NRS-1301]
		} // [NRS-1301]

		if (autoDevtools && !devtoolsOpened) {
			// [NRS-1301]
			try {
				// [NRS-1301]
				webview.openDevTools({ mode: "detach" }); // [NRS-1301]
				devtoolsOpened = true; // [NRS-1301]
			} catch {} // [NRS-1301]
		} // [NRS-1301]

		// Set URL after everything is set up // [NRS-1301]
		const url = initialUrl || DEFAULT_HOME; // [NRS-1301]
		setTimeout(() => {
			// [NRS-1301]
			webview.addEventListener("did-fail-load", (ev) => {
	globalThis.electronAPI?.invoke?.("sb:log", "did-fail-load", ev.errorCode, ev.errorDescription, ev.validatedURL);
});
webview.src = url; // [NRS-1301]
		}, 10); // [NRS-1301]

		if (activate) setActiveTab(id); // else updateTabVisibility(); // [NRS-1301]
		renderBookmarks(); // [NRS-1301]
		// Don't save session immediately on create - let the periodic save handle it // [NRS-1301]
		return id; // [NRS-1301]
	} // [NRS-1301]

	function updateTabVisibility() {
		// [NRS-1301]
		if (splitViewEnabled && !tabs.some((t) => t.id === splitPartnerId)) {
			// [NRS-1301]
			splitPartnerId = null; // [NRS-1301]
			splitViewEnabled = false; // [NRS-1301]
		} // [NRS-1301]
		tabs.forEach((t) => {
			// [NRS-1301]
			const isActive = t.id === activeTabId; // [NRS-1301]
			const isSplit = splitViewEnabled && t.id === splitPartnerId; // [RESTORED]
			t.tabEl.classList.toggle("active", isActive); // [NRS-1301]
			t.webview.classList.toggle("active", isActive); // [NRS-1301]
			t.webview.classList.toggle("split-secondary", isSplit); // [NRS-1301]
			if (splitViewEnabled) {
				// [NRS-1301]
				if (isActive || isSplit) {
					// [NRS-1301]
					t.webview.style.display = "flex"; // [NRS-1301]
				} else {
					// [NRS-1301]
					t.webview.style.display = "none"; // [NRS-1301]
				} // [NRS-1301]
			} else {
				// [NRS-1301]
				t.webview.style.display = isActive ? "flex" : "none"; // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
		contentEl.classList.toggle("split-view", splitViewEnabled && splitPartnerId !== null); // [NRS-1301]
	} // [NRS-1301]

	// [SovereignBrowser] WebContentsView layout pump. The placeholder divs are
	// the single source of truth: whatever the existing CSS decides (active
	// tab, split view, side panels), this mirrors to the main-process views.
	// It also derives a top inset while any chrome dropdown hangs over the
	// content area, and hides every view while a modal is open, because a
	// WebContentsView always paints above this document.
	let wcvPumpStarted = false;
	function ensureWcvLayoutPump() {
		if (wcvPumpStarted) { return; }
		wcvPumpStarted = true;
		const OVERLAY_SELECTORS = ["#omnibox-suggestions", ".context-menu", "#find-bar"]; // menus are native in WCV mode
		const MODAL_SELECTORS = [".modal", "#jarvis-swirl-overlay"];
		const lastSent = new Map();
		function isShown(el) {
			if (!el) { return false; }
			const cs = getComputedStyle(el);
			if (cs.display === "none" || cs.visibility === "hidden") { return false; }
			const r = el.getBoundingClientRect();
			return r.width > 0 && r.height > 0;
		}
		function frame() {
			try {
				const wcvTabs = tabs.filter((t) => t.backing && t.backing.kind === "wcv");
				if (wcvTabs.length) {
					const contentRect = contentEl.getBoundingClientRect();
					let modalOpen = false;
					for (const sel of MODAL_SELECTORS) {
						for (const el of document.querySelectorAll(sel)) {
							if (isShown(el)) { modalOpen = true; break; }
						}
						if (modalOpen) { break; }
					}
					let insetTop = 0;
					if (!modalOpen) {
						for (const sel of OVERLAY_SELECTORS) {
							for (const el of document.querySelectorAll(sel)) {
								if (!isShown(el)) { continue; }
								const r = el.getBoundingClientRect();
								const overlaps = r.bottom > contentRect.top && r.top < contentRect.bottom && r.right > contentRect.left && r.left < contentRect.right;
								if (overlaps) { insetTop = Math.max(insetTop, r.bottom - contentRect.top); }
							}
						}
					}
					const layouts = [];
					for (const t of wcvTabs) {
						const ph = t.webview && t.webview.__el;
						if (!ph || !ph.isConnected) { continue; }
						const r = ph.getBoundingClientRect();
						const visible = !modalOpen && isShown(ph);
						const layout = { id: t.id, x: Math.round(r.left), y: Math.round(r.top + insetTop), width: Math.round(r.width), height: Math.max(0, Math.round(r.height - insetTop)), visible: visible };
						const key = layout.x + "|" + layout.y + "|" + layout.width + "|" + layout.height + "|" + layout.visible;
						if (lastSent.get(t.id) !== key) {
							lastSent.set(t.id, key);
							layouts.push(layout);
						}
					}
					if (layouts.length) {
						globalThis.electronAPI.invoke("tab:layout", { layouts }).catch((err) => {
							console.warn("[wcv] layout send failed:", err && err.message);
						});
					}
				}
			} catch (err) {
				console.warn("[wcv] layout pump error:", err && err.message);
			}
			requestAnimationFrame(frame);
		}
		requestAnimationFrame(frame);
	}

	function setActiveTab(id) {
		// [NRS-1301]
		if (splitViewEnabled && splitPartnerId === id) {
			// [NRS-1301]
			const previousActive = activeTabId; // [NRS-1301]
			activeTabId = id; // [NRS-1301]
			splitPartnerId = previousActive; // [NRS-1301]
		} else {
			// [NRS-1301]
			activeTabId = id; // [NRS-1301]
		} // [NRS-1301]
		const tab = tabs.find((t) => t.id === id); // [NRS-1301]
		updateTabVisibility(); // [NRS-1301]
		if (tab) {
			// [NRS-1301]
			const currentUrl = tab.webview.getURL?.() || tab.webview.src || ""; // [NRS-1301]
			setOmnibox(currentUrl); // [NRS-1301]
			applySitePermissions(tab, getOrigin(currentUrl)); // [NRS-1301]
			if (tab.backing && tab.backing.kind === "wcv") {
				globalThis.electronAPI.invoke("tab:activate", { id }).catch((err) => console.warn("[wcv] activate failed:", err && err.message));
			}
		} // [NRS-1301]
	} // [NRS-1301]

	function closeTab(id) {
		// [NRS-1301]
		const idx = tabs.findIndex((t) => t.id === id); // [NRS-1301]
		if (idx >= 0) {
			// [NRS-1301]
			const [tab] = tabs.splice(idx, 1); // [NRS-1301]
			tab.webview.remove(); // [NRS-1301]
			tab.tabEl.remove(); // [NRS-1301]
			if (splitPartnerId === id) {
				// [NRS-1301]
				splitPartnerId = null; // [NRS-1301]
				splitViewEnabled = false; // [NRS-1301]
			} // [NRS-1301]
			if (activeTabId === id) {
				// [NRS-1301]
				const next = tabs[idx] || tabs[idx - 1] || tabs[0]; // [NRS-1301]
				if (next) setActiveTab(next.id); // else activeTabId = null; // [NRS-1301]
			} // [NRS-1301]
			updateTabVisibility(); // [NRS-1301]
			saveSession(); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	// [SovereignBrowser] Main-process pushes: tab events for the WCV backing,
	// pages opening new tabs, and the extension system's tab requests - which
	// previously had NO receiver in this file at all.
	if (globalThis.electronAPI && typeof globalThis.electronAPI.on === "function") {
		try {
			globalThis.electronAPI.on("tab:event", (msg) => {
				if (!msg) { return; }
				const t = tabs.find((x) => x.id === msg.id);
				if (t && t.backing && typeof t.backing.__handleMainEvent === "function") {
					t.backing.__handleMainEvent(msg.event, msg.payload, msg.nav);
				}
			});
			globalThis.electronAPI.on("holly:open-url-in-new-tab", (msg) => {
				if (msg && msg.url) { try { createTab(msg.url); } catch (err) { console.warn("[wcv] open-in-new-tab failed:", err && err.message); } }
			});
			globalThis.electronAPI.on("ext:create-tab", (msg) => {
				try { createTab((msg && msg.url) || DEFAULT_HOME); } catch (err) { console.warn("[ext] create-tab failed:", err && err.message); }
			});
			globalThis.electronAPI.on("ext:select-tab", (msg) => {
				if (msg && msg.tabId != null && tabs.some((t) => t.id === msg.tabId)) { setActiveTab(msg.tabId); }
			});
			globalThis.electronAPI.on("ext:remove-tab", (msg) => {
				if (msg && msg.tabId != null && tabs.some((t) => t.id === msg.tabId)) { closeTab(msg.tabId); }
			});
		} catch (err) {
			console.warn("[wcv] could not subscribe to main-process events:", err && err.message);
		}
	}

	// [SovereignBrowser] Native chrome menus (WCV mode). DOM dropdowns paint
	// under native views, and insetting the page below them vacated a white
	// strip. Collect the same rows, pop a native menu in main, and route the
	// chosen index back to a .click() on the original element, so every
	// existing handler keeps working untouched.
	let __nativeMenuTargets = [];
	function popupNativeMenu(container, anchorEl, rowButtonSel, labelFor) {
		const items = [];
		__nativeMenuTargets = [];
		for (const child of container.children) {
			if (child.classList.contains("ovf-sep") || child.classList.contains("menu-separator")) {
				if (items.length && !items[items.length - 1].sep) { items.push({ sep: true }); }
				continue;
			}
			if (child.id === "bookmarks-menu-list") {
				for (const opt of child.querySelectorAll(".menu-option")) {
					const t = (opt.textContent || "").trim();
					if (!t) { continue; }
					items.push({ i: __nativeMenuTargets.length, label: t });
					__nativeMenuTargets.push(opt);
				}
				continue;
			}
			const target = rowButtonSel ? child.querySelector(rowButtonSel) : child;
			if (!target) { continue; }
			const label = labelFor ? labelFor(child, target) : (child.textContent || "").trim();
			if (!label) { continue; }
			items.push({ i: __nativeMenuTargets.length, label });
			__nativeMenuTargets.push(target);
		}
		const r = anchorEl.getBoundingClientRect();
		globalThis.electronAPI.invoke("holly:popup-menu", { items: items, x: Math.round(r.left), y: Math.round(r.bottom) }).catch((err) => {
			console.warn("[menus] native popup failed:", err && err.message);
		});
	}
	if (USE_WCV) {
		document.body.classList.add("native-menus");
		const ovfExt = document.getElementById("btn-ovf-extensions");
		if (ovfExt) { ovfExt.addEventListener("click", () => { openExtensions(); }); }
		const puzzleBtn = document.getElementById("btn-extensions-bar");
		if (puzzleBtn) {
			puzzleBtn.addEventListener("click", async (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				let exts = [];
				try {
					exts = await globalThis.electronAPI.invoke("holly:extensions:manage-list");
				} catch (err) {
					console.warn("[menus] puzzle list failed:", err.message);
				}
				const items = [];
				__nativeMenuTargets = [];
				const rect = puzzleBtn.getBoundingClientRect();
				for (const px of (exts || [])) {
					if (!px.enabled) { continue; }
					items.push({ i: __nativeMenuTargets.length, label: px.name || px.id, icon: px.iconUrl || undefined });
					__nativeMenuTargets.push(((pid) => () => {
						try {
							if (typeof browserAction !== "undefined" && browserAction && typeof browserAction.activate === "function") {
								browserAction.activate("persist:holly", { eventType: "click", extensionId: pid, anchorRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } });
							} else {
								openExtensions();
							}
						} catch (err) {
							console.warn("[menus] activate failed:", err.message);
						}
					})(px.id));
				}
				if (items.length) { items.push({ sep: true }); }
				items.push({ i: __nativeMenuTargets.length, label: "Manage extensions" });
				__nativeMenuTargets.push(() => openExtensions());
				items.push({ i: __nativeMenuTargets.length, label: "Get extensions from Chrome Web Store" });
				__nativeMenuTargets.push(() => { try { createTab("https://chromewebstore.google.com/"); } catch (err) { console.warn("[menus] open store failed:", err.message); } });
				globalThis.electronAPI.invoke("holly:popup-menu", { items: items, x: Math.round(rect.left), y: Math.round(rect.bottom) }).catch((err) => {
					console.warn("[menus] puzzle menu failed:", err && err.message);
				});
			}, true);
		}
		globalThis.electronAPI.on("holly:menu-action", (payload) => {
			const el = __nativeMenuTargets[payload && payload.i];
			if (typeof el === "function") { el(); } else if (el) { el.click(); }
		});
		const ovfBtn = document.getElementById("btn-overflow");
		const ovfMenu = document.getElementById("overflow-menu");
		if (ovfBtn && ovfMenu) {
			ovfBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				popupNativeMenu(ovfMenu, ovfBtn, "button", (row) => {
					const s = row.querySelector(".ovf-label");
					return s ? (s.textContent || "").trim() : "";
				});
			}, true);
		}
		for (const mi of document.querySelectorAll("#menu-bar .menu-item")) {
			const lbl = mi.querySelector(".menu-label");
			const dd = mi.querySelector(".menu-dropdown");
			if (!lbl || !dd) { continue; }
			lbl.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopImmediatePropagation();
				popupNativeMenu(dd, lbl, null, (child) => (child.classList && child.classList.contains("menu-option")) ? (child.textContent || "").trim() : "");
			}, true);
		}
	}
	btnBack.addEventListener("click", () => {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (tab?.webview.canGoBack()) tab.webview.goBack(); // [NRS-1301]
	}); // [NRS-1301]

	btnForward.addEventListener("click", () => {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (tab?.webview.canGoForward()) tab.webview.goForward(); // [NRS-1301]
	}); // [NRS-1301]

	btnReload.addEventListener("click", () => {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (tab) {
			// [NRS-1301]
			tab.webview.reload(); // [NRS-1301]
			showSuccess("Reloading page"); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

btnHome.addEventListener("click", () => {
	// [SovereignBrowser] Third entry point: Home button -> own home page
	const tab = tabs.find((t) => t.id === activeTabId);
	if (tab) {
		tab.webview.src = DEFAULT_HOME;
		showSuccess("Home");
	} else {
		createTab(DEFAULT_HOME);
	}
});

	btnNewTab.addEventListener("click", () => {
		// [NRS-1301]
		createTab(DEFAULT_HOME); // [NRS-1301]
		showSuccess("New tab created"); // [NRS-1301]
	}); // [NRS-1301]
	if (btnNewIncognito)
		btnNewIncognito.addEventListener("click", () => {
			// [NRS-1301]
			createTab(DEFAULT_HOME, { incognito: true }); // [NRS-1301]
			showSuccess("Incognito tab created"); // [NRS-1301]
		}); // [NRS-1301]
	if (btnNewWindow)
		btnNewWindow.addEventListener("click", () => {
			// [NRS-1301]
			try {
				// [NRS-1301]
				if (globalThis.electronAPI?.openNewWindow) {
					// [NRS-1301]
					globalThis.electronAPI.openNewWindow(); // [NRS-1301]
				} else {
					// [NRS-1301]
					createTab(DEFAULT_HOME); // [NRS-1301]
				} // [NRS-1301]
			} catch {
				// [NRS-1301]
				createTab(DEFAULT_HOME); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]

	function applyGroup(tab, group) {
		// [NRS-1301]
		const nextGroup = tab.group === group ? null : group; // [NRS-1301]
		tab.group = nextGroup; // [NRS-1301]
		tab.tabEl.classList.toggle("group-a", nextGroup === "A"); // [NRS-1301]
		tab.tabEl.classList.toggle("group-b", nextGroup === "B"); // [NRS-1301]
	} // [NRS-1301]

	if (btnTabGroupA)
		btnTabGroupA.addEventListener("click", () => {
			// [NRS-1301]
			const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
			if (tab) applyGroup(tab, "A"); // [NRS-1301]
		}); // [NRS-1301]
	if (btnTabGroupB)
		btnTabGroupB.addEventListener("click", () => {
			// [NRS-1301]
			const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
			if (tab) applyGroup(tab, "B"); // [NRS-1301]
		}); // [NRS-1301]

	if (btnSplitView)
		btnSplitView.addEventListener("click", () => {
			// [NRS-1301]
			if (splitViewEnabled) {
				// [NRS-1301]
				splitViewEnabled = false; // [NRS-1301]
				splitPartnerId = null; // [NRS-1301]
				updateTabVisibility(); // [NRS-1301]
				return; // [NRS-1301]
			} // [NRS-1301]
			const currentActive = activeTabId; // [NRS-1301]
			let other = tabs.find(t => t.id !== activeTabId); // [RESTORED]
			if (!other) {
				// [NRS-1301]
				const newId = createTab(DEFAULT_HOME, { activate: false }); // [NRS-1301]
				other = tabs.find((t) => t.id === newId); // [NRS-1301]
			} // [NRS-1301]
			splitPartnerId = other ? other.id : null; // [NRS-1301]
			splitViewEnabled = splitPartnerId !== null; // [NRS-1301]
			if (currentActive && splitViewEnabled) setActiveTab(currentActive); // [NRS-1301]
			updateTabVisibility(); // [NRS-1301]
		}); // [NRS-1301]


	// Toggle devtools // [NRS-1301]
	btnDevtools.addEventListener("click", () => {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (tab) tab.webview.openDevTools({ mode: "detach" }); // [NRS-1301]
	}); // [NRS-1301]

	// Toggle auto devtools // [NRS-1301]
	btnDevtoolsAuto.addEventListener("click", () => {
		// [NRS-1301]
		autoDevtools = !autoDevtools; // [NRS-1301]
		try {
			localStorage.setItem(AUTO_DEVTOOLS_KEY, String(autoDevtools));
		} catch {} // [NRS-1301]
		updateAutoDevtoolsButton(); // [NRS-1301]
	}); // [NRS-1301]

	// Voice control button // [NRS-1301]
	if (btnVoice) {
		// [NRS-1301]
		btnVoice.addEventListener("click", async () => {
			// [NRS-1301]
			logOverlay.show("Mic button clicked"); // [NRS-1301]
			// If already listening/recording, stop and reset UI // [NRS-1301]
			if (isListening || isRecording) {
				// [NRS-1301]
				stopAllListening(); // [NRS-1301]
				return; // [NRS-1301]
			} // [NRS-1301]

			// Optimistically show listening state while we request permission/start // [NRS-1301]
			setListeningUI(true); // [NRS-1301]
			updateStatusBar("?? Listening..."); // [NRS-1301]

			try {
				// [NRS-1301]
				if (recognition) {
					// [NRS-1301]
					toggleRecognition(); // [NRS-1301]
				} else {
					// [NRS-1301]
					await toggleRecorder({ skipUI: true }); // [NRS-1301]
				} // [NRS-1301]
			} catch (err) {
				// [NRS-1301]
				console.error("Mic start failed:", err); // [NRS-1301]
				setListeningUI(false); // [NRS-1301]
				updateStatusBar(`? Mic error: ${err?.message || "Unknown error"}`); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	// Voice Recognition + fallback recording // [NRS-1301]
	let recognition = null; // [NRS-1301]
	let isListening = false; // [NRS-1301]
	let voiceTimeout = null; // [NRS-1301]
	let mediaRecorder = null; // [NRS-1301]
	let audioChunks = []; // [NRS-1301]
	let isRecording = false; // [NRS-1301]
	let micReady = false; // [NRS-1301]

	function stopAllListening() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			if (isListening && recognition) {
				// [NRS-1301]
				recognition.stop(); // [NRS-1301]
			} // [NRS-1301]
			if (isRecording) {
				// [NRS-1301]
				stopRecorder(); // [NRS-1301]
			} // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Stop listening failed:", err); // [NRS-1301]
		} finally {
			// [NRS-1301]
			setListeningUI(false); // [NRS-1301]
			if (voiceTimeout) {
				// [NRS-1301]
				clearTimeout(voiceTimeout); // [NRS-1301]
				voiceTimeout = null; // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function requestMicPermission() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const res = await globalThis.electronAPI?.mic?.ask?.(); // [NRS-1301]
			// If platform returns status, honor it; // otherwise assume granted when true // [NRS-1301]
			if (res && res.granted !== undefined) {
				// [NRS-1301]
				if (!res.granted) {
					// [NRS-1301]
					updateStatusBar(`? Mic permission denied${res.status ? ` (${res.status})` : ""}`); // [NRS-1301]
					return false; // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
			return true; // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Mic permission request failed:", err); // [NRS-1301]
			updateStatusBar(`? Mic permission error: ${err?.message || "Unknown error"}`); // [NRS-1301]
			return false; // [RESTORED]
		} // [NRS-1301]
	} // [NRS-1301]

	async function ensureMicPermissionAndWarmup() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			// Fast-path: already ready // [NRS-1301]
			if (micReady) return true; // [NRS-1301]

			// Check status first // [NRS-1301]
			const status = await globalThis.electronAPI?.mic?.status?.(); // [NRS-1301]
			if (status?.status && status.status === "denied") {
				// [NRS-1301]
				updateStatusBar("? Mic permission denied by system"); // [NRS-1301]
				return false; // [RESTORED]
			} // [NRS-1301]

			// Ask OS (macOS) and browsers // [NRS-1301]
			const ok = await requestMicPermission(); // [NRS-1301]
			if (!ok) return false; // [NRS-1301]

			// Trigger browser permission prompt (or verify) via getUserMedia, then immediately stop tracks // [NRS-1301]
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			}); // [NRS-1301]
			stream.getTracks().forEach((t) => t.stop()); // [NRS-1301]
			micReady = true; // [NRS-1301]
			return true; // [RESTORED]
		} catch (err) {
			// [NRS-1301]
			console.error("Mic warmup failed:", err); // [NRS-1301]
			logOverlay.show(`Mic warmup failed: ${err?.message || err}`); // [NRS-1301]
			updateStatusBar(`? Mic error: ${err?.message || "Unknown error"}`); // [NRS-1301]
			return false; // [RESTORED]
		} // [NRS-1301]
	} // [NRS-1301]

	function setListeningUI(active) {
		// [NRS-1301]
		if (!btnVoice) return; // [NRS-1301]
		btnVoice.classList.toggle("listening", !!active); // [NRS-1301]
		btnVoice.innerHTML = active ? "??" : "??"; // [NRS-1301]
	} // [NRS-1301]

	function toggleRecognition() {
		// [NRS-1301]
		if (!recognition) return; // [NRS-1301]
		if (isListening) {
			// [NRS-1301]
			recognition.stop(); // [NRS-1301]
			if (voiceTimeout) {
				// [NRS-1301]
				clearTimeout(voiceTimeout); // [NRS-1301]
				voiceTimeout = null; // [NRS-1301]
			} // [NRS-1301]
		} else {
			// [NRS-1301]
			try {
				// [NRS-1301]
				recognition.start(); // [NRS-1301]
				// Auto-stop after 10 seconds // [NRS-1301]
				voiceTimeout = setTimeout(() => {
					// [NRS-1301]
					if (isListening) {
						// [NRS-1301]
						recognition.stop(); // [NRS-1301]
					} // [NRS-1301]
				}, 10000); // [NRS-1301]
			} catch (error) {
				// [NRS-1301]
				console.error("Failed to start speech recognition:", error); // [NRS-1301]
				updateStatusBar("? Failed to start voice recognition"); // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function toggleRecorder(options = {}) {
		// [NRS-1301]
		const { skipUI = false } = options; // [NRS-1301]
		if (isRecording) {
			// [NRS-1301]
			stopRecorder(); // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]
		if (!navigator.mediaDevices?.getUserMedia) {
			// [NRS-1301]
			updateStatusBar("? Microphone capture not supported"); // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]
		try {
			// [NRS-1301]
			if (!skipUI) setListeningUI(true); // [NRS-1301]
			updateStatusBar("?? Requesting mic..."); // [NRS-1301]
			const ok = await ensureMicPermissionAndWarmup(); // [RESTORED]
			if (!ok) {
				// [NRS-1301]
				setListeningUI(false); // [NRS-1301]
				return; // [NRS-1301]
			} // [NRS-1301]

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			}); // [NRS-1301]
			audioChunks = []; // [NRS-1301]
			try {
				// [NRS-1301]
				mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" }); // [NRS-1301]
			} catch (mimeErr) {
				// [NRS-1301]
				console.warn("Falling back: MediaRecorder without mimeType", mimeErr?.message); // [NRS-1301]
				mediaRecorder = new MediaRecorder(stream); // [NRS-1301]
			} // [NRS-1301]

			mediaRecorder.onstart = () => {
				// [NRS-1301]
				isRecording = true; // [NRS-1301]
				setListeningUI(true); // [NRS-1301]
				updateStatusBar("?? Listening..."); // [NRS-1301]
				voiceTimeout = setTimeout(() => {
					// [NRS-1301]
					if (isRecording) stopRecorder(); // [NRS-1301]
				}, 10000); // [NRS-1301]
			}; // [NRS-1301]

			mediaRecorder.ondataavailable = (e) => {
				// [NRS-1301]
				if (e.data?.size) audioChunks.push(e.data); // [NRS-1301]
			}; // [NRS-1301]

			mediaRecorder.onerror = (e) => {
				// [NRS-1301]
				console.error("MediaRecorder error:", e?.error || e); // [NRS-1301]
				logOverlay.show(`MediaRecorder error: ${e?.error?.message || e?.message || e}`); // [NRS-1301]
				updateStatusBar(`? Recording error: ${e?.error?.message || e?.message || "Unknown"}`); // [NRS-1301]
				stopRecorder(); // [NRS-1301]
			}; // [NRS-1301]

			mediaRecorder.onstop = () => {
				// [NRS-1301]
				stream.getTracks().forEach((t) => t.stop()); // [NRS-1301]
				isRecording = false; // [NRS-1301]
				setListeningUI(false); // [NRS-1301]
				if (voiceTimeout) {
					// [NRS-1301]
					clearTimeout(voiceTimeout); // [NRS-1301]
					voiceTimeout = null; // [NRS-1301]
				} // [NRS-1301]
				if (!audioChunks.length) return; // [NRS-1301]
				const blob = new Blob(audioChunks, { type: 'audio/webm' }); // [RESTORED]
				transcribeBlob(blob); // [NRS-1301]
			}; // [NRS-1301]

			mediaRecorder.start(); // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Mic capture failed:", err); // [NRS-1301]
			logOverlay.show(`Mic capture failed: ${err?.message || err}`); // [NRS-1301]
			setListeningUI(false); // [NRS-1301]
			updateStatusBar(`? Mic access failed: ${err?.message || "Unknown error"}`); // [NRS-1301]
			// Offer opening OS settings when permission errors occur // [NRS-1301]
			if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
				// [NRS-1301]
				try {
					await globalThis.electronAPI?.mic?.openSettings?.();
				} catch {} // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	function stopRecorder() {
		// [NRS-1301]
		try {
			mediaRecorder?.stop();
		} catch (e) {
			// [NRS-1301]
			console.error("Failed to stop recorder:", e); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function transcribeBlob(blob) {
		// [NRS-1301]
		try {
			// [NRS-1301]
			updateStatusBar("? Transcribing..."); // [NRS-1301]
			const form = new FormData(); // [NRS-1301]
			form.append("file", blob, "voice.webm"); // [NRS-1301]
			form.append("model", "whisper-1"); // [NRS-1301]
			form.append("language", "en"); // [NRS-1301]

			const response = await fetch(OPENAI_BASE + "/audio/transcriptions", {
				// [NRS-1301]
				method: "POST", // [NRS-1301]
				headers: {
					// [NRS-1301]
					Authorization: `Bearer ${OPENAI_API_KEY}`, // [NRS-1001] Attach OpenAI API key
				}, // [NRS-1301]
				body: form, // [NRS-1301]
			}); // [NRS-1301]

			const data = await response.json(); // [NRS-1301]
			if (data?.text) {
				// [NRS-1301]
				jarvisInput.value = data.text; // [NRS-1301]
				updateStatusBar(`? Voice: "${data.text}"`); // [NRS-1301]
				setTimeout(() => {
					// [NRS-1301]
					sendToHolly(); // [NRS-1301]
				}, 300); // [NRS-1301]
			} else {
				// [NRS-1301]
				console.error("Transcription response:", data); // [NRS-1301]
				updateStatusBar("? Transcription failed"); // [NRS-1301]
			} // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			console.error("Transcription error:", err); // [NRS-1301]
			logOverlay.show(`Transcription error: ${err?.message || err}`); // [NRS-1301]
			updateStatusBar(`? Transcription error: ${err?.message || "Unknown error"}`); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	// Initialize speech recognition // [NRS-1301]
	function initVoiceRecognition() {
		// [NRS-1301]
		if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
			// [NRS-1301]
			const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; // [NRS-1301]
			recognition = new SpeechRecognition(); // [NRS-1301]
			recognition.continuous = false; // [NRS-1301]
			recognition.interimResults = true; // [NRS-1301]
			recognition.lang = "en-US"; // [NRS-1301]

			recognition.onstart = () => {
				// [NRS-1301]
				isListening = true; // [NRS-1301]
				btnVoice.classList.add("listening"); // [NRS-1301]
				btnVoice.innerHTML = "??"; // [NRS-1301]
				updateStatusBar("?? Listening...", { persist: true }); // [NRS-1301]
			}; // [NRS-1301]

			recognition.onresult = (event) => {
				// [NRS-1301]
				let finalTranscript = ""; // [NRS-1301]
				let interimTranscript = ''; // [RESTORED]

				for (let i = event.resultIndex; i < event.results.length; i++) {
					// [NRS-1301]
					const transcript = event.results[i].transcript; // [NRS-1301]
					if (event.results[i].isFinal) {
						// [NRS-1301]
						finalTranscript += transcript; // [NRS-1301]
					} else {
						// [NRS-1301]
						interimTranscript += transcript; // [NRS-1301]
					} // [NRS-1301]
				} // [NRS-1301]

				if (finalTranscript) {
					// [NRS-1301]
					jarvisInput.value = finalTranscript; // [NRS-1301]
					updateStatusBar(`? Voice: "${finalTranscript}"`); // [NRS-1301]
					// Auto-submit the voice command // [NRS-1301]
					setTimeout(() => {
						// [NRS-1301]
						sendToHolly(); // [NRS-1301]
					}, 500); // [NRS-1301]
				} // [NRS-1301]
			}; // [NRS-1301]

			recognition.onerror = (event) => {
				// [NRS-1301]
				console.error("Speech recognition error:", event.error); // [NRS-1301]
				logOverlay.show(`Speech recognition error: ${event.error}`); // [NRS-1301]
				isListening = false; // [NRS-1301]
				btnVoice.classList.remove("listening"); // [NRS-1301]
				btnVoice.innerHTML = "??"; // [NRS-1301]
				if (event.error !== "aborted") {
					// [NRS-1301]
					updateStatusBar(`? Voice error: ${event.error}`); // [NRS-1301]
				} // [NRS-1301]
			}; // [NRS-1301]

			recognition.onend = () => {
				// [NRS-1301]
				isListening = false; // [NRS-1301]
				btnVoice.classList.remove("listening"); // [NRS-1301]
				btnVoice.innerHTML = "??"; // [NRS-1301]
				if (voiceTimeout) {
					// [NRS-1301]
					clearTimeout(voiceTimeout); // [NRS-1301]
					voiceTimeout = null; // [NRS-1301]
				} // [NRS-1301]
			}; // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	// Jarvis Assistant // [NRS-1301]
	let conversationHistory = []; // [NRS-1301]
	let currentTasks = []; // [NRS-1301]
	let completedTasks = []; // [NRS-1301]
	let currentTaskIndex = 0; // [NRS-1301]
	let isExecutingTasks = false; // [NRS-1301]

	function addJarvisMessage(text, isUser) {
		// [NRS-1301]
		const msgEl = document.createElement("div"); // [NRS-1301]
		msgEl.className = `jarvis-message ${isUser ? "user" : "assistant"}`; // [NRS-1301]
		msgEl.textContent = text; // [NRS-1301]
		jarvisMessages.appendChild(msgEl); // [NRS-1301]
		jarvisMessages.scrollTop = jarvisMessages.scrollHeight; // [NRS-1301]
		return msgEl; // [NRS-1301]
	} // [NRS-1301]

	// Browser control functions for Jarvis // [NRS-1301]
	function showJarvisSwirl() {
		// [NRS-1301]
		jarvisSwirlOverlay.classList.add("active"); // [NRS-1301]
		setTimeout(() => {
			// [NRS-1301]
			jarvisSwirlOverlay.classList.remove("active"); // [NRS-1301]
		}, 2000); // [NRS-1301]
	} // [NRS-1301]

	async function getCurrentPageContent() {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return null; // [NRS-1301]

		try {
			// [NRS-1301]
			const result = await tab.webview.executeJavaScript(`
        (() => {
          const title = document.title;
          const url = window.location.href; // [RESTORED]
          const bodyText = document.body.innerText.substring(0, 3000); // [RESTORED]
          const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText).slice(0, 10); // [RESTORED]
          const links = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText, href: a.href })).filter(a => a.href).slice(0, 10); // [RESTORED]
          const images = Array.from(document.querySelectorAll('img')).map(img => ({ // [RESTORED]
            alt: img.alt || '',
            src: img.src,
            width: img.naturalWidth || img.width || null,
            height: img.naturalHeight || img.height || null
          })).filter(img => img.src).slice(0, 10);

          return {
            title,
            url,
            bodyText,
            headings,
            links,
            images
          };
        })();
      `); // Execute in-page extraction script
			return result; // [NRS-1301]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to extract page content:", error); // [NRS-1301]
			return null; // [RESTORED]
		} // [NRS-1301]
	} // [NRS-1301]

	async function extractForms() {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return null; // [NRS-1301]

		try {
			// [NRS-1301]
			const result = await tab.webview.executeJavaScript(`
        (() => {
          // Wait a moment for dynamic content to load // [NRS-1301]
          const waitForElements = (selector, timeout = 2000) => { // [NRS-1301]
            return new Promise((resolve) => { // [NRS-1301]
              const check = () => { // [NRS-1301]
                const elements = document.querySelectorAll(selector); // [NRS-1301]
                if (elements.length > 0) { // [NRS-1301]
                  resolve(elements); // [NRS-1301]
                } else if (timeout > 0) { // [NRS-1301]
                  setTimeout(check, 100); // [NRS-1301]
                  timeout -= 100; // [NRS-1301]
                } else { // [NRS-1301]
                  resolve([]); // [NRS-1301]
                } // [NRS-1301]
              }; // [NRS-1301]
              check(); // [NRS-1301]
            }); // [NRS-1301]
          }; // [NRS-1301]

          const extractFormData = () => { // [NRS-1301]
            const forms = Array.from(document.querySelectorAll('form')); // [NRS-1301]

            // Also look for input fields that might not be in a form element
            const standaloneInputs = Array.from(document.querySelectorAll('input:not(form input), textarea:not(form textarea), select:not(form select)'));
            let allForms = forms.map((form, formIndex) => { // [RESTORED]
              const fields = Array.from(form.querySelectorAll('input, textarea, select')).map((field, fieldIndex) => ({
                type: field.type || field.tagName.toLowerCase(),
                name: field.name,
                id: field.id,
                placeholder: field.placeholder,
                label: (() => {
                  const label = field.labels?.[0] ||
                               document.querySelector(\`label[for="\${field.id}"]\`) ||
                               field.closest('div')?.querySelector('label') ||
                               field.previousElementSibling?.tagName === 'LABEL' ? field.previousElementSibling : null;
                               return label?.textContent?.trim() || field.placeholder || field.name || ''; // [RESTORED]
                })(),
                required: field.required,
                value: field.value,
                fieldIndex: fieldIndex,
                selector: field.id ? \`#\${field.id}\` :
                         field.name ? \`[name="\${field.name}"]\` :
                         field.placeholder ? \`[placeholder="\${field.placeholder}"]\` :
                         \`form:nth-of-type(\${formIndex + 1}) \${field.tagName.toLowerCase()}:nth-of-type(\${fieldIndex + 1})\`,
                visible: field.offsetParent !== null && field.style.display !== 'none'
              })).filter(field => field.visible);

              return {
                formIndex: formIndex,
                action: form.action,
                method: form.method,
                fields: fields,
                submitButton: form.querySelector('button[type="submit"], input[type="submit"], button:not([type])')?.textContent || 'Submit'
              };
            });

            // If we have standalone inputs (like Google's sign-in), create a virtual form
            if (standaloneInputs.length > 0) {
              const standaloneFields = standaloneInputs.map((field, fieldIndex) => ({
                type: field.type || field.tagName.toLowerCase(),
                name: field.name,
                id: field.id,
                placeholder: field.placeholder,
                label: (() => {
                  const label = field.labels?.[0] ||
                               document.querySelector(\`label[for="\${field.id}"]\`) ||
                               field.closest('div')?.querySelector('label') ||
                               field.previousElementSibling?.tagName === 'LABEL' ? field.previousElementSibling : null;
                               return label?.textContent?.trim() || field.placeholder || field.name || ''; // [RESTORED]
                })(),
                required: field.required,
                value: field.value,
                fieldIndex: fieldIndex,
                selector: field.id ? \`#\${field.id}\` :
                         field.name ? \`[name="\${field.name}"]\` :
                         field.placeholder ? \`[placeholder="\${field.placeholder}"]\` :
                         \`input:nth-of-type(\${fieldIndex + 1})\`,
                visible: field.offsetParent !== null && field.style.display !== 'none'
              })).filter(field => field.visible);

              if (standaloneFields.length > 0) {
                allForms.push({
                  formIndex: allForms.length,
                  action: window.location.href,
                  method: 'post',
                  fields: standaloneFields,
                  submitButton: document.querySelector('button[type="submit"], input[type="submit"], button:contains("Sign in"), button:contains("Next"), button:contains("Continue")')?.textContent || 'Submit'
                });
              }
            }

            return allForms;
          }; // [NRS-1301]

          return extractFormData(); // [NRS-1301]
        })(); // [NRS-1301]

        return result; // [NRS-1301]
      `); // [NRS-1301]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to extract forms:", error); // [NRS-1301]
			return null; // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function fillFormField(selector, value) {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return false; // [NRS-1301]

		try {
			// [NRS-1301]
			const result = await tab.webview.executeJavaScript(`
        (() => {
          let field = document.querySelector('${selector}');

          if (!field) {
            // Try comprehensive selectors for email/username fields
            const selectors = [
              'input[type="email"]',
              'input[type="text"]',
              'input[placeholder*="email" i]',
              'input[placeholder*="Email" i]',
              'input[placeholder*="phone" i]',
              'input[placeholder*="username" i]',
              'input[name*="email" i]',
              'input[name*="Email" i]',
              'input[name*="username" i]',
              'input[name*="login" i]',
              'input[id*="email" i]',
              'input[id*="Email" i]',
              'input[id*="username" i]',
              'input[id*="login" i]',
              'input[autocomplete="email"]',
              'input[autocomplete="username"]',
              'input[autocomplete="off"]',
              // Google-specific selectors
              'input[aria-label*="email" i]',
              'input[aria-label*="Email" i]',
              'input[data-initial-value]',
              'input[jsname]',
              'input[spellcheck="false"]',
              // Generic fallbacks
              'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
              'input[type="text"]:visible',
              'input:visible'
            ];

            for (const testSelector of selectors) {
              const fields = document.querySelectorAll(testSelector);
              for (const testField of fields) {
                // Check if field is visible and interactive
                const rect = testField.getBoundingClientRect();
                const style = window.getComputedStyle(testField); // [RESTORED]

                if (testField.offsetParent !== null &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    rect.width > 0 &&
                    rect.height > 0 &&
                    !testField.disabled &&
                    !testField.readOnly) {
                  field = testField;
                  break;
                }
              }
              if (field) break;
            }

            if (!field) {
              console.log('No suitable input field found');
              return false; // [RESTORED]
            }
          }

          // Enhanced field interaction for better compatibility
          try {
            // Focus the field
            field.focus();

            // Clear existing value using multiple methods
            field.value = '';
            field.setAttribute('value', '');

            // Wait a moment for any focus events to complete
            setTimeout(() => {
              // Set the new value
              field.value = '${value.replaceAll("'", "\\'")}';
              field.setAttribute('value', '${value.replaceAll("'", "\\'")}');

              // Trigger comprehensive events for maximum compatibility
              field.dispatchEvent(new Event('focus', { bubbles: true }));
              field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
              field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
              field.dispatchEvent(new Event('blur', { bubbles: true }));

              // Try React/Angular event triggering
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
              nativeInputValueSetter.call(field, '${value.replaceAll("'", "\\'")}');
              field.dispatchEvent(new Event('input', { bubbles: true }));

            }, 10);

            console.log('Successfully filled field:', field);
            return true; // [RESTORED]
          } catch (err) {
            console.error('Error filling field:', err);
            return false; // [RESTORED]
          }
        })();
      `);
      return result; // [RESTORED]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to fill form field:", error); // [NRS-1301]
			return false; // [RESTORED]
		} // [NRS-1301]
	} // [NRS-1301]

	async function submitForm(formIndex = 0) {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return false; // [NRS-1301]

		try {
			// [NRS-1301]
			const result = await tab.webview.executeJavaScript(`
        (() => {
          const forms = document.querySelectorAll('form');
          if (forms[${formIndex}]) {
            const submitButton = forms[${formIndex}].querySelector('button[type="submit"], input[type="submit"]');
            if (submitButton) {
              submitButton.click();
              return true; // [RESTORED]
            } else {
              forms[${formIndex}].submit();
              return true; // [RESTORED]
            }
          }
          return false;
        })();
      `);
      return result; // [RESTORED]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to submit form:", error); // [NRS-1301]
			return false; // [RESTORED]
		} // [NRS-1301]
	} // [NRS-1301]

	async function clickElement(selector, textContent = null) {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return false; // [NRS-1301]

		try {
			// [NRS-1301]
			const result = await tab.webview.executeJavaScript(`
        (() => {
          // Inject swirl animation styles if not already present
          if (!document.getElementById('jarvis-click-swirl-styles')) {
            const style = document.createElement('style');
            style.id = 'jarvis-click-swirl-styles';
            style.textContent = \`
              @keyframes jarvis-click-swirl { // [NRS-1301]
                0% { // [NRS-1301]
                  transform: translate(-50%, -50%) scale(0); // [NRS-1301]
                  opacity: 0.8; // [NRS-1301]
                } // [NRS-1301]
                50% { // [NRS-1301]
                  opacity: 0.6; // [NRS-1301]
                } // [NRS-1301]
                100% { // [NRS-1301]
                  transform: translate(-50%, -50%) scale(3); // [NRS-1301]
                  opacity: 0; // [NRS-1301]
                } // [NRS-1301]
              } // [NRS-1301]
              .jarvis-click-effect { // [NRS-1301]
                position: relative; // [NRS-1301]
                overflow: visible !important; // [NRS-1301]
              } // [NRS-1301]
              .jarvis-click-effect::before { // [NRS-1301]
                content: ''; // [NRS-1301]
                position: absolute; // [NRS-1301]
                top: 50%; // [NRS-1301]
                left: 50%; // [NRS-1301]
                width: 100px; // [NRS-1301]
                height: 100px; // [NRS-1301]
                border-radius: 50%; // [NRS-1301]
                background: radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(99, 102, 241, 0.6) 40%, rgba(168, 85, 247, 0.4) 70%, transparent 100%); // [NRS-1301]
                pointer-events: none; // [NRS-1301]
                z-index: 999999; // [NRS-1301]
                animation: jarvis-click-swirl 0.8s ease-out forwards; // [NRS-1301]
                box-shadow: 0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(99, 102, 241, 0.4); // [NRS-1301]
              } // [NRS-1301]
            \`;
            document.head.appendChild(style);
          }

          let element = null;

          // Try direct selector first
          if ('${selector}') {
            element = document.querySelector('${selector}');
          }

          // If not found and text provided, search by text content
          if (!element && '${textContent}') {
            const allElements = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"], [onclick]');
            for (const el of allElements) {
              if (el.textContent.toLowerCase().includes('${textContent}'.toLowerCase()) ||
                  el.value?.toLowerCase().includes('${textContent}'.toLowerCase()) ||
                  el.getAttribute('aria-label')?.toLowerCase().includes('${textContent}'.toLowerCase())) {
                element = el;
                break;
              }
            }
          }

          // If still not found, try comprehensive search
          if (!element) {
            const clickableSelectors = [
              'button', 'a', 'input[type="button"]', 'input[type="submit"]',
              '[role="button"]', '[onclick]', '.btn', '.button',
              'div[onclick]', 'span[onclick]'
            ];

            for (const sel of clickableSelectors) {
              const elements = document.querySelectorAll(sel);
              for (const el of elements) {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el); // [RESTORED]

                // Check if element is visible and interactive
                if (el.offsetParent !== null &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    rect.width > 0 &&
                    rect.height > 0 &&
                    !el.disabled) {

                  // Match by text if provided
                  if ('${textContent}') {
                    const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase();
                    if (text.includes('${textContent}'.toLowerCase())) {
                      element = el;
                      break;
                    }
                  }
                }
              }
              if (element) break;
            }
          }

          if (!element) {
            return { success: false, message: 'Element not found or not clickable' };
          }

          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Wait a moment for scroll
          setTimeout(() => {
            // Add swirl effect
            element.classList.add('jarvis-click-effect');

            // Remove effect after animation completes
            setTimeout(() => {
              element.classList.remove('jarvis-click-effect');
            }, 800);

            // Perform click slightly after swirl starts
            setTimeout(() => {
              try {
                element.focus();
                element.click();

                // Also dispatch events
                element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              } catch (err) {
                console.error('Click error:', err);
              }
            }, 200);
          }, 100);

          return {
            success: true,
            message: 'Clicked element: ' + (element.textContent?.substring(0, 50) || element.tagName)
          };
        })();
      `);
      return result; // [RESTORED]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to click element:", error); // [NRS-1301]
			return { success: false, message: error.message }; // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function clickAndTypeInField(selector, text, fieldLabel = null) {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return false; // [NRS-1301]

		try {
			// [NRS-1301]
			const result = await tab.webview.executeJavaScript(`
        (() => {
          // Inject swirl animation styles if not already present
          if (!document.getElementById('jarvis-click-swirl-styles')) {
            const style = document.createElement('style');
            style.id = 'jarvis-click-swirl-styles';
            style.textContent = \`
              @keyframes jarvis-click-swirl { // [NRS-1301]
                0% { // [NRS-1301]
                  transform: translate(-50%, -50%) scale(0); // [NRS-1301]
                  opacity: 0.8; // [NRS-1301]
                } // [NRS-1301]
                50% { // [NRS-1301]
                  opacity: 0.6; // [NRS-1301]
                } // [NRS-1301]
                100% { // [NRS-1301]
                  transform: translate(-50%, -50%) scale(3); // [NRS-1301]
                  opacity: 0; // [NRS-1301]
                } // [NRS-1301]
              } // [NRS-1301]
              .jarvis-click-effect { // [NRS-1301]
                position: relative; // [NRS-1301]
                overflow: visible !important; // [NRS-1301]
              } // [NRS-1301]
              .jarvis-click-effect::before { // [NRS-1301]
                content: ''; // [NRS-1301]
                position: absolute; // [NRS-1301]
                top: 50%; // [NRS-1301]
                left: 50%; // [NRS-1301]
                width: 100px; // [NRS-1301]
                height: 100px; // [NRS-1301]
                border-radius: 50%; // [NRS-1301]
                background: radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(99, 102, 241, 0.6) 40%, rgba(168, 85, 247, 0.4) 70%, transparent 100%); // [NRS-1301]
                pointer-events: none; // [NRS-1301]
                z-index: 999999; // [NRS-1301]
                animation: jarvis-click-swirl 0.8s ease-out forwards; // [NRS-1301]
                box-shadow: 0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(99, 102, 241, 0.4); // [NRS-1301]
              } // [NRS-1301]
            \`;
            document.head.appendChild(style);
          }

          let field = null;

          // Try direct selector first
          if ('${selector}') {
            field = document.querySelector('${selector}');
          }

          // If not found, search by label, placeholder, or name
          if (!field) {
            const searchText = '${fieldLabel}' || '${selector}';
            const inputSelectors = [; // [RESTORED]
              'input[type="text"]',
              'input[type="email"]',
              'input[type="password"]',
              'input[type="search"]',
              'input[type="tel"]',
              'input[type="url"]',
              'input:not([type])',
              'textarea'
            ];

            for (const sel of inputSelectors) {
              const inputs = document.querySelectorAll(sel);
              for (const input of inputs) {
                const rect = input.getBoundingClientRect();
                const style = window.getComputedStyle(input); // [RESTORED]

                // Check if field is visible and interactive
                if (input.offsetParent !== null &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    rect.width > 0 &&
                    rect.height > 0 &&
                    !input.disabled &&
                    !input.readOnly) {

                  // Match by placeholder, name, id, or associated label // [NRS-1301]
                  const placeholder = (input.placeholder || '').toLowerCase(); // [NRS-1301]
                  const name = (input.name || '').toLowerCase(); // [NRS-1301]
                  const id = (input.id || '').toLowerCase(); // [NRS-1301]
                  const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase(); // [NRS-1301]
                  const label = input.labels?.[0]?.textContent?.toLowerCase() ||
                               document.querySelector('label[for="' + input.id + '"]')?.textContent?.toLowerCase() || ''; // [NRS-1301]
                  const search = searchText.toLowerCase(); // [NRS-1301]
                  if (placeholder.includes(search) ||
                      name.includes(search) ||
                      id.includes(search) ||
                      ariaLabel.includes(search) ||
                      label.includes(search)) {
                    field = input;
                    break;
                  }
                }
              }
              if (field) break;
            }
          }

          if (!field) {
            return { success: false, message: 'Text field not found or not editable' };
          }

          // Scroll field into view
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Wait for scroll, then show effect and type
          setTimeout(() => {
            // Add swirl effect
            field.classList.add('jarvis-click-effect');

            // Remove effect after animation
            setTimeout(() => {
              field.classList.remove('jarvis-click-effect');
            }, 800);

            // Focus and type
            setTimeout(() => {
              try {
                // Focus the field
                field.focus();
                field.click();

                // Clear existing value
                field.value = '';
                field.setAttribute('value', '');

                // Set new value
                const textToType = '${text.replace(/'/g, "\\'").replace(/"/g, '\\"')}';
                field.value = textToType;
                field.setAttribute('value', textToType);

                // Trigger events for React/Angular/Vue compatibility
                field.dispatchEvent(new Event('focus', { bubbles: true }));
                field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
                field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));

                // React compatibility
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
                                               Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                if (nativeInputValueSetter) {
                  nativeInputValueSetter.call(field, textToType);
                  field.dispatchEvent(new Event('input', { bubbles: true }));
                }
              } catch (err) {
                console.error('Type error:', err);
              }
            }, 200);
          }, 100);

          return {
            success: true,
            message: 'Clicked field and typed: ' + (field.placeholder || field.name || field.id || 'input field')
          };
        })(); // [NRS-1301]

        return result; // [NRS-1301]
      `); // [NRS-1301]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to click and type in field:", error); // [NRS-1301]
			return { success: false, message: error.message }; // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	function createTaskList(tasks) {
		// [NRS-1301]
		currentTasks = tasks.map((task, index) => ({
			// [NRS-1301]
			id: index + 1, // [NRS-1301]
			description: task, // [NRS-1301]
			status: "pending", // [NRS-1301]
			startTime: null, // [NRS-1301]
			endTime: null, // [NRS-1301]
		})); // [NRS-1301]
		completedTasks = []; // [NRS-1301]
		currentTaskIndex = 0; // [NRS-1301]
		isExecutingTasks = true; // [NRS-1301]

		addJarvisMessage(`?? Created ${tasks.length} tasks - Starting automatic execution now!`, false); // [NRS-1301]

		// Immediately start executing tasks without delay // [NRS-1301]
		addJarvisThinking("?? Initializing automatic task execution..."); // [NRS-1301]

		// Start execution immediately // [NRS-1301]
		setTimeout(() => {
			// [NRS-1301]
			executeNextTaskAutomatically(); // [NRS-1301]
		}, 100); // [NRS-1301]

		return `Created task list with ${tasks.length} tasks - Automatic execution started`; // [NRS-1301]
	} // [NRS-1301]

	function addJarvisThinking(text) {
		// [NRS-1301]
		const thinkingEl = document.createElement("div"); // [NRS-1301]
		thinkingEl.className = "jarvis-message thinking"; // [NRS-1301]
		thinkingEl.innerHTML = `<em>?? Thinking: ${text}</em>`; // [NRS-1301]
		thinkingEl.style.opacity = "0.7"; // [NRS-1301]
		thinkingEl.style.fontStyle = "italic"; // [NRS-1301]
		jarvisMessages.appendChild(thinkingEl); // [NRS-1301]
		jarvisMessages.scrollTop = jarvisMessages.scrollHeight; // [NRS-1301]
		return thinkingEl; // [RESTORED]
	} // [NRS-1301]

	function updateTaskStatus(taskId, status, result = null) {
		// [NRS-1301]
		const task = currentTasks.find((t) => t.id === taskId); // [NRS-1301]
		if (task) {
			// [NRS-1301]
			task.status = status; // [NRS-1301]
			if (status === "in-progress") {
				// [NRS-1301]
				task.startTime = new Date(); // [NRS-1301]
			} else if (status === "completed") {
				// [NRS-1301]
				task.endTime = new Date(); // [NRS-1301]
				task.result = result; // [NRS-1301]
				completedTasks.push({ ...task }); // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]
		return task; // [NRS-1301]
	} // [NRS-1301]

	function getTaskSummary() {
		// [NRS-1301]
		const totalTasks = currentTasks.length;
		const completed = completedTasks.length; // [RESTORED]
		const pending = currentTasks.filter(t => t.status === 'pending').length; // [RESTORED]
		const inProgress = currentTasks.filter(t => t.status === 'in-progress').length; // [RESTORED]
		let summary = `?? Task Summary:\n`; // [RESTORED]
		summary += `Total Tasks: ${totalTasks}\n`; // [NRS-1301]
		summary += `Completed: ${completed}\n`; // [NRS-1301]
		summary += `In Progress: ${inProgress}\n`; // [NRS-1301]
		summary += `Pending: ${pending}\n\n`; // [NRS-1301]

		if (completedTasks.length > 0) {
			// [NRS-1301]
			summary += `? Completed Tasks:\n`; // [NRS-1301]
			completedTasks.forEach((task) => {
				// [NRS-1301]
				const duration =
					task.endTime && task.startTime // [NRS-1301]
						? Math.round((task.endTime - task.startTime) / 1000)
						: 0; // [NRS-1301]
				summary += `- ${task.description} (${duration}s)\n`; // [NRS-1301]
				if (task.result) summary += `  Result: ${task.result}\n`; // [NRS-1301]
			}); // [NRS-1301]
		} // [NRS-1301]

		return summary; // [NRS-1301]
	} // [NRS-1301]

	async function progressToNextTask() {
		// [NRS-1301]
		if (!isExecutingTasks) {
			// [NRS-1301]
			addJarvisThinking("?? Task execution stopped"); // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]

		const nextTask = currentTasks.find((t) => t.status === "pending"); // [NRS-1301]
		if (nextTask) {
			// [NRS-1301]
			addJarvisThinking(`?? Next task found: ${nextTask.description}`); // [NRS-1301]

			// Execute immediately // [NRS-1301]
			setTimeout(async () => {
				// [NRS-1301]
				await executeNextTaskAutomatically(); // [NRS-1301]
			}, 500); // [NRS-1301]
		} else {
			// [NRS-1301]
			result = jarvisFunctions.navigate_to_url({ url: url }); // [NRS-1301]
			isExecutingTasks = false; // [NRS-1301]
			addJarvisThinking("?? ALL TASKS COMPLETED! Generating summary..."); // [NRS-1301]

			setTimeout(() => {
				// [NRS-1301]
				const summary = getTaskSummary(); // [NRS-1301]
				addJarvisMessage(`?? MISSION ACCOMPLISHED!\n\n${summary}`, false); // [NRS-1301]
			}, 500); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function executeNextTaskAutomatically() {
		// [NRS-1301]
		addJarvisThinking("?? Checking for next task to execute..."); // [NRS-1301]
		const nextTask = currentTasks.find(t => t.status === 'pending'); // [RESTORED]
		if (!nextTask) {
			// [NRS-1301]
			addJarvisThinking("? No pending tasks found"); // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]

		addJarvisThinking(`?? Found task ${nextTask.id}: "${nextTask.description}"`); // [NRS-1301]

		// Mark task as started // [NRS-1301]
		updateTaskStatus(nextTask.id, "in-progress"); // [NRS-1301]
		addJarvisThinking(`?? Task ${nextTask.id} marked as IN PROGRESS`); // [NRS-1301]
		let result = 'Task executed automatically'; // [RESTORED]
		let success = true; // [RESTORED]

		try {
			// [NRS-1301]
			const taskDesc = nextTask.description.toLowerCase(); // [NRS-1301]
			addJarvisThinking(`?? Analyzing task: "${taskDesc}"`); // [NRS-1301]

			if (taskDesc.includes("navigate")) {
				// [NRS-1301]
				addJarvisThinking("?? This is a NAVIGATION task"); // [NRS-1301]
				const urlMatch = nextTask.description.match(/(https?:\/\/[^\s]+|[\w.-]+\.[a-z]{2,}|demoqa\.com)/i); // [RESTORED]
				if (urlMatch) {
					// [NRS-1301]
					let url = urlMatch[0]; // [NRS-1301]
					if (url === "demoqa.com" || url.includes("demoqa")) {
						// [NRS-1301]
						url = "https://demoqa.com/automation-practice-form"; // [NRS-1301]
					} // [NRS-1301]

					addJarvisThinking(`?? Navigating to: ${url}`); // [NRS-1301]

					try {
						// [NRS-1301]
						result = await jarvisFunctions.navigate_to_url({ url: url }); // [NRS-1301]
						addJarvisThinking(`? Navigation result: ${result}`); // [NRS-1301]

						// Wait for page to load // [NRS-1301]
						addJarvisThinking("? Waiting 4 seconds for page to load..."); // [NRS-1301]
						await new Promise(resolve => setTimeout(resolve, 4000)); // [RESTORED]
						addJarvisThinking("? Page load wait complete"); // [NRS-1301]

						success = true; // [NRS-1301]
					} catch (navError) {
						// [NRS-1301]
						result = `Navigation error: ${navError.message}`; // [NRS-1301]
						success = false; // [NRS-1301]
						addJarvisThinking(`? Navigation failed: ${navError.message}`); // [NRS-1301]
					} // [NRS-1301]
				} else {
					// [NRS-1301]
					result = "No valid URL found in task description"; // [NRS-1301]
					success = false; // [NRS-1301]
					addJarvisThinking("? No URL found in task description"); // [NRS-1301]
				} // [NRS-1301]
			} else if (
				taskDesc.includes("extract") ||
				(taskDesc.includes("find") && taskDesc.includes("form"))
			) {
				// [NRS-1301]
				// Auto-extract forms using actual Jarvis function // [NRS-1301]
				addJarvisThinking("Waiting for page to load before extracting forms..."); // [NRS-1301]
				// Wait a bit for page to load // [NRS-1301]
				await new Promise((resolve) => setTimeout(resolve, 3000)); // [NRS-1301]

				try {
					// [NRS-1301]
					result = await jarvisFunctions.extract_forms(); // [NRS-1301]
					addJarvisThinking(`Form extraction completed: ${result}`); // [NRS-1301]

					if (result && result !== "No forms found on this page") {
						// [NRS-1301]
						const formsData = JSON.parse(result); // [NRS-1301]
						addJarvisThinking(`Found ${formsData.formsFound} forms with fields`); // [NRS-1301]
						success = true; // [NRS-1301]
					} else {
						// [NRS-1301]
						addJarvisThinking("No forms were found on the current page"); // [NRS-1301]
						success = false; // [NRS-1301]
					} // [NRS-1301]
				} catch (extractError) {
					// [NRS-1301]
					result = `Form extraction error: ${extractError.message}`; // [NRS-1301]
					success = false; // [NRS-1301]
					addJarvisThinking(`Form extraction failed: ${extractError.message}`); // [NRS-1301]
				} // [NRS-1301]
			} else if (taskDesc.includes("fill")) {
				// [NRS-1301]
				// Auto-fill forms with provided data using actual Jarvis function // [NRS-1301]
				addJarvisThinking("Extracting forms first..."); // [NRS-1301]

				try {
					// [NRS-1301]
					const formsResult = await jarvisFunctions.extract_forms(); // [NRS-1301]

					if (formsResult && formsResult !== "No forms found on this page") {
						// [NRS-1301]
						const formsData = JSON.parse(formsResult); // [NRS-1301]

						if (formsData.forms && formsData.forms.length > 0) {
							// [NRS-1301]
							const form = formsData.forms[0]; // [NRS-1301]
							const fields = []; // [RESTORED]

							// Extract data from task description // [NRS-1301]
							const emailMatch = nextTask.description.match(/([\w.-]+@[\w.-]+\.[a-z]{2,})/i); // [NRS-1301]
							const phoneMatch = nextTask.description.match(/phone[:\s]*(\d{10,})/i); // [RESTORED]
							const nameMatches = nextTask.description.match(/name[:\s]*([a-zA-Z\s]+)/i); // [RESTORED]
							const firstNameMatch = nextTask.description.match(/first\s*name[:\s]*([a-zA-Z]+)/i); // [RESTORED]
							const lastNameMatch = nextTask.description.match(/last\s*name[:\s]*([a-zA-Z]+)/i); // [RESTORED]

							addJarvisThinking(`Found ${form.fields.length} form fields to process`); // [NRS-1301]

							// Fill available form fields // [NRS-1301]
							for (const field of form.fields) {
								// [NRS-1301]
								const fieldType = field.type?.toLowerCase(); // [NRS-1301]
								const fieldName = field.name?.toLowerCase() || ''; // [RESTORED]
								const fieldLabel = field.label?.toLowerCase() || ''; // [RESTORED]

								if (
									(fieldType === "email" ||
										fieldName.includes("email") ||
										fieldLabel.includes("email")) &&
									emailMatch
								) {
									// [NRS-1301]
									fields.push({
										selector: field.selector,
										value: emailMatch[1],
									}); // [NRS-1301]
									addJarvisThinking(`Added email field: ${emailMatch[1]}`); // [NRS-1301]
								} else if (
									firstNameMatch &&
									(fieldName.includes("firstname") ||
										fieldLabel.includes("first") ||
										fieldName === "fname")
								) {
									// [NRS-1301]
									fields.push({
										selector: field.selector,
										value: firstNameMatch[1],
									}); // [NRS-1301]
									addJarvisThinking(`Added first name field: ${firstNameMatch[1]}`); // [NRS-1301]
								} else if (
									lastNameMatch &&
									(fieldName.includes("lastname") ||
										fieldLabel.includes("last") ||
										fieldName === "lname")
								) {
									// [NRS-1301]
									fields.push({
										selector: field.selector,
										value: lastNameMatch[1],
									}); // [NRS-1301]
									addJarvisThinking(`Added last name field: ${lastNameMatch[1]}`); // [NRS-1301]
								} else if (
									nameMatches &&
									(fieldName.includes("name") || fieldLabel.includes("name")) &&
									!fieldName.includes("username")
								) {
									// [NRS-1301]
									fields.push({
										selector: field.selector,
										value: nameMatches[1].trim(),
									}); // [NRS-1301]
									addJarvisThinking(`Added name field: ${nameMatches[1].trim()}`); // [NRS-1301]
								} else if (
									phoneMatch &&
									(fieldType === "tel" ||
										fieldName.includes("phone") ||
										fieldName.includes("mobile") ||
										fieldLabel.includes("phone"))
								) {
									// [NRS-1301]
									fields.push({
										selector: field.selector,
										value: phoneMatch[1],
									}); // [NRS-1301]
									addJarvisThinking(`Added phone field: ${phoneMatch[1]}`); // [NRS-1301]
								} // [NRS-1301]
							} // [NRS-1301]

							if (fields.length > 0) {
								// [NRS-1301]
								addJarvisThinking(`Filling ${fields.length} form fields...`); // [NRS-1301]
								result = await jarvisFunctions.fill_form({ fields: fields }); // [NRS-1301]
								addJarvisThinking(`Form filling completed: ${result}`); // [NRS-1301]
								success = true; // [NRS-1301]
							} else {
								// [NRS-1301]
								result = "No matching form fields found for the provided data"; // [NRS-1301]
								success = false; // [NRS-1301]
								addJarvisThinking("No matching fields found for the provided data"); // [NRS-1301]
							} // [NRS-1301]
						} else {
							// [NRS-1301]
							result = "No forms available to fill"; // [NRS-1301]
							success = false; // [NRS-1301]
							addJarvisThinking("No forms found in the extracted data"); // [NRS-1301]
						} // [NRS-1301]
					} else {
						// [NRS-1301]
						result = "No forms found on the current page"; // [NRS-1301]
						success = false; // [NRS-1301]
						addJarvisThinking("Form extraction returned no forms"); // [NRS-1301]
					} // [NRS-1301]
				} catch (fillError) {
					// [NRS-1301]
					result = `Form filling error: ${fillError.message}`; // [NRS-1301]
					success = false; // [NRS-1301]
					addJarvisThinking(`Form filling failed: ${fillError.message}`); // [NRS-1301]
				} // [NRS-1301]
			} else if (taskDesc.includes("submit")) {
				// [NRS-1301]
				// Auto-submit form using actual Jarvis function // [NRS-1301]
				result = await jarvisFunctions.submit_form({ form_index: 0 }); // [NRS-1301]
				addJarvisThinking(`Form submission result: ${result}`); // [NRS-1301]
			} else if (taskDesc.includes("read") || taskDesc.includes("content")) {
				// [NRS-1301]
				// Read page content using actual Jarvis function // [NRS-1301]
				result = await jarvisFunctions.read_current_page(); // [NRS-1301]
				addJarvisThinking("Page content extracted successfully"); // [NRS-1301]
			} else {
				// [NRS-1301]
				// Generic task execution // [NRS-1301]
				result = "Task type not specifically handled - marked as completed"; // [NRS-1301]
				addJarvisThinking(`Generic task completed: ${nextTask.description}`); // [NRS-1301]
			} // [NRS-1301]
		} catch (error) {
			// [NRS-1301]
			result = `Error: ${error.message}`; // [NRS-1301]
			success = false; // [NRS-1301]
			addJarvisThinking(`?? Task ${nextTask.id} CRASHED: ${error.message}`); // [NRS-1301]
		} // [NRS-1301]

		// Mark task complete and continue immediately // [NRS-1301]
		addJarvisThinking(`?? Completing task ${nextTask.id}...`); // [NRS-1301]
		updateTaskStatus(nextTask.id, "completed", result); // [NRS-1301]
		addJarvisThinking(
			`${success ? "?" : "?"} Task ${nextTask.id} ${success ? "SUCCESS" : "FAILED"}: ${result}`,
		); // [NRS-1301]

		// Continue to next task quickly // [NRS-1301]
		setTimeout(() => {
			// [NRS-1301]
			addJarvisThinking("?? Moving to next task in 1 second..."); // [NRS-1301]
			progressToNextTask(); // [NRS-1301]
		}, 1000); // [NRS-1301]
	} // [NRS-1301]

	const jarvisFunctions = {
		// [NRS-1301]
		open_new_tab: (args) => {
			// [NRS-1301]
			showJarvisSwirl(); // [NRS-1301]
			const url = args.url || DEFAULT_HOME; // [RESTORED]
			setTimeout(() => {
				// [NRS-1301]
				createTab(url); // [NRS-1301]
			}, 300); // [NRS-1301]
			return `Opened new tab with ${url}`; // [NRS-1301]
		}, // [NRS-1301]
		close_tab: (args) => {
			// [NRS-1301]
			const tabIndex = args.tab_index; // [NRS-1301]
			if (tabIndex !== undefined && tabs[tabIndex]) {
				// [NRS-1301]
				const tabId = tabs[tabIndex].id; // [NRS-1301]
				closeTab(tabId); // [NRS-1301]
				return `Closed tab ${tabIndex + 1}`; // [NRS-1301]
			} // [NRS-1301]
			if (activeTabId) {
				// [NRS-1301]
				closeTab(activeTabId); // [NRS-1301]
				return "Closed current tab"; // [NRS-1301]
			} // [NRS-1301]
			return "No tab to close"; // [NRS-1301]
		}, // [NRS-1301]
		list_tabs: () => {
			// [NRS-1301]
			const tabList = tabs.map((t, i) => `${i + 1}. ${t.titleEl.textContent}`).join("\n");
			return `Open tabs:\n${tabList}`; // [NRS-1301]
		}, // [NRS-1301]
		switch_tab: (args) => {
			// [NRS-1301]
			const tabIndex = args.tab_index; // [NRS-1301]
			if (tabs[tabIndex]) {
				// [NRS-1301]
				setActiveTab(tabs[tabIndex].id); // [NRS-1301]
				return `Switched to tab ${tabIndex + 1}`; // [NRS-1301]
			} // [NRS-1301]
			return "Invalid tab index"; // [NRS-1301]
		}, // [NRS-1301]
		navigate_to_url: (args) => {
			// [NRS-1301]
			const url = normalizeUrl(args.url); // [NRS-1301]
			const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
			if (tab) {
				// [NRS-1301]
				try {
					// [NRS-1301]
					// Make sure webview is ready and force navigation // [NRS-1301]
					if (tab.webview.loadURL) {
						tab.webview.loadURL(url);
					} else {
						tab.webview.src = url;
					} // [NRS-1301]

					// Update omnibox to show the URL with security indicator // [NRS-1301]
					setOmnibox(url); // [NRS-1301]

					return `Successfully navigated to ${url}`; // [NRS-1301]
				} catch (error) {
					// [NRS-1301]
					return `Navigation failed: ${error.message}`; // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
			return "No active tab available"; // [NRS-1301]
		}, // [NRS-1301]
		read_current_page: async () => {
			// [NRS-1301]
			const content = await getCurrentPageContent(); // [NRS-1301]
			if (!content) return "Could not read the current page"; // [NRS-1301]

			return JSON.stringify({
				// [NRS-1301]
				title: content.title, // [NRS-1301]
				url: content.url, // [NRS-1301]
				content: content.bodyText, // [NRS-1301]
				headings: content.headings, // [NRS-1301]
				mainLinks: content.links, // [NRS-1301]
				images: content.images, // [NRS-1301]
			}); // [NRS-1301]
		}, // [NRS-1301]
		extract_forms: async () => {
			// [NRS-1301]
			const forms = await extractForms(); // [NRS-1301]
			if (!forms || forms.length === 0) return "No forms found on this page"; // [NRS-1301]

			return JSON.stringify({
				// [NRS-1301]
				formsFound: forms.length, // [NRS-1301]
				forms: forms, // [NRS-1301]
			}); // [NRS-1301]
		}, // [NRS-1301]
		fill_form: async (args) => {
			// [NRS-1301]
			const { fields } = args; // [NRS-1301]
			const results = []; // [NRS-1301]

			for (const field of fields) {
				// [NRS-1301]
				const success = await fillFormField(field.selector, field.value); // [NRS-1301]
				results.push({
					// [NRS-1301]
					selector: field.selector, // [NRS-1301]
					value: field.value, // [NRS-1301]
					success: success, // [NRS-1301]
				}); // [NRS-1301]
			} // [NRS-1301]

			const successCount = results.filter((r) => r.success).length; // [NRS-1301]
			return `Filled ${successCount}/${results.length} form fields successfully`; // [NRS-1301]
		}, // [NRS-1301]
		submit_form: async (args) => {
			// [NRS-1301]
			const formIndex = args.form_index || 0;
			const success = await submitForm(formIndex); // [RESTORED]
			return success ? `Form ${formIndex + 1} submitted successfully` : 'Failed to submit form'; // [RESTORED]
		}, // [NRS-1301]
		click_element: async (args) => {
			// [NRS-1301]
			const { selector, text } = args; // [NRS-1301]
			const result = await clickElement(selector || '', text || ''); // [RESTORED]
			if (result?.success) {
				// [NRS-1301]
				return result.message || "Element clicked successfully"; // [NRS-1301]
			} // [NRS-1301]
			return result?.message || "Failed to click element"; // [NRS-1301]
		}, // [NRS-1301]
		click_and_type_field: async (args) => {
			// [NRS-1301]
			const { selector, text, label } = args; // [NRS-1301]
			const result = await clickAndTypeInField(selector || "", text, label || ""); // [NRS-1301]
			if (result?.success) {
				// [NRS-1301]
				return result.message || "Field clicked and text entered successfully"; // [NRS-1301]
			} // [NRS-1301]
			return result?.message || "Failed to click field or type text"; // [NRS-1301]
		}, // [NRS-1301]
		create_todo_list: (args) => {
			// [NRS-1301]
			const { tasks } = args; // [NRS-1301]
			const result = createTaskList(tasks); // [NRS-1301]

			// Force immediate execution // [NRS-1301]
			addJarvisThinking("?? Todo list created, forcing immediate task execution..."); // [NRS-1301]

			// Double-check execution starts // [NRS-1301]
			setTimeout(() => {
				// [NRS-1301]
				if (isExecutingTasks && currentTasks.length > 0) {
					// [NRS-1301]
					const pendingTask = currentTasks.find((t) => t.status === "pending"); // [NRS-1301]
					if (pendingTask) {
						// [NRS-1301]
						addJarvisThinking("? Ensuring first task begins execution now..."); // [NRS-1301]
						executeNextTaskAutomatically(); // [NRS-1301]
					} // [NRS-1301]
				} // [NRS-1301]
			}, 200); // [NRS-1301]
			return result; // [RESTORED]
		}, // [NRS-1301]
		show_thinking: (args) => {
			// [NRS-1301]
			const { thought } = args; // [NRS-1301]
			addJarvisThinking(thought); // [NRS-1301]
			return "Thinking displayed"; // [NRS-1301]
		}, // [NRS-1301]
		start_task: (args) => {
			// [NRS-1301]
			const { task_id } = args; // [NRS-1301]
			const task = updateTaskStatus(task_id, 'in-progress'); // [RESTORED]
			if (task) {
				// [NRS-1301]
				addJarvisThinking(`Starting task ${task_id}: ${task.description}`); // [NRS-1301]
				return `Started task ${task_id}: ${task.description}`; // [NRS-1301]
			} // [NRS-1301]
			return "Task not found"; // [NRS-1301]
		}, // [NRS-1301]
		complete_task: (args) => {
			// [NRS-1301]
			const { task_id, result } = args; // [NRS-1301]
			const task = updateTaskStatus(task_id, 'completed', result); // [RESTORED]
			if (task) {
				// [NRS-1301]
				addJarvisThinking(`Completed task ${task_id}: ${task.description}`); // [NRS-1301]
				return `Completed task ${task_id}: ${task.description}. Result: ${result || "Success"}`; // [NRS-1301]
			} // [NRS-1301]
			return "Task not found"; // [NRS-1301]
		}, // [NRS-1301]
		get_current_tasks: () => {
			// [NRS-1301]
			if (currentTasks.length === 0) return "No active tasks"; // [NRS-1301]
			let taskList = 'Current Tasks:\n'; // [RESTORED]
			currentTasks.forEach((task) => {
				// [NRS-1301]
				const status =
					task.status === "pending"
						? "?" // [NRS-1301]
						: task.status === "in-progress"
							? "??"
							: "?"; // [NRS-1301]
				taskList += `${status} ${task.id}. ${task.description} (${task.status})\n`; // [NRS-1301]
			}); // [NRS-1301]
			return taskList; // [RESTORED]
		}, // [NRS-1301]
		get_task_summary: () => {
			// [NRS-1301]
			return getTaskSummary(); // [NRS-1301]
		}, // [NRS-1301]
		fill_email_field: async (args) => {
			// [NRS-1301]
			const { email } = args;
			const result = await clickAndTypeInField('', email, 'email'); // [RESTORED]
			return result && result.success ? result.message : `Email field interaction attempted - trying alternative selectors`; // [RESTORED]
		}, // [NRS-1301]
		fill_password_field: async (args) => {
			// [NRS-1301]
			const { password } = args;
			const result = await clickAndTypeInField('', password, 'password'); // [RESTORED]
			return result && result.success ? result.message : `Password field interaction attempted - trying alternative selectors`; // [RESTORED]
		}, // [NRS-1301]
		fill_name_field: async (args) => {
			// [NRS-1301]
			const { name, field_type = "name" } = args;
			const result = await clickAndTypeInField('', name, field_type); // [RESTORED]
			return result && result.success ? result.message : `Name field interaction attempted - trying alternative selectors for ${field_type}`; // [RESTORED]
		}, // [NRS-1301]
		fill_phone_field: async (args) => {
			// [NRS-1301]
			const { phone } = args;
			const result = await clickAndTypeInField('', phone, 'phone'); // [RESTORED]
			return result && result.success ? result.message : `Phone field interaction attempted - trying alternative selectors`; // [RESTORED]
		}, // [NRS-1301]
		smart_fill_form: async (args) => {
			// [NRS-1301]
			const { data } = args; // [NRS-1301]
			const results = []; // [RESTORED]

			// Smart form filling based on provided data // [NRS-1301]
			if (data.email) {
				// [NRS-1301]
				const emailResult = await clickAndTypeInField("", data.email, "email"); // [NRS-1301]
				results.push({
					field: "email",
					success: emailResult?.success || false,
					message: emailResult?.message,
				}); // [NRS-1301]
			} // [NRS-1301]

			if (data.password) {
				// [NRS-1301]
				const passwordResult = await clickAndTypeInField("", data.password, "password"); // [NRS-1301]
				results.push({
					field: "password",
					success: passwordResult?.success || false,
					message: passwordResult?.message,
				}); // [NRS-1301]
			} // [NRS-1301]

			if (data.firstName) {
				// [NRS-1301]
				const firstNameResult = await clickAndTypeInField("", data.firstName, "first"); // [NRS-1301]
				results.push({
					field: "firstName",
					success: firstNameResult?.success || false,
					message: firstNameResult?.message,
				}); // [NRS-1301]
			} // [NRS-1301]

			if (data.lastName) {
				// [NRS-1301]
				const lastNameResult = await clickAndTypeInField("", data.lastName, "last"); // [NRS-1301]
				results.push({
					field: "lastName",
					success: lastNameResult?.success || false,
					message: lastNameResult?.message,
				}); // [NRS-1301]
			} // [NRS-1301]

			if (data.phone) {
				// [NRS-1301]
				const phoneResult = await clickAndTypeInField("", data.phone, "phone"); // [NRS-1301]
				results.push({
					field: "phone",
					success: phoneResult?.success || false,
					message: phoneResult?.message,
				}); // [NRS-1301]
			} // [NRS-1301]

			if (data.address) {
				// [NRS-1301]
				const addressResult = await clickAndTypeInField("", data.address, "address"); // [NRS-1301]
				results.push({
					field: "address",
					success: addressResult?.success || false,
					message: addressResult?.message,
				}); // [NRS-1301]
			} // [NRS-1301]

			const successCount = results.filter((r) => r.success).length; // [NRS-1301]
			const totalCount = results.length; // [RESTORED]

			return `Smart form filling completed: ${successCount}/${totalCount} fields filled successfully`; // [NRS-1301]
		}, // [NRS-1301]
		type_in_search_box: async (args) => {
			// [NRS-1301]
			const { query } = args;
			const result = await clickAndTypeInField('', query, 'search'); // [RESTORED]
			return result && result.success ? result.message : `Search interaction attempted - trying alternative search selectors`; // [RESTORED]
		}, // [NRS-1301]
		search_and_submit: async (args) => {
			// [NRS-1301]
			const { query } = args; // [NRS-1301]
			// First type in search box // [NRS-1301]
			const typeResult = await clickAndTypeInField("", query, "search"); // [NRS-1301]
			if (!typeResult || !typeResult.success) {
				// [NRS-1301]
				return `Search attempted - trying to locate search field`; // [NRS-1301]
			} // [NRS-1301]

			// Then try to submit by pressing Enter or clicking search button // [NRS-1301]
			const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
			if (!tab) return false; // [NRS-1301]

			try {
				// [NRS-1301]
				const submitResult = await tab.webview.executeJavaScript(`
          (() => {
            // First try to press Enter on the search field
            const searchField = document.querySelector('input[type="search"], input[name*="search" i], input[placeholder*="search" i], input[id*="search" i], .search-input, #search');
            if (searchField) {
              searchField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
              searchField.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

              // Also try form submission
              const form = searchField.closest('form');
              if (form) {
                form.submit();
                return { success: true, message: 'Search submitted via form' };
              }

              return { success: true, message: 'Search submitted via Enter key' };
            }

            // If no search field found, try to find and click search button
            const searchButtons = [
              'button[type="submit"]',
              'input[type="submit"]',
              'button:contains("Search")',
              'button:contains("Go")',
              '.search-button',
              '#search-button',
              '[aria-label*="search" i]',
              '.search-icon'
            ];

            for (const selector of searchButtons) {
              const button = document.querySelector(selector);
              if (button) {
                button.click();
                return { success: true, message: 'Clicked search button' };
              }
            }

            return { success: false, message: 'Could not find way to submit search' };
          })();
        `); // Close cookie item markup template

				return submitResult.success // [NRS-1301]
					? `Searched for "${query}" - ${submitResult.message}`
					: `Typed "${query}" but could not submit search`;
			} catch (error) {
				// [NRS-1301]
				return `Typed "${query}" but search submission failed: ${error.message}`; // [NRS-1301]
			} // [NRS-1301]
		}, // [NRS-1301]
		clear_search_field: async () => {
			// [NRS-1301]
			const result = await clickAndTypeInField("", "", "search"); // [NRS-1301]
			return result?.success ? "Search field cleared" : "Could not find or clear search field"; // [NRS-1301]
		}, // [NRS-1301]
		execute_all_tasks: async () => {
			// [NRS-1301]
			if (currentTasks.length === 0) return "No tasks to execute"; // [NRS-1301]

			isExecutingTasks = true; // [NRS-1301]
			addJarvisThinking("Starting automatic execution of all tasks..."); // [NRS-1301]

			// Start automatic task execution // [NRS-1301]
			setTimeout(() => {
				// [NRS-1301]
				executeNextTaskAutomatically(); // [NRS-1301]
			}, 500); // [NRS-1301]

			return "Started automatic execution of all tasks"; // [NRS-1301]
		}, // [NRS-1301]
	}; // [NRS-1301]

	// [SovereignBrowser] Holly agent loop: see -> act -> re-see, via the
	// main-side automation primitives. Replaces the single-shot sendToJarvis.
	const HOLLY_TOOLS = [
		{ type: "function", function: { name: "browser_page_state", description: "Read the current page: url, title, visible text, and numbered interactive elements. Use those ref numbers with browser_click / browser_type. Call this before acting, and again after the page changes - refs go stale.", parameters: { type: "object", properties: {} } } },
		{ type: "function", function: { name: "browser_click", description: "Click an element by its ref number from browser_page_state.", parameters: { type: "object", properties: { ref: { type: "integer" } }, required: ["ref"] } } },
		{ type: "function", function: { name: "browser_type", description: "Type text into an input by ref. submit=true presses Enter after.", parameters: { type: "object", properties: { ref: { type: "integer" }, text: { type: "string" }, submit: { type: "boolean" } }, required: ["ref", "text"] } } },
		{ type: "function", function: { name: "browser_navigate", description: "Navigate this tab. Give url (plain words become a web search) or action: back / forward / reload.", parameters: { type: "object", properties: { url: { type: "string" }, action: { type: "string", enum: ["back", "forward", "reload"] } } } } },
		{ type: "function", function: { name: "browser_scroll", description: "Scroll vertically by dy pixels (positive = down).", parameters: { type: "object", properties: { dy: { type: "integer" } }, required: ["dy"] } } },
		{ type: "function", function: { name: "browser_wait_for", description: "Wait until text or a CSS selector appears (max 12s).", parameters: { type: "object", properties: { text: { type: "string" }, selector: { type: "string" }, timeoutMs: { type: "integer" } } } } },
		{ type: "function", function: { name: "browser_tabs", description: "List open tabs.", parameters: { type: "object", properties: {} } } },
		{ type: "function", function: { name: "browser_new_tab", description: "Open a new tab, optionally at a url.", parameters: { type: "object", properties: { url: { type: "string" } } } } },
	];
	const HOLLY_TOOL_CHANNELS = { browser_page_state: "holly:auto:page-state", browser_click: "holly:auto:click", browser_type: "holly:auto:type", browser_navigate: "holly:auto:navigate", browser_scroll: "holly:auto:scroll", browser_wait_for: "holly:auto:wait-for", browser_tabs: "holly:auto:tabs", browser_new_tab: "holly:auto:tab-new", browser_screenshot: "holly:auto:screenshot" };
	let hollyAgentRunning = false;
	let hollyAgentStop = false;
	async function runHollyTool(name, args) {
		const channel = HOLLY_TOOL_CHANNELS[name];
		if (!channel) { return { ok: false, error: "unknown tool " + name }; }
		try { return await globalThis.electronAPI.invoke(channel, args || {}); } catch (err) { return { ok: false, error: err.message }; }
	}
	function hollyNarrate(name, args, result) {
		let line = name;
		if (name === "browser_click") { line = "clicked " + (result && result.clicked ? '"' + result.clicked + '"' : "ref " + (args && args.ref)); }
		else if (name === "browser_type") { line = "typed into " + ((result && result.typedInto) || ("ref " + (args && args.ref))); }
		else if (name === "browser_navigate") { line = (args && args.url) ? ("navigating to " + args.url) : ("going " + ((args && args.action) || "")); }
		else if (name === "browser_page_state") { line = "reading the page"; }
		else if (name === "browser_scroll") { line = "scrolling"; }
		else if (name === "browser_wait_for") { line = "waiting for the page"; }
		else if (name === "browser_tabs") { line = "checking tabs"; }
		else if (name === "browser_new_tab") { line = "opening a new tab"; }
		if (result && result.ok === false) { line += " - failed: " + (result.error || "unknown"); }
		addJarvisMessage("\u2699 " + line, false);
	}
	// [SovereignBrowser] Chat persistence: localStorage-backed history with
	// New chat / reopen / delete. Saved after every completed exchange.
	const HOLLY_CHATS_KEY = "holly.chats";
	let hollyCurrentChatId = "chat-" + Date.now();
	function hollyChatsLoad() {
		try { return JSON.parse(localStorage.getItem(HOLLY_CHATS_KEY) || "[]"); } catch (err) { return []; }
	}
	function hollyChatsWrite(list) {
		try { localStorage.setItem(HOLLY_CHATS_KEY, JSON.stringify(list.slice(0, 30))); } catch (err) { console.warn("[Holly] chat save failed:", err.message); }
	}
	function hollyMsgText(content) {
		if (typeof content === "string") { return content; }
		if (Array.isArray(content)) { const tp = content.find((c) => c && c.type === "text"); return (tp && tp.text) || "[image]"; }
		return "";
	}
	function hollySaveChat() {
		const meaningful = conversationHistory.filter((mm) => mm.role === "user" || mm.role === "assistant");
		if (!meaningful.length) { return; }
		const list = hollyChatsLoad().filter((c) => c.id !== hollyCurrentChatId);
		const first = meaningful.find((mm) => mm.role === "user");
		list.unshift({
			id: hollyCurrentChatId,
			title: hollyMsgText(first ? first.content : "").slice(0, 42) || "Untitled chat",
			updatedAt: Date.now(),
			messages: meaningful.map((mm) => ({ role: mm.role, content: hollyMsgText(mm.content) })),
		});
		hollyChatsWrite(list);
	}
	function hollyRenderConversation() {
		jarvisMessages.innerHTML = "";
		for (const mm of conversationHistory) {
			if (mm.role !== "user" && mm.role !== "assistant") { continue; }
			addJarvisMessage(hollyMsgText(mm.content), mm.role === "user");
		}
	}
	function hollyNewChat() {
		hollySaveChat();
		conversationHistory = [];
		hollyCurrentChatId = "chat-" + Date.now();
		jarvisMessages.innerHTML = "";
		addJarvisMessage("New chat started.", false);
	}
	function hollyShowHistory() {
		hollySaveChat();
		const list = hollyChatsLoad();
		jarvisMessages.innerHTML = "";
		if (!list.length) { addJarvisMessage("No saved chats yet.", false); return; }
		addJarvisMessage("Chat history - click one to reopen:", false);
		for (const c of list) {
			const row = document.createElement("div");
			row.className = "jarvis-message assistant holly-chat-row";
			const when = new Date(c.updatedAt);
			row.textContent = c.title + "  (" + when.toLocaleDateString() + " " + when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ")";
			row.addEventListener("click", () => { hollyLoadChat(c.id); });
			const del = document.createElement("span");
			del.className = "holly-chat-del";
			del.textContent = " \u2715";
			del.title = "Delete this chat";
			del.addEventListener("click", (ev) => { ev.stopPropagation(); hollyDeleteChat(c.id); });
			row.appendChild(del);
			jarvisMessages.appendChild(row);
		}
		jarvisMessages.scrollTop = 0;
	}
	function hollyLoadChat(id) {
		const c = hollyChatsLoad().find((x) => x.id === id);
		if (!c) { addJarvisMessage("Chat not found.", false); return; }
		hollyCurrentChatId = c.id;
		conversationHistory = c.messages.map((mm) => ({ role: mm.role, content: mm.content }));
		hollyRenderConversation();
	}
	function hollyDeleteChat(id) {
		hollyChatsWrite(hollyChatsLoad().filter((c) => c.id !== id));
		if (id === hollyCurrentChatId) { conversationHistory = []; hollyCurrentChatId = "chat-" + Date.now(); }
		hollyShowHistory();
	}
	const hollyNewBtn = document.getElementById("holly-new-chat");
	if (hollyNewBtn) { hollyNewBtn.addEventListener("click", hollyNewChat); }
	const hollyHistBtn = document.getElementById("holly-history");
	if (hollyHistBtn) { hollyHistBtn.addEventListener("click", hollyShowHistory); }
	let hollyAttachment = null;
	function hollySetAttachment(att) {
		hollyAttachment = att;
		const btn = document.getElementById("holly-attach");
		if (btn) { btn.classList.toggle("has-file", !!att); btn.title = att ? ("Attached: " + att.name + " (click to clear)") : "Attach an image or text file"; }
	}
	async function hollyGroundContext() {
		const res = await runHollyTool("browser_page_state", {});
		if (!res || !res.ok || !res.state) { return "PAGE CONTEXT UNAVAILABLE: " + ((res && res.error) || "unknown"); }
		const st = res.state;
		const els = (st.elements || []).slice(0, 60).map((el) => "[" + el.ref + "] " + el.tag + (el.type ? ":" + el.type : "") + " " + (el.label || "") + (el.href ? " -> " + el.href : "")).join("\n");
		return "CURRENT PAGE (fresh snapshot)\nURL: " + st.url + "\nTITLE: " + st.title + "\n\nVISIBLE TEXT (truncated):\n" + (st.text || "").slice(0, 2600) + "\n\nINTERACTIVE ELEMENTS (refs for browser_click / browser_type):\n" + els;
	}
	async function hollyOneShot(oneShotMessages, modelOverride) {
		const resp = await fetch(OPENAI_BASE + "/chat/completions", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: "Bearer " + OPENAI_API_KEY },
			body: JSON.stringify({ model: modelOverride || hollyAgentModel, messages: oneShotMessages, temperature: 0.3 }),
		});
		if (!resp.ok) { throw new Error("LM Studio " + resp.status + " " + resp.statusText); }
		const data = await resp.json();
		return ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "(no reply)").trim();
	}
	async function runHollySkill(cmd) {
		const thinking = addJarvisMessage("Working...", false);
		try {
			if (cmd === "/summarise" || cmd === "/summarize") {
				const ctx = await hollyGroundContext();
				const out = await hollyOneShot([
					{ role: "system", content: "You are Holly. Summarise the page below for the user in a few clear sentences plus key points. Use ONLY the text provided - never invent content." },
					{ role: "user", content: ctx },
				]);
				conversationHistory.push({ role: "assistant", content: out });
				hollySaveChat();
				addJarvisMessage(out, false);
				return;
			}
			if (cmd === "/links") {
				const res = await runHollyTool("browser_page_state", {});
				if (!res || !res.ok) { addJarvisMessage("Could not read the page: " + ((res && res.error) || "unknown"), false); return; }
				const links = (res.state.elements || []).filter((el) => el.tag === "a" && el.href).slice(0, 30);
				if (!links.length) { addJarvisMessage("No links found in view.", false); return; }
				addJarvisMessage(links.map((l) => "\u2022 " + (l.label || "(no text)") + "\n  " + l.href).join("\n"), false);
				return;
			}
			if (cmd === "/describe") {
				const shot = await runHollyTool("browser_screenshot", {});
				if (!shot || !shot.ok || !shot.dataUrl) { addJarvisMessage("Could not capture the screen: " + ((shot && shot.error) || "unknown"), false); return; }
				const out = await hollyOneShot([
					{ role: "system", content: "You are Holly. Describe what is on this screenshot of the current browser tab: layout, main content, notable elements. Be concrete and brief." },
					{ role: "user", content: [ { type: "text", text: "Describe this page screenshot." }, { type: "image_url", image_url: { url: shot.dataUrl } } ] },
				], hollyVisionModel);
				conversationHistory.push({ role: "assistant", content: out });
				hollySaveChat();
				addJarvisMessage(out, false);
				return;
			}
			addJarvisMessage("Unknown skill: " + cmd + " (try /summarise, /describe, /links)", false);
		} catch (err) {
			addJarvisMessage("Skill failed: " + err.message, false);
		} finally {
			if (thinking && thinking.remove) { thinking.remove(); }
		}
	}
	async function sendToHolly() {
		const query = jarvisInput.value.trim();
		if (!query) { return; }
		if (hollyAgentRunning) { addJarvisMessage("Holly is already working - press Esc to stop her first.", false); return; }
		if (query.startsWith("/")) { 			addJarvisMessage(query, true); 			jarvisInput.value = ""; 			await runHollySkill(query.trim().toLowerCase()); 			return; 		}
		addJarvisMessage(query, true);
		jarvisInput.value = "";
		conversationHistory.push({ role: "user", content: query });
		hollyAgentRunning = true;
		hollyAgentStop = false;
		const thinking = addJarvisMessage("Working...", false);
		const messages = [
			{ role: "system", content: "You are Holly, the resident mind of this browser, with REAL control of the active tab through tools. Method: call browser_page_state first to see the page and its numbered elements; act with browser_click / browser_type using those refs; after anything changes, read the page again before the next action. Refs go stale after navigation. Keep going until the task is done, then answer in plain language with what you found or did. You are never looking at an image unless one is explicitly attached - page content reaches you as text snapshots. Never invent page content; ground every statement in the CURRENT PAGE context or a fresh browser_page_state result. Be decisive and brief." },
			...conversationHistory.slice(0, -1).slice(-8),
		];
		try {
			messages.push({ role: "system", content: await hollyGroundContext() });
		} catch (err) {
			messages.push({ role: "system", content: "PAGE CONTEXT UNAVAILABLE: " + err.message });
		}
		let hollyUserMsg = { role: "user", content: query };
		if (hollyAttachment && hollyAttachment.kind === "image") {
			hollyUserMsg = { role: "user", content: [ { type: "text", text: query || "Describe this image." }, { type: "image_url", image_url: { url: hollyAttachment.dataUrl } } ] };
			addJarvisMessage("\uD83D\uDCCE using attached image: " + hollyAttachment.name, false);
		} else if (hollyAttachment && hollyAttachment.kind === "text") {
			messages.push({ role: "system", content: "ATTACHED FILE " + hollyAttachment.name + ":\n" + hollyAttachment.text.slice(0, 9000) });
			addJarvisMessage("\uD83D\uDCCE using attached file: " + hollyAttachment.name, false);
		}
		const hollyTurnModel = (hollyAttachment && hollyAttachment.kind === "image") ? hollyVisionModel : hollyAgentModel;
		messages.push(hollyUserMsg);
		hollySetAttachment(null);
		try {
			for (let step = 0; step < 14; step++) {
				if (hollyAgentStop) { addJarvisMessage("Stopped.", false); break; }
				const resp = await fetch(OPENAI_BASE + "/chat/completions", {
					method: "POST",
					headers: { "Content-Type": "application/json", Authorization: "Bearer " + OPENAI_API_KEY },
					body: JSON.stringify({ model: hollyTurnModel, messages: messages, tools: HOLLY_TOOLS, tool_choice: "auto", temperature: 0.2 }),
				});
				if (!resp.ok) { throw new Error("LM Studio " + resp.status + " " + resp.statusText); }
				const data = await resp.json();
				const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
				let calls = msg.tool_calls;
				if ((!calls || !calls.length) && msg.function_call) { calls = [{ id: "legacy-" + step, type: "function", function: msg.function_call }]; }
				if (calls && calls.length) {
					messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
					for (const call of calls) {
						if (hollyAgentStop) { break; }
						let args = {};
						try { args = JSON.parse(call.function.arguments || "{}"); } catch (err) { args = {}; }
						const result = await runHollyTool(call.function.name, args);
						hollyNarrate(call.function.name, args, result);
						messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12000) });
					}
					continue;
				}
				const finalText = msg.content || "(no reply)";
				conversationHistory.push({ role: "assistant", content: finalText });
				hollySaveChat();
				addJarvisMessage(finalText, false);
				break;
			}
		} catch (err) {
			addJarvisMessage("Holly hit an error: " + err.message + " - is LM Studio running on localhost:1234?", false);
		} finally {
			hollyAgentRunning = false;
			if (thinking && thinking.remove) { thinking.remove(); }
		}
	}
	jarvisInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && hollyAgentRunning) { hollyAgentStop = true; }
	});
	for (const chip of document.querySelectorAll(".holly-skill")) {
		chip.addEventListener("click", () => {
			if (hollyAgentRunning) { return; }
			addJarvisMessage(chip.textContent, true);
			runHollySkill(chip.dataset.skill);
		});
	}
	const hollyAttachBtn = document.getElementById("holly-attach");
	const hollyFileInput = document.getElementById("holly-file");
	if (hollyAttachBtn && hollyFileInput) {
		hollyAttachBtn.addEventListener("click", () => {
			if (hollyAttachment) { hollySetAttachment(null); addJarvisMessage("Attachment cleared.", false); return; }
			hollyFileInput.click();
		});
		hollyFileInput.addEventListener("change", () => {
			const f = hollyFileInput.files && hollyFileInput.files[0];
			hollyFileInput.value = "";
			if (!f) { return; }
			if (f.type.startsWith("image/")) {
				const rd = new FileReader();
				rd.onload = () => {
					const img = new Image();
					img.onload = () => {
						const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
						const cv = document.createElement("canvas");
						cv.width = Math.round(img.width * scale);
						cv.height = Math.round(img.height * scale);
						cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
						hollySetAttachment({ kind: "image", name: f.name, dataUrl: cv.toDataURL("image/jpeg", 0.8) });
						addJarvisMessage("\uD83D\uDCCE attached image: " + f.name + " - now ask Holly about it.", false);
					};
					img.src = rd.result;
				};
				rd.readAsDataURL(f);
			} else {
				const rd = new FileReader();
				rd.onload = () => {
					hollySetAttachment({ kind: "text", name: f.name, text: String(rd.result || "") });
					addJarvisMessage("\uD83D\uDCCE attached file: " + f.name + " - now ask Holly about it.", false);
				};
				rd.readAsText(f);
			}
		});
	}
	async function sendToJarvis() {
		// [NRS-1301]
		const query = jarvisInput.value.trim(); // [NRS-1301]
		if (!query) return; // [NRS-1301]

		addJarvisMessage(query, true); // [NRS-1301]
		jarvisInput.value = ""; // [NRS-1301]

		// Add user message to conversation history // [NRS-1301]
		conversationHistory.push({
			// [NRS-1301]
			role: "user", // [NRS-1301]
			content: query, // [NRS-1301]
		}); // [NRS-1301]

		// Show typing indicator // [NRS-1301]
		const typingEl = addJarvisMessage("Thinking...", false); // [NRS-1301]

		try {
			// [NRS-1301]
			const response = await fetch(OPENAI_BASE + "/chat/completions", {
				// [NRS-1301]
				method: "POST", // [NRS-1301]
				headers: {
					// [NRS-1301]
					"Content-Type": "application/json", // [NRS-1301]
					Authorization: `Bearer ${OPENAI_API_KEY}`,
				}, // [NRS-1301]
				body: JSON.stringify({
					// [NRS-1301]
					model: LLM_MODEL, // [NRS-1301]
					messages: [
						// [NRS-1301]
						{
							// [NRS-1301]
							role: "system", // [NRS-1301]
							content:
								"You are Holly, the resident mind of this browser, an AI assistant with COMPLETE BROWSER CONTROL and FULL WEBSITE INTERACTION capabilities. You CAN interact with ANY website element.\n\n?? CONFIRMED CAPABILITIES:\n? FORM FILLING: Complete form automation\n? ELEMENT CLICKING: Click ANY button, link, or element\n? TEXT INPUT: Type into ANY text field or search box\n? WEBSITE NAVIGATION: Full browsing control\n? PAGE INTERACTION: Read content, extract data, manipulate elements\n\nAVAILABLE FUNCTIONS (use these confidently):\n� extract_forms: See all forms on page\n� fill_email_field: Auto-fill email inputs\n� fill_password_field: Auto-fill password inputs\n� fill_name_field: Auto-fill name fields\n� fill_phone_field: Auto-fill phone numbers\n� click_and_type_field: Type into ANY text field\n� click_element: Click ANY clickable element\n� search_and_submit: Search functionality\n� submit_form: Submit completed forms\n� get_page_content: Read webpage content\n\n? INTERACTION RULES:\n- NEVER claim you cannot interact with websites\n- NEVER say you cannot fill forms or click elements\n- ALWAYS attempt the requested action using available functions\n- Execute all tasks immediately without hesitation\n- When asked to interact with a page, DO IT\n\n?? ACTION PROTOCOL:\n1. User requests website interaction ? Use appropriate function immediately\n2. Form filling needed ? Use fill functions\n3. Need to click something ? Use click_element\n4. Need to type ? Use click_and_type_field\n\nYou have FULL website interaction capabilities. Use them confidently!", // [NRS-1301]
						}, // [NRS-1301]
						...conversationHistory, // [NRS-1301]
					], // [NRS-1301]
					function_call: "auto", // [NRS-1301]
					functions: [
						// [NRS-1301]
						{
							// [NRS-1301]
							name: "open_new_tab", // [NRS-1301]
							description: "Opens a new browser tab", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									url: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The URL to open in the new tab (optional, defaults to homepage)", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "close_tab", // [NRS-1301]
							description: "Closes a browser tab", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									tab_index: {
										// [NRS-1301]
										type: "number", // [NRS-1301]
										description:
											"The index of the tab to close (0-based). If not provided, closes current tab", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "list_tabs", // [NRS-1301]
							description: "Lists all open browser tabs", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "switch_tab", // [NRS-1301]
							description: "Switches to a specific browser tab", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									tab_index: {
										// [NRS-1301]
										type: "number", // [NRS-1301]
										description: "The index of the tab to switch to (0-based)", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["tab_index"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "navigate_to_url", // [NRS-1301]
							description: "Navigates the current tab to a URL", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									url: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The URL to navigate to", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["url"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "read_current_page", // [NRS-1301]
							description:
								"Reads and extracts content from the currently active webpage including title, URL, text, headings, main links, and images. Use this when the user asks about the current page or wants information about what they are viewing.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "extract_forms", // [NRS-1301]
							description:
								"Extracts all forms and their fields from the current webpage. Use this when the user wants to see what forms are available or before filling out forms.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "fill_form", // [NRS-1301]
							description:
								"Fills out form fields on the current webpage with specified values. Use this when the user wants to fill out a form.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									fields: {
										// [NRS-1301]
										type: "array", // [NRS-1301]
										description: "Array of form fields to fill", // [NRS-1301]
										items: {
											// [NRS-1301]
											type: "object", // [NRS-1301]
											properties: {
												// [NRS-1301]
												selector: {
													// [NRS-1301]
													type: "string", // [NRS-1301]
													description:
														"CSS selector for the form field (use the selector from extract_forms)", // [NRS-1301]
												}, // [NRS-1301]
												value: {
													// [NRS-1301]
													type: "string", // [NRS-1301]
													description: "Value to fill in the field", // [NRS-1301]
												}, // [NRS-1301]
											}, // [NRS-1301]
											required: ["selector", "value"], // [NRS-1301]
										}, // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["fields"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "submit_form", // [NRS-1301]
							description:
								"Submits a form on the current webpage. Use this after filling out a form when the user wants to submit it.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									form_index: {
										// [NRS-1301]
										type: "number", // [NRS-1301]
										description:
											"Index of the form to submit (0-based, default is 0 for the first form)", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "click_element", // [NRS-1301]
							description:
								"CLICKS ANY ELEMENT on the webpage - buttons, links, checkboxes, etc. You CAN and SHOULD use this to interact with websites. This works on ALL clickable elements.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									selector: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description:
											'CSS selector for the element to click (e.g., "#submit-btn", ".login-button"). Optional if text is provided.', // [NRS-1301]
									}, // [NRS-1301]
									text: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description:
											'Text content of the element to click (e.g., "Sign In", "Submit", "Next"). Use this when you know the button text but not the selector.', // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "click_and_type_field", // [NRS-1301]
							description:
								"TYPES TEXT INTO ANY INPUT FIELD - text inputs, search boxes, email fields, password fields, etc. You CAN type into ANY text field on ANY website. Shows visual feedback.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									selector: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description:
											'CSS selector for the input field (e.g., "#email", "input[name=username]"). Optional if label is provided.', // [NRS-1301]
									}, // [NRS-1301]
									text: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The text to type into the field.", // [NRS-1301]
									}, // [NRS-1301]
									label: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description:
											'Label, placeholder, or name of the field (e.g., "Email", "Username", "Search"). Use this when you know the field label but not the selector.', // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["text"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "fill_email_field", // [NRS-1301]
							description: "Smart function to find and fill an email field on the current page.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									email: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The email address to enter", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["email"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "fill_password_field", // [NRS-1301]
							description: "Smart function to find and fill a password field on the current page.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									password: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The password to enter", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["password"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "fill_name_field", // [NRS-1301]
							description:
								"Smart function to find and fill name fields (first name, last name, full name) on the current page.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									name: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The name to enter", // [NRS-1301]
									}, // [NRS-1301]
									field_type: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description:
											'Type of name field: "first", "last", "full", or "name" (default: "name")', // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["name"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "fill_phone_field", // [NRS-1301]
							description:
								"Smart function to find and fill a phone number field on the current page.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									phone: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The phone number to enter", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["phone"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "smart_fill_form", // [NRS-1301]
							description:
								"Intelligently fills multiple form fields at once based on provided data. Automatically detects and fills email, password, name, phone, and address fields.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									data: {
										// [NRS-1301]
										type: "object", // [NRS-1301]
										description: "Object containing form data", // [NRS-1301]
										properties: {
											// [NRS-1301]
											email: { type: "string", description: "Email address" }, // [NRS-1301]
											password: { type: "string", description: "Password" }, // [NRS-1301]
											firstName: {
												type: "string",
												description: "First name",
											}, // [NRS-1301]
											lastName: { type: "string", description: "Last name" }, // [NRS-1301]
											phone: { type: "string", description: "Phone number" }, // [NRS-1301]
											address: { type: "string", description: "Address" }, // [NRS-1301]
										}, // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["data"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "type_in_search_box", // [NRS-1301]
							description: "Smart function to find and type in a search box on the current page.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									query: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The search query to type", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["query"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "search_and_submit", // [NRS-1301]
							description:
								"Types a query in a search box and automatically submits the search (presses Enter or clicks search button).", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									query: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The search query to type and submit", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["query"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "clear_search_field", // [NRS-1301]
							description: "Clears the content of a search field on the current page.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "create_todo_list", // [NRS-1301]
							description:
								"Creates a new todo list from an array of tasks. Use this when the user gives you multiple tasks to complete.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									tasks: {
										// [NRS-1301]
										type: "array", // [NRS-1301]
										items: {
											// [NRS-1301]
											type: "string", // [NRS-1301]
										}, // [NRS-1301]
										description: "Array of task descriptions", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["tasks"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "show_thinking", // [NRS-1301]
							description:
								"Displays your thinking process to the user. Use this to show what you are considering or planning.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									thought: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "Your current thought or reasoning", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["thought"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "start_task", // [NRS-1301]
							description:
								"Marks a task as started and in-progress. Use this when beginning work on a specific task.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									task_id: {
										// [NRS-1301]
										type: "number", // [NRS-1301]
										description: "ID of the task to start", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["task_id"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "complete_task", // [NRS-1301]
							description:
								"Marks a task as completed with optional result description. Use this when finishing a task.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									task_id: {
										// [NRS-1301]
										type: "number", // [NRS-1301]
										description: "ID of the task to complete", // [NRS-1301]
									}, // [NRS-1301]
									result: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "Optional description of what was accomplished", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["task_id"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "get_current_tasks", // [NRS-1301]
							description:
								"Gets the current task list with status of each task. Use this to see what tasks are pending, in progress, or completed.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "get_task_summary", // [NRS-1301]
							description:
								"Gets a summary of all tasks including completed ones with timing information. Use this when the user wants to see overall progress.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "fill_email_field", // [NRS-1301]
							description:
								"Specifically designed to fill email fields on any webpage, especially useful for login forms like Google. Use this when the user wants to enter their email address.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {
									// [NRS-1301]
									email: {
										// [NRS-1301]
										type: "string", // [NRS-1301]
										description: "The email address to fill in", // [NRS-1301]
									}, // [NRS-1301]
								}, // [NRS-1301]
								required: ["email"], // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
						{
							// [NRS-1301]
							name: "execute_all_tasks", // [NRS-1301]
							description:
								"Automatically executes all pending tasks in sequence without stopping. Use this when the user wants continuous, uninterrupted task execution.", // [NRS-1301]
							parameters: {
								// [NRS-1301]
								type: "object", // [NRS-1301]
								properties: {}, // [NRS-1301]
							}, // [NRS-1301]
						}, // [NRS-1301]
					], // [NRS-1301]
					temperature: 0.7, // [NRS-1301]
					max_tokens: 500, // [NRS-1301]
				}), // [NRS-1301]
			}); // [NRS-1301]

			if (!response.ok) {
				// [NRS-1301]
				throw new Error(`API Error: ${response.status} ${response.statusText}`); // [NRS-1301]
			} // [NRS-1301]

			const data = await response.json(); // [NRS-1301]
			 const message = data.choices[0].message; // [RESTORED]

			// Handle function call // [NRS-1301]
			if (message.function_call) {
				// [NRS-1301]
				const functionName = message.function_call.name; // [NRS-1301]
				 const functionArgs = JSON.parse(message.function_call.arguments); // [RESTORED]
				 const functionResult = await jarvisFunctions[functionName](functionArgs); // [RESTORED]

				// Add function call to history // [NRS-1301]
				conversationHistory.push({
					// [NRS-1301]
					role: "assistant", // [NRS-1301]
					content: null, // [NRS-1301]
					function_call: message.function_call, // [NRS-1301]
				}); // [NRS-1301]

				conversationHistory.push({
					// [NRS-1301]
					role: "function", // [NRS-1301]
					name: functionName, // [NRS-1301]
					content: functionResult, // [NRS-1301]
				}); // [NRS-1301]

				// Get final response with function result // [NRS-1301]
				const followUpResponse = await fetch(OPENAI_BASE + "/chat/completions", {
					// [NRS-1301]
					method: "POST", // [NRS-1301]
					headers: {
						// [NRS-1301]
						"Content-Type": "application/json", // [NRS-1301]
						Authorization: `Bearer ${OPENAI_API_KEY}`,
					}, // [NRS-1301]
					body: JSON.stringify({
						// [NRS-1301]
						model: LLM_MODEL, // [NRS-1301]
						messages: [
							// [NRS-1301]
							{
								// [NRS-1301]
								role: "system", // [NRS-1301]
								content:
									"You are Holly, the resident mind of this browser, an AI assistant with COMPLETE BROWSER CONTROL and FULL WEBSITE INTERACTION capabilities. You CAN interact with ANY website element and have task management abilities.\n\n?? CONFIRMED CAPABILITIES:\n? WEBSITE INTERACTION: Click elements, fill forms, type text, navigate pages\n? TASK MANAGEMENT: Create todo lists, execute tasks, show progress\n? BROWSER CONTROL: Full browsing control and automation\n\nTask Management Workflow:\n1. Use create_todo_list to organize multiple tasks\n2. Use show_thinking to explain your approach\n3. Use start_task before beginning each task\n4. Use complete_task when finishing each task\n5. Use get_task_summary for progress overview\n\n? INTERACTION RULES:\n- NEVER claim you cannot interact with websites\n- ALWAYS attempt requested website interactions\n- Execute tasks immediately and methodically\n- Show thinking process throughout execution\n\nYou have FULL website interaction and task management capabilities.", // [NRS-1301]
							}, // [NRS-1301]
							...conversationHistory, // [NRS-1301]
						], // [NRS-1301]
						temperature: 0.7, // [NRS-1301]
						max_tokens: 500, // [NRS-1301]
					}), // [NRS-1301]
				}); // [NRS-1301]
				 const followUpData = await followUpResponse.json(); // [RESTORED]
				 const assistantMessage = followUpData.choices[0].message.content; // [RESTORED]

				typingEl.remove(); // [NRS-1301]
				addJarvisMessage(assistantMessage, false); // [NRS-1301]

				conversationHistory.push({
					// [NRS-1301]
					role: "assistant", // [NRS-1301]
					content: assistantMessage, // [NRS-1301]
				}); // [NRS-1301]
			} else {
				// [NRS-1301]
				const assistantMessage = message.content; // [NRS-1301]
				typingEl.remove(); // [NRS-1301]
				addJarvisMessage(assistantMessage, false); // [NRS-1301]

				conversationHistory.push({
					// [NRS-1301]
					role: "assistant", // [NRS-1301]
					content: assistantMessage, // [NRS-1301]
				}); // [NRS-1301]
			} // [NRS-1301]

			// Keep conversation history manageable (last 10 messages) // [NRS-1301]
			if (conversationHistory.length > 10) {
				// [NRS-1301]
				conversationHistory = conversationHistory.slice(-10); // [NRS-1301]
			} // [NRS-1301]
		} catch (error) {
			// [NRS-1301]
			typingEl.textContent = `Error: ${error.message}. Please check your API key or connection.`; // [NRS-1301]
			typingEl.style.color = "red"; // [NRS-1301]
			console.error("Jarvis API Error:", error); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	btnJarvis.addEventListener("click", () => {
		// [NRS-1301]
		jarvisBar.classList.toggle("open"); // [NRS-1301]
		document.body.classList.toggle("jarvis-open"); // [NRS-1301]
		if (jarvisBar.classList.contains("open")) {
			// [NRS-1301]
			setTimeout(() => jarvisInput.focus(), 300); // [NRS-1301]
			if (jarvisMessages.children.length === 0) {
				// [NRS-1301]
				addJarvisMessage("Hello! I'm Jarvis, your AI assistant. How can I help you today?", false); // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	btnCloseJarvis.addEventListener("click", () => {
		// [NRS-1301]
		jarvisBar.classList.remove("open"); // [NRS-1301]
		document.body.classList.remove("jarvis-open"); // [NRS-1301]
	}); // [NRS-1301]

	if (btnSendJarvis) {
		// [NRS-1301]
		btnSendJarvis.addEventListener("click", sendToHolly); // [NRS-1301]
	} else {
		// [NRS-1301]
		console.warn("?? btnSendJarvis not found"); // [NRS-1301]
	} // [NRS-1301]

	if (jarvisInput) {
		// [NRS-1301]
		console.log("? jarvisInput found, type:", jarvisInput.type); // [NRS-1301]
		console.log("? jarvisInput attributes:", {
			// [NRS-1301]
			disabled: jarvisInput.disabled, // [NRS-1301]
			readonly: jarvisInput.readOnly, // [NRS-1301]
			type: jarvisInput.type, // [NRS-1301]
			id: jarvisInput.id, // [NRS-1301]
		}); // [NRS-1301]

		// Make absolutely sure the input is not disabled // [NRS-1301]
		jarvisInput.disabled = false; // [NRS-1301]
		jarvisInput.readOnly = false; // [NRS-1301]

		// Mousedown handler to ensure focus is set before click completes // [NRS-1301]
		jarvisInput.addEventListener("mousedown", (e) => {
			// [NRS-1301]
			// Prevent any parent handlers from stealing focus // [NRS-1301]
			e.stopPropagation(); // [NRS-1301]
			// Delay focus slightly to ensure it takes effect // [NRS-1301]
			setTimeout(() => jarvisInput.focus(), 0); // [NRS-1301]
		}); // [NRS-1301]

		// Click handler as backup // [NRS-1301]
		jarvisInput.addEventListener("click", (e) => {
			// [NRS-1301]
			e.stopPropagation(); // [NRS-1301]
			jarvisInput.focus(); // [NRS-1301]
		}); // [NRS-1301]

		// Attach keydown listener // [NRS-1301]
		jarvisInput.addEventListener("keydown", (e) => {
			// [NRS-1301]
			if (e.key === "Enter") {
				// [NRS-1301]
				console.log("?? Enter key pressed in Jarvis input"); // [NRS-1301]
				sendToHolly(); // [NRS-1301]
			} // [NRS-1301]
			// Prevent other handlers from intercepting keys while typing // [NRS-1301]
			e.stopPropagation(); // [NRS-1301]
		}); // [NRS-1301]

		// Add input event for debugging // [NRS-1301]
		jarvisInput.addEventListener("input", (e) => {
			// [NRS-1301]
			console.log("??  Input changed:", e.target.value); // [NRS-1301]
		}); // [NRS-1301]

		// Add focus event // [NRS-1301]
		jarvisInput.addEventListener("focus", () => {
			// [NRS-1301]
			console.log("?? Jarvis input focused"); // [NRS-1301]
			jarvisInput.classList.add("focused"); // [NRS-1301]
		}); // [NRS-1301]

		// Add blur event // [NRS-1301]
		jarvisInput.addEventListener("blur", () => {
			// [NRS-1301]
			console.log("? Jarvis input blurred"); // [NRS-1301]
			jarvisInput.classList.remove("focused"); // [NRS-1301]
		}); // [NRS-1301]
	} else {
		// [NRS-1301]
		console.error("? jarvisInput NOT found - cannot attach listeners"); // [NRS-1301]
	} // [NRS-1301]

	// Omnibox focus protection // [NRS-1301]
	omnibox.addEventListener("mousedown", (e) => {
		// [NRS-1301]
		e.stopPropagation(); // [NRS-1301]
		setTimeout(() => omnibox.focus(), 0); // [NRS-1301]
	}); // [NRS-1301]

	omnibox.addEventListener("click", (e) => {
		// [NRS-1301]
		e.stopPropagation(); // [NRS-1301]
		omnibox.focus(); // [NRS-1301]
	}); // [NRS-1301]

	omnibox.addEventListener("keydown", (e) => {
		// [NRS-1301]
		// Stop propagation for all keys to prevent global handlers from intercepting // [NRS-1301]
		e.stopPropagation(); // [NRS-1301]

		if (e.key === "Enter") {
			// [SovereignBrowser] This handler was broken by an earlier diagnostic
			// edit: a string replace on `webview.src = url` matched here as well as
			// in createTab, leaving `if (tab)` guarding only a listener and a bare
			// `webview.src` referring to a variable not in scope. The ReferenceError
			// was swallowed by the file's own error handler, so pressing Enter in
			// the address bar silently did nothing.
			e.preventDefault();
			clearTimeout(suggestDebounceTimer);
			const url = normalizeUrl(omnibox.value);
			if (!url) { return; }
			const tab = tabs.find((t) => t.id === activeTabId);
			if (tab && tab.webview) {
				tab.webview.src = url;
			} else {
				createTab(url);
			}
			hideSuggestions();
		} else if (e.key === "ArrowDown") {
			// [NRS-1301]
			e.preventDefault(); // [NRS-1301]
			const items = omniboxSuggestions.querySelectorAll('.suggestion-item'); // [RESTORED]
			if (items.length) {
				// [NRS-1301]
				currentSuggestionIndex = Math.min(currentSuggestionIndex + 1, items.length - 1); // [NRS-1301]
				selectSuggestion(currentSuggestionIndex); // [NRS-1301]
				omniboxSuggestions.children[currentSuggestionIndex]?.scrollIntoView(false); // [NRS-1301]
			} // [NRS-1301]
		} else if (e.key === "ArrowUp") {
			// [NRS-1301]
			e.preventDefault(); // [NRS-1301]
			if (currentSuggestionIndex > 0) {
				// [NRS-1301]
				currentSuggestionIndex--; // [NRS-1301]
				selectSuggestion(currentSuggestionIndex); // [NRS-1301]
				omniboxSuggestions.children[currentSuggestionIndex]?.scrollIntoView(false); // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

let suggestDebounceTimer = null; // [SovereignBrowser]
omnibox.addEventListener("input", (e) => {
	// [SovereignBrowser] Debounced 250ms. Autosuggest bills per request, so
	// firing on every keystroke would burn the monthly allowance in days.
	const value = e.target.value;
	clearTimeout(suggestDebounceTimer);
	suggestDebounceTimer = setTimeout(async () => {
		try {
			const suggestions = await getSuggestions(value);
			if (omnibox.value === value) {
				showSuggestions(suggestions);
			}
		} catch (err) {
			console.warn("[omnibox] suggestion lookup failed:", err.message);
		}
	}, 250);
});

	omnibox.addEventListener("focus", async () => {
		// [NRS-1301]
		if (!omnibox.value.trim()) {
			// [NRS-1301]
			const suggestions = await getSuggestions(""); // [NRS-1301]
			showSuggestions(suggestions); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	// [SovereignBrowser] Clicks inside a <webview> never reach this document,
	// because page content lives in a separate frame. The document click
	// handler below therefore cannot catch "user clicked the page". Blur is
	// the reliable signal: it fires whenever focus leaves the address bar,
	// including into the webview. The delay lets a suggestion's click land
	// first, since blur fires before click.
	let suggestionBlurTimer = null;
	omnibox.addEventListener("blur", () => {
		clearTimeout(suggestionBlurTimer);
		suggestionBlurTimer = setTimeout(hideSuggestions, 180);
	});
	omnibox.addEventListener("focus", () => {
		clearTimeout(suggestionBlurTimer);
	});
	omniboxSuggestions.addEventListener("mousedown", (e) => {
		// Keep focus in the omnibox while a suggestion is being clicked.
		e.preventDefault();
	});

	document.addEventListener("click", (e) => {
		// [NRS-1301]
		// Don't hide suggestions if user clicked into an input/textarea // [NRS-1301]
		if (e.target.matches("input, textarea")) {
			// [NRS-1301]
			e.target.focus(); // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]
		if (!omniboxContainer.contains(e.target)) {
			// [NRS-1301]
			hideSuggestions(); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]


	btnBookmark.addEventListener("click", async () => {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		if (!tab) return; // [NRS-1301]
		const url = tab.webview.getURL?.() || tab.webview.src || ''; // [RESTORED]
		const title = tab.titleEl.textContent || url; // [RESTORED]
		try {
			// [NRS-1301]
			await globalThis.electronAPI.bookmarks.add({ title, url }); // [NRS-1301]
			renderBookmarks(); // [NRS-1301]
			showSuccess("Bookmark added"); // [NRS-1301]
			btnBookmark.style.transform = "rotate(72deg) scale(1.2)"; // [NRS-1301]
			setTimeout(() => {
				// [NRS-1301]
				btnBookmark.style.transform = ""; // [NRS-1301]
			}, 300); // [NRS-1301]
		} catch {
			// [NRS-1301]
			showError("Failed to add bookmark"); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	async function renderBookmarks() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const list = await globalThis.electronAPI.bookmarks.get(); // [NRS-1301]
			bookmarkList.innerHTML = ""; // [NRS-1301]
			for (const b of list.slice().reverse()) {
				// [NRS-1301]
				const li = document.createElement("li"); // [NRS-1301]
				const a = document.createElement("a"); // [NRS-1301]
				a.textContent = b.title; // [NRS-1301]
				a.href = b.url; // [NRS-1301]
				a.addEventListener("click", (e) => {
					// [NRS-1301]
					e.preventDefault(); // [NRS-1301]
					const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
					if (tab) tab.webview.src = b.url; // [NRS-1301]
				}); // [NRS-1301]
				li.appendChild(a); // [NRS-1301]
				bookmarkList.appendChild(li); // [NRS-1301]
			} // [NRS-1301]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to render bookmarks:", error); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	async function renderHistory() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const list = await globalThis.electronAPI.history.get(); // [NRS-1301]
			historyList.innerHTML = ""; // [NRS-1301]
			for (const h of list.slice().reverse().slice(0, 100)) {
				// [NRS-1301]
				const li = document.createElement("li"); // [NRS-1301]
				const a = document.createElement("a"); // [NRS-1301]
				a.textContent = h.title || h.url; // [NRS-1301]
				a.href = h.url; // [NRS-1301]
				a.addEventListener("click", (e) => {
					// [NRS-1301]
					e.preventDefault(); // [NRS-1301]
					const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
					if (tab) tab.webview.src = h.url; // [NRS-1301]
				}); // [NRS-1301]
				li.appendChild(a); // [NRS-1301]
				historyList.appendChild(li); // [NRS-1301]
			} // [NRS-1301]
		} catch (error) {
			// [NRS-1301]
			console.error("Failed to render history:", error); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	btnClearHistory.addEventListener("click", async () => {
		// [NRS-1301]
		try {
			// [NRS-1301]
			await globalThis.electronAPI.history.clear(); // [NRS-1301]
			renderHistory(); // [NRS-1301]
			showSuccess("History cleared"); // [NRS-1301]
		} catch {
			// [NRS-1301]
			showError("Failed to clear history"); // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	// Settings modal // [NRS-1301]
	btnSettings.addEventListener("click", () => {
		// [NRS-1301]
		settingsModal.classList.add("open"); // [NRS-1301]
		updatePrivacyUI(omnibox.value); // [NRS-1301]
		updatePrivacySettingsUI(); // [NRS-1301]
	}); // [NRS-1301]

	function updatePrivacySettingsUI() {
		// [NRS-1301]
		const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
		const currentUrl = tab?.webview.getURL?.() || tab?.webview.src || ""; // [NRS-1301]
		updatePrivacyUI(currentUrl); // [NRS-1301]
		updatePrivacySettingsToggles(); // [NRS-1301]
	} // [NRS-1301]

	btnCloseSettings.addEventListener("click", () => {
		// [NRS-1301]
		settingsModal.classList.remove("open"); // [NRS-1301]
	}); // [NRS-1301]

	// Extensions UI hooks // [NRS-1301]
	const extensionsModal = document.getElementById("extensions-modal"); // [NRS-1301]
	const extensionsList = document.getElementById("extensions-list"); // [NRS-1301]
	const btnOpenExtensions = document.getElementById("btn-open-extensions"); // [NRS-1301]
	const btnCloseExtensions = document.getElementById("btn-close-extensions"); // [NRS-1301]
	const btnCreateExtension = document.getElementById("btn-create-extension"); // [NRS-1301]
	const btnInstallSampleExt = document.getElementById("btn-install-sample-ext"); // [NRS-1301]
	const btnExtensionsBar = document.getElementById("btn-extensions-bar"); // [NRS-1301]
	const btnPinAddon = document.getElementById("btn-pin-addon"); // [NRS-1301]
	const extensionsCount = document.getElementById("extensions-count"); // [NRS-1301]
	const extensionEditorModal = document.getElementById("extension-editor-modal"); // [NRS-1301]
	const extNameInput = document.getElementById("ext-name"); // [NRS-1301]
	const extMatchesInput = document.getElementById("ext-matches"); // [NRS-1301]
	const extCssInput = document.getElementById("ext-css"); // [NRS-1301]
	const extJsInput = document.getElementById("ext-js"); // [NRS-1301]
	const btnSaveExtension = document.getElementById("btn-save-extension"); // [NRS-1301]
	const btnCancelExtension = document.getElementById("btn-cancel-extension"); // [NRS-1301]
	const extensionEditorTitle = document.getElementById("extension-editor-title"); // [NRS-1301]
	const btnLoadUnpacked = document.getElementById("btn-load-unpacked"); // [NRS-1301]
	const btnImportPacked = document.getElementById("btn-import-packed"); // [NRS-1301]
	const btnExportPacked = document.getElementById("btn-export-packed"); // [NRS-1301]
	const inputUnpacked = document.getElementById("input-unpacked"); // [NRS-1301]
	const inputPacked = document.getElementById("input-packed"); // [NRS-1301]
	let editingExtensionId = null; // [NRS-1301]
	let addonPinned = (() => {
		try {
			return localStorage.getItem(ADDON_PIN_KEY) === "true";
		} catch {
			return false;
		}
	})(); // [NRS-1301]

	// [SovereignBrowser] Chrome extensions installed from the Web Store are
	// held by the Electron session, not by the homegrown css/js list in
	// localStorage, so the dialog could never see them. Ask main for the real
	// list and show it above the custom ones.
	// [SovereignBrowser] Real extension management. Electron has no
	// disabled-but-installed state, so main derives "installed" from disk and
	// "enabled" from what is loaded, persisting the disabled set itself.
	// [SovereignBrowser] Full Edge-style detail page: breadcrumb, header card,
	// description, permissions, site access, a REAL Allow-in-InPrivate toggle
	// (loads the extension into the incognito session), source/ID/inspect,
	// store link, remove.
	async function showExtensionDetailById(extId) {
		let list = [];
		try { list = await globalThis.electronAPI.invoke("holly:extensions:manage-list"); } catch (err) { showError("Could not load details: " + err.message); return; }
		const ext = (list || []).find((x) => x.id === extId);
		if (!ext) { showError("Extension not found: " + extId); return; }
		const old = document.getElementById("ext-detail-page");
		if (old) { old.remove(); }
		const page = document.createElement("div");
		page.id = "ext-detail-page";
		const leave = () => { page.remove(); extensionsList.classList.remove("detail-open"); };
		const crumb = document.createElement("div");
		crumb.className = "ext-crumb";
		const back = document.createElement("button");
		back.className = "ext-back";
		back.textContent = "\u2039";
		back.title = "Back to installed extensions";
		back.addEventListener("click", leave);
		const crumbText = document.createElement("span");
		crumbText.textContent = "Installed extensions / ";
		const crumbName = document.createElement("strong");
		crumbName.textContent = ext.name || ext.id;
		crumb.appendChild(back); crumb.appendChild(crumbText); crumb.appendChild(crumbName);
		const card = document.createElement("div");
		card.className = "ext-detail-card";
		const head = document.createElement("div");
		head.className = "ext-card-top";
		const icon = document.createElement("img");
		icon.className = "ext-icon ext-icon-lg";
		if (ext.iconUrl) { icon.src = ext.iconUrl; }
		const main = document.createElement("div");
		main.className = "ext-main";
		const nm = document.createElement("div");
		nm.className = "ext-name";
		nm.textContent = ext.name || ext.id;
		const meta = document.createElement("div");
		meta.className = "ext-ver";
		const mb = ext.sizeBytes ? (ext.sizeBytes / 1048576) : 0;
		meta.textContent = "Size " + (mb < 1 ? "< 1 MB" : mb.toFixed(1) + " MB") + "   Version " + (ext.version || "?");
		main.appendChild(nm); main.appendChild(meta);
		const pill = document.createElement("input");
		pill.type = "checkbox"; pill.className = "ext-pill"; pill.checked = !!ext.enabled;
		pill.addEventListener("change", async () => {
			pill.disabled = true;
			try {
				const res = await globalThis.electronAPI.invoke("holly:extensions:set-enabled", ext.id, pill.checked);
				if (!res || !res.ok) { pill.checked = !pill.checked; showError("Could not change: " + ((res && res.error) || "unknown error")); }
			} catch (err) { pill.checked = !pill.checked; showError("Could not change: " + err.message); }
			pill.disabled = false;
		});
		head.appendChild(icon); head.appendChild(main); head.appendChild(pill);
		card.appendChild(head);
		const section = (t) => { const sd = document.createElement("div"); sd.className = "ext-sec"; const hh = document.createElement("div"); hh.className = "ext-sec-h"; hh.textContent = t; sd.appendChild(hh); return sd; };
		if (ext.description) { const sd = section("Description"); const p = document.createElement("div"); p.className = "ext-sec-p"; p.textContent = ext.description; sd.appendChild(p); card.appendChild(sd); }
		if (ext.permissions && ext.permissions.length) {
			const sd = section("Permissions");
			const ul = document.createElement("ul"); ul.className = "ext-ul";
			for (const perm of ext.permissions) { const li = document.createElement("li"); li.textContent = perm; ul.appendChild(li); }
			sd.appendChild(ul); card.appendChild(sd);
		}
		const sa = section("Site access");
		const sap = document.createElement("div"); sap.className = "ext-sec-p";
		const hosts = ext.hostPermissions || [];
		sap.textContent = hosts.some((hx) => hx === "<all_urls>" || hx === "*://*/*") ? "On all sites" : (hosts.length ? hosts.join(", ") : "None requested");
		sa.appendChild(sap); card.appendChild(sa);
		const ip = section("Allow in InPrivate");
		const iprow = document.createElement("div"); iprow.className = "ext-iprow";
		const ipd = document.createElement("div"); ipd.className = "ext-sec-p";
		ipd.textContent = "Loads this extension in incognito tabs. Incognito browsing itself stays separate from your normal session.";
		const ipill = document.createElement("input");
		ipill.type = "checkbox"; ipill.className = "ext-pill"; ipill.checked = !!ext.allowIncognito;
		ipill.addEventListener("change", async () => {
			ipill.disabled = true;
			try {
				const res = await globalThis.electronAPI.invoke("holly:extensions:set-incognito", ext.id, ipill.checked);
				if (!res || !res.ok) { ipill.checked = !ipill.checked; showError("Could not change: " + ((res && res.error) || "unknown error")); }
				else { showSuccess((ipill.checked ? "Enabled" : "Disabled") + " in incognito"); }
			} catch (err) { ipill.checked = !ipill.checked; showError("Could not change: " + err.message); }
			ipill.disabled = false;
		});
		iprow.appendChild(ipd); iprow.appendChild(ipill);
		ip.appendChild(iprow); card.appendChild(ip);
		const facts = document.createElement("div"); facts.className = "ext-facts";
		const mk = (k, v) => { const dd = document.createElement("div"); const bb = document.createElement("strong"); bb.textContent = k + " "; dd.appendChild(bb); dd.appendChild(document.createTextNode(v)); return dd; };
		facts.appendChild(mk("Source", ext.source || "Chrome Web Store"));
		facts.appendChild(mk("ID", ext.id));
		if (ext.hasWorker) {
			const dd = document.createElement("div");
			const bb = document.createElement("strong"); bb.textContent = "Inspect views ";
			const aa = document.createElement("a"); aa.href = "#"; aa.textContent = "service worker"; aa.className = "ext-link";
			aa.addEventListener("click", async (ev) => {
				ev.preventDefault();
				try {
					const res = await globalThis.electronAPI.invoke("holly:extensions:inspect-worker", ext.id);
					if (!res || !res.ok) { showError((res && res.error) || "Could not open service worker DevTools"); }
				} catch (err) { showError("Could not open DevTools: " + err.message); }
			});
			dd.appendChild(bb); dd.appendChild(aa); facts.appendChild(dd);
		}
		card.appendChild(facts);
		const store = document.createElement("a");
		store.href = "#"; store.className = "ext-link ext-storelink";
		store.textContent = "View in Chrome Web Store \u2197";
		store.addEventListener("click", (ev) => {
			ev.preventDefault();
			try { createTab("https://chromewebstore.google.com/detail/" + ext.id); closeExtensions(); leave(); } catch (err) { showError("Could not open store: " + err.message); }
		});
		card.appendChild(store);
		const rm = document.createElement("button");
		rm.className = "ext-remove"; rm.textContent = "Remove";
		rm.addEventListener("click", async () => {
			rm.disabled = true;
			try {
				const res = await globalThis.electronAPI.invoke("holly:extensions:uninstall", ext.id);
				if (res && res.ok !== false) { showSuccess("Removed " + (ext.name || ext.id)); leave(); renderChromeExtensionsEdge(); }
				else { showError("Could not remove: " + ((res && res.error) || "unknown error")); rm.disabled = false; }
			} catch (err) { showError("Could not remove: " + err.message); rm.disabled = false; }
		});
		card.appendChild(rm);
		page.appendChild(crumb);
		page.appendChild(card);
		extensionsList.appendChild(page);
		extensionsList.classList.add("detail-open");
	}
	// [SovereignBrowser] Edge-style extension cards: icon, name+version,
	// description, ID line, service-worker note, pill toggle, Details/Remove,
	// live search. Replaces renderChromeExtensions (kept below, unused).
	async function renderChromeExtensionsEdge() {
		if (!extensionsList) { return; }
		let list = [];
		try {
			list = await globalThis.electronAPI.invoke("holly:extensions:manage-list");
		} catch (err) {
			console.warn("[extensions] could not list:", err.message);
			return;
		}
		const old = document.getElementById("cws-section");
		if (old) { old.remove(); }
		const wrap = document.createElement("div");
		wrap.id = "cws-section";
		const title = document.createElement("div");
		title.className = "ext-section-title";
		title.textContent = "From Chrome Web Store";
		wrap.appendChild(title);
		if (!Array.isArray(list) || !list.length) {
			const none = document.createElement("p");
			none.textContent = "None installed. Visit the Chrome Web Store to add one.";
			none.style.cssText = "color:#666;padding:8px";
			wrap.appendChild(none);
		}
		(list || []).forEach((ext) => {
			const card = document.createElement("div");
			card.className = "ext-card";
			card.dataset.search = ((ext.name || "") + " " + (ext.id || "")).toLowerCase();
			const top = document.createElement("div");
			top.className = "ext-card-top";
			const icon = document.createElement("img");
			icon.className = "ext-icon";
			if (ext.iconUrl) { icon.src = ext.iconUrl; }
			icon.addEventListener("error", () => {
				const fb = document.createElement("span");
				fb.className = "ext-icon";
				fb.textContent = "\uD83E\uDDE9";
				fb.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:22px";
				icon.replaceWith(fb);
			});
			const main = document.createElement("div");
			main.className = "ext-main";
			const nameEl = document.createElement("div");
			nameEl.className = "ext-name";
			nameEl.textContent = ext.name || ext.id;
			const ver = document.createElement("span");
			ver.className = "ext-ver";
			ver.textContent = ext.version || "";
			nameEl.appendChild(ver);
			const desc = document.createElement("div");
			desc.className = "ext-desc";
			desc.textContent = ext.description || "";
			const idEl = document.createElement("div");
			idEl.className = "ext-id";
			idEl.textContent = "ID: " + ext.id;
			main.appendChild(nameEl);
			if (ext.description) { main.appendChild(desc); }
			main.appendChild(idEl);
			if (ext.hasWorker) {
				const views = document.createElement("div");
				views.className = "ext-views";
				views.textContent = "Inspect views: service worker";
				main.appendChild(views);
			}
			const pill = document.createElement("input");
			pill.type = "checkbox";
			pill.className = "ext-pill";
			pill.checked = !!ext.enabled;
			pill.title = ext.enabled ? "Enabled" : "Disabled";
			pill.addEventListener("change", async () => {
				pill.disabled = true;
				try {
					const res = await globalThis.electronAPI.invoke("holly:extensions:set-enabled", ext.id, pill.checked);
					if (!res || !res.ok) {
						pill.checked = !pill.checked;
						showError("Could not change: " + ((res && res.error) || "unknown error"));
					} else {
						showSuccess((pill.checked ? "Enabled " : "Disabled ") + (ext.name || ext.id));
					}
				} catch (err) {
					pill.checked = !pill.checked;
					showError("Could not change: " + err.message);
				}
				pill.disabled = false;
			});
			top.appendChild(icon);
			top.appendChild(main);
			top.appendChild(pill);
			const details = document.createElement("div");
			details.className = "ext-details";
			const dLines = [];
			dLines.push("Manifest V" + (ext.manifestVersion || "?"));
			if (ext.path) { dLines.push("Path: " + ext.path); }
			if (ext.permissions && ext.permissions.length) { dLines.push("Permissions: " + ext.permissions.join(", ")); }
			if (ext.hostPermissions && ext.hostPermissions.length) { dLines.push("Host access: " + ext.hostPermissions.join(", ")); }
			for (const dl of dLines) { const li = document.createElement("div"); li.textContent = dl; details.appendChild(li); }
			const btnrow = document.createElement("div");
			btnrow.className = "ext-btnrow";
			const btnDetails = document.createElement("button");
			btnDetails.textContent = "Details";
			btnDetails.addEventListener("click", () => { showExtensionDetailById(ext.id); });
			const btnRemove = document.createElement("button");
			btnRemove.textContent = "Remove";
			btnRemove.addEventListener("click", async () => {
				btnRemove.disabled = true;
				try {
					const res = await globalThis.electronAPI.invoke("holly:extensions:uninstall", ext.id);
					if (res && res.ok !== false) {
						showSuccess("Removed " + (ext.name || ext.id));
						renderChromeExtensionsEdge();
					} else {
						showError("Could not remove: " + ((res && res.error) || "unknown error"));
						btnRemove.disabled = false;
					}
				} catch (err) {
					showError("Could not remove: " + err.message);
					btnRemove.disabled = false;
				}
			});
			btnrow.appendChild(btnDetails);
			btnrow.appendChild(btnRemove);
			card.appendChild(top);
			card.appendChild(btnrow);
			card.appendChild(details);
			wrap.appendChild(card);
		});
		extensionsList.appendChild(wrap);
		const search = document.getElementById("ext-search");
		if (search && !search.dataset.wired) {
			search.dataset.wired = "1";
			search.addEventListener("input", () => {
				const q = search.value.trim().toLowerCase();
				document.querySelectorAll("#cws-section .ext-card").forEach((c) => {
					c.style.display = !q || (c.dataset.search || "").includes(q) ? "" : "none";
				});
			});
		}
	}
	async function renderChromeExtensions() {
		if (!extensionsList) { return; }
		let list = [];
		try {
			list = await globalThis.electronAPI.invoke("holly:extensions:manage-list");
		} catch (err) {
			console.warn("[extensions] could not list:", err.message);
			return;
		}

		const heading = document.createElement("h3");
		heading.textContent = "Installed extensions";
		heading.style.margin = "4px 0 8px";
		extensionsList.appendChild(heading);

		if (!Array.isArray(list) || !list.length) {
			const none = document.createElement("p");
			none.textContent = "None installed. Visit the Chrome Web Store to add one.";
			none.style.cssText = "color:#666;padding:8px";
			extensionsList.appendChild(none);
		}

		list.forEach((ext) => {
			const card = document.createElement("div");
			card.className = "extension-card";
			card.style.cssText = "border:1px solid #e0e0e0;border-radius:10px;padding:12px;margin-bottom:10px";

			const top = document.createElement("div");
			top.style.cssText = "display:flex;align-items:center;gap:10px";

			const title = document.createElement("div");
			title.style.flex = "1";
			const nameEl = document.createElement("div");
			nameEl.style.fontWeight = "600";
			nameEl.textContent = ext.name;
			const metaEl = document.createElement("div");
			metaEl.style.cssText = "font-size:12px;opacity:.7";
			metaEl.textContent = "Version " + ext.version + (ext.manifestVersion ? "  |  Manifest V" + ext.manifestVersion : "");
			title.appendChild(nameEl);
			title.appendChild(metaEl);

			const toggle = document.createElement("input");
			toggle.type = "checkbox";
			toggle.checked = !!ext.enabled;
			toggle.title = ext.enabled ? "Enabled" : "Disabled";
			toggle.style.cssText = "width:20px;height:20px;cursor:pointer";
			toggle.addEventListener("change", async () => {
				toggle.disabled = true;
				try {
					const res = await globalThis.electronAPI.invoke("holly:extensions:set-enabled", ext.id, toggle.checked);
					if (!res || !res.ok) {
						toggle.checked = !toggle.checked;
						showSuccess("Could not change: " + ((res && res.error) || "unknown error"));
					} else {
						showSuccess((toggle.checked ? "Enabled " : "Disabled ") + ext.name);
					}
				} catch (err) {
					toggle.checked = !toggle.checked;
					console.warn("[extensions] toggle failed:", err.message);
				}
				toggle.disabled = false;
			});

			top.appendChild(title);
			top.appendChild(toggle);
			card.appendChild(top);

			if (ext.description) {
				const d = document.createElement("div");
				d.style.cssText = "font-size:13px;margin-top:8px";
				d.textContent = ext.description;
				card.appendChild(d);
			}

			const perms = (ext.permissions || []).concat(ext.hostPermissions || []);
			if (perms.length) {
				const p = document.createElement("div");
				p.style.cssText = "font-size:12px;opacity:.7;margin-top:8px";
				p.textContent = "Permissions: " + perms.join(", ");
				card.appendChild(p);
			}

			const idEl = document.createElement("div");
			idEl.style.cssText = "font-size:11px;opacity:.55;margin-top:6px";
			idEl.textContent = "ID " + ext.id + "  |  Source: " + (ext.source || "unknown");
			card.appendChild(idEl);

			const actions = document.createElement("div");
			actions.style.cssText = "display:flex;gap:8px;margin-top:10px";

			const folderBtn = document.createElement("button");
			folderBtn.className = "setting-btn";
			folderBtn.textContent = "Copy folder path";
			folderBtn.addEventListener("click", async () => {
				const res = await globalThis.electronAPI.invoke("holly:extensions:open-folder", ext.id);
				showSuccess(res && res.ok ? "Profile folder opened; extension path copied" : "Could not locate folder");
			});

			const removeBtn = document.createElement("button");
			removeBtn.className = "setting-btn";
			removeBtn.textContent = "Remove";
			removeBtn.addEventListener("click", async () => {
				if (!confirm("Remove " + ext.name + "? This deletes its files.")) { return; }
				removeBtn.disabled = true;
				try {
					const res = await globalThis.electronAPI.invoke("holly:extensions:uninstall", ext.id);
					if (res && res.ok) { showSuccess("Removed " + ext.name); renderExtensions(); }
					else { removeBtn.disabled = false; showSuccess("Could not remove"); }
				} catch (err) {
					removeBtn.disabled = false;
					console.warn("[extensions] uninstall failed:", err.message);
				}
			});

			actions.appendChild(folderBtn);
			actions.appendChild(removeBtn);
			card.appendChild(actions);
			extensionsList.appendChild(card);
		});

		const sep = document.createElement("h3");
		sep.textContent = "Custom extensions";
		sep.style.margin = "18px 0 8px";
		extensionsList.appendChild(sep);
	}

	function renderExtensions() {
		// [NRS-1301]
		if (!extensionsList) return; // [NRS-1301]
		extensionsList.innerHTML = ""; // [NRS-1301]
		renderChromeExtensionsEdge(); // [SovereignBrowser] real Chrome extensions first
		if (!extensions.length) {
			// [NRS-1301]
			const p = document.createElement("p"); // [NRS-1301]
			p.textContent = "No custom extensions yet."; // [SovereignBrowser]
			p.style.color = "#666"; // [NRS-1301]
			p.style.padding = "8px"; // [NRS-1301]
			extensionsList.appendChild(p); // [NRS-1301]
			return; // [NRS-1301]
		} // [NRS-1301]
		for (const ext of extensions) {
			// [NRS-1301]
			const item = document.createElement("div"); // [NRS-1301]
			item.className = "extension-card"; // [NRS-1301]
			const header = document.createElement('div'); // [RESTORED]
			header.className = "extension-header"; // [NRS-1301]
			const icon = document.createElement('div'); // [RESTORED]
			icon.className = "extension-icon"; // [NRS-1301]
			icon.textContent = getExtensionIcon(ext); // [NRS-1301]
			const titleWrap = document.createElement('div'); // [RESTORED]
			titleWrap.className = "extension-title-wrap"; // [NRS-1301]
			const name = document.createElement('div'); // [RESTORED]
			name.className = "extension-name"; // [NRS-1301]
			name.textContent = ext.name; // [NRS-1301]
			const subtitle = document.createElement('div'); // [RESTORED]
			subtitle.className = "extension-subtitle"; // [NRS-1301]
			subtitle.textContent = (ext.matches || []).join(", ") || "All sites"; // [NRS-1301]
			titleWrap.appendChild(name); // [NRS-1301]
			titleWrap.appendChild(subtitle); // [NRS-1301]
			header.appendChild(icon); // [NRS-1301]
			header.appendChild(titleWrap); // [NRS-1301]
			const desc = document.createElement('div'); // [RESTORED]
			desc.className = "extension-desc"; // [NRS-1301]
			desc.textContent = ext.description || "No description provided."; // [NRS-1301]
			const meta = document.createElement('div'); // [RESTORED]
			meta.className = "extension-meta"; // [NRS-1301]
			meta.textContent = `ID: ${ext.id}`; // [NRS-1301]
			const actions = document.createElement('div'); // [RESTORED]
			actions.className = "extension-actions"; // [NRS-1301]
			const leftActions = document.createElement('div'); // [RESTORED]
			leftActions.className = "extension-actions-left"; // [NRS-1301]
			const rightActions = document.createElement('div'); // [RESTORED]
			rightActions.className = "extension-actions-right"; // [NRS-1301]
			const detailsBtn = document.createElement('button'); // [RESTORED]
			detailsBtn.className = "setting-btn"; // [NRS-1301]
			detailsBtn.textContent = "Details"; // [NRS-1301]
			detailsBtn.addEventListener("click", () => {
				// [NRS-1301]
				editingExtensionId = ext.id; // [NRS-1301]
				extensionEditorTitle.textContent = "Edit Extension"; // [NRS-1301]
				extNameInput.value = ext.name || ""; // [NRS-1301]
				extMatchesInput.value = (ext.matches || []).join(", "); // [NRS-1301]
				extCssInput.value = ext.css || ""; // [NRS-1301]
				extJsInput.value = ext.js || ""; // [NRS-1301]
				extensionEditorModal.classList.add("open"); // [NRS-1301]
			}); // [NRS-1301]
			const removeBtn = document.createElement('button'); // [RESTORED]
			removeBtn.className = "extension-remove"; // [NRS-1301]
			removeBtn.textContent = "Remove"; // [NRS-1301]
			removeBtn.addEventListener("click", () => {
				// [NRS-1301]
				extensions = extensions.filter((e) => e.id !== ext.id); // [NRS-1301]
				saveExtensions(); // [NRS-1301]
				renderExtensions(); // [NRS-1301]
				showSuccess("Extension removed"); // [NRS-1301]
				updateExtensionsCount(); // [NRS-1301]
				updatePinnedExtensionsUI(); // [NRS-1301]
			}); // [NRS-1301]
			const pinBtn = document.createElement('button'); // [RESTORED]
			pinBtn.className = "extension-pin"; // [NRS-1301]
			pinBtn.textContent = ext.pinned ? "??" : "??"; // [NRS-1301]
			pinBtn.title = ext.pinned ? "Unpin to Add-on Bar" : "Pin to Add-on Bar"; // [NRS-1301]
			pinBtn.addEventListener("click", () => {
				// [NRS-1301]
				ext.pinned = !ext.pinned; // [NRS-1301]
				saveExtensions(); // [NRS-1301]
				updatePinnedExtensionsUI(); // [NRS-1301]
				renderExtensions(); // [NRS-1301]
			}); // [NRS-1301]
			const toggleWrap = document.createElement('label'); // [RESTORED]
			toggleWrap.className = "switch"; // [NRS-1301]
			const toggle = document.createElement('input'); // [RESTORED]
			toggle.type = "checkbox"; // [NRS-1301]
			toggle.checked = !!ext.enabled; // [NRS-1301]
			const slider = document.createElement('span'); // [RESTORED]
			slider.className = "slider round"; // [NRS-1301]
			toggle.addEventListener("change", () => {
				// [NRS-1301]
				ext.enabled = toggle.checked; // [NRS-1301]
				saveExtensions(); // [NRS-1301]
				showSuccess(`${ext.name} ${ext.enabled ? "enabled" : "disabled"}`); // [NRS-1301]
				updateExtensionsCount(); // [NRS-1301]
				updatePinnedExtensionsUI(); // [NRS-1301]
			}); // [NRS-1301]
			toggleWrap.appendChild(toggle); // [NRS-1301]
			toggleWrap.appendChild(slider); // [NRS-1301]

			leftActions.appendChild(detailsBtn); // [NRS-1301]
			leftActions.appendChild(removeBtn); // [NRS-1301]
			rightActions.appendChild(pinBtn); // [NRS-1301]
			rightActions.appendChild(toggleWrap); // [NRS-1301]
			actions.appendChild(leftActions); // [NRS-1301]
			actions.appendChild(rightActions); // [NRS-1301]

			item.appendChild(header); // [NRS-1301]
			item.appendChild(desc); // [NRS-1301]
			item.appendChild(meta); // [NRS-1301]
			item.appendChild(actions); // [NRS-1301]
			extensionsList.appendChild(item); // [NRS-1301]
		} // [NRS-1301]
		updatePinnedExtensionsUI(); // [NRS-1301]
	} // [NRS-1301]

	function getExtensionIcon(ext) {
		// [NRS-1301]
		if (ext.icon) return ext.icon; // [NRS-1301]
		if ((ext.name || "").toLowerCase().includes("keychain")) return "??"; // [NRS-1301]
		return (ext.name || "").charAt(0).toUpperCase() || "??"; // [NRS-1301]
	} // [NRS-1301]

	function updatePinnedExtensionsUI() {
		// [NRS-1301]
		const slot = document.querySelector(".addon-right"); // [NRS-1301]
		if (!slot) return; // [NRS-1301]
		slot.innerHTML = ""; // [NRS-1301]
		extensions // [NRS-1301]
			.filter((ext) => ext.enabled && ext.pinned) // [NRS-1301]
			.forEach((ext) => {
				// [NRS-1301]
				const btn = document.createElement("button"); // [NRS-1301]
				btn.className = "addon-ext-btn"; // [NRS-1301]
				btn.textContent = getExtensionIcon(ext); // [NRS-1301]
				btn.title = `${ext.name} � click to manage`; // [NRS-1301]
				btn.addEventListener("click", openExtensions); // [NRS-1301]
				slot.appendChild(btn); // [NRS-1301]
			}); // [NRS-1301]
	} // [NRS-1301]

	function updateAddonPinUI() {
		// [NRS-1301]
		const addonBar = document.getElementById("addon-bar"); // [NRS-1301]
		if (!addonBar || !btnPinAddon) return; // [NRS-1301]
		addonBar.classList.toggle("pinned", addonPinned); // [NRS-1301]
		btnPinAddon.classList.toggle("pinned", addonPinned); // [NRS-1301]
		btnPinAddon.title = addonPinned ? "Unpin add-on bar" : "Pin add-on bar"; // [NRS-1301]
		try {
			localStorage.setItem(ADDON_PIN_KEY, addonPinned ? "true" : "false");
		} catch {} // [NRS-1301]
	} // [NRS-1301]
	updateAddonPinUI(); // [NRS-1301]

	function openExtensions() {
		// [NRS-1301]
		extensionsModal?.classList.add("open"); // [NRS-1301]
		renderExtensions(); // [NRS-1301]
	} // [NRS-1301]

	function closeExtensions() {
		// [NRS-1301]
		extensionsModal?.classList.remove("open"); // [NRS-1301]
	} // [NRS-1301]

	if (btnOpenExtensions) btnOpenExtensions.addEventListener("click", openExtensions); // [NRS-1301]
	if (btnCloseExtensions) btnCloseExtensions.addEventListener("click", closeExtensions); // [NRS-1301]
	if (btnExtensionsBar) btnExtensionsBar.addEventListener("click", openExtensions); // [NRS-1301]
	if (btnPinAddon)
		btnPinAddon.addEventListener("click", () => {
			addonPinned = !addonPinned;
			updateAddonPinUI();
		}); // [NRS-1301]

	if (btnCreateExtension)
		btnCreateExtension.addEventListener("click", () => {
			// [NRS-1301]
			editingExtensionId = null; // [NRS-1301]
			extensionEditorTitle.textContent = "Create Extension"; // [NRS-1301]
			extNameInput.value = ""; // [NRS-1301]
			extMatchesInput.value = ""; // [NRS-1301]
			extCssInput.value = ""; // [NRS-1301]
			extJsInput.value = ""; // [NRS-1301]
			extensionEditorModal.classList.add("open"); // [NRS-1301]
		}); // [NRS-1301]

	if (btnCancelExtension)
		btnCancelExtension.addEventListener("click", () => {
			// [NRS-1301]
			extensionEditorModal.classList.remove("open"); // [NRS-1301]
		}); // [NRS-1301]

	if (btnSaveExtension)
		btnSaveExtension.addEventListener("click", () => {
			// [NRS-1301]
			const name = extNameInput.value.trim() || "Untitled Extension"; // [NRS-1301]
			const matches = extMatchesInput.value.split(',').map(s => s.trim()).filter(Boolean); // [RESTORED]
			const css = extCssInput.value; // [RESTORED]
			const js = extJsInput.value; // [RESTORED]

			if (editingExtensionId) {
				// [NRS-1301]
				const ext = extensions.find((e) => e.id === editingExtensionId); // [NRS-1301]
				if (ext) {
					// [NRS-1301]
					ext.name = name;
					ext.matches = matches;
					ext.css = css;
					ext.js = js; // [NRS-1301]
				} // [NRS-1301]
			} else {
				// [NRS-1301]
				const id = Date.now(); // [NRS-1301]
				extensions.push({ id, name, matches, css, js, enabled: true }); // [NRS-1301]
			} // [NRS-1301]
			saveExtensions(); // [NRS-1301]
			renderExtensions(); // [NRS-1301]
			extensionEditorModal.classList.remove("open"); // [NRS-1301]
			showSuccess("Extension saved"); // [NRS-1301]
			updateExtensionsCount(); // [NRS-1301]
			updatePinnedExtensionsUI(); // [NRS-1301]
		}); // [NRS-1301]

	if (btnInstallSampleExt)
		btnInstallSampleExt.addEventListener("click", () => {
			// [NRS-1301]
			const samples = [
				// [NRS-1301]
				{
					// [NRS-1301]
					id: Date.now(), // [NRS-1301]
					name: "Dark Reader Lite", // [NRS-1301]
					matches: ["*://*/*"], // [NRS-1301]
					css: "html{filter: invert(0.9) hue-rotate(180deg)} img,video,canvas{filter: invert(1) hue-rotate(180deg)}", // [NRS-1301]
					js: "", // [NRS-1301]
					enabled: false, // [NRS-1301]
					description: "Invert sites for a quick dark mode.", // [NRS-1301]
				}, // [NRS-1301]
				{
					// [NRS-1301]
					id: Date.now() + 1, // [NRS-1301]
					name: "Hide Common Ads", // [NRS-1301]
					matches: ["*://*/*"], // [NRS-1301]
					css: '[id*="ad" i],[class*="ad" i],[class*="ads" i],[class*="advert" i]{display:none!important}', // [NRS-1301]
					js: "", // [NRS-1301]
					enabled: false, // [NRS-1301]
					description: "Remove common ad containers on most pages.", // [NRS-1301]
				}, // [NRS-1301]
				{
					// [NRS-1301]
					id: Date.now() + 2, // [NRS-1301]
					name: "Keychain Passwords", // [NRS-1301]
					matches: ["*://*/*"], // [NRS-1301]
					css: "", // [NRS-1301]
					js: "", // [NRS-1301]
					enabled: false, // [NRS-1301]
					icon: "??", // [NRS-1301]
					pinned: true, // [NRS-1301]
					description: "Autofill and manage passwords from your keychain.", // [NRS-1301]
				}, // [NRS-1301]
			]; // [NRS-1301]
			// Merge without duplicates by name // [NRS-1301]
			for (const s of samples) {
				// [NRS-1301]
				if (!extensions.some((e) => e.name === s.name)) extensions.push(s); // [NRS-1301]
			} // [NRS-1301]
			saveExtensions(); // [NRS-1301]
			renderExtensions(); // [NRS-1301]
			openExtensions(); // [NRS-1301]
			showSuccess("Sample extensions installed"); // [NRS-1301]
			updateExtensionsCount(); // [NRS-1301]
			updatePinnedExtensionsUI(); // [NRS-1301]
		}); // [NRS-1301]

	function updateExtensionsCount() {
		// [NRS-1301]
		if (!extensionsCount) return; // [NRS-1301]
		const enabled = extensions.filter((e) => e.enabled).length; // [NRS-1301]
		extensionsCount.textContent = `${enabled} enabled`; // [NRS-1301]
	} // [NRS-1301]
	updateExtensionsCount(); // [NRS-1301]
	updatePinnedExtensionsUI(); // [NRS-1301]

	// Unpacked import: read manifest.json and referenced files // [NRS-1301]
	async function importUnpackedFromFiles(fileList) {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const files = Array.from(fileList); // [NRS-1301]
			const manifestFile = files.find((f) => f.name.toLowerCase() === "manifest.json"); // [NRS-1301]
			if (!manifestFile) {
				showError("manifest.json not found");
				return;
			} // [NRS-1301]
			const manifestText = await manifestFile.text(); // [NRS-1301]
			const manifest = JSON.parse(manifestText); // [RESTORED]
			const name = manifest.name || 'Unpacked Extension'; // [RESTORED]
			const matches = manifest.matches || manifest.match || []; // [RESTORED]
			let css = ''; // [RESTORED]
			let js = ''; // [RESTORED]
			if (manifest.css) {
				// [NRS-1301]
				// css can be a string path or array // [NRS-1301]
				const cssPaths = Array.isArray(manifest.css) ? manifest.css : [manifest.css]; // [NRS-1301]
				for (const p of cssPaths) {
					// [NRS-1301]
					const f = files.find((ff) => ff.name === p || ff.webkitRelativePath?.endsWith("/" + p)); // [NRS-1301]
					if (f) css += "\n" + (await f.text()); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
			if (manifest.js) {
				// [NRS-1301]
				const jsPaths = Array.isArray(manifest.js) ? manifest.js : [manifest.js]; // [NRS-1301]
				for (const p of jsPaths) {
					// [NRS-1301]
					const f = files.find((ff) => ff.name === p || ff.webkitRelativePath?.endsWith("/" + p)); // [NRS-1301]
					if (f) js += "\n" + (await f.text()); // [NRS-1301]
				} // [NRS-1301]
			} // [NRS-1301]
			const id = Date.now(); // [NRS-1301]
			extensions.push({ id, name, matches, css, js, enabled: true }); // [NRS-1301]
			saveExtensions(); // [NRS-1301]
			renderExtensions(); // [NRS-1301]
			showSuccess("Unpacked extension loaded"); // [NRS-1301]
			updateExtensionsCount(); // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			showError("Failed to load unpacked: " + (err?.message || "Unknown error")); // [NRS-1301]
		} // [NRS-1301]
	} // [NRS-1301]

	if (btnLoadUnpacked && inputUnpacked) {
		// [NRS-1301]
		btnLoadUnpacked.addEventListener("click", () => inputUnpacked.click()); // [NRS-1301]
		inputUnpacked.addEventListener("change", async (e) => {
			// [NRS-1301]
			const files = e.target.files; // [NRS-1301]
			if (files?.length) {
				// [NRS-1301]
				await importUnpackedFromFiles(files); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnImportPacked && inputPacked) {
		// [NRS-1301]
		btnImportPacked.addEventListener("click", () => inputPacked.click()); // [NRS-1301]
		inputPacked.addEventListener("change", async (e) => {
			// [NRS-1301]
			const file = e.target.files?.[0]; // [NRS-1301]
			if (!file) return; // [NRS-1301]
			try {
				// [NRS-1301]
				const text = await file.text(); // [NRS-1301]
				const pack = JSON.parse(text); // [RESTORED]
				// Support single extension or array // [NRS-1301]
				const list = Array.isArray(pack) ? pack : [pack]; // [NRS-1301]
				for (const ext of list) {
					// [NRS-1301]
					if (!extensions.some((e) => e.name === ext.name)) {
						// [NRS-1301]
						extensions.push({
							id: Date.now() + Math.random(),
							name: ext.name,
							matches: ext.matches || [],
							css: ext.css || "",
							js: ext.js || "",
							enabled: !!ext.enabled,
						}); // [NRS-1301]
					} // [NRS-1301]
				} // [NRS-1301]
				saveExtensions(); // [NRS-1301]
				renderExtensions(); // [NRS-1301]
				showSuccess("Packed extensions imported"); // [NRS-1301]
				updateExtensionsCount(); // [NRS-1301]
			} catch (err) {
				// [NRS-1301]
				showError("Failed to import packed: " + (err?.message || "Unknown")); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnExportPacked) {
		// [NRS-1301]
		btnExportPacked.addEventListener("click", () => {
			// [NRS-1301]
			try {
				// [NRS-1301]
				const data = JSON.stringify(extensions, null, 2); // [NRS-1301]
				const blob = new Blob([data], { type: 'application/json' }); // [RESTORED]
				const url = URL.createObjectURL(blob); // [RESTORED]
				const a = document.createElement('a'); // [RESTORED]
				a.href = url; // [NRS-1301]
				a.download = "extensions-pack.json"; // [NRS-1301]
				document.body.appendChild(a); // [NRS-1301]
				a.click(); // [NRS-1301]
				document.body.removeChild(a); // [NRS-1301]
				URL.revokeObjectURL(url); // [NRS-1301]
				showSuccess("Extensions exported"); // [NRS-1301]
			} catch (err) {
				// [NRS-1301]
				showError("Failed to export: " + (err?.message || "Unknown error")); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	btnSetDefaultBrowser.addEventListener("click", async () => {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const result = await globalThis.electronAPI.setDefaultBrowser?.(); // [NRS-1301]
			if (result?.success) {
				// [NRS-1301]
				defaultBrowserStatus.textContent = "? HOLLY is now your default browser!"; // [NRS-1301]
				defaultBrowserStatus.style.color = "green"; // [NRS-1301]
			} else {
				// [NRS-1301]
				defaultBrowserStatus.textContent =
					"? Failed to set as default browser. You may need admin rights."; // [NRS-1301]
				defaultBrowserStatus.style.color = "red"; // [NRS-1301]
			} // [NRS-1301]
		} catch (err) {
			// [NRS-1301]
			defaultBrowserStatus.textContent = "? Error: " + (err?.message || "Unknown error"); // [NRS-1301]
			defaultBrowserStatus.style.color = "red"; // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

	if (toggleSiteNotifications) {
		// [NRS-1301]
		toggleSiteNotifications.addEventListener("change", () => {
			// [NRS-1301]
			const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
			const currentUrl = tab?.webview.getURL?.() || tab?.webview.src || ""; // [RESTORED]
			const origin = getOrigin(currentUrl); // [RESTORED]
			const setting = loadSiteSetting(origin); // [RESTORED]
			setting.notificationsAllowed = toggleSiteNotifications.checked; // [NRS-1301]
			saveSiteSetting(origin, setting); // [NRS-1301]
			applySitePermissions(tab, origin); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	// Privacy settings event listeners // [NRS-1301]
	if (toggleAutoClear) {
		// [NRS-1301]
		toggleAutoClear.addEventListener("change", () => {
			// [NRS-1301]
			privacySettings.autoClear = toggleAutoClear.checked; // [NRS-1301]
			savePrivacySettings(); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (toggleBlockThirdPartyCookies) {
		// [NRS-1301]
		toggleBlockThirdPartyCookies.addEventListener("change", () => {
			// [NRS-1301]
			privacySettings.blockThirdPartyCookies = toggleBlockThirdPartyCookies.checked; // [NRS-1301]
			savePrivacySettings(); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (toggleDoNotTrack) {
		// [NRS-1301]
		toggleDoNotTrack.addEventListener("change", () => {
			// [NRS-1301]
			privacySettings.doNotTrack = toggleDoNotTrack.checked; // [NRS-1301]
			savePrivacySettings(); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (toggleTrackingProtection) {
		// [NRS-1301]
		toggleTrackingProtection.addEventListener("change", () => {
			// [NRS-1301]
			privacySettings.trackingProtection = toggleTrackingProtection.checked; // [NRS-1301]
			savePrivacySettings(); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnViewCookies) {
		// [NRS-1301]
		btnViewCookies.addEventListener("click", () => {
			// [NRS-1301]
			showCookieManager(); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnCloseCookies) {
		// [NRS-1301]
		btnCloseCookies.addEventListener("click", () => {
			// [NRS-1301]
			cookieModal.classList.remove("show"); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnDeleteSelectedCookies) {
		// [NRS-1301]
		btnDeleteSelectedCookies.addEventListener("click", () => {
			// [NRS-1301]
			deleteSelectedCookies(); // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnDeleteAllCookies) {
		// [NRS-1301]
		btnDeleteAllCookies.addEventListener("click", () => {
			// [NRS-1301]
			if (confirm("Delete all cookies? This cannot be undone.")) {
				// [NRS-1301]
				deleteAllCookies(); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnClearSiteData) {
		// [NRS-1301]
		btnClearSiteData.addEventListener("click", async () => {
			// [NRS-1301]
			const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
			const currentUrl = tab?.webview.getURL?.() || tab?.webview.src || ''; // [RESTORED]
			const origin = getOrigin(currentUrl); // [RESTORED]
			const msg = await clearSiteDataForOrigin(origin); // [RESTORED]
			if (msg.includes("Cleared")) {
				// [NRS-1301]
				showSuccess(msg); // [NRS-1301]
			} else {
				// [NRS-1301]
				showError(msg); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	if (btnClearAllData) {
		// [NRS-1301]
		btnClearAllData.addEventListener("click", async () => {
			// [NRS-1301]
			const msg = await clearAllBrowsingData(); // [NRS-1301]
			if (msg.includes("Cleared")) {
				// [NRS-1301]
				showSuccess(msg); // [NRS-1301]
			} else {
				// [NRS-1301]
				showError(msg); // [NRS-1301]
			} // [NRS-1301]
		}); // [NRS-1301]
	} // [NRS-1301]

	// Initialize voice recognition so the mic button can start listening // [NRS-1301]
	initVoiceRecognition(); // [NRS-1301]

	// Menu bar actions // [NRS-1301]
	function handleMenuAction(action) {
		// [NRS-1301]
		const actionMap = {
			// [NRS-1301]
			"new-tab": () => createTab(DEFAULT_HOME), // [NRS-1301]
			"new-window": () => {
				// [NRS-1301]
				try {
					// [NRS-1301]
					if (globalThis.electronAPI?.openNewWindow) globalThis.electronAPI.openNewWindow(); // else createTab(DEFAULT_HOME); // [NRS-1301]
				} catch {
					createTab(DEFAULT_HOME);
				} // [NRS-1301]
			}, // [NRS-1301]
			"new-incognito": () => createTab(DEFAULT_HOME, { incognito: true }), // [NRS-1301]
			"close-tab": () => {
				// [NRS-1301]
				if (activeTabId) closeTab(activeTabId); // [NRS-1301]
			}, // [NRS-1301]
			"close-window": () => {
				// [NRS-1301]
				try {
					globalThis.electronAPI?.closeWindow?.();
				} catch {} // [NRS-1301]
			}, // [NRS-1301]
			"exit-app": () => {
				// [NRS-1301]
				try {
					globalThis.electronAPI?.exitApp?.();
				} catch {} // [NRS-1301]
			}, // [NRS-1301]
			undo: () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab?.webview?.undo) tab.webview.undo(); // [NRS-1301]
			}, // [NRS-1301]
			redo: () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab?.webview?.redo) tab.webview.redo(); // [NRS-1301]
			}, // [NRS-1301]
			cut: () => document.execCommand("cut"), // [NRS-1301]
			copy: () => document.execCommand("copy"), // [NRS-1301]
			paste: () => document.execCommand("paste"), // [NRS-1301]
			find: () => showFindBar(), // [NRS-1301]
			settings: () => {
				// [NRS-1301]
				settingsModal.classList.add("open"); // [NRS-1301]
				updatePrivacyUI(omnibox.value); // [NRS-1301]
			}, // [NRS-1301]
			reload: () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab) tab.webview.reload(); // [NRS-1301]
			}, // [NRS-1301]
			"full-screen": () => {
				// [NRS-1301]
				if (!document.fullscreenElement) {
					// [NRS-1301]
					document.documentElement.requestFullscreen().catch((err) => console.error(err)); // [NRS-1301]
				} else {
					// [NRS-1301]
					document.exitFullscreen(); // [NRS-1301]
				} // [NRS-1301]
			}, // [NRS-1301]
			"zoom-in": () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab?.webview?.setZoomLevel) {
					// [NRS-1301]
					const current = tab.webview.getZoomLevel?.() || 0; // [NRS-1301]
					tab.webview.setZoomLevel(current + 0.1); // [NRS-1301]
				} // [NRS-1301]
			}, // [NRS-1301]
			"zoom-out": () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab?.webview?.setZoomLevel) {
					// [NRS-1301]
					const current = tab.webview.getZoomLevel?.() || 0; // [NRS-1301]
					tab.webview.setZoomLevel(current - 0.1); // [NRS-1301]
				} // [NRS-1301]
			}, // [NRS-1301]
			"zoom-reset": () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab?.webview?.setZoomLevel) tab.webview.setZoomLevel(0); // [NRS-1301]
			}, // [NRS-1301]
			devtools: () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab) tab.webview.openDevTools({ mode: "detach" }); // [NRS-1301]
			}, // [NRS-1301]
			"go-back": () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab?.webview.canGoBack?.()) tab.webview.goBack(); // [NRS-1301]
			}, // [NRS-1301]
			"go-forward": () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (tab?.webview.canGoForward?.()) tab.webview.goForward(); // [NRS-1301]
			}, // [NRS-1301]
			"clear-history": async () => {
				// [NRS-1301]
				try {
					await globalThis.electronAPI.history.clear();
					renderHistory();
				} catch {} // [NRS-1301]
			}, // [NRS-1301]
			"bookmark-page": async () => {
				// [NRS-1301]
				const tab = tabs.find((t) => t.id === activeTabId); // [NRS-1301]
				if (!tab) return; // [NRS-1301]
				const url = tab.webview.getURL?.() || tab.webview.src || ''; // [RESTORED]
				const title = tab.titleEl.textContent || url; // [RESTORED]
				try {
					// [NRS-1301]
					await globalThis.electronAPI.bookmarks.add({ title, url }); // [NRS-1301]
					renderBookmarks(); // [NRS-1301]
					renderBookmarksMenu(); // [NRS-1301]
				} catch {} // [NRS-1301]
			}, // [NRS-1301]
			about: () => {
				// [NRS-1301]
				addJarvisMessage(
					"HOLLY v1.0 - A lightweight, Electron-based web browser with AI assistance via Jarvis.",
					false,
				); // [NRS-1301]
			}, // [NRS-1301]
			"report-issue": () => {
				// [NRS-1301]
				addJarvisMessage(
					"To report an issue, please create a GitHub issue or contact the development team.",
					false,
				); // [NRS-1301]
			}, // [NRS-1301]
		}; // [NRS-1301]
		const handler = actionMap[action]; // [RESTORED]
		if (handler) handler(); // [NRS-1301]
	} // [NRS-1301]

	async function renderBookmarksMenu() {
		// [NRS-1301]
		try {
			// [NRS-1301]
			const list = await globalThis.electronAPI.bookmarks.get(); // [NRS-1301]
			bookmarksMenuList.innerHTML = ""; // [NRS-1301]
			for (const b of list.slice().reverse()) {
				// [NRS-1301]
				const div = document.createElement("div"); // [NRS-1301]
				div.className = "menu-option"; // [NRS-1301]
				div.textContent = b.title; // [NRS-1301]
				div.addEventListener("click", (e) => {
					// [NRS-1301]
					e.stopPropagation(); // [NRS-1301]
					const tab = tabs.find(t => t.id === activeTabId); // [RESTORED]
					if (tab) tab.webview.src = b.url; // [NRS-1301]
				}); // [NRS-1301]
				bookmarksMenuList.appendChild(div); // [NRS-1301]
			} // [NRS-1301]
		} catch {} // [NRS-1301]
	} // [NRS-1301]

	document.querySelectorAll(".menu-option").forEach((option) => {
		// [NRS-1301]
		option.addEventListener("click", (e) => {
			// [NRS-1301]
			const action = e.target.dataset.action; // [NRS-1301]
			if (action) handleMenuAction(action); // [NRS-1301]
		}); // [NRS-1301]
	}); // [NRS-1301]

	// Initialize: restore session or create first tab // [NRS-1301]
	const sessionRestored = restoreSession(); // [NRS-1301]
	if (!sessionRestored) {
		// [NRS-1301]
		createTab(DEFAULT_HOME); // [NRS-1301]
	} // [NRS-1301]
	renderHistory(); // [NRS-1301]
	renderBookmarksMenu(); // [NRS-1301]
	updateAutoDevtoolsButton(); // [NRS-1301]

	// Save session periodically and on window close // [NRS-1301]
	setInterval(saveSession, 30000); // Save every 30 seconds // [NRS-1301]
	window.addEventListener("beforeunload", async () => {
		// [NRS-1301]
		saveSession(); // [NRS-1301]

		// Auto-clear browsing data if enabled // [NRS-1301]
		if (privacySettings.autoClear) {
			// [NRS-1301]
			try {
				// [NRS-1301]
				await clearAllBrowsingData(); // [NRS-1301]
				localStorage.removeItem(SESSION_KEY); // Don't restore session if cleared // [NRS-1301]
			} catch (err) {
				// [NRS-1301]
				console.error("Failed to auto-clear data:", err); // [NRS-1301]
			} // [NRS-1301]
		} // [NRS-1301]
	}); // [NRS-1301]

})(); // [NRS-1301]