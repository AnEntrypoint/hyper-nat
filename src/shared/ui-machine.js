const { createMachine, assign } = require('xstate');

const uiMachine = createMachine({
  id: 'ui',
  initial: 'home',
  context: {
    relays: [],
    logEntries: [],
    settings: {
      logLevel: 'info',
      defaultTimeout: 15000,
      defaultHost: '127.0.0.1',
    },
  },
  states: {
    home: {
      on: {
        NAVIGATE_ADD: 'add_relay',
        NAVIGATE_SETTINGS: 'settings',
        NAVIGATE_LOGS: 'logs',
        UPDATE_RELAYS: { actions: assign({ relays: ({ event }) => event.relays }) },
        APPEND_LOG: {
          actions: assign({
            logEntries: ({ context, event }) => {
              const next = [...context.logEntries, event.entry];
              return next.length > 500 ? next.slice(next.length - 500) : next;
            },
          }),
        },
        UPDATE_SETTINGS: { actions: assign({ settings: ({ event }) => event.settings }) },
      },
    },
    add_relay: {
      on: {
        NAVIGATE_HOME: 'home',
        NAVIGATE_SETTINGS: 'settings',
        NAVIGATE_LOGS: 'logs',
        UPDATE_RELAYS: { actions: assign({ relays: ({ event }) => event.relays }) },
        APPEND_LOG: {
          actions: assign({
            logEntries: ({ context, event }) => {
              const next = [...context.logEntries, event.entry];
              return next.length > 500 ? next.slice(next.length - 500) : next;
            },
          }),
        },
      },
    },
    settings: {
      on: {
        NAVIGATE_HOME: 'home',
        NAVIGATE_ADD: 'add_relay',
        NAVIGATE_LOGS: 'logs',
        UPDATE_RELAYS: { actions: assign({ relays: ({ event }) => event.relays }) },
        APPEND_LOG: {
          actions: assign({
            logEntries: ({ context, event }) => {
              const next = [...context.logEntries, event.entry];
              return next.length > 500 ? next.slice(next.length - 500) : next;
            },
          }),
        },
        UPDATE_SETTINGS: { actions: assign({ settings: ({ event }) => event.settings }) },
      },
    },
    logs: {
      on: {
        NAVIGATE_HOME: 'home',
        NAVIGATE_ADD: 'add_relay',
        NAVIGATE_SETTINGS: 'settings',
        UPDATE_RELAYS: { actions: assign({ relays: ({ event }) => event.relays }) },
        APPEND_LOG: {
          actions: assign({
            logEntries: ({ context, event }) => {
              const next = [...context.logEntries, event.entry];
              return next.length > 500 ? next.slice(next.length - 500) : next;
            },
          }),
        },
        CLEAR_LOGS: { actions: assign({ logEntries: () => [] }) },
      },
    },
  },
});

module.exports = { uiMachine };
