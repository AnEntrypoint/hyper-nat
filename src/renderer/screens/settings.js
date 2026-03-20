import { createElement, applyDiff } from '../../../vendor/webjsx.js';
import { getSnapshot, send } from '../app-state.js';

class AppSettings extends HTMLElement {
  constructor() {
    super();
    this._form = { logLevel: 'info', defaultTimeout: 15000, defaultHost: '127.0.0.1' };
    this._saved = false;
    this._error = '';
  }

  connectedCallback() {
    const snap = getSnapshot();
    this._form = { ...snap.context.settings };
    this._render();
  }

  _set(key, value) {
    this._form[key] = value;
    this._saved = false;
    this._render();
  }

  async _save() {
    const timeout = parseInt(this._form.defaultTimeout);
    if (isNaN(timeout) || timeout < 1000) {
      this._error = 'Timeout must be at least 1000ms';
      this._render();
      return;
    }
    if (!this._form.defaultHost.trim()) {
      this._error = 'Host cannot be empty';
      this._render();
      return;
    }
    this._error = '';
    const res = await window.electronAPI.saveSettings(this._form);
    if (res.ok) {
      send({ type: 'UPDATE_SETTINGS', settings: res.settings });
      this._saved = true;
    } else {
      this._error = res.error || 'Save failed';
    }
    this._render();
  }

  _render() {
    const f = this._form;
    applyDiff(this, [
      createElement('div', { class: 'p-6 max-w-md mx-auto' },
        createElement('h2', { class: 'text-xl font-bold mb-4' }, 'Settings'),

        this._saved && createElement('div', { class: 'alert alert-success mb-4' },
          createElement('span', {}, '✓ Settings saved')
        ),
        this._error && createElement('div', { class: 'alert alert-error mb-4' },
          createElement('span', {}, this._error)
        ),

        createElement('div', { class: 'form-control mb-4' },
          createElement('label', { class: 'label' },
            createElement('span', { class: 'label-text font-medium' }, 'Log Level')
          ),
          createElement('select', {
            class: 'select select-bordered w-full',
            onchange: (e) => this._set('logLevel', e.target.value),
          },
            ...['error', 'warn', 'info', 'debug'].map(level =>
              createElement('option', { value: level, selected: f.logLevel === level }, level)
            )
          )
        ),

        createElement('div', { class: 'form-control mb-4' },
          createElement('label', { class: 'label' },
            createElement('span', { class: 'label-text font-medium' }, 'Default Timeout (ms)')
          ),
          createElement('input', {
            type: 'number',
            value: String(f.defaultTimeout),
            class: 'input input-bordered w-full',
            oninput: (e) => this._set('defaultTimeout', parseInt(e.target.value) || 15000),
          })
        ),

        createElement('div', { class: 'form-control mb-4' },
          createElement('label', { class: 'label' },
            createElement('span', { class: 'label-text font-medium' }, 'Default Host')
          ),
          createElement('input', {
            type: 'text',
            value: f.defaultHost,
            class: 'input input-bordered w-full',
            oninput: (e) => this._set('defaultHost', e.target.value),
          })
        ),

        createElement('button', {
          class: 'btn btn-primary w-full mt-2',
          onclick: () => this._save(),
        }, 'Save Settings')
      ),
    ]);
  }
}

customElements.define('app-settings', AppSettings);
