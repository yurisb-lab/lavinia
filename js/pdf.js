// Monta a folha A4 com os cards em tamanho real, o pontilhado de corte e as marcas nos cantos.
// Se algum card tiver verso, cada folha ganha uma página de verso logo depois, espelhada,
// para imprimir frente e verso virando o papel pela borda comprida.

import { CARD, sideHasContent } from './card.js';
import { renderForPrint } from './render.js';
import { ensureFonts } from './fonts.js';

export const SHEET = {
  pageW: 210, // A4 em mm
  pageH: 297,
  cols: 3,
  rows: 3,
  slotW: CARD.short, // na folha todo card fica em pé: 53 x 85 mm
  slotH: CARD.long,
  gap: 5, // mm entre um card e outro, onde ficam as marcas de corte
  markOffset: 1.5, // mm de folga entre o card e a marca
  markLength: 2, // mm
  backBleed: 1, // mm: o verso sai um pouco maior, para não sobrar branco se a impressora deslocar
};

export const PER_PAGE = SHEET.cols * SHEET.rows;

// Posição (mm) de cada espaço da folha, da esquerda para a direita, de cima para baixo.
export function slotPositions() {
  const totalW = SHEET.cols * SHEET.slotW + (SHEET.cols - 1) * SHEET.gap;
  const totalH = SHEET.rows * SHEET.slotH + (SHEET.rows - 1) * SHEET.gap;
  const x0 = (SHEET.pageW - totalW) / 2;
  const y0 = (SHEET.pageH - totalH) / 2;
  const out = [];
  for (let r = 0; r < SHEET.rows; r++) {
    for (let c = 0; c < SHEET.cols; c++) {
      out.push({ x: x0 + c * (SHEET.slotW + SHEET.gap), y: y0 + r * (SHEET.slotH + SHEET.gap) });
    }
  }
  return out;
}

// Lista de cards já repetida pelo número de cópias, dividida em páginas.
export function paginate(cards) {
  const flat = [];
  for (const card of cards) for (let i = 0; i < (card.copies || 1); i++) flat.push(card);
  const pages = [];
  for (let i = 0; i < flat.length; i += PER_PAGE) pages.push(flat.slice(i, i + PER_PAGE));
  return pages;
}

export const hasBack = (card) => !!(card.design && sideHasContent(card.design.back));

let jsPdfPromise = null;
function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jsPdfPromise) {
    jsPdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/jspdf.umd.min.js', import.meta.url).href;
      s.onload = () => resolve(window.jspdf);
      s.onerror = () => {
        jsPdfPromise = null;
        reject(new Error('Não consegui carregar o gerador de PDF.'));
      };
      document.head.appendChild(s);
    });
  }
  return jsPdfPromise;
}

function cropMarks(doc, x, y, w, h) {
  const o = SHEET.markOffset;
  const l = SHEET.markLength;
  const lines = [
    // canto superior esquerdo
    [x - o - l, y, x - o, y], [x, y - o - l, x, y - o],
    // canto superior direito
    [x + w + o, y, x + w + o + l, y], [x + w, y - o - l, x + w, y - o],
    // canto inferior esquerdo
    [x - o - l, y + h, x - o, y + h], [x, y + h + o, x, y + h + o + l],
    // canto inferior direito
    [x + w + o, y + h, x + w + o + l, y + h], [x + w, y + h + o, x + w, y + h + o + l],
  ];
  for (const [x1, y1, x2, y2] of lines) doc.line(x1, y1, x2, y2);
}

// Pontilhado bem rente ao card, por fora: cortando por ele, não sobra linha no card.
function cutLine(doc, x, y, w, h) {
  const o = 0.12;
  doc.setDrawColor(150);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([0.9, 0.7], 0);
  doc.roundedRect(x - o, y - o, w + 2 * o, h + 2 * o, CARD.radius + o, CARD.radius + o, 'S');
  doc.setLineDashPattern([], 0);
}

function ruler(doc, x, y) {
  // Régua de 5 cm para conferir se a impressora não mudou o tamanho.
  doc.setDrawColor(90);
  doc.setLineWidth(0.25);
  doc.line(x, y, x + 50, y);
  for (let i = 0; i <= 50; i += 5) {
    const t = i % 10 === 0 ? 2.2 : 1.2;
    doc.line(x + i, y, x + i, y - t);
  }
  doc.setFontSize(6.5);
  doc.setTextColor(90);
  doc.text('5 cm', x + 52, y);
}

// cards: [{ id, copies, design, getImg }]; options: { cutLine }
export async function buildPdf(cards, { cutLine: withCutLine = true, onProgress } = {}) {
  const { jsPDF } = await loadJsPdf();
  await ensureFonts(cards.map((c) => c.design));
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pages = paginate(cards);
  const slots = slotPositions();
  const rendered = new Map();
  const total = new Set(pages.flat().map((c) => c.id)).size + new Set(pages.flat().filter(hasBack).map((c) => c.id)).size;
  let done = 0;
  const anyBack = cards.some(hasBack);

  async function image(card, sideName) {
    const key = `${sideName}-${card.id}`;
    if (!rendered.has(key)) {
      const canvas = renderForPrint(card.design, sideName, card.getImg, { bleed: sideName === 'back' ? SHEET.backBleed : 0 });
      rendered.set(key, canvas.toDataURL('image/jpeg', 0.92));
      done++;
      onProgress && onProgress(done / total);
      await new Promise((r) => setTimeout(r, 0)); // deixa a tela respirar no tablet
    }
    return { data: rendered.get(key), alias: 'card-' + key };
  }

  let pageNo = 0;
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (pageNo++ > 0) doc.addPage('a4', 'portrait');

    for (let i = 0; i < page.length; i++) {
      const { x, y } = slots[i];
      const im = await image(page[i], 'front');
      // O apelido faz o PDF guardar a imagem uma vez só, mesmo com várias cópias.
      doc.addImage(im.data, 'JPEG', x, y, SHEET.slotW, SHEET.slotH, im.alias, 'NONE');
      if (withCutLine) cutLine(doc, x, y, SHEET.slotW, SHEET.slotH);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    for (let i = 0; i < page.length; i++) cropMarks(doc, slots[i].x, slots[i].y, SHEET.slotW, SHEET.slotH);

    const footerY = SHEET.pageH - 6;
    ruler(doc, 14, footerY);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `Photo cards da Lavínia  ·  folha ${p + 1} de ${pages.length}${anyBack ? ' (frente)' : ''}  ·  imprima em tamanho real (100%)`,
      SHEET.pageW - 14,
      footerY,
      { align: 'right' }
    );

    // Verso: mesma folha, espelhada da esquerda para a direita.
    if (page.some(hasBack)) {
      doc.addPage('a4', 'portrait');
      pageNo++;
      const b = SHEET.backBleed;
      for (let i = 0; i < page.length; i++) {
        if (!hasBack(page[i])) continue;
        const { x, y } = slots[i];
        const mx = SHEET.pageW - x - SHEET.slotW;
        const im = await image(page[i], 'back');
        doc.addImage(im.data, 'JPEG', mx - b, y - b, SHEET.slotW + 2 * b, SHEET.slotH + 2 * b, im.alias, 'NONE');
      }
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(`Verso da folha ${p + 1}  ·  vire o papel pela borda comprida`, SHEET.pageW / 2, SHEET.pageH - 6, { align: 'center' });
    }
  }
  return doc;
}
