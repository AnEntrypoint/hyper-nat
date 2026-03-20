import { createElement, applyDiff } from '../../../vendor/webjsx.js';

const COLOR_CLASSES = {
  green: 'badge badge-success',
  yellow: 'badge badge-warning',
  red: 'badge badge-error',
  blue: 'badge badge-primary',
  gray: 'badge badge-ghost',
  secondary: 'badge badge-secondary',
};

class RuiBadge extends HTMLElement {
  static get observedAttributes() { return ['color', 'text']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _render() {
    const color = this.getAttribute('color') || 'gray';
    const text = this.getAttribute('text') || this.textContent.trim();
    const cls = COLOR_CLASSES[color] || 'badge badge-ghost';
    applyDiff(this, [createElement('span', { class: cls }, text)]);
  }
}

customElements.define('rui-badge', RuiBadge);
