// The save prompt: browser chrome, not page content.
//
// A page may ASK for this prompt; it cannot draw it, style it, click it, or
// learn what it says. That matters because a page-drawn "Save password?" is
// trivially spoofable - a hostile site could fake one and harvest whatever the
// user types, or auto-accept its own.
//
// The prompt window is shown metadata only: host, username, and whether this
// is a create or an update. THE PASSWORD NEVER LEAVES MAIN. On accept, main
// commits from its own pending record, so a compromised prompt renderer has
// nothing worth stealing.

import { BrowserWindow, ipcMain } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PENDING_TTL_MS = 90 * 1000;

export function createSavePromptManager({ pageVault, neverPath, onCommitted, onError }) {
  let promptWindow = null;
  let promptWindowId = null;
  let pending = null;          // { origin, host, username, password, action, entryId, at }
  let neverList = new Set();

  try {
    if (neverPath && existsSync(neverPath)) {
      const raw = JSON.parse(readFileSync(neverPath, 'utf-8'));
      if (Array.isArray(raw)) neverList = new Set(raw);
    }
  } catch (err) {
    console.warn('[saveprompt] could not read the never-save list:', err.message);
  }

  const persistNever = () => {
    if (!neverPath) return;
    try {
      writeFileSync(neverPath, JSON.stringify([...neverList]), 'utf-8');
    } catch (err) {
      console.warn('[saveprompt] could not write the never-save list:', err.message);
    }
  };

  const clearPending = () => { pending = null; };

  const expired = () => !pending || (Date.now() - pending.at) > PENDING_TTL_MS;

  function closePrompt() {
    if (promptWindow && !promptWindow.isDestroyed()) promptWindow.close();
    promptWindow = null;
    promptWindowId = null;
  }

  function isBlocked(host) { return neverList.has(host); }

  // Closing the window destroys its renderer, and destroying it before the IPC
  // reply is delivered means the caller never sees the result - the prompt
  // could never show "that failed" because it would already be gone. Defer the
  // close by a tick so the reply lands first.
  function closeAfterReply() { setImmediate(() => closePrompt()); }

  /** Called by main when a page offers a credential worth saving. */
  function offer(parent, origin, decision, credential) {
    if (isBlocked(decision.host)) return { offered: false, reason: 'never for this site' };

    pending = {
      origin,
      host: decision.host,
      username: credential.username,
      password: credential.password,
      action: decision.action,
      entryId: decision.entryId || null,
      needsUnlock: decision.needsUnlock,
      at: Date.now(),
    };

    closePrompt();
    promptWindow = new BrowserWindow({
      width: 380,
      height: 210,
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      modal: false,
      frame: false,
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: join(HERE, 'save-prompt-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    promptWindowId = promptWindow.webContents.id;
    promptWindow.webContents.on('will-navigate', (e) => e.preventDefault());
    promptWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    promptWindow.on('closed', () => { promptWindow = null; promptWindowId = null; });
    promptWindow.loadFile(join(HERE, 'save-prompt.html'));
    promptWindow.once('ready-to-show', () => { if (promptWindow) promptWindow.show(); });
    return { offered: true, action: decision.action, needsUnlock: decision.needsUnlock };
  }

  const fromPrompt = (event) => promptWindowId !== null && event.sender.id === promptWindowId;

  // Metadata for display. Deliberately no password field: there is nothing in
  // this payload worth stealing.
  ipcMain.removeHandler('saveprompt:payload');
  ipcMain.handle('saveprompt:payload', (event) => {
    if (!fromPrompt(event)) return { ok: false, code: 'FORBIDDEN' };
    if (expired()) return { ok: false, code: 'EXPIRED' };
    return {
      ok: true,
      value: {
        host: pending.host,
        username: pending.username,
        action: pending.action,
        needsUnlock: pending.needsUnlock,
      },
    };
  });

  ipcMain.removeHandler('saveprompt:respond');
  ipcMain.handle('saveprompt:respond', (event, args) => {
    if (!fromPrompt(event)) return { ok: false, code: 'FORBIDDEN' };
    const choice = args && args.choice;

    if (choice === 'never') {
      if (pending) { neverList.add(pending.host); persistNever(); }
      clearPending();
      closeAfterReply();
      return { ok: true, value: { stored: false, never: true } };
    }
    if (choice !== 'save') {
      clearPending();
      closeAfterReply();
      return { ok: true, value: { stored: false } };
    }
    if (expired()) {
      clearPending();
      closeAfterReply();
      return { ok: false, code: 'EXPIRED' };
    }

    try {
      const saved = pageVault.commitSave(pending.origin, {
        username: pending.username,
        password: pending.password,
        action: pending.action,
        entryId: pending.entryId,
      });
      const host = pending.host;
      clearPending();
      closeAfterReply();
      if (typeof onCommitted === 'function') onCommitted(host, saved);
      return { ok: true, value: { stored: true, id: saved.id } };
    } catch (err) {
      clearPending();
      closeAfterReply();
      if (typeof onError === 'function') onError(err);
      return { ok: false, code: err.code || 'UNKNOWN', message: err.message };
    }
  });

  return {
    offer,
    isBlocked,
    closePrompt,
    get promptWindowId() { return promptWindowId; },
    get hasPending() { return Boolean(pending) && !expired(); },
    // Test seam: force expiry without waiting 90 seconds.
    __expirePending() { if (pending) pending.at = Date.now() - (PENDING_TTL_MS + 1000); },
    neverListSize() { return neverList.size; },
  };
}
