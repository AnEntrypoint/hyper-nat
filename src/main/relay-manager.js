const { createActor } = require('xstate');
const { createRelayMachine } = require('../shared/relay-machine');
const ModeHandler = require('../../lib/modes');
const { createBridgedLogger } = require('./logger-bridge');

const logger = createBridgedLogger(process.env.LOG_LEVEL || 'info');
let _onStateChange = null;
let _idCounter = 0;
const _actors = new Map();

function setStateChangeCallback(fn) {
  _onStateChange = fn;
}

function notifyStateChange(id, snapshot) {
  if (_onStateChange) {
    _onStateChange(id, {
      state: snapshot.value,
      context: {
        id: snapshot.context.id,
        proto: snapshot.context.proto,
        port: snapshot.context.port,
        localPort: snapshot.context.localPort,
        host: snapshot.context.host,
        mode: snapshot.context.mode,
        publicKey: snapshot.context.publicKey,
        error: snapshot.context.error,
      },
    });
  }
}

async function startRelay(config) {
  const id = `relay-${++_idCounter}`;
  const machine = createRelayMachine(id);
  const actor = createActor(machine);

  actor.subscribe((snapshot) => {
    notifyStateChange(id, snapshot);
  });

  actor.start();

  try {
    if (config.mode === 'server') {
      actor.send({ type: 'START_SERVER', config });
      const publicKey = await ModeHandler.server({
        proto: config.proto,
        port: config.port,
        host: config.host || '127.0.0.1',
        secret: config.secret,
        showCommands: false,
      });
      actor.send({ type: 'KEY_GENERATED', publicKey });
      actor.send({ type: 'STARTED', handle: null });
      _actors.set(id, actor);
      logger.info(`Relay ${id} started (server, ${config.proto}:${config.port})`);
      return { id, publicKey };
    } else {
      actor.send({ type: 'START_CLIENT', config });
      await ModeHandler.client({
        proto: config.proto,
        port: config.port,
        localPort: config.localPort || config.port,
        publicKey: config.publicKey,
        host: config.host || '127.0.0.1',
      });
      actor.send({ type: 'STARTED', handle: null });
      _actors.set(id, actor);
      logger.info(`Relay ${id} started (client, ${config.proto}:${config.port})`);
      return { id };
    }
  } catch (err) {
    logger.error(`Relay ${id} failed to start: ${err.message}`);
    actor.send({ type: 'ERROR', message: err.message });
    _actors.set(id, actor);
    throw err;
  }
}

function stopRelay(id) {
  const actor = _actors.get(id);
  if (!actor) throw new Error(`Relay ${id} not found`);
  actor.send({ type: 'STOP' });
  setTimeout(() => {
    try { actor.send({ type: 'STOPPED' }); } catch (_) {}
    _actors.delete(id);
    logger.info(`Relay ${id} stopped`);
  }, 200);
}

function listRelays() {
  const result = [];
  for (const [id, actor] of _actors.entries()) {
    const snap = actor.getSnapshot();
    result.push({
      id,
      state: snap.value,
      proto: snap.context.proto,
      port: snap.context.port,
      localPort: snap.context.localPort,
      host: snap.context.host,
      mode: snap.context.mode,
      publicKey: snap.context.publicKey,
      error: snap.context.error,
    });
  }
  return result;
}

module.exports = { startRelay, stopRelay, listRelays, setStateChangeCallback };
