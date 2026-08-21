// Preload for the vault window ONLY.
//
// This file must never be attached to the chrome UI window or to any tab: it
// is the only place vault channels are reachable from a renderer. Even so it is
// not the security boundary - main.js pins the vault window's webContents id
// and refuses these channels from anywhere else. Two locks, because a preload
// travels with whatever window it is attached to and mistakes are easy.
//
// Sits alongside preload.js (the chrome UI preload) but shares nothing with it.

const { contextBridge, ipcRenderer } = require('electron');

// Every call resolves to { ok: true, value } or { ok: false, code, message }.
// Error classes do not survive IPC, so the UI branches on code:
//   AUTH      wrong master password, or the vault file has been altered
//   LOCKED    the vault is locked (manually or by idle auto-lock)
//   FORMAT    the vault file is missing or damaged
//   STATE     bad input, or an operation that does not apply right now
//   FORBIDDEN this renderer is not the authorised vault window
//   UNKNOWN   unexpected fault; details stay in the HOLLY log
const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('vault', Object.freeze({
  state: () => call('vault:state'),
  status: () => call('vault:status'),

  create: (masterPassword) => call('vault:create', masterPassword),
  unlock: (masterPassword) => call('vault:unlock', masterPassword),
  lock: () => call('vault:lock'),
  touch: () => call('vault:touch'),
  changeMasterPassword: (oldPw, newPw) => call('vault:change-master', oldPw, newPw),

  list: () => call('vault:list'),
  get: (id) => call('vault:get', id),
  add: (entry) => call('vault:add', entry),
  update: (id, patch) => call('vault:update', id, patch),
  remove: (id) => call('vault:remove', id),
  importEntries: (entries) => call('vault:import', entries),

  setAutoLock: (value) => call('vault:set-auto-lock', value),
  generate: (options) => call('vault:generate', options),

  // main -> renderer, fired when the vault locks itself so the UI can drop the
  // decrypted entries without polling. Returns an unsubscribe function.
  onLocked: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const wrapped = () => handler();
    ipcRenderer.on('vault:locked', wrapped);
    return () => ipcRenderer.removeListener('vault:locked', wrapped);
  },
}));
