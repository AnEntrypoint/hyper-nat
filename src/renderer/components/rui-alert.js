import { createElement, applyDiff } from '../../../vendor/webjsx.js';

const TYPE_CLASSES = {
  success: 'alert alert-success',
  error: 'alert alert-error',
  warning: 'alert alert-warning',
  info: 'alert alert-info',
};

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

class RuiAlert extends HTMLElement {
  static get observedAttributes() { return ['type', 'message']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _render() {
    const type = this.getAttribute('type') || 'info';
    const message = this.getAttribute('message') || this.textContent.trim();
    if (!message) { applyDiff(this, []); return; }
    const cls = TYPE_CLASSES[type] || 'alert alert-info';
    applyDiff(this, [
      createElement('div', { class: cls, role: 'alert' },
        createElement('span', { class: 'text-sm font-medium' }, `${ICONS[type] || ''} ${message}`)
      ),
    ]);
  }
}

customElements.define('rui-alert', RuiAlert);
