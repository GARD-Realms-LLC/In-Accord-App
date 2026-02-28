const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iaLauncher', {
  install: (channel, targetPlatform) => ipcRenderer.invoke('install', channel, targetPlatform),
  uninstall: (channel) => ipcRenderer.invoke('uninstall', channel),
  launch: (channel, targetPlatform) => ipcRenderer.invoke('launch', channel, targetPlatform),
  getChangelog: () => ipcRenderer.invoke('get-changelog'),
  getStatus: () => ipcRenderer.invoke('get-status'), // already exists
  getAssetPath: (name) => ipcRenderer.invoke('get-asset-path', name), // already exists
  showError: (msg) => ipcRenderer.invoke('show-error', msg),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  restoreFromTray: () => ipcRenderer.invoke('restore-from-tray')
});
