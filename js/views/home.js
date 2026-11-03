// Tela inicial: um "mural" com as criações disponíveis.
// A primeira ferramenta aparece grande; as outras, num mural de blocos menores.

import { db } from '../db.js';
import { icon } from '../icons.js';
import { cloudEnabled, newPostsCount, cachedGroups } from '../group.js';

export const title = '';

const TOOLS = [
  {
    route: 'photo-cards',
    name: 'Photo cards',
    text: 'Escolha fotos, enfeite com textos, adesivos e molduras, e imprima numa folha A4 já com o pontilhado para recortar. Também faz mini polaroids, marcadores de página e cartões dobráveis.',
    art: 'cards',
  },
  {
    route: 'photo-cards?f=poster',
    name: 'Pôster e mural',
    text: 'Uma folha A4 inteira: mural de fotos, photo dump, cartaz de aniversário, scrapbook ou calendário.',
    art: 'poster',
  },
  {
    route: 'adesivos',
    name: 'Meus adesivos',
    text: 'Transforme fotos em figurinhas com contorno e imprima em papel adesivo.',
    art: 'stickers',
    meta: 'stickers',
  },
  {
    route: 'fichario',
    name: 'Meu fichário',
    text: 'Todos os seus cards guardados, com favoritos e pastas.',
    art: 'binder',
    meta: 'binder',
  },
  {
    route: 'turma',
    name: 'Minha turma',
    text: 'Mostre seus cards para as amigas e a família, ganhe coraçõezinhos e combine trocas.',
    art: 'group',
    meta: 'group',
    cloud: true,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia, Lavínia!';
  if (h < 18) return 'Boa tarde, Lavínia!';
  return 'Boa noite, Lavínia!';
}

function art(kind) {
  if (kind === 'cards') {
    return `
    <div class="tile-art" aria-hidden="true">
      <span class="mini-card mini-card--a"><span class="mini-card__sky"></span>${icon('heart', { size: 22, fill: true })}</span>
      <span class="mini-card mini-card--b"><span class="mini-card__sky"></span>${icon('star', { size: 22, fill: true })}</span>
      <span class="mini-card mini-card--c"><span class="mini-card__sky"></span>${icon('sparkle', { size: 22, fill: true })}</span>
    </div>`;
  }
  if (kind === 'poster') {
    return `
    <div class="small-art small-art--poster" aria-hidden="true">
      <span class="art-poster"><b></b><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>`;
  }
  if (kind === 'group') {
    return `
    <div class="small-art small-art--group" aria-hidden="true">
      <span class="art-face art-face--a">🐱</span>
      <span class="art-face art-face--b">🦄</span>
      <span class="art-face art-face--c">🐰</span>
      <span class="art-heart">${icon('heart', { size: 22, fill: true })}</span>
    </div>`;
  }
  if (kind === 'stickers') {
    return `
    <div class="small-art small-art--stickers" aria-hidden="true">
      <span class="art-sticker art-sticker--a">${icon('heart', { size: 30, fill: true })}</span>
      <span class="art-sticker art-sticker--b">${icon('star', { size: 26, fill: true })}</span>
      <span class="art-sticker art-sticker--c">${icon('sparkle', { size: 22, fill: true })}</span>
    </div>`;
  }
  return `
    <div class="small-art small-art--binder" aria-hidden="true">
      <span class="art-binder"><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>`;
}

const go = (label) => `<span class="tool-tile__go">${label} ${icon('arrowLeft', { size: 20 }).replace('class="ic"', 'class="ic ic--flip"')}</span>`;

export async function mount(el) {
  const [main, ...more] = TOOLS.filter((t) => !t.cloud || cloudEnabled);
  el.innerHTML = `
    <section class="home">
      <div class="home__hello">
        <h1 class="home__title">${greeting()}<br><span>O que vamos criar hoje?</span></h1>
      </div>
      <div class="home__tools">
        <a class="tool-tile" href="#/${main.route}">
          ${art(main.art)}
          <span class="tool-tile__body">
            <span class="tool-tile__name">${main.name}</span>
            <span class="tool-tile__text">${main.text}</span>
            <span class="tool-tile__meta" data-meta="photo-cards"></span>
            ${go('Começar')}
          </span>
        </a>
        <div class="home__more">
          ${more
            .map(
              (t, i) => `
            <a class="tool-tile tool-tile--small tool-tile--${i}" href="#/${t.route}">
              ${art(t.art)}
              <span class="tool-tile__body">
                <span class="tool-tile__name">${t.name}</span>
                <span class="tool-tile__text">${t.text}</span>
                ${t.meta ? `<span class="tool-tile__meta" data-meta="${t.meta}"></span>` : ''}
                ${go('Abrir')}
              </span>
            </a>`
            )
            .join('')}
        </div>
      </div>
    </section>`;

  try {
    const all = await db.allCards();
    const sheet = all.filter((c) => c.inSheet !== false);
    const total = sheet.reduce((n, c) => n + (c.copies || 1), 0);
    const meta = el.querySelector('[data-meta="photo-cards"]');
    if (meta && total > 0) meta.textContent = total === 1 ? '1 coisa esperando na folha' : `${total} coisas esperando na folha`;
    const saved = all.filter((c) => c.kind !== 'sticker').length;
    const bm = el.querySelector('[data-meta="binder"]');
    if (bm && saved) bm.textContent = saved === 1 ? '1 card guardado' : `${saved} cards guardados`;
    const st = (await db.allStickers()).length;
    const sm = el.querySelector('[data-meta="stickers"]');
    if (sm && st) sm.textContent = st === 1 ? '1 adesivo' : `${st} adesivos`;
  } catch (_) {}

  // Posts novos na turma (só se este aparelho já está numa turma).
  const gm = el.querySelector('[data-meta="group"]');
  if (gm && (await cachedGroups()).length) {
    newPostsCount()
      .then((n) => {
        if (n && gm.isConnected) gm.textContent = n === 1 ? '1 post novo' : `${n >= 99 ? '99+' : n} posts novos`;
      })
      .catch(() => {});
  }
}
