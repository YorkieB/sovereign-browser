// Preload for TABS - i.e. for arbitrary web pages. Assume everything talking
// to this is hostile.
//
// It exposes no vault state, no entry list, and no way to commit a save. Note
// there is no origin parameter anywhere: the page cannot supply one, because
// main reads it from the frame instead.

const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, args) => ipcRenderer.invoke(channel, args || {});

contextBridge.exposeInMainWorld('hollyVault', Object.freeze({
  // Credentials for THIS page: id, username, service name. Never a password.
  suggestions: () => call('pagevault:query'),

  // One password, for one id this origin owns. Called after the user picks a
  // suggestion; main re-checks the id against this origin regardless.
  fill: (id) => call('pagevault:fill', { id }),

  // Works with the vault locked - registering on a site should not demand a
  // master password before you have even chosen one.
  generate: (options) => call('pagevault:generate', { options }),

  // Asks the BROWSER to offer a save. Returns only whether a prompt was
  // offered; the page never learns what is stored, and cannot accept on the
  // user's behalf.
  offerSave: (username, password) => call('pagevault:offer-save', { username, password }),

  // "Manage passwords": asks HOLLY to open the Keychain window. Returns
  // nothing about the vault, and main rate-limits it so a page cannot spam
  // windows open.
  openManager: () => call('pagevault:open-manager'),
}));
