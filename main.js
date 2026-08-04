const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  systemPreferences,
  shell,
} = require('electron'); // [NRS-1501] Electron app framework
const path = require('node:path'); // [NRS-1503] Path utilities
const fs = require('node:fs'); // [NRS-1503] File system access
const { setupJarvisAgentHandlers } = require('./agents/jarvis-integration'); // [NRS-1001] Jarvis AI agent integration
const BrowserAutomationManager = require('./browser-automation-manager'); // [NRS-1101] Browser automation controller
const { ElectronChromeExtensions } = require('electron-chrome-extensions'); // [SovereignBrowser]
const { installChromeWebStore } = require('electron-chrome-web-store'); // [SovereignBrowser]
require('dotenv').config(); // [NRS-1601] Load environment variables

// Set OpenAI API key if not already in environment // [NRS-1001]
if (!process.env.OPENAI_API_KEY) {
  // [NRS-1001]
  process.env.OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE'; // [NRS-1001]
} // [NRS-1001] Fallback API key for agent

function getDataFile(name) {
  // [NRS-1001]
  const dir = app.getPath('userData'); // [NRS-1602] Get app data directory
  return path.join(dir, name); // [NRS-1602] Build data file path
} // [NRS-1001]

function readJson(name, fallback) {
  // [NRS-1001]
  try {
    // [NRS-1001]
    const p = getDataFile(name); // [NRS-1602] Get file path
    if (!fs.existsSync(p)) return fallback; // [NRS-1602] Check if file exists
    const raw = fs.readFileSync(p, 'utf8'); // [NRS-1602] Read file content
    return JSON.parse(raw); // [NRS-1602] Parse JSON
  } catch (e) {
    // [NRS-1001]
    console.warn(`Failed to read JSON file ${name}:`, e.message); // [NRS-1602] Log read error
    return fallback; // [NRS-1602] Return fallback value
  } // [NRS-1001]
} // [NRS-1001]

function writeJson(name, data) {
  // [NRS-1001]
  try {
    // [NRS-1001]
    const p = getDataFile(name); // [NRS-1602] Get file path
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8'); // [NRS-1602] Write JSON file
    return true; // [NRS-1602] Success indicator
  } catch (e) {
    // [NRS-1001]
    console.warn(`Failed to write JSON file ${name}:`, e.message); // [NRS-1602] Log write error
    return false; // [NRS-1602] Failure indicator
  } // [NRS-1001]
} // [NRS-1001]

function createWindow() {
  // [NRS-1001]
  const win = new BrowserWindow({
    // [NRS-1001]
    width: 1200, // [NRS-1001]
    height: 800, // [NRS-1001]
    title: 'HOLLY', // [NRS-1001]
    useContentSize: true, // [NRS-1001]
    autoHideMenuBar: true, // [NRS-1001]
    webPreferences: {
      // [NRS-1001]
      preload: path.join(__dirname, 'preload.js'), // [NRS-1001]
      contextIsolation: true, // [NRS-1001]
      nodeIntegration: false, // [NRS-1001]
      webviewTag: true, // [NRS-1001]
      session: browsingSession(), // [SovereignBrowser] same session as tabs
      sandbox: true, // [SovereignBrowser] required for extension preload scripts
    }, // [NRS-1001]
  }); // [NRS-1501] Create browser window with security settings

  // [SovereignBrowser] Every <webview> is a tab as far as extensions are
  // concerned. Register each one as it attaches so chrome.tabs, badges and
  // browser actions resolve against real tabs.
  win.webContents.on('did-attach-webview', (event, guestContents) => {
    try {
      if (chromeExtensions) { chromeExtensions.addTab(guestContents, win); }
    } catch (err) {
      console.warn('[Holly] Could not register webview with extensions:', err.message);
    }
  });

  win.setMenuBarVisibility(false); // [NRS-1303] Hide menu bar
  win.loadFile(path.join(__dirname, 'src', 'index.html')); // [NRS-1301] Load main HTML
  try {
    win.maximize();
  } catch {} // [NRS-1303] Maximize window

  // Handle window close // [NRS-1001]
  win.on('close', event => {
    // [NRS-1001]
    // Allow normal close // [NRS-1001]
    win.destroy(); // [NRS-1501] Destroy window on close
  }); // [NRS-1001]

  // Keyboard toggles for devtools // [NRS-1001]
  win.webContents.on('before-input-event', (event, input) => {
    // [NRS-1001]
    const key = (input.key || '').toLowerCase(); // [NRS-1303] Normalize key name
    const isDevtoolsCombo = (input.control && input.shift && key === 'i') || key === 'f12'; // [NRS-1303] Check devtools shortcut
    if (isDevtoolsCombo) {
      // [NRS-1001]
      win.webContents.toggleDevTools(); // [NRS-1303] Toggle devtools
      event.preventDefault(); // [NRS-1303] Prevent default behavior
    } // [NRS-1001]
  }); // [NRS-1001]

  // Downloads handling // [NRS-1001]
  try {
    // [NRS-1001]
    browsingSession().on('will-download', (event, item) => {
      // [NRS-1001]
      const fileName = item.getFilename(); // [NRS-1101] Get download filename
      const savePath = path.join(app.getPath('downloads'), fileName); // [NRS-1101] Build download path
      item.setSavePath(savePath); // [NRS-1001]
    }); // [NRS-1001]
  } catch (e) {
    // [NRS-1001]
    console.warn('Failed to set up download handler:', e.message); // [NRS-1001]
  } // [NRS-1001]
} // [NRS-1001]

