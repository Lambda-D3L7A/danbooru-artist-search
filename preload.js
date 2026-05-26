const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getArtists: (opts) => ipcRenderer.invoke('danbooru:getArtists', opts),
  getArtistPosts: (opts) => ipcRenderer.invoke('danbooru:getArtistPosts', opts),
  autocomplete: (q, type) => ipcRenderer.invoke('danbooru:autocomplete', q, type),
  testAuth: (creds) => ipcRenderer.invoke('danbooru:testAuth', creds),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  downloadStart: (opts) => ipcRenderer.invoke('download:start', opts),
  downloadCancel: (name) => ipcRenderer.invoke('download:cancel', name),
  downloadSingle: (opts) => ipcRenderer.invoke('download:single', opts),
  onDownloadProgress: (cb) => ipcRenderer.on('download:progress', (_e, p) => cb(p)),
  storeGet: (key, fallback) => ipcRenderer.invoke('store:get', key, fallback),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  copy: (text) => ipcRenderer.invoke('app:copy', text),
});
