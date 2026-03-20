import { createElement, applyDiff } from '../../../vendor/webjsx.js';

class RuiNavbar extends HTMLElement {
  static get observedAttributes() { return ['active']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _navigate(screen) {
    this.setAttribute('active', screen);
    this.dispatchEvent(new CustomEvent('rui-navigate', { bubbles: true, detail: { screen } }));
  }

  _render() {
    const active = this.getAttribute('active') || 'home';
    const navItems = [
      { id: 'home', label: 'Dashboard' },
      { id: 'add_relay', label: 'Add Relay' },
      { id: 'settings', label: 'Settings' },
      { id: 'logs', label: 'Logs' },
    ];

    applyDiff(this, [
      createElement('div', { class: 'navbar bg-base-300 border-b border-base-content/10 px-4' },
        createElement('div', { class: 'navbar-start' },
          createElement('span', { class: 'text-xl font-bold text-primary' }, 'Hyper-NAT')
        ),
        createElement('div', { class: 'navbar-center' },
          createElement('div', { class: 'tabs tabs-boxed bg-base-200' },
            ...navItems.map(item =>
              createElement('button', {
                class: `tab${active === item.id ? ' tab-active' : ''}`,
                onclick: () => this._navigate(item.id),
              }, item.label)
            )
          )
        ),
        createElement('div', { class: 'navbar-end' },
          createElement('span', { class: 'text-xs text-base-content/40' }, 'v2.0.0')
        )
      ),
    ]);
  }
}

customElements.define('rui-navbar', RuiNavbar);
