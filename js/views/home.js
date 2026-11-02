// Tela inicial: um "mural" com as criações disponíveis.
// Quando houver mais ferramentas, é só acrescentar outro item em TOOLS.

import { db } from '../db.js';
import { icon } from '../icons.js';

export const title = '';

const TOOLS = [
  {
    route: 'photo-cards',
    name: 'Photo cards',
    text: 'Escolha fotos, enfeite com textos, adesivos e molduras, e imprima numa folha A4 já com o pontilhado para recortar.',
    art: 'cards',
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia, Lavínia!';
  if (h < 18) return 'Boa tarde, Lavínia!';
  return 'Boa noite, Lavínia!';
}

function cardsArt() {
  return `
    <div class="tile-art" aria-hidden="true">
      <span class="mini-card mini-card--a"><span class="mini-card__sky"></span>${icon('heart', { size: 22, fill: true })}</span>
      <span class="mini-card mini-card--b"><span class="mini-card__sky"></span>${icon('star', { size: 22, fill: true })}</span>
      <span class="mini-card mini-card--c"><span class="mini-card__sky"></span>${icon('sparkle', { size: 22, fill: true })}</span>
    </div>`;
}

export async function mount(el) {
  el.innerHTML = `
    <section class="home">
      <div class="home__hello">
        <h1 class="home__title">${greeting()}<br><span>O que vamos criar hoje?</span></h1>
      </div>
      <div class="home__tools">
        ${TOOLS.map(
          (t) => `
          <a class="tool-tile" href="#/${t.route}">
            ${t.art === 'cards' ? cardsArt() : ''}
            <span class="tool-tile__body">
              <span class="tool-tile__name">${t.name}</span>
              <span class="tool-tile__text">${t.text}</span>
              <span class="tool-tile__meta" data-meta="${t.route}"></span>
              <span class="tool-tile__go">Começar ${icon('arrowLeft', { size: 20 }).replace('class="ic"', 'class="ic ic--flip"')}</span>
            </span>
          </a>`
        ).join('')}
      </div>
    </section>`;

  try {
    const cards = await db.allCards();
    const total = cards.reduce((n, c) => n + (c.copies || 1), 0);
    const meta = el.querySelector('[data-meta="photo-cards"]');
    if (meta && total > 0) meta.textContent = total === 1 ? '1 card esperando na folha' : `${total} cards esperando na folha`;
  } catch (_) {}
}
