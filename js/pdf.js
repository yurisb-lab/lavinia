// Monta as folhas A4: photo cards, mini polaroids, marcadores, cartões dobráveis e adesivos
// misturados na mesma folha (para gastar menos papel), e pôsteres numa folha só deles.
// Se alguma coisa tiver verso, a folha ganha uma página de verso logo depois, espelhada,
// para imprimir frente e verso virando o papel pela borda comprida.

import { formatInfo, sideHasContent } from './card.js';
import { renderForPrint, roundRectPath } from './render.js';
import { ensureFonts } from './fonts.js';
import { addOutline } from './fx.js';

export const SHEET = {
  pageW: 210, // A4 em mm
  pageH: 297,
  margin: 10, // mm nas laterais
  top: 10,
  bottom: 15, // rodapé com a régua
  gap: 5, // mm entre uma coisa e outra, onde ficam as marcas de corte
  stickerGap: 2.5, // entre dois adesivos basta menos
  markOffset: 1.5, // mm de folga entre o card e a marca
  markLength: 2, // mm
  backBleed: 1, // mm: o verso sai um pouco maior, para não sobrar branco se a impressora deslocar
};

export const STICKER_BORDER = 1.6; // mm de borda branca em volta do adesivo impresso
export const STICKER_MARGIN = 2.2; // mm entre o desenho e a beira da caixa (borda + linha de corte)

const CONTENT_W = SHEET.pageW - 2 * SHEET.margin;
const CONTENT_H = SHEET.pageH - SHEET.top - SHEET.bottom;

export const isSticker = (rec) => rec.kind === 'sticker';
export const hasBack = (rec) => !isSticker(rec) && !!(rec.design && sideHasContent(rec.design.back));
export const isPoster = (rec) => !isSticker(rec) && formatInfo(rec.design && rec.design.format).id === 'poster';

// Tamanho do desenho de um adesivo impresso (mm): sizeMm é o lado maior.
export function stickerDims(rec) {
  const a = rec.sticker.aspect || 1;
  const s = rec.sticker.sizeMm || 50;
  return a >= 1 ? { w: s, h: s / a } : { w: s * a, h: s };
}

// Tamanho na folha (mm), sempre do jeito que sai impresso (cards deitados saem em pé).
export function printSize(rec) {
  if (isSticker(rec)) {
    const { w, h } = stickerDims(rec);
    return { w: w + 2 * STICKER_MARGIN, h: h + 2 * STICKER_MARGIN, sticker: true };
  }
  const f = formatInfo(rec.design.format);
  if (f.id === 'poster') return { w: SHEET.pageW, h: SHEET.pageH, full: true };
  if (f.id === 'folded') return { w: f.w * 2, h: f.h, folded: true };
  return { w: f.w, h: f.h };
}

const gapX = (a, b) => (a.sticker && b.sticker ? SHEET.stickerGap : SHEET.gap);
const rowGap = (row, it) => (it.sticker && row.items.every((x) => x.sticker) ? SHEET.stickerGap : SHEET.gap);

