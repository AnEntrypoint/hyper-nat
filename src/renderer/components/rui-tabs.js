import { createElement, applyDiff } from '../../../vendor/webjsx.js';

class RuiTabs extends HTMLElement {
  static get observedAttributes() { return ['tabs', 'active-tab']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _select(tab) {
    this.setAttribute('active-tab', tab);
    this.dispatchEvent(new CustomEvent('rui-tab-change', { bubbles: true, detail: { tab } }));
  }

  _render() {
    let tabs = [];
    try { tabs = JSON.parse(this.getAttribute('tabs') || '[]'); } catch (_) {}
    const active = this.getAttribute('active-tab') || (tabs[0] || '');

    applyDiff(this, [
      createElement('div', { class: 'tabs tabs-boxed bg-base-200 inline-flex' },
        ...tabs.map(tab =>
          createElement('button', {
            class: `tab${active === tab ? ' tab-active' : ''}`,
            onclick: () => this._select(tab),
          }, tab.toUpperCase())
        )
      ),
    ]);
  }
}

customElements.define('rui-tabs', RuiTabs);
