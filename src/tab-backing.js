/**
 * [SovereignBrowser] Tab backing abstraction.
 *
 * WHY THIS EXISTS
 * ---------------
 * HOLLY's tabs are currently <webview> elements. Electron's own documentation
 * says "We currently recommend to not use the webview tag", warns of dramatic
 * architectural changes affecting rendering, navigation and event routing, and
 * gives no guarantee it remains available. That conflicts with this project's
 * non-negotiable requirement that the engine stay patchable.
 *
 * The sanctioned replacement is WebContentsView. The awkward part is not the
 * API surface: of 167 webview references in renderer.js, only about 25 are
 * genuinely DOM-specific (src, style, classList, remove, getBoundingClientRect,
 * addEventListener, setAttribute). Everything else - executeJavaScript, getURL,
 * reload, goBack, findInPage, setZoomLevel, cut/copy/paste - is webContents API
 * that exists identically on WebContentsView.
 *
 * The awkward part is WHERE THE OBJECT LIVES:
 *   <webview>        -> a DOM element in the renderer. Reads are synchronous.
 *   WebContentsView  -> owned by the main process. Reads are async IPC.
 *
 * renderer.js reads getURL() and canGoBack() synchronously in ~13 places. Those
 * cannot become promises without touching every call site, so this abstraction
 * keeps a MIRRORED STATE CACHE in the renderer, refreshed from navigation
 * events. Sync reads stay sync; only commands cross the IPC boundary.
 *
 * This file ships with the webview backing wired up and the WebContentsView
 * backing stubbed, so the abstraction lands with zero behavioural change and
 * can be verified before the engine underneath is swapped.
 */

(function (global) {
	"use strict";

	var TAB_EVENTS = [
		"did-start-loading",
		"did-stop-loading",
		"did-navigate",
		"did-navigate-in-page",
		"did-fail-load",
		"dom-ready",
		"page-title-updated",
		"found-in-page",
		"context-menu",
		"console-message",
	];

	function createStateCache() {
		return {
			url: "",
			title: "",
			canGoBack: false,
			canGoForward: false,
			isLoading: false,
			domReady: false,
		};
	}

	function createWebviewBacking(webviewEl) {
		if (!webviewEl) {
			throw new Error("createWebviewBacking requires a <webview> element");
		}

		var state = createStateCache();
		var listeners = new Map();

		function emit(event, payload) {
			var fns = listeners.get(event);
			if (!fns) { return; }
			fns.forEach(function (fn) {
				try {
					fn(payload);
				} catch (err) {
					console.warn("[tab] listener for", event, "threw:", err && err.message);
				}
			});
		}

		function refreshNavigationState() {
			try {
				state.url = (webviewEl.getURL && webviewEl.getURL()) || webviewEl.src || "";
				state.canGoBack = !!(webviewEl.canGoBack && webviewEl.canGoBack());
				state.canGoForward = !!(webviewEl.canGoForward && webviewEl.canGoForward());
			} catch (err) {
				state.canGoBack = false;
				state.canGoForward = false;
			}
		}

		TAB_EVENTS.forEach(function (event) {
			webviewEl.addEventListener(event, function (e) {
				if (event === "did-start-loading") { state.isLoading = true; }
				if (event === "did-stop-loading") { state.isLoading = false; refreshNavigationState(); }
				if (event === "did-navigate" || event === "did-navigate-in-page") { refreshNavigationState(); }
				if (event === "dom-ready") { state.domReady = true; refreshNavigationState(); }
				if (event === "page-title-updated" && e && e.title) { state.title = e.title; }
				emit(event, e);
			});
		});

		return {
			kind: "webview",
			state: state,

			get element() { return webviewEl; },

			on: function (event, fn) {
				if (!listeners.has(event)) { listeners.set(event, new Set()); }
				listeners.get(event).add(fn);
			},
			off: function (event, fn) {
				var fns = listeners.get(event);
				if (fns) { fns.delete(fn); }
			},

			getURL: function () { return state.url || webviewEl.src || ""; },
			getTitle: function () { return state.title; },
			canGoBack: function () { return state.canGoBack; },
			canGoForward: function () { return state.canGoForward; },
			isLoading: function () { return state.isLoading; },
			isReady: function () { return state.domReady; },

			loadURL: function (url) { state.url = url; webviewEl.src = url; },
			reload: function () { webviewEl.reload(); },
			goBack: function () { if (state.canGoBack) { webviewEl.goBack(); } },
			goForward: function () { if (state.canGoForward) { webviewEl.goForward(); } },
			stop: function () { if (webviewEl.stop) { webviewEl.stop(); } },
			focus: function () { webviewEl.focus(); },

			executeJavaScript: function (code) {
				if (!state.domReady) { return Promise.reject(new Error("webview not ready")); }
				return webviewEl.executeJavaScript(code);
			},
			insertCSS: function (css) { return webviewEl.insertCSS(css); },
			setZoomLevel: function (level) { webviewEl.setZoomLevel(level); },
			getZoomLevel: function () { return webviewEl.getZoomLevel(); },
			openDevTools: function (opts) { webviewEl.openDevTools(opts); },
			closeDevTools: function () { webviewEl.closeDevTools(); },
			findInPage: function (text, opts) { return webviewEl.findInPage(text, opts); },
			stopFindInPage: function (action) { webviewEl.stopFindInPage(action); },
			downloadURL: function (url) { webviewEl.downloadURL(url); },
			print: function (opts) { webviewEl.print(opts); },

			cut: function () { webviewEl.cut(); },
			copy: function () { webviewEl.copy(); },
			paste: function () { webviewEl.paste(); },
			undo: function () { webviewEl.undo(); },
			redo: function () { webviewEl.redo(); },
			selectAll: function () { webviewEl.selectAll(); },

			// With <webview> these are free: it is a DOM element, so CSS positions
			// it. With WebContentsView they become main-process setBounds calls
			// driven by the renderer's layout. That is the real migration cost.
			show: function () { webviewEl.style.display = ""; },
			hide: function () { webviewEl.style.display = "none"; },
			setBounds: function () { /* no-op: CSS handles this for webview */ },
			destroy: function () {
				try {
					webviewEl.remove();
				} catch (err) {
					console.warn("[tab] could not remove webview:", err && err.message);
				}
			},
		};
	}

	// Backing B: WebContentsView, owned by the main process. Deliberately not
	// implemented yet, so the abstraction can be proven in place first and the
	// swap stays a one-file change rather than a rewrite.
	function createWebContentsViewBacking() {
		throw new Error(
			"WebContentsView backing not implemented yet. Landing the abstraction " +
			"first so the swap is isolated and reversible."
		);
	}

	global.HollyTabBacking = {
		TAB_EVENTS: TAB_EVENTS,
		createWebviewBacking: createWebviewBacking,
		createWebContentsViewBacking: createWebContentsViewBacking,
	};
})(globalThis);
