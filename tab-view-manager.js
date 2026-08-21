/**
 * [SovereignBrowser] Main-process tab view manager.
 *
 * Owns one WebContentsView per renderer tab id. The renderer remains the
 * source of truth for WHICH tabs exist and WHERE they sit (it measures a
 * placeholder <div class="webview"> per tab and streams layout diffs here);
 * this module is the source of truth for the live web content.
 *
 * Every navigation-relevant event is forwarded to the renderer together with
 * a full navigation-state snapshot, so the renderer's mirrored cache can keep
 * answering getURL()/canGoBack() synchronously.
 */
'use strict';

const { WebContentsView, Menu, clipboard, ipcMain } = require('electron');

const FORWARDED_EVENTS = [
  'did-start-loading',
  'did-stop-loading',
  'did-navigate',
  'did-navigate-in-page',
  'did-fail-load',
  'dom-ready',
  'page-title-updated',
  'page-favicon-updated',
  'found-in-page',
];

// Commands the renderer may invoke on a tab's webContents, by name. Anything
// not listed is rejected loudly - no silent pass-through to arbitrary methods.
const ALLOWED_COMMANDS = new Set([
  'reload', 'stop', 'focus',
  'executeJavaScript', 'insertCSS',
  'setZoomLevel', 'getZoomLevel',
  'openDevTools', 'closeDevTools',
  'findInPage', 'stopFindInPage',
  'downloadURL', 'print',
  'cut', 'copy', 'paste', 'undo', 'redo', 'selectAll',
  'setAudioMuted', 'isAudioMuted',
]);

