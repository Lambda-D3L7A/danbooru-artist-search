const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getArtists: (opts) => ipcRenderer.invoke('danbooru:getArtists', opts),
  getArtistPosts: (opts) => ipcRenderer.invoke('danbooru:getArtistPosts', opts),
  autocomplete: (q) => ipcRenderer.invoke('danbooru:autocomplete', q),
  testAuth: (creds) => ipcRenderer.invoke('danbooru:testAuth', creds),
  storeGet: (key, fallback) => ipcRenderer.invoke('store:get', key, fallback),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  copy: (text) => ipcRenderer.invoke('app:copy', text),
});
