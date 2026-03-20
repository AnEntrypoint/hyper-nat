import { createElement, applyDiff } from '../../../vendor/webjsx.js';
import { getSnapshot, subscribe, navigate } from '../app-state.js';

const STATE_BADGE = {
  running: { color: 'green', text: 'Running' },
  starting: { color: 'yellow', text: 'Starting' },
  generating_key: { color: 'yellow', text: 'Generating Key' },
  stopping: { color: 'yellow', text: 'Stopping' },
  error: { color: 'red', text: 'Error' },
  idle: { color: 'gray', text: 'Idle' },
};

class AppHome extends HTMLElement {
  connectedCallback() {
    this._unsub = subscribe(() => this._render());
    this._render();
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }

  async _stopRelay(id) {
    await window.electronAPI.stopRelay(id);
  }

  async _copyKey(key) {
    try { await navigator.clipboard.writeText(key); } catch (_) {}
  }

  _render() {
    const snap = getSnapshot();
    const { relays } = snap.context;

    if (relays.length === 0) {
      applyDiff(this, [
        createElement('div', { class: 'flex flex-col items-center justify-center h-64 gap-4 text-base-content/50' },
          createElement('div', { class: 'text-5xl' }, '🌐'),
          createElement('p', { class: 'text-lg' }, 'No active relays'),
          createElement('button', {
            class: 'btn btn-primary mt-2',
            onclick: () => navigate('add_relay'),
          }, 'Add Relay'),
        ),
      ]);
      return;
    }

    applyDiff(this, [
      createElement('div', { class: 'p-4 flex flex-col gap-3' },
        createElement('div', { class: 'flex items-center justify-between mb-2' },
          createElement('h2', { class: 'text-xl font-bold' }, 'Active Relays'),
          createElement('button', {
            class: 'btn btn-primary btn-sm',
            onclick: () => navigate('add_relay'),
          }, '+ Add Relay'),
        ),
        ...relays.map(relay => this._renderRelayCard(relay))
      ),
    ]);
  }

  _renderRelayCard(relay) {
    const badge = STATE_BADGE[relay.state] || STATE_BADGE.idle;
    const isStopping = relay.state === 'stopping';

    return createElement('div', { class: 'card bg-base-200 shadow-sm border border-base-content/10' },
      createElement('div', { class: 'card-body p-4 flex flex-row items-start justify-between gap-4' },
        createElement('div', { class: 'flex flex-col gap-1 min-w-0 flex-1' },
          createElement('div', { class: 'flex items-center gap-2 flex-wrap' },
            createElement('span', { class: 'font-bold text-base' }, relay.proto?.toUpperCase() || ''),
            createElement('span', { class: 'badge badge-ghost badge-sm' }, relay.mode || ''),
            createElement('span', { class: `badge badge-sm ${badge.color === 'green' ? 'badge-success' : badge.color === 'red' ? 'badge-error' : badge.color === 'yellow' ? 'badge-warning' : 'badge-ghost'}` }, badge.text),
          ),
          createElement('div', { class: 'text-sm text-base-content/60' },
            `Port: ${relay.port || ''}${relay.localPort && relay.localPort !== relay.port ? ` → ${relay.localPort}` : ''} | Host: ${relay.host || '127.0.0.1'}`
          ),
          relay.publicKey && createElement('div', { class: 'flex items-center gap-2 mt-1' },
            createElement('code', { class: 'text-xs bg-base-300 px-2 py-1 rounded truncate max-w-xs' }, relay.publicKey.slice(0, 32) + '...'),
            createElement('button', {
              class: 'btn btn-xs btn-ghost',
              onclick: () => this._copyKey(relay.publicKey),
              title: 'Copy public key',
            }, '⎘'),
          ),
          relay.error && createElement('div', { class: 'text-xs text-error mt-1' }, relay.error),
        ),
        createElement('button', {
          class: 'btn btn-error btn-sm flex-shrink-0',
          disabled: isStopping,
          onclick: () => this._stopRelay(relay.id),
        }, isStopping ? '...' : 'Stop'),
      )
    );
  }
}

customElements.define('app-home', AppHome);
