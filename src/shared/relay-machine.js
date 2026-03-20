const { createMachine, assign } = require('xstate');

function createRelayMachine(id) {
  return createMachine({
    id: `relay-${id}`,
    initial: 'idle',
    context: {
      id,
      proto: null,
      port: null,
      localPort: null,
      host: '127.0.0.1',
      secret: null,
      publicKey: null,
      mode: null,
      error: null,
      relayHandle: null,
    },
    states: {
      idle: {
        on: {
          START_SERVER: {
            actions: assign({
              proto: ({ event }) => event.config.proto,
              port: ({ event }) => event.config.port,
              localPort: ({ event }) => event.config.localPort || null,
              host: ({ event }) => event.config.host || '127.0.0.1',
              secret: ({ event }) => event.config.secret || null,
              publicKey: ({ event }) => event.config.publicKey || null,
              mode: () => 'server',
              error: () => null,
            }),
            target: 'generating_key',
          },
          START_CLIENT: {
            actions: assign({
              proto: ({ event }) => event.config.proto,
              port: ({ event }) => event.config.port,
              localPort: ({ event }) => event.config.localPort || null,
              host: ({ event }) => event.config.host || '127.0.0.1',
              secret: () => null,
              publicKey: ({ event }) => event.config.publicKey || null,
              mode: () => 'client',
              error: () => null,
            }),
            target: 'starting',
          },
        },
      },
      generating_key: {
        on: {
          KEY_GENERATED: {
            actions: assign({ publicKey: ({ event }) => event.publicKey }),
            target: 'starting',
          },
          ERROR: {
            actions: assign({ error: ({ event }) => event.message }),
            target: 'error',
          },
        },
      },
      starting: {
        on: {
          STARTED: {
            actions: assign({ relayHandle: ({ event }) => event.handle || null }),
            target: 'running',
          },
          ERROR: {
            actions: assign({ error: ({ event }) => event.message }),
            target: 'error',
          },
        },
      },
      running: {
        on: {
          STOP: 'stopping',
          ERROR: {
            actions: assign({ error: ({ event }) => event.message }),
            target: 'error',
          },
        },
      },
      stopping: {
        on: {
          STOPPED: {
            actions: assign({ relayHandle: () => null }),
            target: 'idle',
          },
          ERROR: {
            actions: assign({ error: ({ event }) => event.message }),
            target: 'idle',
          },
        },
      },
      error: {
        on: {
          START_SERVER: {
            actions: assign({
              proto: ({ event }) => event.config.proto,
              port: ({ event }) => event.config.port,
              localPort: ({ event }) => event.config.localPort || null,
              host: ({ event }) => event.config.host || '127.0.0.1',
              secret: ({ event }) => event.config.secret || null,
              publicKey: ({ event }) => event.config.publicKey || null,
              mode: () => 'server',
              error: () => null,
            }),
            target: 'generating_key',
          },
          START_CLIENT: {
            actions: assign({
              proto: ({ event }) => event.config.proto,
              port: ({ event }) => event.config.port,
              localPort: ({ event }) => event.config.localPort || null,
              host: ({ event }) => event.config.host || '127.0.0.1',
              secret: () => null,
              publicKey: ({ event }) => event.config.publicKey || null,
              mode: () => 'client',
              error: () => null,
            }),
            target: 'starting',
          },
          STOP: 'idle',
        },
      },
    },
  });
}

module.exports = { createRelayMachine };
