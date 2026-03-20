import { createElement, applyDiff } from '../../../vendor/webjsx.js';
import { navigate } from '../app-state.js';

function randomSecret() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function field(label, children) {
  return createElement('div', { class: 'form-control mb-4' },
    createElement('label', { class: 'label' },
      createElement('span', { class: 'label-text font-medium' }, label)
    ),
    ...children
  );
}

function numInput(placeholder, value, onInput) {
  return createElement('input', {
    type: 'number', placeholder, value,
    class: 'input input-bordered w-full',
    oninput: (e) => onInput(e.target.value),
  });
}

function textInput(placeholder, value, cls, onInput) {
  return createElement('input', {
    type: 'text', placeholder, value,
    class: cls || 'input input-bordered w-full',
    oninput: (e) => onInput(e.target.value),
  });
}

class AppAddRelay extends HTMLElement {
  constructor() {
    super();
    this._s = { mode: 'server', proto: 'tcp', port: '', localPort: '', host: '127.0.0.1', secret: '', publicKey: '', loading: false, error: '', portError: '' };
  }

  connectedCallback() { this._s.secret = randomSecret(); this._render(); }

  _set(k, v) { this._s[k] = v; this._render(); }

  async _submit() {
    const s = this._s;
    const port = parseInt(s.port);
    if (isNaN(port) || port < 1 || port > 65535) { this._set('portError', 'Port must be 1-65535'); return; }
    if (s.mode === 'client' && !s.publicKey.trim()) { this._set('error', 'Public key required'); return; }
    this._s.loading = true; this._s.error = ''; this._s.portError = ''; this._render();
    const config = {
      mode: s.mode, proto: s.proto, port, host: s.host || '127.0.0.1',
      ...(s.mode === 'server' ? { secret: s.secret } : { localPort: parseInt(s.localPort) || port, publicKey: s.publicKey.trim() }),
    };
    const res = await window.electronAPI.startRelay(config);
    if (res.ok) { navigate('home'); return; }
    this._s.loading = false; this._s.error = res.error || 'Failed to start relay'; this._render();
  }

  _render() {
    const s = this._s;
    const protos = ['tcp', 'udp', 'tcpudp'];
    applyDiff(this, [
      createElement('div', { class: 'p-6 max-w-lg mx-auto' },
        createElement('h2', { class: 'text-xl font-bold mb-4' }, 'Add Relay'),
        s.error && createElement('div', { class: 'alert alert-error mb-4' }, createElement('span', {}, s.error)),

        field('Mode', [createElement('div', { class: 'flex gap-3' },
          ...['server', 'client'].map(m =>
            createElement('label', { class: 'flex items-center gap-2 cursor-pointer' },
              createElement('input', { type: 'radio', class: 'radio radio-primary', name: 'mode', checked: s.mode === m, onchange: () => this._set('mode', m) }),
              createElement('span', { class: 'label-text' }, m.charAt(0).toUpperCase() + m.slice(1))
            )
          )
        )]),

        field('Protocol', [createElement('div', { class: 'tabs tabs-boxed bg-base-200 inline-flex' },
          ...protos.map(p => createElement('button', { class: `tab${s.proto === p ? ' tab-active' : ''}`, onclick: () => this._set('proto', p) }, p.toUpperCase()))
        )]),

        field(s.mode === 'server' ? 'Local Port to Expose' : 'Remote Port', [
          numInput('3000', s.port, v => this._set('port', v)),
          s.portError && createElement('label', { class: 'label' }, createElement('span', { class: 'label-text-alt text-error' }, s.portError)),
        ]),

        s.mode === 'client' && field('Local Port', [numInput('Same as remote', s.localPort, v => this._set('localPort', v))]),
        field('Host', [textInput('127.0.0.1', s.host, null, v => this._set('host', v))]),

        s.mode === 'server' && field('Secret', [
          createElement('div', { class: 'flex items-center gap-1' },
            createElement('label', { class: 'label-text-alt text-base-content/50 text-xs ml-auto' }, 'Auto-generated')
          ),
          textInput('', s.secret, 'input input-bordered w-full font-mono text-xs', v => this._set('secret', v)),
        ]),

        s.mode === 'client' && field('Public Key', [
          textInput('Server public key (base58)', s.publicKey, 'input input-bordered w-full font-mono text-xs', v => this._set('publicKey', v)),
        ]),

        createElement('div', { class: 'flex gap-3 mt-6' },
          createElement('button', { class: `btn btn-primary flex-1${s.loading ? ' loading' : ''}`, disabled: s.loading, onclick: () => this._submit() }, s.loading ? 'Starting...' : 'Start Relay'),
          createElement('button', { class: 'btn btn-ghost', onclick: () => navigate('home') }, 'Cancel'),
        )
      ),
    ]);
  }
}

customElements.define('app-add-relay', AppAddRelay);