// [SovereignBrowser] The session every normal tab uses. Must match the
// partition set on the <webview> elements in renderer.js, or downloads and
// extensions attach to a session no tab is actually using.
// [SovereignBrowser] Electron's default user agent contains an "Electron/x.y.z"
// token, and the webviews were additionally hardcoded to Chrome/131 while the
// bundled Chromium is far newer. Sites that check for embedded frameworks - and
// Google's sign-in in particular - reject both. Build one honest Chrome UA from
// the actual Chromium version and let every webview inherit it, so this stays
// correct automatically on future Electron upgrades.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/' + process.versions.chrome + ' Safari/537.36';
app.userAgentFallback = CHROME_UA;
const BROWSING_PARTITION = 'persist:holly';
function browsingSession() {
  return session.fromPartition(BROWSING_PARTITION);
}

async function loadExtensions() {
  // [NRS-1001]
  const extRoot = path.join(__dirname, 'extensions'); // [NRS-1001]
  if (!fs.existsSync(extRoot)) return; // [NRS-1001]
  const entries = fs.readdirSync(extRoot, { withFileTypes: true }); // [NRS-1001]
  for (const entry of entries) {
    // [NRS-1001]
    if (entry.isDirectory()) {
      // [NRS-1001]
      const extPath = path.join(extRoot, entry.name); // [NRS-1001]
      try {
        // [NRS-1001]
        const loaded = await browsingSession().loadExtension(extPath, {
          allowFileAccess: true,
        }); // [NRS-1001]
        console.log('Loaded extension', loaded.name, 'from', extPath); // [NRS-1001]
      } catch (e) {
        // [NRS-1001]
        console.warn('Failed to load extension from', extPath, e.message); // [NRS-1001]
      } // [NRS-1001]
    } // [NRS-1001]
  } // [NRS-1001]
} // [NRS-1001]

// Use a temp cache directory to avoid OS permission issues // [NRS-1001]
// === Sovereign Browser: profile + home page location ======================
// Profile lives under %LOCALAPPDATA%\SovereignBrowser so bookmarks, history
// and cache survive restarts. Previously this pointed at the temp directory,
// which wiped the profile on every launch.
const PROFILE_DIR = path.join(
  process.env.LOCALAPPDATA || app.getPath('appData'),
  'SovereignBrowser'
);
const HOME_DIR = path.join(PROFILE_DIR, 'home');
const HOME_FILE = path.join(HOME_DIR, 'index.html');
const cacheDir = path.join(PROFILE_DIR, 'Cache');

try {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  fs.mkdirSync(HOME_DIR, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  app.setPath('userData', PROFILE_DIR);
} catch (err) {
  console.error('[SovereignBrowser] Could not create profile directory:', err);
  throw new Error('Profile directory unusable at ' + PROFILE_DIR + ': ' + err.message);
}

// Seed the home page from the bundled template on FIRST RUN ONLY, so the
// user's own edits to the live home page are never overwritten.
try {
  if (!fs.existsSync(HOME_FILE)) {
    const seed = path.join(__dirname, 'home', 'index.html');
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, HOME_FILE);
      console.log('[SovereignBrowser] Seeded home page at ' + HOME_FILE);
    } else {
      console.warn('[SovereignBrowser] No home template found at ' + seed);
    }
  }
} catch (err) {
  console.error('[SovereignBrowser] Could not seed home page:', err);
}

