import './components/index.js';
import './screens/home.js';
import './screens/add-relay.js';
import './screens/settings.js';
import './screens/logs.js';
import { createElement, applyDiff } from '../../vendor/webjsx.js';
import { getSnapshot, subscribe, navigate } from './app-state.js';

const SCREEN_TAGS = {
  home: 'app-home',
  add_relay: 'app-add-relay',
  settings: 'app-settings',
  logs: 'app-logs',
};

function renderApp() {
  const snap = getSnapshot();
  const screen = snap.value;
  const navbar = document.getElementById('navbar');
  const main = document.getElementById('main');

  if (navbar) {
    applyDiff(navbar, [
      createElement('rui-navbar', {
        active: screen,
        onruinavigate: (e) => navigate(e.detail.screen),
      }),
    ]);
    const navEl = navbar.querySelector('rui-navbar');
    if (navEl) {
      navEl.addEventListener('rui-navigate', (e) => navigate(e.detail.screen));
    }
  }

  if (main) {
    const tag = SCREEN_TAGS[screen] || 'app-home';
    applyDiff(main, [createElement(tag, {})]);
  }
}

subscribe(renderApp);
renderApp();
