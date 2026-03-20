import { createMachine, assign } from '../../vendor/xstate.js';

function appendLog(context, event) {
  const next = [...context.logEntries, event.entry];
  return next.length > 500 ? next.slice(next.length - 500) : next;
}

const sharedOn = {
  UPDATE_RELAYS: { actions: assign({ relays: ({ event }) => event.relays }) },
  APPEND_LOG: { actions: assign({ logEntries: ({ context, event }) => appendLog(context, event) }) },
  UPDATE_SETTINGS: { actions: assign({ settings: ({ event }) => event.settings }) },
};

export const uiMachine = createMachine({
  id: 'ui',
  initial: 'home',
  context: {
    relays: [],
    logEntries: [],
    settings: { logLevel: 'info', defaultTimeout: 15000, defaultHost: '127.0.0.1' },
  },
  states: {
    home: {
      on: {
        ...sharedOn,
        NAVIGATE_ADD: 'add_relay',
        NAVIGATE_SETTINGS: 'settings',
        NAVIGATE_LOGS: 'logs',
      },
    },
    add_relay: {
      on: {
        ...sharedOn,
        NAVIGATE_HOME: 'home',
        NAVIGATE_SETTINGS: 'settings',
        NAVIGATE_LOGS: 'logs',
      },
    },
    settings: {
      on: {
        ...sharedOn,
        NAVIGATE_HOME: 'home',
        NAVIGATE_ADD: 'add_relay',
        NAVIGATE_LOGS: 'logs',
      },
    },
    logs: {
      on: {
        ...sharedOn,
        NAVIGATE_HOME: 'home',
        NAVIGATE_ADD: 'add_relay',
        NAVIGATE_SETTINGS: 'settings',
        CLEAR_LOGS: { actions: assign({ logEntries: () => [] }) },
      },
    },
  },
});
