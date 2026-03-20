import { createElement, applyDiff } from '../../../vendor/webjsx.js';

class RuiCard extends HTMLElement {
  static get observedAttributes() { return ['title', 'subtitle']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _render() {
    const title = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const slot = this.querySelector('[slot="content"]');
    const contentHtml = slot ? slot.outerHTML : '';

    applyDiff(this, [
      createElement('div', { class: 'card bg-base-200 shadow-md' },
        createElement('div', { class: 'card-body p-4' },
          title && createElement('h3', { class: 'card-title text-base font-semibold' }, title),
          subtitle && createElement('p', { class: 'text-sm text-base-content/60' }, subtitle),
          createElement('div', { class: 'card-slot mt-2', 'data-slot': 'content' })
        )
      ),
    ]);

    if (slot) {
      const slotTarget = this.querySelector('[data-slot="content"]');
      if (slotTarget && slot) slotTarget.appendChild(slot);
    }
  }
}

customElements.define('rui-card', RuiCard);
