// [SovereignBrowser] Holly's hands: WCV-native browser automation primitives.
// Every tool operates on the active tab's WebContents from the main process,
// replacing the dead <webview>-era control functions in the renderer.
const { ipcMain } = require('electron');

const SNAPSHOT_SRC = `(() => {
  try {
    const sel = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="menuitem"], [role="combobox"], [onclick], [contenteditable="true"]';
    const interactive = Array.from(document.querySelectorAll(sel));
    const refs = [];
    const els = [];
    for (const el of interactive) {
      try {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) { continue; }
        let hidden = false;
        try { const cs = getComputedStyle(el); hidden = cs.visibility === 'hidden' || cs.display === 'none'; } catch (e) { hidden = false; }
        if (hidden) { continue; }
        const label = (el.getAttribute('aria-label') || el.placeholder || (el.tagName === 'INPUT' ? el.value : '') || el.innerText || el.alt || el.title || el.name || '')
          .trim().replace(/\\s+/g, ' ').slice(0, 70);
        els.push({
          ref: refs.length,
          tag: el.tagName.toLowerCase(),
          type: el.type || undefined,
          href: (el.tagName === 'A' && el.href) ? String(el.href).slice(0, 140) : undefined,
          label: label,
          inViewport: r.bottom > 0 && r.top < innerHeight,
        });
        refs.push(el);
        if (refs.length >= 150) { break; }
      } catch (e) { /* skip element */ }
    }
    window.__hollyRefs = refs;
    return {
      url: location.href,
      title: document.title,
      text: (document.body ? document.body.innerText : '').replace(/\\n{3,}/g, '\\n\\n').slice(0, 5000),
      scrollY: Math.round(scrollY),
      pageHeight: Math.round(document.documentElement.scrollHeight),
      viewportH: innerHeight,
      elements: els,
    };
  } catch (err) {
    return { url: location.href, title: document.title, text: '', elements: [], snapshotError: String(err && err.message || err) };
  }
})()`;

function clickSrc(i) {
  return `(() => {
    const el = (window.__hollyRefs || [])[${i}];
    if (!el || !el.isConnected) { return { ok: false, error: 'stale ref ${i} - call browser_page_state again' }; }
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.click();
    return { ok: true, clicked: ((el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 60)) };
  })()`;
}

function typeSrc(i, textJson, submit) {
  return `(() => {
    const el = (window.__hollyRefs || [])[${i}];
    if (!el || !el.isConnected) { return { ok: false, error: 'stale ref ${i} - call browser_page_state again' }; }
    const txt = ${textJson};
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.focus();
    if (el.isContentEditable) {
      el.textContent = txt;
    } else {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) { desc.set.call(el, txt); } else { el.value = txt; }
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (${submit ? 'true' : 'false'}) {
      const k = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', k));
      el.dispatchEvent(new KeyboardEvent('keypress', k));
      el.dispatchEvent(new KeyboardEvent('keyup', k));
      if (el.form && typeof el.form.requestSubmit === 'function') { el.form.requestSubmit(); }
    }
    return { ok: true, typedInto: (el.getAttribute('aria-label') || el.placeholder || el.name || el.tagName).slice(0, 60) };
  })()`;
}
function selectSrc(i, valueJson) {
  return `(() => {
    const el = (window.__hollyRefs || [])[${i}];
    if (!el || !el.isConnected) { return { ok: false, error: 'stale ref ${i} - call browser_page_state again' }; }
    if (el.tagName !== 'SELECT') { return { ok: false, error: 'ref ${i} is not a dropdown (' + el.tagName + ')' }; }
    const want = String(${valueJson});
    const wl = want.toLowerCase();
    let chosen = null;
    for (const opt of el.options) {
      if (opt.value === want || opt.text === want) { chosen = opt; break; }
    }
    if (!chosen) { for (const opt of el.options) { if (opt.text.toLowerCase().includes(wl) || opt.value.toLowerCase() === wl) { chosen = opt; break; } } }
    if (!chosen) { return { ok: false, error: 'no option matching ' + JSON.stringify(want) + ' in [' + Array.from(el.options).map(o => o.text).join(', ').slice(0, 200) + ']' }; }
    el.focus();
    el.value = chosen.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, selected: chosen.text };
  })()`;
}

