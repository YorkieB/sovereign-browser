// Main-process side of the page-facing vault channels.
//
// Reachable from web pages, so the rules are tighter than the vault window's:
//
//  1. The ORIGIN IS NEVER TAKEN FROM THE PAGE. It is read from the sender's own
//     frame URL. A page can lie about anything it sends; it cannot lie about
//     where it is. This single rule is what makes the whole feature safe.
//  2. Main frames only. A page can embed an iframe from anywhere, and an
//     iframe asking for its parent's credentials is the oldest trick there is.
//  3. Never the vault window, and never a non-tab. The vault window has its own
//     richer channels; nothing else has any business here.
//  4. No commit channel exists. A page can ASK for a save prompt; only the
//     prompt itself, drawn by the browser, can commit one.

import { ipcMain } from 'electron';
import { PageVaultError } from './page-vault.mjs';

function toFailure(err) {
  if (err instanceof PageVaultError) return { ok: false, code: err.code, message: err.message };
  console.error('[pagevault] unexpected error:', err);
  return { ok: false, code: 'UNKNOWN', message: 'Request failed.' };
}

/**
 * @param pageVault        from createPageVault()
 * @param isAuthorisedTab  (event) => boolean
 * @param onSaveOffer      (webContents, origin, decision, credential) => void
 *                         called when a page asks for a save prompt; main draws it
 */
export function registerPageVaultIpc(pageVault, isAuthorisedTab, onSaveOffer, onOpenManager) {
  if (typeof isAuthorisedTab !== 'function') {
    throw new Error('registerPageVaultIpc requires an isAuthorisedTab(event) predicate.');
  }

  // "Manage passwords" opens a window. Opening a window is not dangerous, but
  // a page that could do it in a loop would be, so it is rate-limited per
  // sender. Nothing about the vault is returned either way.
  const OPEN_COOLDOWN_MS = 5000;
  const lastOpen = new Map();

  const senderOrigin = (event) => {
    const frame = event.senderFrame;
    if (!frame) return null;
    // Sub-frames are refused outright (rule 2).
    if (frame !== event.sender.mainFrame) return null;
    return frame.url || null;
  };

  const handlers = {
    'pagevault:query': (origin) => pageVault.query(origin),
    'pagevault:fill': (origin, args) => pageVault.fill(origin, args && args.id),
    'pagevault:generate': (origin, args) => pageVault.generate(args && args.options),
    'pagevault:offer-save': (origin, args, event) => {
      const credential = {
        username: args && typeof args.username === 'string' ? args.username : '',
        password: args && typeof args.password === 'string' ? args.password : '',
      };
      const decision = pageVault.prepareSave(origin, credential);
      if (decision.action === 'none') return { offered: false, reason: 'already stored' };
      // Hand off to the browser to draw the prompt. The page learns only that
      // a prompt was offered - not what is stored, not whether it matched.
      if (typeof onSaveOffer === 'function') {
        onSaveOffer(event.sender, origin, decision, credential);
      }
      return { offered: true, action: decision.action, needsUnlock: decision.needsUnlock };
    },
    'pagevault:open-manager': (origin, args, event) => {
      const id = event.sender.id;
      const now = Date.now();
      const last = lastOpen.get(id) || 0;
      if (now - last < OPEN_COOLDOWN_MS) return { opened: false, reason: 'too soon' };
      lastOpen.set(id, now);
      if (typeof onOpenManager === 'function') onOpenManager(event.sender, origin);
      return { opened: true };
    },
  };

  const channels = Object.keys(handlers);
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (event, args) => {
      if (!isAuthorisedTab(event)) {
        return { ok: false, code: 'FORBIDDEN', message: 'Not permitted.' };
      }
      const origin = senderOrigin(event);
      if (!origin) {
        return { ok: false, code: 'BAD_ORIGIN', message: 'This frame cannot use the vault.' };
      }
      try {
        return { ok: true, value: await handlers[channel](origin, args, event) };
      } catch (err) {
        return toFailure(err);
      }
    });
  }
  return channels;
}

export function unregisterPageVaultIpc(channels) {
  for (const c of channels) ipcMain.removeHandler(c);
}
