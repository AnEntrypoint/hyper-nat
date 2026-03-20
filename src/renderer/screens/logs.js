import { createElement, applyDiff } from '../../../vendor/webjsx.js';
import { getSnapshot, subscribe, send } from '../app-state.js';

const LEVEL_BADGE = {
  error: 'badge-error',
  warn: 'badge-warning',
  info: 'badge-primary',
  debug: 'badge-ghost',
};

const LEVELS = ['error', 'warn', 'info', 'debug'];

class AppLogs extends HTMLElement {
  constructor() {
    super();
    this._filter = 'debug';
    this._autoScroll = true;
  }

  connectedCallback() {
    this._unsub = subscribe(() => this._render());
    this._render();
  }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
  }

  _clear() {
    send({ type: 'CLEAR_LOGS' });
  }

  _levelIndex(level) {
    return LEVELS.indexOf(level);
  }

  _render() {
    const snap = getSnapshot();
    const allEntries = snap.context.logEntries;
    const filterIdx = this._levelIndex(this._filter);
    const entries = allEntries.filter(e => this._levelIndex(e.level) <= filterIdx);

    applyDiff(this, [
      createElement('div', { class: 'flex flex-col h-full p-4 gap-2' },
        createElement('div', { class: 'flex items-center justify-between' },
          createElement('h2', { class: 'text-xl font-bold' }, 'Logs'),
          createElement('div', { class: 'flex items-center gap-3' },
            createElement('select', {
              class: 'select select-bordered select-sm',
              onchange: (e) => { this._filter = e.target.value; this._render(); },
            },
              ...LEVELS.map(l =>
                createElement('option', { value: l, selected: this._filter === l }, l.toUpperCase())
              )
            ),
            createElement('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: () => this._clear(),
            }, 'Clear'),
          )
        ),

        createElement('div', {
          class: 'flex-1 overflow-y-auto font-mono text-xs bg-base-300 rounded-lg p-3 min-h-0',
          style: 'max-height: calc(100vh - 180px);',
          ref: (el) => { if (el && this._autoScroll) el.scrollTop = el.scrollHeight; },
        },
          entries.length === 0
            ? [createElement('span', { class: 'text-base-content/40' }, 'No log entries')]
            : entries.map((entry, i) =>
                createElement('div', { class: 'flex items-start gap-2 py-0.5 border-b border-base-content/5', key: String(i) },
                  createElement('span', { class: 'text-base-content/40 whitespace-nowrap' },
                    new Date(entry.timestamp).toLocaleTimeString()
                  ),
                  createElement('span', { class: `badge badge-xs ${LEVEL_BADGE[entry.level] || 'badge-ghost'} flex-shrink-0` },
                    entry.level
                  ),
                  createElement('span', { class: 'text-base-content/80 break-all' }, entry.message),
                )
              )
        )
      ),
    ]);

    const container = this.querySelector('[style]');
    if (container && this._autoScroll) container.scrollTop = container.scrollHeight;
  }
}

customElements.define('app-logs', AppLogs);