function createTabViewManager(win, opts) {
  if (!win) { throw new Error('createTabViewManager requires a BrowserWindow'); }
  if (!opts || typeof opts.getSession !== 'function') {
    throw new Error('createTabViewManager requires opts.getSession(incognito)');
  }
  const getExtensions = opts.getExtensions || (() => null);
  const notifyRenderer = opts.notifyRenderer || (() => {});

  /** id -> { view, wc, incognito, fullscreen, lastLayout } */
  const tabsById = new Map();
  /** webContents.id -> tab id (for extension callbacks) */
  const wcIdToTabId = new Map();
  let lastActiveId = null; // [SovereignBrowser] tracked for Holly automation
  /** views created before the extensions instance existed */
  const pendingExtensionTabs = [];
  let disposed = false;

  function send(channel, payload) {
    try {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    } catch (err) {
      console.warn('[tabviews] send failed on', channel, '-', err.message);
    }
  }

  function navSnapshot(wc) {
    try {
      const nav = wc.navigationHistory;
      return {
        url: wc.getURL(),
        title: wc.getTitle(),
        canGoBack: nav && typeof nav.canGoBack === 'function' ? nav.canGoBack() : wc.canGoBack(),
        canGoForward: nav && typeof nav.canGoForward === 'function' ? nav.canGoForward() : wc.canGoForward(),
        isLoading: wc.isLoading(),
      };
    } catch (err) {
      return { url: '', title: '', canGoBack: false, canGoForward: false, isLoading: false };
    }
  }

  function forward(id, wc, event, payload) {
    send('tab:event', { id, event, payload: payload || {}, nav: navSnapshot(wc) });
  }

  function registerWithExtensions(entry) {
    if (entry.incognito) { return; } // Chrome semantics: extensions stay out of incognito
    const ext = getExtensions();
    if (!ext) {
      pendingExtensionTabs.push(entry);
      return;
    }
    try {
      ext.addTab(entry.wc, win);
    } catch (err) {
      console.warn('[tabviews] extensions.addTab failed:', err.message);
    }
  }

  function goBack(wc) {
    const nav = wc.navigationHistory;
    if (nav && typeof nav.goBack === 'function') { nav.goBack(); } else { wc.goBack(); }
  }
  function goForward(wc) {
    const nav = wc.navigationHistory;
    if (nav && typeof nav.goForward === 'function') { nav.goForward(); } else { wc.goForward(); }
  }

  function buildContextMenu(id, wc, params) {
    const template = [];
    const nav = navSnapshot(wc);
    template.push(
      { label: 'Back', enabled: nav.canGoBack, click: () => { try { goBack(wc); } catch (e) { console.warn('[tabviews] back:', e.message); } } },
      { label: 'Forward', enabled: nav.canGoForward, click: () => { try { goForward(wc); } catch (e) { console.warn('[tabviews] forward:', e.message); } } },
      { label: 'Reload', click: () => { try { wc.reload(); } catch (e) { console.warn('[tabviews] reload:', e.message); } } },
      { type: 'separator' },
    );
    if (params.linkURL) {
      template.push(
        { label: 'Open link in new tab', click: () => notifyRenderer('holly:open-url-in-new-tab', { url: params.linkURL, from: id }) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }
    if (params.hasImageContents || params.mediaType === 'image') {
      template.push(
        { label: 'Copy image', click: () => { try { wc.copyImageAt(params.x, params.y); } catch (e) { console.warn('[tabviews] copyImageAt:', e.message); } } },
        { label: 'Copy image address', enabled: !!params.srcURL, click: () => clipboard.writeText(params.srcURL || '') },
        { label: 'Save image as...', enabled: !!params.srcURL, click: () => { try { wc.downloadURL(params.srcURL); } catch (e) { console.warn('[tabviews] downloadURL:', e.message); } } },
        { type: 'separator' },
      );
    }
    if (params.isEditable) {
      const f = params.editFlags || {};
      template.push(
        { label: 'Undo', enabled: !!f.canUndo, click: () => wc.undo() },
        { label: 'Redo', enabled: !!f.canRedo, click: () => wc.redo() },
        { type: 'separator' },
        { label: 'Cut', enabled: !!f.canCut, click: () => wc.cut() },
        { label: 'Copy', enabled: !!f.canCopy, click: () => wc.copy() },
        { label: 'Paste', enabled: !!f.canPaste, click: () => wc.paste() },
        { label: 'Select all', click: () => wc.selectAll() },
        { type: 'separator' },
      );
    } else if (params.selectionText && params.selectionText.trim()) {
      template.push(
        { label: 'Copy', click: () => wc.copy() },
        { type: 'separator' },
      );
    }
    // Real Chrome-extension context menu items (e.g. Dark Reader), if any.
    try {
      const ext = getExtensions();
      if (ext && typeof ext.getContextMenuItems === 'function') {
        const items = ext.getContextMenuItems(wc, params);
        if (Array.isArray(items) && items.length) {
          template.push(...items, { type: 'separator' });
        }
      }
    } catch (err) {
      console.warn('[tabviews] extension menu items unavailable:', err.message);
    }
    template.push({
      label: 'Inspect element',
      click: () => { try { wc.inspectElement(params.x, params.y); } catch (e) { console.warn('[tabviews] inspect:', e.message); } },
    });
    try {
      Menu.buildFromTemplate(template).popup({ window: win });
    } catch (err) {
      console.warn('[tabviews] context menu popup failed:', err.message);
    }
  }

  function applyLayout(entry, layout) {
    entry.lastLayout = layout;
    if (entry.fullscreen) { return; } // fullscreen override owns the bounds
    try {
      entry.view.setBounds({
        x: Math.round(layout.x),
        y: Math.round(layout.y),
        width: Math.max(0, Math.round(layout.width)),
        height: Math.max(0, Math.round(layout.height)),
      });
      entry.view.setVisible(!!layout.visible);
    } catch (err) {
      console.warn('[tabviews] setBounds/setVisible failed for tab', layout.id, '-', err.message);
    }
  }

  function enterFullscreen(entry) {
    entry.fullscreen = true;
    try {
      const b = win.getContentBounds();
      entry.view.setBounds({ x: 0, y: 0, width: b.width, height: b.height });
      entry.view.setVisible(true);
      win.contentView.addChildView(entry.view); // raise to top
    } catch (err) {
      console.warn('[tabviews] enter fullscreen failed:', err.message);
    }
  }

  function leaveFullscreen(entry) {
    entry.fullscreen = false;
    if (entry.lastLayout) { applyLayout(entry, entry.lastLayout); }
  }

  function createTab(id, incognito) {
    if (disposed) { throw new Error('tab view manager is disposed'); }
    if (tabsById.has(id)) { throw new Error('tab ' + id + ' already exists'); }
    const view = new WebContentsView({
      webPreferences: {
        session: opts.getSession(!!incognito),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        // Deliberately NO preload: web pages must not receive HOLLY's
        // electronAPI bridge. (The <webview> path leaked it to every site.)
      },
    });
    const wc = view.webContents;
    const entry = { id, view, wc, incognito: !!incognito, fullscreen: false, lastLayout: null };
    tabsById.set(id, entry);
    wcIdToTabId.set(wc.id, id);

    try { if (typeof view.setBackgroundColor === 'function') { view.setBackgroundColor('#ffffff'); } } catch (err) { /* cosmetic only */ }

    for (const event of FORWARDED_EVENTS) {
      wc.on(event, (e, ...args) => {
        let payload = {};
        switch (event) {
          case 'did-navigate': payload = { url: args[0] }; break;
          case 'did-navigate-in-page': payload = { url: args[0], isMainFrame: args[1] }; break;
          case 'did-fail-load': payload = { errorCode: args[0], errorDescription: args[1], validatedURL: args[2], isMainFrame: args[3] }; break;
          case 'page-title-updated': payload = { title: args[0] }; break;
          case 'page-favicon-updated': payload = { favicons: args[0] }; break;
          case 'found-in-page': payload = { result: args[0] }; break;
          default: payload = {};
        }
        forward(id, wc, event, payload);
      });
    }

    // console-message changed shape across Electron majors; normalise both.
    wc.on('console-message', (e, a, b, c, d) => {
      const payload = (a && typeof a === 'object' && 'message' in a)
        ? { level: a.level, message: a.message, line: a.lineNumber, sourceId: a.sourceId }
        : { level: a, message: b, line: c, sourceId: d };
      forward(id, wc, 'console-message', payload);
    });

    wc.on('context-menu', (e, params) => {
      try { buildContextMenu(id, wc, params); } catch (err) {
        console.warn('[tabviews] context menu failed:', err.message);
      }
    });

    wc.on('enter-html-full-screen', () => enterFullscreen(entry));
    wc.on('leave-html-full-screen', () => leaveFullscreen(entry));

    wc.on('render-process-gone', (e, details) => {
      console.warn('[tabviews] renderer gone for tab', id, '-', details && details.reason);
      forward(id, wc, 'did-fail-load', {
        errorCode: -1000,
        errorDescription: 'Renderer process gone: ' + (details && details.reason ? details.reason : 'unknown'),
        validatedURL: '',
        isMainFrame: true,
      });
    });

    wc.setWindowOpenHandler((details) => {
      notifyRenderer('holly:open-url-in-new-tab', { url: details.url, from: id });
      return { action: 'deny' };
    });

    win.contentView.addChildView(view);
    view.setVisible(false); // renderer's first layout message reveals it
    registerWithExtensions(entry);
    return entry;
  }

  function destroyTab(id) {
    const entry = tabsById.get(id);
    if (!entry) { return false; }
    tabsById.delete(id);
    wcIdToTabId.delete(entry.wc.id);
    if (win.isDestroyed()) {
      // The window (and its whole view tree) is already gone - there is
      // nothing left to remove, and calling removeChildView here is exactly
      // the case that produced a misleading "failed" warning.
      console.log('[tabviews] tab', id, 'view already gone with the window - skipping removeChildView');
    } else {
      try { win.contentView.removeChildView(entry.view); } catch (err) {
        console.warn('[tabviews] removeChildView failed for tab', id, '-', err.message);
      }
    }
    try { entry.wc.close(); } catch (err) {
      console.warn('[tabviews] webContents.close failed for tab', id, '-', err.message);
    }
    return true;
  }

  // ---- IPC surface -------------------------------------------------------
  // Every tab channel in one place: registration clears stale handlers first so
  // a second window can initialise cleanly, and dispose() leaves answering
  // stubs behind rather than nothing (see the note on dispose below).
  const TAB_CHANNELS = ['tab:create', 'tab:load', 'tab:cmd', 'tab:back', 'tab:forward', 'tab:layout', 'tab:activate', 'tab:destroy'];
  for (const channel of TAB_CHANNELS) {
    try { ipcMain.removeHandler(channel); } catch (err) { /* nothing registered yet */ }
  }

  ipcMain.handle('tab:create', (event, { id, incognito }) => {
    try {
      createTab(id, incognito);
      return { ok: true };
    } catch (err) {
      console.error('[tabviews] tab:create failed for', id, '-', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('tab:load', (event, { id, url }) => {
    const entry = tabsById.get(id);
    if (!entry) { return { ok: false, error: 'no such tab ' + id }; }
    entry.wc.loadURL(url).catch((err) => {
      // did-fail-load already reaches the renderer; this stops an unhandled rejection.
      console.warn('[tabviews] loadURL rejected for tab', id, '-', err.message);
    });
    return { ok: true };
  });

  ipcMain.handle('tab:cmd', async (event, { id, method, args }) => {
    const entry = tabsById.get(id);
    if (!entry) { return { ok: false, error: 'no such tab ' + id }; }
    if (!ALLOWED_COMMANDS.has(method)) { return { ok: false, error: 'command not allowed: ' + method }; }
    try {
      const result = await entry.wc[method](...(Array.isArray(args) ? args : []));
      return { ok: true, result: typeof result === 'undefined' ? null : result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // goBack/goForward route through navigationHistory when available, so they
  // get explicit handlers rather than the generic name lookup above.
  ipcMain.handle('tab:back', (event, { id }) => {
    const entry = tabsById.get(id);
    if (!entry) { return { ok: false, error: 'no such tab ' + id }; }
    try { goBack(entry.wc); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('tab:forward', (event, { id }) => {
    const entry = tabsById.get(id);
    if (!entry) { return { ok: false, error: 'no such tab ' + id }; }
    try { goForward(entry.wc); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('tab:layout', (event, { layouts }) => {
    if (!Array.isArray(layouts)) { return { ok: false, error: 'layouts must be an array' }; }
    for (const layout of layouts) {
      const entry = tabsById.get(layout.id);
      if (entry) { applyLayout(entry, layout); }
    }
    return { ok: true };
  });

  ipcMain.handle('tab:activate', (event, { id }) => {
    const entry = tabsById.get(id);
    if (!entry) { return { ok: false, error: 'no such tab ' + id }; }
    try {
      win.contentView.addChildView(entry.view); // re-add raises to top
      const ext = getExtensions();
      if (ext && typeof ext.selectTab === 'function') { ext.selectTab(entry.wc); }
      entry.wc.focus();
      lastActiveId = id;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('tab:destroy', (event, { id }) => {
    return { ok: destroyTab(id) };
  });

  win.on('closed', () => { dispose(); });

  function dispose() {
    if (disposed) { return; }
    disposed = true;
    for (const id of Array.from(tabsById.keys())) { destroyTab(id); }
    // Leave an answering stub on each channel rather than removing it outright.
    // The renderer is still tearing down when the window closes and can invoke
    // tab:activate after this point; with no handler at all, Electron logs
    // "Error occurred in handler for 'tab:activate': No handler registered",
    // which looked like a fault but was only a late, harmless call. The stub
    // answers it honestly and the registration loop above clears these before
    // any future window registers its own.
    for (const channel of TAB_CHANNELS) {
      try { ipcMain.removeHandler(channel); } catch (err) { /* already gone */ }
      try {
        ipcMain.handle(channel, () => ({ ok: false, error: 'tab views disposed' }));
      } catch (err) {
        console.warn('[tabviews] could not install disposed-stub for', channel, '-', err.message);
      }
    }
  }

  return {
    attachExtensions(ext) {
      if (!ext) { return; }
      while (pendingExtensionTabs.length) {
        const entry = pendingExtensionTabs.shift();
        if (tabsById.has(entry.id) && !entry.incognito) {
          try { ext.addTab(entry.wc, win); } catch (err) {
            console.warn('[tabviews] deferred extensions.addTab failed:', err.message);
          }
        }
      }
    },
    tabIdForWebContents(wcId) {
      return wcIdToTabId.has(wcId) ? wcIdToTabId.get(wcId) : null;
    },
    getWebContents(id) { const e = tabsById.get(id); return e ? e.wc : null; },
    activeId() { return lastActiveId; },
    activeWebContents() {
      const e = (lastActiveId != null && tabsById.get(lastActiveId)) || tabsById.values().next().value;
      return e ? e.wc : null;
    },
    listTabs() {
      const out = [];
      for (const [tid, e] of tabsById) {
        try { out.push({ id: tid, active: tid === lastActiveId, url: e.wc.getURL(), title: e.wc.getTitle() }); }
        catch (err) { out.push({ id: tid, active: tid === lastActiveId, url: '', title: '' }); }
      }
      return out;
    },
    count() { return tabsById.size; },
    dispose,
  };
}

module.exports = { createTabViewManager };