function keySrc(keyName) {
  const map = { enter: { key: 'Enter', code: 'Enter', keyCode: 13 }, tab: { key: 'Tab', code: 'Tab', keyCode: 9 }, escape: { key: 'Escape', code: 'Escape', keyCode: 27 }, esc: { key: 'Escape', code: 'Escape', keyCode: 27 }, backspace: { key: 'Backspace', code: 'Backspace', keyCode: 8 }, delete: { key: 'Delete', code: 'Delete', keyCode: 46 }, arrowdown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }, arrowup: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }, arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }, arrowright: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }, pagedown: { key: 'PageDown', code: 'PageDown', keyCode: 34 }, pageup: { key: 'PageUp', code: 'PageUp', keyCode: 33 }, home: { key: 'Home', code: 'Home', keyCode: 36 }, end: { key: 'End', code: 'End', keyCode: 35 } };
  const spec = map[String(keyName || '').toLowerCase()] || null;
  return `(() => {
    const spec = ${JSON.stringify(spec)};
    if (!spec) { return { ok: false, error: 'unsupported key: ${keyName}' }; }
    const el = document.activeElement || document.body;
    const o = Object.assign({ bubbles: true, cancelable: true, which: spec.keyCode }, spec);
    el.dispatchEvent(new KeyboardEvent('keydown', o));
    el.dispatchEvent(new KeyboardEvent('keypress', o));
    el.dispatchEvent(new KeyboardEvent('keyup', o));
    return { ok: true, pressed: spec.key };
  })()`;
}

async function withActive(tabViews, fn) {
  const wc = tabViews.activeWebContents();
  if (!wc || wc.isDestroyed()) { return { ok: false, error: 'no active tab' }; }
  try { return await fn(wc); } catch (err) { return { ok: false, error: err.message }; }
}