// Distribui tudo (já repetido pelo número de cópias) em folhas.
// Devolve [{ full, items: [{ rec, x, y, w, h, folded, sticker }] }].
export function layoutSheet(records) {
  const items = [];
  records.forEach((rec, order) => {
    const size = printSize(rec);
    for (let i = 0; i < (rec.copies || 1); i++) items.push({ rec, order, ...size });
  });
  const rest = items.filter((i) => !i.full).sort((a, b) => b.h - a.h || a.order - b.order);
  const pages = [];
  for (const it of rest) {
    let placed = false;
    for (const pg of pages) {
      // primeiro tenta caber no fim de uma fileira que já existe
      for (const row of pg.rows) {
        const need = row.w + gapX(row.items[row.items.length - 1], it) + it.w;
        if (it.h <= row.h && need <= CONTENT_W) {
          row.items.push(it);
          row.w = need;
          placed = true;
          break;
        }
      }
      if (placed) break;
      // depois, uma fileira nova nesta folha
      const g = rowGap(pg.rows[pg.rows.length - 1], it);
      if (pg.used + g + it.h <= CONTENT_H) {
        pg.rows.push({ items: [it], w: it.w, h: it.h });
        pg.used += g + it.h;
        placed = true;
        break;
      }
    }
    if (!placed) pages.push({ rows: [{ items: [it], w: it.w, h: it.h }], used: it.h });
  }

  const out = pages.map((pg) => {
    const list = [];
    let y = SHEET.top + (CONTENT_H - pg.used) / 2;
    pg.rows.forEach((row, ri) => {
      let x = SHEET.margin + (CONTENT_W - row.w) / 2;
      row.items.forEach((it, i) => {
        if (i > 0) x += gapX(row.items[i - 1], it);
        list.push({ rec: it.rec, x, y, w: it.w, h: it.h, folded: !!it.folded, sticker: !!it.sticker });
        x += it.w;
      });
      const next = pg.rows[ri + 1];
      if (next) y += row.h + rowGap(row, next.items[0]);
    });
    return { full: false, items: list };
  });
  for (const it of items.filter((i) => i.full)) {
    out.push({ full: true, items: [{ rec: it.rec, x: 0, y: 0, w: SHEET.pageW, h: SHEET.pageH, full: true }] });
  }
  return out;
}

// Onde vai o verso (na página de verso, que é espelhada).
// No cartão dobrável, a parte de dentro fica atrás da metade esquerda (a contracapa),
// e assim aparece do lado direito quando o cartão abre.
export function backRect(item) {
  const b = SHEET.backBleed;
  if (item.full) return { x: 0, y: 0, w: item.w, h: item.h, bleed: 0 };
  if (item.folded) {
    const pw = item.w / 2;
    return { x: SHEET.pageW - item.x - pw - b, y: item.y - b, w: pw + 2 * b, h: item.h + 2 * b, bleed: b };
  }
  return { x: SHEET.pageW - item.x - item.w - b, y: item.y - b, w: item.w + 2 * b, h: item.h + 2 * b, bleed: b };
}

