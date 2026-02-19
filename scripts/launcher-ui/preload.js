const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iaLauncher', {
  install: (channel, targetPlatform) => ipcRenderer.invoke('install', channel, targetPlatform),
  launch: (channel, targetPlatform) => ipcRenderer.invoke('launch', channel, targetPlatform),
  showError: (msg) => ipcRenderer.invoke('show-error', msg),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
