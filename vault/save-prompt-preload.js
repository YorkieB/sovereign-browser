const { contextBridge, ipcRenderer } = require('electron');

// Two calls, nothing else. The prompt is display and a decision, and it never
// sees a password - main holds the credential and commits it itself.
contextBridge.exposeInMainWorld('savePrompt', Object.freeze({
  payload: () => ipcRenderer.invoke('saveprompt:payload'),
  respond: (choice) => ipcRenderer.invoke('saveprompt:respond', { choice }),
}));
