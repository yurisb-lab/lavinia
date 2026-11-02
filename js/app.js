// Aplicativo da Lavínia: navegação entre telas.
// Para criar uma tela nova: crie js/views/minha-tela.js com mount(el) e registre em ROUTES.

import { askPersistentStorage } from './db.js';
import * as home from './views/home.js';
import * as photocards from './views/photocards.js';

const ROUTES = {
  '': home,
  'photo-cards': photocards,
};

const viewEl = document.getElementById('view');
let unmount = null;

function currentRoute() {
  return location.hash.replace(/^#\/?/, '').split('?')[0];
}

async function render() {
  const name = currentRoute();
  const view = ROUTES[name] || home;
  if (unmount) {
    try {
      unmount();
    } catch (_) {}
    unmount = null;
  }
  document.body.dataset.route = name || 'home';
  viewEl.innerHTML = '';
  viewEl.scrollTop = 0;
  window.scrollTo(0, 0);
  unmount = (await view.mount(viewEl)) || null;
  const title = view.title ? `${view.title} · Aplicativo da Lavínia` : 'Aplicativo da Lavínia';
  document.title = title;
}

window.addEventListener('hashchange', render);
render();
askPersistentStorage();

// Funciona sem internet e pode ser instalado na tela inicial do tablet.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
