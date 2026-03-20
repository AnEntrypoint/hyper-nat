const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startRelay(config) {
    return ipcRenderer.invoke('relay:start', config);
  },

  stopRelay(id) {
    return ipcRenderer.invoke('relay:stop', id);
  },

  getRelays() {
    return ipcRenderer.invoke('relay:list');
  },

  getSettings() {
    return ipcRenderer.invoke('settings:get');
  },

  saveSettings(settings) {
    return ipcRenderer.invoke('settings:save', settings);
  },

  onRelayStateChange(callback) {
    ipcRenderer.removeAllListeners('relay:state-changed');
    ipcRenderer.on('relay:state-changed', (_event, data) => callback(data));
  },

  onRelayListUpdated(callback) {
    ipcRenderer.removeAllListeners('relay:list-updated');
    ipcRenderer.on('relay:list-updated', (_event, relays) => callback(relays));
  },

  onLogMessage(callback) {
    ipcRenderer.removeAllListeners('log:message');
    ipcRenderer.on('log:message', (_event, entry) => callback(entry));
  },
});
