const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  logLevel: 'info',
  defaultTimeout: 15000,
  defaultHost: '127.0.0.1',
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return { ...DEFAULTS };
}

function saveSettings(settings) {
  try {
    const p = getSettingsPath();
    const merged = { ...DEFAULTS, ...settings };
    fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (e) {
    throw new Error(`Failed to save settings: ${e.message}`);
  }
}

module.exports = { getSettings, saveSettings, DEFAULTS };
