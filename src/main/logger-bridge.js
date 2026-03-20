const { Logger } = require('../../lib/utils/logger');

let _broadcastFn = null;
const _queue = [];

function initLoggerBridge(broadcastFn) {
  _broadcastFn = broadcastFn;
  for (const entry of _queue) {
    _broadcastFn(entry);
  }
  _queue.length = 0;
}

function broadcast(entry) {
  if (_broadcastFn) {
    try { _broadcastFn(entry); } catch (_) {}
  } else {
    _queue.push(entry);
  }
}

class BridgedLogger extends Logger {
  constructor(level) {
    super(level);
  }

  error(message, ...args) {
    super.error(message, ...args);
    broadcast({ level: 'error', message: String(message), timestamp: new Date().toISOString() });
  }

  warn(message, ...args) {
    super.warn(message, ...args);
    broadcast({ level: 'warn', message: String(message), timestamp: new Date().toISOString() });
  }

  info(message, ...args) {
    super.info(message, ...args);
    broadcast({ level: 'info', message: String(message), timestamp: new Date().toISOString() });
  }

  debug(message, ...args) {
    super.debug(message, ...args);
    broadcast({ level: 'debug', message: String(message), timestamp: new Date().toISOString() });
  }
}

function createBridgedLogger(level) {
  return new BridgedLogger(level);
}

module.exports = { initLoggerBridge, createBridgedLogger };
