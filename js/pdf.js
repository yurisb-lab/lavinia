// Monta a folha A4 com os cards em tamanho real e as marcas de corte.

import { CARD, renderForPrint } from './card.js';

export const SHEET = {
  pageW: 210, // A4 em mm
  pageH: 297,
  cols: 3,
  rows: 3,
  slotW: CARD.short, // na folha todo card fica em pé: 54 x 86 mm
  slotH: CARD.long,
  gap: 5, // mm entre um card e outro, onde ficam as marcas de corte
  markOffset: 1, // mm de folga entre o card e a marca
  markLength: 3, // mm (termina 1 mm antes do card vizinho)
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

// cards: [{ id, copies, design, img }]; options: { cutLine }
export async function buildPdf(cards, { cutLine = true, onProgress } = {}) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pages = paginate(cards);
  const slots = slotPositions();
  const rendered = new Map();
  let done = 0;
  const unique = new Set(pages.flat().map((c) => c.id)).size;

  for (let p = 0; p < pages.length; p++) {
    if (p > 0) doc.addPage('a4', 'portrait');
    const page = pages[p];

    for (let i = 0; i < page.length; i++) {
      const card = page[i];
      const { x, y } = slots[i];
      if (!rendered.has(card.id)) {
        const canvas = renderForPrint(card.img, card.design);
        rendered.set(card.id, canvas.toDataURL('image/jpeg', 0.92));
        done++;
        onProgress && onProgress(done / unique);
        await new Promise((r) => setTimeout(r, 0)); // deixa a tela respirar no tablet
      }
      // O apelido faz o PDF guardar a imagem uma vez só, mesmo com várias cópias.
      doc.addImage(rendered.get(card.id), 'JPEG', x, y, SHEET.slotW, SHEET.slotH, 'card-' + card.id, 'NONE');

      if (cutLine) {
        doc.setDrawColor(185);
        doc.setLineWidth(0.12);
        doc.roundedRect(x, y, SHEET.slotW, SHEET.slotH, CARD.radius, CARD.radius, 'S');
      }
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    for (let i = 0; i < page.length; i++) cropMarks(doc, slots[i].x, slots[i].y, SHEET.slotW, SHEET.slotH);

    const footerY = SHEET.pageH - 6;
    ruler(doc, 14, footerY);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `Photo cards da Lavínia  ·  folha ${p + 1} de ${pages.length}  ·  imprima em tamanho real (100%)`,
      SHEET.pageW - 14,
      footerY,
      { align: 'right' }
    );
  }
  return doc;
}
