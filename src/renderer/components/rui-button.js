import { createElement, applyDiff } from '../../../vendor/webjsx.js';

const VARIANT_CLASSES = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  error: 'btn btn-error',
  ghost: 'btn btn-ghost',
  outline: 'btn btn-outline',
};

class RuiButton extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'disabled', 'type', 'size', 'loading'];
  }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _render() {
    const variant = this.getAttribute('variant') || 'primary';
    const disabled = this.hasAttribute('disabled');
    const loading = this.hasAttribute('loading');
    const size = this.getAttribute('size') || '';
    const cls = [VARIANT_CLASSES[variant] || 'btn btn-primary', size ? `btn-${size}` : ''].join(' ').trim();
    const label = this.textContent.trim() || this.getAttribute('label') || '';

    applyDiff(this, [
      createElement('button', {
        class: cls,
        disabled: disabled || loading,
        onclick: (e) => {
          if (!disabled && !loading) this.dispatchEvent(new CustomEvent('rui-click', { bubbles: true, detail: e }));
        },
      }, loading ? '...' : label),
    ]);
  }
}

customElements.define('rui-button', RuiButton);