// Adesivo pronto para imprimir: o desenho com borda branca e uma linha cinza fininha para recortar.
export function renderStickerPrint(img, rec, pxPerMm = 300 / 25.4) {
  const { w, h } = printSize(rec);
  const out = document.createElement('canvas');
  out.width = Math.round(w * pxPerMm);
  out.height = Math.round(h * pxPerMm);
  const dims = stickerDims(rec);
  const innerW = dims.w * pxPerMm;
  const innerH = dims.h * pxPerMm;
  const base = document.createElement('canvas');
  base.width = Math.max(1, Math.round(innerW));
  base.height = Math.max(1, Math.round(innerH));
  const bctx = base.getContext('2d');
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(img, 0, 0, base.width, base.height);
  const white = addOutline(base, STICKER_BORDER * pxPerMm, '#ffffff');
  const line = addOutline(white.canvas, Math.max(1, 0.18 * pxPerMm), '#a99aa4');
  const pad = white.pad + line.pad;
  const octx = out.getContext('2d');
  octx.drawImage(line.canvas, (out.width - base.width) / 2 - pad, (out.height - base.height) / 2 - pad);
  return out;
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

// ---------- desenho da folha ----------
// O mesmo desenho serve para o PDF e para a imagem JPG: "out" sabe desenhar em cada um.
// out = { page(), image(key, getCanvas, type, x, y, w, h), line(x1, y1, x2, y2, dash), cut(x, y, w, h, r), text(s, x, y, size, gray, align) }

function cropMarks(out, x, y, w, h) {
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
  for (const [x1, y1, x2, y2] of lines) out.line(x1, y1, x2, y2);
}

function ruler(out, x, y) {
  // Régua de 5 cm para conferir se a impressora não mudou o tamanho.
  out.line(x, y, x + 50, y, null, 90);
  for (let i = 0; i <= 50; i += 5) out.line(x + i, y, x + i, y - (i % 10 === 0 ? 2.2 : 1.2), null, 90);
  out.text('5 cm', x + 52, y, 6.5, 90, 'left');
}

async function paintSheet(out, records, { cutLine: withCutLine = true, onProgress } = {}) {
  await ensureFonts(records.filter((r) => !isSticker(r)).map((r) => r.design));
  const pages = layoutSheet(records);
  const uniq = new Set();
  for (const pg of pages) {
    for (const it of pg.items) {
      uniq.add('f' + it.rec.id);
      if (hasBack(it.rec)) uniq.add('b' + it.rec.id);
    }
  }
  const total = uniq.size || 1;
  const seen = new Set();
  const anyBack = records.some(hasBack);

  // Desenha (e guarda) cada card uma vez só, mesmo com várias cópias.
  async function image(rec, sideName, bleed, x, y, w, h) {
    const key = `${sideName}-${rec.id}`;
    const make = () =>
      isSticker(rec)
        ? rec.getImg('s') && renderStickerPrint(rec.getImg('s'), rec)
        : renderForPrint(rec.design, sideName, rec.getImg, { bleed });
    await out.image(key, make, isSticker(rec) ? 'PNG' : 'JPEG', x, y, w, h);
    if (!seen.has(key)) {
      seen.add(key);
      onProgress && onProgress(seen.size / total);
      await new Promise((r) => setTimeout(r, 0)); // deixa a tela respirar no tablet
    }
  }

  const normalPages = pages.filter((p) => !p.full).length;
  let sheetNo = 0;
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    await out.page({ name: page.full ? `poster-${p + 1}` : `folha-${sheetNo + 1}` });

    if (page.full) {
      await image(page.items[0].rec, 'front', 0, 0, 0, SHEET.pageW, SHEET.pageH);
    } else {
      sheetNo++;
      for (const it of page.items) {
        if (it.sticker) {
          await image(it.rec, 'front', 0, it.x, it.y, it.w, it.h);
          continue;
        }
        const f = formatInfo(it.rec.design.format);
        if (it.folded) {
          const pw = it.w / 2;
          await image(it.rec, 'front', 0, it.x + pw, it.y, pw, it.h);
          // contracapa: só uma assinatura pequenininha
          out.text('feito com carinho por Lavínia', it.x + pw / 2, it.y + it.h - 6, 7, 170, 'center');
        } else {
          await image(it.rec, 'front', 0, it.x, it.y, it.w, it.h);
        }
        if (withCutLine) out.cut(it.x, it.y, it.w, it.h, f.radius);
      }
      for (const it of page.items) {
        if (it.sticker) continue;
        cropMarks(out, it.x, it.y, it.w, it.h);
        if (it.folded) {
          // marquinhas da dobra, em cima e embaixo, por fora do cartão
          const mx = it.x + it.w / 2;
          out.line(mx, it.y - SHEET.markOffset - SHEET.markLength, mx, it.y - SHEET.markOffset, [0.6, 0.6]);
          out.line(mx, it.y + it.h + SHEET.markOffset, mx, it.y + it.h + SHEET.markOffset + SHEET.markLength, [0.6, 0.6]);
        }
      }
      const footerY = SHEET.pageH - 6;
      ruler(out, 14, footerY);
      out.text(
        `Folha da Lavínia  ·  folha ${sheetNo} de ${normalPages}${anyBack ? ' (frente)' : ''}  ·  imprima em tamanho real (100%)`,
        SHEET.pageW - 14,
        footerY,
        7,
        120,
        'right'
      );
    }

    // Verso: mesma folha, espelhada da esquerda para a direita.
    const backs = page.items.filter((it) => hasBack(it.rec));
    if (backs.length) {
      await out.page({ name: page.full ? `poster-${p + 1}-verso` : `folha-${sheetNo}-verso`, back: true });
      for (const it of backs) {
        const r = backRect(it);
        await image(it.rec, 'back', r.bleed, r.x, r.y, r.w, r.h);
      }
      if (!page.full) out.text(`Verso da folha ${sheetNo}  ·  vire o papel pela borda comprida`, SHEET.pageW / 2, SHEET.pageH - 6, 7, 120, 'center');
    }
  }
  await out.finish();
}

