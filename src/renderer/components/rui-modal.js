import { createElement, applyDiff } from '../../../vendor/webjsx.js';

class RuiModal extends HTMLElement {
  static get observedAttributes() { return ['open', 'title']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _close() {
    this.removeAttribute('open');
    this.dispatchEvent(new CustomEvent('rui-close', { bubbles: true }));
  }

  _render() {
    const open = this.hasAttribute('open');
    const title = this.getAttribute('title') || '';

    applyDiff(this, [
      createElement('dialog', {
        class: `modal${open ? ' modal-open' : ''}`,
        onclick: (e) => { if (e.target === e.currentTarget) this._close(); },
      },
        createElement('div', { class: 'modal-box' },
          createElement('div', { class: 'flex items-center justify-between mb-4' },
            createElement('h3', { class: 'font-bold text-lg' }, title),
            createElement('button', {
              class: 'btn btn-ghost btn-sm btn-circle',
              onclick: () => this._close(),
            }, '✕')
          ),
          createElement('div', { class: 'modal-body' })
        )
      ),
    ]);
  }
}

customElements.define('rui-modal', RuiModal);
