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

	// Backing B: WebContentsView, owned by the main process. Commands cross
	// the IPC boundary; reads stay synchronous against the mirrored state
	// cache, refreshed by the nav snapshot the main process attaches to every
	// forwarded event.
	function createWebContentsViewBacking(options) {
		var api = global.electronAPI;
		if (!api || typeof api.invoke !== "function" || typeof api.on !== "function") {
			throw new Error("createWebContentsViewBacking requires electronAPI.invoke and electronAPI.on");
		}
		if (!options || typeof options.id !== "number") {
			throw new Error("createWebContentsViewBacking requires a numeric tab id");
		}

		var id = options.id;
		var state = createStateCache();
		state.zoomLevel = 0;
		var listeners = new Map();
		var attrs = new Map();
		var placeholderEl = null;
		var compat = null;

		function emit(event, payload) {
			var fns = listeners.get(event);
			if (!fns) { return; }
			fns.forEach(function (fn) {
				try {
					fn(payload);
				} catch (err) {
					console.warn("[tab " + id + "] listener for", event, "threw:", err && err.message);
				}
			});
		}

		function cmd(method, args) {
			return api.invoke("tab:cmd", { id: id, method: method, args: args || [] }).then(function (res) {
				if (!res || !res.ok) {
					throw new Error((res && res.error) || ("tab:cmd " + method + " failed"));
				}
				return res.result;
			});
		}

		function fireAndForget(method, args) {
			cmd(method, args).catch(function (err) {
				console.warn("[tab " + id + "] " + method + " failed:", err && err.message);
			});
		}

		function handleMainEvent(event, payload, nav) {
			if (nav) {
				if (typeof nav.url === "string" && nav.url) { state.url = nav.url; }
				if (typeof nav.title === "string" && nav.title) { state.title = nav.title; }
				state.canGoBack = !!nav.canGoBack;
				state.canGoForward = !!nav.canGoForward;
				state.isLoading = !!nav.isLoading;
			}
			if (event === "did-start-loading") { state.isLoading = true; }
			if (event === "did-stop-loading") { state.isLoading = false; }
			if (event === "dom-ready") {
				state.domReady = true;
				if (compat) { compat.__domReady = true; }
			}
			if (event === "page-title-updated" && payload && payload.title) { state.title = payload.title; }
			emit(event, payload || {});
		}

		api.invoke("tab:create", { id: id, incognito: !!options.incognito }).then(function (res) {
			if (!res || !res.ok) {
				console.error("[tab " + id + "] main-process view creation failed:", (res && res.error) || "unknown");
			}
		}).catch(function (err) {
			console.error("[tab " + id + "] tab:create failed:", err && err.message);
		});

		var backing = {
			kind: "wcv",
			state: state,
			id: id,

			on: function (event, fn) {
				if (!listeners.has(event)) { listeners.set(event, new Set()); }
				listeners.get(event).add(fn);
			},
			off: function (event, fn) {
				var fns = listeners.get(event);
				if (fns) { fns.delete(fn); }
			},

			getURL: function () { return state.url || ""; },
			getTitle: function () { return state.title; },
			canGoBack: function () { return state.canGoBack; },
			canGoForward: function () { return state.canGoForward; },
			isLoading: function () { return state.isLoading; },
			isReady: function () { return state.domReady; },

		loadURL: function (url) {
				state.url = url;
				api.invoke("tab:load", { id: id, url: url }).then(function (res) {
					if (!res || !res.ok) { console.warn("[tab " + id + "] load rejected:", (res && res.error) || "unknown"); }
				}).catch(function (err) {
					console.warn("[tab " + id + "] tab:load failed:", err && err.message);
				});
			},
			reload: function () { fireAndForget("reload"); },
			goBack: function () {
				api.invoke("tab:back", { id: id }).catch(function (err) { console.warn("[tab " + id + "] back failed:", err && err.message); });
			},
			goForward: function () {
				api.invoke("tab:forward", { id: id }).catch(function (err) { console.warn("[tab " + id + "] forward failed:", err && err.message); });
			},
			stop: function () { fireAndForget("stop"); },
			focus: function () { fireAndForget("focus"); },

			executeJavaScript: function (code, userGesture) { return cmd("executeJavaScript", [code, !!userGesture]); },
			insertCSS: function (css) { return cmd("insertCSS", [css]); },
			setZoomLevel: function (level) { state.zoomLevel = level; fireAndForget("setZoomLevel", [level]); },
			getZoomLevel: function () { return state.zoomLevel; },
			openDevTools: function (opts) { fireAndForget("openDevTools", opts ? [opts] : []); },
			closeDevTools: function () { fireAndForget("closeDevTools"); },
			findInPage: function (text, opts) { fireAndForget("findInPage", opts ? [text, opts] : [text]); return 0; },
			stopFindInPage: function (action) { fireAndForget("stopFindInPage", [action || "clearSelection"]); },
			downloadURL: function (url) { fireAndForget("downloadURL", [url]); },
			print: function (opts) { fireAndForget("print", opts ? [opts] : []); },

			cut: function () { fireAndForget("cut"); },
			copy: function () { fireAndForget("copy"); },
			paste: function () { fireAndForget("paste"); },
			undo: function () { fireAndForget("undo"); },
			redo: function () { fireAndForget("redo"); },
			selectAll: function () { fireAndForget("selectAll"); },

			show: function () { if (placeholderEl) { placeholderEl.style.display = ""; } },
			hide: function () { if (placeholderEl) { placeholderEl.style.display = "none"; } },
			setBounds: function () { /* the layout pump owns geometry */ },
			destroy: function () {
				api.invoke("tab:destroy", { id: id }).catch(function (err) {
					console.warn("[tab " + id + "] destroy failed:", err && err.message);
				});
			},

			__handleMainEvent: handleMainEvent,

			compatElement: function (el) {
				placeholderEl = el;
				compat = buildCompatElement(backing, el, attrs);
				return compat;
			},
		};
		return backing;
	}

	// A <webview>-shaped shim over a WebContentsView backing plus its
	// placeholder div, so the existing tab.webview call sites keep working
	// unchanged. DOM-ish members route to the placeholder; engine members
	// route to the backing.
	function buildCompatElement(backing, el, attrs) {
		var shim = {
			getURL: function () { return backing.getURL(); },
			getTitle: function () { return backing.getTitle(); },
			canGoBack: function () { return backing.canGoBack(); },
			canGoForward: function () { return backing.canGoForward(); },
			isLoading: function () { return backing.isLoading(); },
			loadURL: function (u) { backing.loadURL(u); },
			reload: function () { backing.reload(); },
			goBack: function () { backing.goBack(); },
			goForward: function () { backing.goForward(); },
			stop: function () { backing.stop(); },
			focus: function () { backing.focus(); },
			executeJavaScript: function (code, ug) { return backing.executeJavaScript(code, ug); },
			insertCSS: function (css) { return backing.insertCSS(css); },
			setZoomLevel: function (l) { backing.setZoomLevel(l); },
			getZoomLevel: function () { return backing.getZoomLevel(); },
			openDevTools: function (o) { backing.openDevTools(o); },
			closeDevTools: function () { backing.closeDevTools(); },
			findInPage: function (t, o) { return backing.findInPage(t, o); },
			stopFindInPage: function (a) { backing.stopFindInPage(a); },
			downloadURL: function (u) { backing.downloadURL(u); },
			print: function (o) { backing.print(o); },
			cut: function () { backing.cut(); },
			copy: function () { backing.copy(); },
			paste: function () { backing.paste(); },
			undo: function () { backing.undo(); },
			redo: function () { backing.redo(); },
			selectAll: function () { backing.selectAll(); },
			addEventListener: function (ev, fn) { backing.on(ev, fn); },
			removeEventListener: function (ev, fn) { backing.off(ev, fn); },
			setAttribute: function (k, v) {
				attrs.set(k, v);
				if (k === "src") { backing.loadURL(v); }
			},
			getAttribute: function (k) { return attrs.has(k) ? attrs.get(k) : null; },
			getBoundingClientRect: function () { return el.getBoundingClientRect(); },
			remove: function () {
				backing.destroy();
				try { el.remove(); } catch (err) { console.warn("[tab " + backing.id + "] placeholder remove failed:", err && err.message); }
			},
			__domReady: false,
		};
		Object.defineProperties(shim, {
			src: {
				get: function () { return backing.getURL() || attrs.get("src") || ""; },
				set: function (v) { attrs.set("src", v); backing.loadURL(v); },
			},
			style: { get: function () { return el.style; } },
			classList: { get: function () { return el.classList; } },
			className: {
				get: function () { return el.className; },
				set: function (v) { el.className = v; },
			},
			dataset: { get: function () { return el.dataset; } },
			parentElement: { get: function () { return el.parentElement; } },
			isConnected: { get: function () { return el.isConnected; } },
			__el: { get: function () { return el; } },
		});
		return shim;
	}


	global.HollyTabBacking = {
		TAB_EVENTS: TAB_EVENTS,
		createWebviewBacking: createWebviewBacking,
		createWebContentsViewBacking: createWebContentsViewBacking,
	};
})(globalThis);