function normalizeUrl(u) {
  const s = String(u || '').trim();
  if (!s) { return null; }
  if (/^(https?|file):\/\//i.test(s)) { return s; }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) { return 'https://' + s; }
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(s);
}

function setupAutomation({ tabViews, tellRenderer }) {
  ipcMain.handle('holly:auto:page-state', () => withActive(tabViews, async (wc) => {
    const state = await wc.executeJavaScript(SNAPSHOT_SRC, true);
    return { ok: true, state };
  }));

  ipcMain.handle('holly:auto:click', (event, { ref }) => withActive(tabViews, async (wc) => {
    const i = Number(ref);
    if (!Number.isInteger(i) || i < 0) { return { ok: false, error: 'ref must be a non-negative integer' }; }
    return await wc.executeJavaScript(clickSrc(i), true);
  }));

  ipcMain.handle('holly:auto:type', (event, { ref, text, submit }) => withActive(tabViews, async (wc) => {
    const i = Number(ref);
    if (!Number.isInteger(i) || i < 0) { return { ok: false, error: 'ref must be a non-negative integer' }; }
    return await wc.executeJavaScript(typeSrc(i, JSON.stringify(String(text == null ? '' : text)), !!submit), true);
  }));

  ipcMain.handle('holly:auto:select', (event, { ref, value }) => withActive(tabViews, async (wc) => {
  	const i = Number(ref);
  	if (!Number.isInteger(i) || i < 0) { return { ok: false, error: 'ref must be a non-negative integer' }; }
  	return await wc.executeJavaScript(selectSrc(i, JSON.stringify(String(value == null ? "" : value))), true);
  }));

  ipcMain.handle('holly:auto:key', (event, { key }) => withActive(tabViews, async (wc) => {
  	return await wc.executeJavaScript(keySrc(key), true);
  }));

  ipcMain.handle('holly:auto:submit-wait', (event, { ref }) => withActive(tabViews, async (wc) => {
  	const i = Number(ref);
  	if (!Number.isInteger(i) || i < 0) { return { ok: false, error: 'ref must be a non-negative integer' }; }
  	const navigated = new Promise((resolve) => {
  		let done = false;
  		const finish = (how) => { if (!done) { done = true; cleanup(); resolve(how); } };
  		const cleanup = () => { wc.removeListener('did-finish-load', ok); wc.removeListener('did-navigate', ok); };
  		const ok = () => finish('navigated');
  		wc.once('did-finish-load', ok);
  		wc.once('did-navigate', ok);
  		setTimeout(() => finish('timeout'), 12000);
  	});
  	const clickRes = await wc.executeJavaScript(clickSrc(i), true);
  	if (clickRes && clickRes.ok === false) { return clickRes; }
  	const how = await navigated;
  	return { ok: true, clicked: (clickRes && clickRes.clicked) || null, result: how, url: wc.getURL() };
  }));

  ipcMain.handle('holly:auto:scroll', (event, { dy }) => withActive(tabViews, async (wc) => {
    const d = Number(dy) || 0;
    const y = await wc.executeJavaScript('(() => { window.scrollBy(0, ' + Math.trunc(d) + '); return Math.round(scrollY); })()', true);
    return { ok: true, scrollY: y };
  }));

  ipcMain.handle('holly:auto:navigate', (event, { url, action }) => withActive(tabViews, async (wc) => {
    if (action === 'back') { if (wc.navigationHistory && wc.navigationHistory.canGoBack()) { wc.navigationHistory.goBack(); } else if (wc.canGoBack && wc.canGoBack()) { wc.goBack(); } return { ok: true, url: wc.getURL() }; }
    if (action === 'forward') { if (wc.navigationHistory && wc.navigationHistory.canGoForward()) { wc.navigationHistory.goForward(); } else if (wc.canGoForward && wc.canGoForward()) { wc.goForward(); } return { ok: true, url: wc.getURL() }; }
    if (action === 'reload') { wc.reload(); return { ok: true, url: wc.getURL() }; }
    const target = normalizeUrl(url);
    if (!target) { return { ok: false, error: 'no url given' }; }
    const settled = new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; cleanup(); resolve(); } };
      const cleanup = () => {
        wc.removeListener('did-finish-load', finish);
        wc.removeListener('did-fail-load', finish);
      };
      wc.once('did-finish-load', finish);
      wc.once('did-fail-load', finish);
      setTimeout(finish, 15000);
    });
    wc.loadURL(target).catch(() => { /* did-fail-load handles it */ });
    await settled;
    return { ok: true, url: wc.getURL(), title: wc.getTitle() };
  }));

  ipcMain.handle('holly:auto:wait-for', (event, { text, selector, timeoutMs }) => withActive(tabViews, async (wc) => {
    const limit = Math.min(Math.max(Number(timeoutMs) || 4000, 250), 12000);
    const deadline = Date.now() + limit;
    const probe = selector
      ? '!!document.querySelector(' + JSON.stringify(String(selector)) + ')'
      : '(document.body ? document.body.innerText : "").includes(' + JSON.stringify(String(text || '')) + ')';
    while (Date.now() < deadline) {
      const hit = await wc.executeJavaScript('(() => { try { return ' + probe + '; } catch (e) { return false; } })()', true);
      if (hit) { return { ok: true, found: true }; }
      await new Promise((r) => setTimeout(r, 300));
    }
    return { ok: true, found: false };
  }));

  ipcMain.handle('holly:auto:screenshot', () => withActive(tabViews, async (wc) => {
    const img = await wc.capturePage();
    const resized = img.resize({ width: 1000 });
    return { ok: true, dataUrl: 'data:image/jpeg;base64,' + resized.toJPEG(65).toString('base64') };
  }));

  ipcMain.handle('holly:auto:tabs', () => {
    try { return { ok: true, tabs: tabViews.listTabs() }; } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('holly:auto:log', (event, entry) => {
  	try {
  		const os = require('os'); const fsx = require('fs'); const pth = require('path');
  		const dir = pth.join(process.env.LOCALAPPDATA || os.homedir(), 'SovereignBrowser');
  		fsx.mkdirSync(dir, { recursive: true });
  		fsx.appendFileSync(pth.join(dir, 'holly-actions.log'), JSON.stringify(entry) + '\n', 'utf8');
  		return { ok: true };
  	} catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('holly:auto:tab-new', (event, { url }) => {
    try {
      tellRenderer('ext:create-tab', { url: normalizeUrl(url) || undefined, active: true });
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  // One-shot self-test so the launch log proves Holly can grip the page.
  setTimeout(async () => {
    const res = await withActive(tabViews, async (wc) => {
      const state = await wc.executeJavaScript(SNAPSHOT_SRC, true);
      return { ok: true, url: state.url, elements: state.elements.length };
    });
    if (res.ok) {
      console.log('[Holly-auto] self-test: gripped', res.url, '-', res.elements, 'interactive elements');
    } else {
      console.warn('[Holly-auto] self-test failed:', res.error);
    }
  }, 9000);

  console.log('[Holly-auto] automation primitives registered');
}

module.exports = { setupAutomation };