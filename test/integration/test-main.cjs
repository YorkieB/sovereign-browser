// test/integration/test-main.cjs - test-owned Electron entry for integration checks.
// Loads --url=<target> in a hidden window and asserts the page title carries the
// integration marker. Mirrors the [smoke] convention: grep-able PASS/FAIL + exit code.
const { app, BrowserWindow } = require('electron');

const MARKER = 'HOLLY-INTEGRATION-OK';
const urlArg = process.argv.find((a) => a.startsWith('--url='));
const url = urlArg ? urlArg.slice('--url='.length) : null;

function fail(reason) {
  console.error('[integration] FAIL:', reason);
  app.exit(1);
}

const guard = setTimeout(() => fail('timeout after 30s'), 30000);
if (guard.unref) guard.unref();

app.whenReady().then(async () => {
  if (!url) return fail('no --url=<target> supplied');
  try {
    const w = new BrowserWindow({ show: false });
    await w.loadURL(url);
    const title = await w.webContents.executeJavaScript('document.title');
    if (String(title).includes(MARKER)) {
      console.log('[integration] PASS: loaded', url, 'title=', title);
      app.exit(0);
    } else {
      fail('marker missing, title=' + title);
    }
  } catch (e) {
    fail('load error: ' + e.message);
  }
});
