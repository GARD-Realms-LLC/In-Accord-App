const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iaLauncher', {
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getDiscordVersions: () => ipcRenderer.invoke('get-discord-versions'),
  getChannelStatus: (channel) => ipcRenderer.invoke('get-channel-status', channel),
  getLauncherInfo: () => ipcRenderer.invoke('get-launcher-info'),
  getChangelog: () => ipcRenderer.invoke('get-changelog'),
  downloadDiscordInstaller: (channel) => ipcRenderer.invoke('download-discord-installer', channel),
  install: (channel) => ipcRenderer.invoke('install', channel),
  uninstall: (channel) => ipcRenderer.invoke('uninstall', channel),
  launch: (channel) => ipcRenderer.invoke('launch', channel),
  readCrashErrors: (channel) => ipcRenderer.invoke('read-crash-errors', channel),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