// records: [{ id, copies, design | sticker, getImg }]; options: { cutLine, onProgress }
export async function buildPdf(records, opts = {}) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const data = new Map();
  let first = true;
  await paintSheet(
    {
      page() {
        if (!first) doc.addPage('a4', 'portrait');
        first = false;
      },
      image(key, make, type, x, y, w, h) {
        if (!data.has(key)) {
          const c = make();
          data.set(key, c ? c.toDataURL(type === 'PNG' ? 'image/png' : 'image/jpeg', 0.92) : null);
        }
        // O apelido faz o PDF guardar a imagem uma vez só, mesmo com várias cópias.
        if (data.get(key)) doc.addImage(data.get(key), type, x, y, w, h, 'img-' + key, 'NONE');
      },
      line(x1, y1, x2, y2, dash, gray = 0) {
        doc.setDrawColor(gray);
        doc.setLineWidth(gray ? 0.25 : 0.2);
        if (dash) doc.setLineDashPattern(dash, 0);
        doc.line(x1, y1, x2, y2);
        if (dash) doc.setLineDashPattern([], 0);
      },
      // Pontilhado bem rente ao card, por fora: cortando por ele, não sobra linha no card.
      cut(x, y, w, h, radius) {
        const o = 0.12;
        doc.setDrawColor(150);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([0.9, 0.7], 0);
        if (radius > 0) doc.roundedRect(x - o, y - o, w + 2 * o, h + 2 * o, radius + o, radius + o, 'S');
        else doc.rect(x - o, y - o, w + 2 * o, h + 2 * o, 'S');
        doc.setLineDashPattern([], 0);
      },
      text(str, x, y, size, gray, align) {
        doc.setFontSize(size);
        doc.setTextColor(gray);
        doc.text(str, x, y, { align });
      },
      finish() {},
    },
    records,
    opts
  );
  return doc;
}

// A mesma folha como imagens JPG (uma por página), em 300 dpi: [File]
export async function buildSheetImages(records, opts = {}) {
  const k = 300 / 25.4; // pixels por mm
  const files = [];
  const cache = new Map();
  let canvas = null;
  let ctx = null;
  let name = '';
  async function flush() {
    if (!canvas) return;
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
    files.push(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
    canvas.width = canvas.height = 0; // solta a memória (importante no tablet)
    canvas = null;
  }
  await paintSheet(
    {
      async page(info) {
        await flush();
        name = info.name;
        canvas = document.createElement('canvas');
        canvas.width = Math.round(SHEET.pageW * k);
        canvas.height = Math.round(SHEET.pageH * k);
        ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(k, k);
        ctx.imageSmoothingQuality = 'high';
      },
      image(key, make, type, x, y, w, h) {
        if (!cache.has(key)) cache.set(key, make() || null);
        const c = cache.get(key);
        if (c) ctx.drawImage(c, x, y, w, h);
      },
      line(x1, y1, x2, y2, dash, gray = 0) {
        ctx.save();
        ctx.strokeStyle = `rgb(${gray},${gray},${gray})`;
        ctx.lineWidth = gray ? 0.25 : 0.2;
        ctx.setLineDash(dash || []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      },
      cut(x, y, w, h, radius) {
        const o = 0.12;
        ctx.save();
        ctx.strokeStyle = 'rgb(150,150,150)';
        ctx.lineWidth = 0.2;
        ctx.setLineDash([0.9, 0.7]);
        roundRectPath(ctx, x - o, y - o, w + 2 * o, h + 2 * o, radius > 0 ? radius + o : 0);
        ctx.stroke();
        ctx.restore();
      },
      text(str, x, y, size, gray, align) {
        ctx.save();
        ctx.font = `${(size * 25.4) / 72}px Nunito, Helvetica, Arial, sans-serif`;
        ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
        ctx.textAlign = align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(str, x, y);
        ctx.restore();
      },
      finish: flush,
    },
    records,
    opts
  );
  return files;
}
