import { createElement, applyDiff } from '../../../vendor/webjsx.js';

class RuiInput extends HTMLElement {
  static get observedAttributes() { return ['label', 'type', 'placeholder', 'value', 'error', 'disabled']; }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }

  _render() {
    const label = this.getAttribute('label') || '';
    const type = this.getAttribute('type') || 'text';
    const placeholder = this.getAttribute('placeholder') || '';
    const value = this.getAttribute('value') || '';
    const error = this.getAttribute('error') || '';
    const disabled = this.hasAttribute('disabled');

    applyDiff(this, [
      createElement('div', { class: 'form-control w-full' },
        label && createElement('label', { class: 'label' },
          createElement('span', { class: 'label-text text-sm font-medium' }, label)
        ),
        createElement('input', {
          type,
          placeholder,
          value,
          disabled,
          class: `input input-bordered w-full${error ? ' input-error' : ''}`,
          oninput: (e) => {
            this.setAttribute('value', e.target.value);
            this.dispatchEvent(new CustomEvent('rui-input', { bubbles: true, detail: { value: e.target.value } }));
          },
        }),
        error && createElement('label', { class: 'label' },
          createElement('span', { class: 'label-text-alt text-error' }, error)
        ),
      ),
    ]);
  }
}

customElements.define('rui-input', RuiInput);
