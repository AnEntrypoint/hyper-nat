import { createActor } from '../../vendor/xstate.js';
import { uiMachine } from '../shared/ui-machine-esm.js';

let _actor = null;
const _subscribers = new Set();

function getActor() {
  if (!_actor) {
    _actor = createActor(uiMachine);
    _actor.subscribe(() => {
      for (const fn of _subscribers) fn(getSnapshot());
    });
    _actor.start();

    window.electronAPI.onRelayListUpdated((relays) => {
      _actor.send({ type: 'UPDATE_RELAYS', relays });
    });

    window.electronAPI.onLogMessage((entry) => {
      _actor.send({ type: 'APPEND_LOG', entry });
    });

    window.electronAPI.getRelays().then((res) => {
      if (res.ok) _actor.send({ type: 'UPDATE_RELAYS', relays: res.relays });
    });

    window.electronAPI.getSettings().then((res) => {
      if (res.ok) _actor.send({ type: 'UPDATE_SETTINGS', settings: res.settings });
    });
  }
  return _actor;
}

function getSnapshot() {
  return getActor().getSnapshot();
}

function send(event) {
  getActor().send(event);
}

function subscribe(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

function navigate(screen) {
  const eventMap = {
    home: 'NAVIGATE_HOME',
    add_relay: 'NAVIGATE_ADD',
    settings: 'NAVIGATE_SETTINGS',
    logs: 'NAVIGATE_LOGS',
  };
  const type = eventMap[screen];
  if (type) send({ type });
}

export { getSnapshot, send, subscribe, navigate };
