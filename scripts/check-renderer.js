// Run as: electron scripts/check-renderer.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const results = { errors: [], logs: [], loaded: false };

app.whenReady().then(async () => {
  const { registerIpcHandlers } = require('../src/main/ipc-handlers');
  registerIpcHandlers();
  const win = new BrowserWindow({
    width: 1100, height: 720, show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const entry = { level, message, line, source: path.basename(sourceId || '') };
    if (level >= 2) results.errors.push(entry);
    else results.logs.push(entry);
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    results.errors.push({ type: 'load-fail', code, desc, url });
  });

  win.webContents.on('did-finish-load', () => {
    results.loaded = true;
  });

  win.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  setTimeout(() => {
    fs.writeFileSync(path.join(__dirname, 'renderer-check-result.json'), JSON.stringify(results, null, 2));
    app.quit();
  }, 5000);
});