// [SovereignBrowser] The preload runs sandboxed (Electron >=20 default), so it
// cannot use node:path or process.env. Compute the home URL here, where full
// Node is available, and hand it over synchronously on request.
const { pathToFileURL } = require('node:url');
const HOME_URL = pathToFileURL(HOME_FILE).href;
ipcMain.handle('sb:log', (event, ...args) => { console.log('[SB-RENDERER]', ...args); });
ipcMain.on('sb:get-home-url', (event) => {
  event.returnValue = HOME_URL;
});
app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-application-cache');
app.commandLine.appendSwitch('disable-gpu');
// =========================================================================

// [SovereignBrowser] Chrome extension support.
// Electron alone only exposes a DevTools-focused subset of the extension APIs
// and knows nothing about tabs, popups or browser actions.
// electron-chrome-extensions supplies those; electron-chrome-web-store adds
// installation from the Chrome Web Store and remembers what is installed,
// which Electron does not do on its own.
let chromeExtensions = null;

function mainWindow() {
  return BrowserWindow.getAllWindows()[0] || null;
}

// Extensions ask the browser to open, select and close tabs. HOLLY's tabs live
// in the renderer, so forward these as IPC messages it already understands.
function tellRenderer(channel, payload) {
  const win = mainWindow();
  if (win && !win.webContents.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

// [SovereignBrowser] The renderer's Extensions dialog was built around a
// homegrown css/js injection list in localStorage and knows nothing about real
// Chrome extensions. Expose what the session has actually loaded.
ipcMain.handle('holly:extensions:list', () => {
  try {
    return browsingSession()
      .getAllExtensions()
      .map((e) => ({
        id: e.id,
        name: e.name,
        version: e.version,
        description: (e.manifest && e.manifest.description) || '',
providers: undefined,
      }));
  } catch (err) {
    console.warn('[Holly] Could not list extensions:', err.message);
    return [];
  }
});

ipcMain.handle('holly:extensions:remove', (event, id) => {
  try {
    const s = browsingSession();
    if (s.extensions) { s.extensions.removeExtension(id); } else { s.removeExtension(id); }
    return { ok: true };
  } catch (err) {
    console.warn('[Holly] Could not remove extension:', err.message);
    return { ok: false, error: err.message };
  }
});

// [SovereignBrowser] Extension management.
// Electron has no concept of a disabled-but-installed extension: an extension
// is either loaded into the session or it is not. So "installed" is derived
// from what is on disk, "enabled" from what is currently loaded, and the
// disabled set is persisted ourselves so the choice survives a restart.
const EXTENSIONS_DIR = () => path.join(app.getPath('userData'), 'Extensions');

function extensionsState() {
  return readJson('extensions-state.json', { disabled: [] });
}

function setExtensionDisabled(id, disabled) {
  const state = extensionsState();
  const set = new Set(state.disabled || []);
  if (disabled) { set.add(id); } else { set.delete(id); }
  state.disabled = Array.from(set);
  writeJson('extensions-state.json', state);
}

// Each extension lives at Extensions/<id>/<version>/manifest.json
function findExtensionPath(id) {
  try {
    const base = path.join(EXTENSIONS_DIR(), id);
    if (!fs.existsSync(base)) { return null; }
    const versions = fs.readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    if (!versions.length) { return null; }
    return path.join(base, versions[versions.length - 1]);
  } catch (err) {
    console.warn('[Holly] Could not resolve extension path for', id, err.message);
    return null;
  }
}

function readManifest(extPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

function sessionExtensions() {
  const s = browsingSession();
  return s.extensions || s;
}

function listInstalledExtensions() {
  const loaded = new Map(sessionExtensions().getAllExtensions().map((e) => [e.id, e]));
  const disabled = new Set(extensionsState().disabled || []);
  const dir = EXTENSIONS_DIR();
  const results = [];

  let ids = [];
  try {
    if (fs.existsSync(dir)) {
      ids = fs.readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    }
  } catch (err) {
    console.warn('[Holly] Could not read extensions directory:', err.message);
  }

  for (const id of ids) {
    const extPath = findExtensionPath(id);
    const manifest = extPath ? readManifest(extPath) : null;
    const live = loaded.get(id);
    if (!manifest && !live) { continue; }
    results.push({
      id,
      name: (live && live.name) || (manifest && manifest.name) || id,
      version: (live && live.version) || (manifest && manifest.version) || '',
      description: (manifest && manifest.description) || '',
      permissions: (manifest && manifest.permissions) || [],
      hostPermissions: (manifest && (manifest.host_permissions || [])) || [],
      manifestVersion: (manifest && manifest.manifest_version) || null,
      path: extPath || (live && live.path) || '',
      enabled: !!live && !disabled.has(id),
      source: 'Chrome Web Store',
    });
  }
  return results;
}

ipcMain.handle('holly:extensions:manage-list', () => {
  try {
    return listInstalledExtensions();
  } catch (err) {
    console.warn('[Holly] manage-list failed:', err.message);
    return [];
  }
});

ipcMain.handle('holly:extensions:set-enabled', async (event, id, enabled) => {
  try {
    const ext = sessionExtensions();
    if (enabled) {
      const extPath = findExtensionPath(id);
      if (!extPath) { throw new Error('Extension files not found on disk'); }
      await ext.loadExtension(extPath, { allowFileAccess: true });
    } else {
      ext.removeExtension(id);
    }
    setExtensionDisabled(id, !enabled);
    return { ok: true };
  } catch (err) {
    console.warn('[Holly] set-enabled failed:', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('holly:extensions:uninstall', (event, id) => {
  try {
    try { sessionExtensions().removeExtension(id); } catch {}
    const base = path.join(EXTENSIONS_DIR(), id);
    if (fs.existsSync(base)) {
      fs.rmSync(base, { recursive: true, force: true });
    }
    setExtensionDisabled(id, false);
    return { ok: true };
  } catch (err) {
    console.warn('[Holly] uninstall failed:', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('holly:extensions:open-folder', async (event, id) => {
  // [SovereignBrowser] Explorer refuses to navigate to the extensions folder
  // under %LOCALAPPDATA% regardless of invocation form (shell.openPath,
  // showItemInFolder, explorer /select, cmd start), even though the files are
  // readable and the ACL grants full control. Rather than keep fighting the
  // shell, copy the path to the clipboard so it can be pasted anywhere, and
  // still attempt to open it.
  try {
    const extPath = findExtensionPath(id);
    if (!extPath || !fs.existsSync(extPath)) {
      return { ok: false, error: 'Not found on disk' };
    }
    try {
      const { clipboard } = require('electron');
      clipboard.writeText(extPath);
    } catch (clipErr) {
      console.warn('[Holly] Could not copy path:', clipErr.message);
    }
    // Explorer will not navigate into the Chromium profile tree. This is
    // reproducible outside HOLLY entirely - cmd /c start fails the same way
    // on a freshly created empty folder there, while deep folders elsewhere
    // open fine. The profile root does open, so go there and leave the exact
    // path on the clipboard to paste into the address bar.
    const openErr = await shell.openPath(app.getPath('userData'));
    if (openErr) { console.warn('[Holly] openPath reported:', openErr); }
    return { ok: true, path: extPath, copied: true };
  } catch (err) {
    console.warn('[Holly] open-folder failed:', err.message);
    return { ok: false, error: err.message };
  }
}); // [NRS-1001]

app.on('window-all-closed', () => {
  // [NRS-1001]
  if (process.platform !== 'darwin') app.quit(); // [NRS-1001]
}); // [NRS-1001]

// IPC: bookmarks and history // [NRS-1001]
ipcMain.handle('bookmarks:get', () => {
  // [NRS-1001]
  return readJson('bookmarks.json', []); // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('bookmarks:add', (evt, bookmark) => {
  // [NRS-1001]
  const list = readJson('bookmarks.json', []); // [NRS-1001]
  list.push({ ...bookmark, addedAt: new Date().toISOString() }); // [NRS-1001]
  writeJson('bookmarks.json', list); // [NRS-1001]
  return list; // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('history:get', () => {
  // [NRS-1001]
  return readJson('history.json', []); // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('history:add', (evt, entry) => {
  // [NRS-1001]
  const list = readJson('history.json', []); // [NRS-1001]
  list.push({ ...entry, visitedAt: new Date().toISOString() }); // [NRS-1001]
  writeJson('history.json', list); // [NRS-1001]
  return list; // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('history:clear', () => {
  // [NRS-1001]
  writeJson('history.json', []); // [NRS-1001]
  return []; // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('show-open-dialog', async () => {
  // [NRS-1001]
  const res = await dialog.showOpenDialog({ properties: ['openFile'] }); // [NRS-1001]
  return res.filePaths?.[0] || null; // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('set-default-browser', async () => {
  // [NRS-1001]
  try {
    // [NRS-1001]
    const { execSync } = require('node:child_process'); // [NRS-1001]
    const exePath = process.execPath.replaceAll('\\', '\\\\'); // [NRS-1001]

    const commands = [
      // [NRS-1001]
      String.raw`reg add "HKCU\Software\Classes\http\shell\open\command" /ve /d "\"${exePath}\" --url \"%%1\"" /f`, // [NRS-1001]
      String.raw`reg add "HKCU\Software\Classes\https\shell\open\command" /ve /d "\"${exePath}\" --url \"%%1\"" /f`, // [NRS-1001] HTTPS association command
    ]; // [NRS-1001]

    for (const cmd of commands) {
      // [NRS-1001]
      try {
        // [NRS-1001]
        execSync(cmd, { shell: 'cmd.exe', stdio: 'pipe' }); // [NRS-1001]
      } catch (e) {
        // [NRS-1001]
        console.warn('Registry command failed:', cmd, e.message); // [NRS-1001]
      } // [NRS-1001]
    } // [NRS-1001]

    return { success: true, message: 'Set as default browser' }; // [NRS-1001]
  } catch (err) {
    // [NRS-1001]
    console.error('Failed to set default browser:', err.message); // [NRS-1001]
    return { success: false, message: err.message }; // [NRS-1001]
  } // [NRS-1001]
}); // [NRS-1001]

// Microphone permission (helps on macOS; harmless elsewhere) // [NRS-1001]
ipcMain.handle('mic:ask-permission', async () => {
  // [NRS-1001]
  try {
    // [NRS-1001]
    if (systemPreferences?.askForMediaAccess) {
      // [NRS-1001]
      const granted = await systemPreferences.askForMediaAccess('microphone'); // [NRS-1001]
      const status = systemPreferences.getMediaAccessStatus?.('microphone'); // [NRS-1001]
      return { granted, status: status || 'unknown' }; // [NRS-1001]
    } // [NRS-1001]
    return { granted: true, status: 'not-applicable' }; // [NRS-1001]
  } catch (err) {
    // [NRS-1001]
    return {
      granted: false,
      status: 'error',
      error: err?.message || 'Unknown error',
    }; // [NRS-1001]
  } // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('mic:get-status', () => {
  // [NRS-1001]
  try {
    // [NRS-1001]
    if (systemPreferences?.getMediaAccessStatus) {
      // [NRS-1001]
      const status = systemPreferences.getMediaAccessStatus('microphone'); // [NRS-1001]
      return { status }; // [NRS-1001]
    } // [NRS-1001]
    return { status: 'not-applicable' }; // [NRS-1001]
  } catch (err) {
    // [NRS-1001]
    return { status: 'error', error: err?.message || 'Unknown error' }; // [NRS-1001]
  } // [NRS-1001]
}); // [NRS-1001]

ipcMain.handle('mic:open-settings', async () => {
  // [NRS-1001]
  try {
    // [NRS-1001]
    const platform = process.platform; // [NRS-1001]
    if (platform === 'darwin')
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
      );
    // [NRS-1001]
    else if (platform === 'win32')
      await shell.openExternal('ms-settings:privacy-microphone'); // [NRS-1001]
    else await shell.openExternal('about:blank'); // [NRS-1001]
    return { opened: true }; // [NRS-1001]
  } catch (err) {
    // [NRS-1001]
    return { opened: false, error: err?.message || 'Unknown error' }; // [NRS-1001]
  } // [NRS-1001]
}); // [NRS-1001]













