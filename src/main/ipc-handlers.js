const { ipcMain, BrowserWindow } = require('electron');
const { startRelay, stopRelay, listRelays, setStateChangeCallback } = require('./relay-manager');
const { getSettings, saveSettings } = require('./settings-store');
const { initLoggerBridge } = require('./logger-bridge');

function broadcastToAll(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

function registerIpcHandlers() {
  initLoggerBridge((entry) => broadcastToAll('log:message', entry));

  setStateChangeCallback((id, stateInfo) => {
    broadcastToAll('relay:state-changed', { id, ...stateInfo });
    broadcastToAll('relay:list-updated', listRelays());
  });

  ipcMain.handle('relay:start', async (_event, config) => {
    try {
      const result = await startRelay(config);
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('relay:stop', async (_event, id) => {
    try {
      stopRelay(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('relay:list', async () => {
    return { ok: true, relays: listRelays() };
  });

  ipcMain.handle('settings:get', async () => {
    return { ok: true, settings: getSettings() };
  });

  ipcMain.handle('settings:save', async (_event, settings) => {
    try {
      const saved = saveSettings(settings);
      return { ok: true, settings: saved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerIpcHandlers };
