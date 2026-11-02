// Adesivos: desenhos feitos aqui mesmo (ficam lisinhos em qualquer tamanho) e emojis.
// Cada desenho vive numa caixa de 100 x 100 e ganha uma borda branca, como adesivo de verdade.

import { shade } from './card.js';

const P = (d) => new Path2D(d);

function circle(cx, cy, r) {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

function ellipse(cx, cy, rx, ry, rot = 0) {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

function rrect(x, y, w, h, r) {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}

function starPath(points, outer, inner, cx, cy) {
  const p = new Path2D();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

// Lua: um círculo menos outro círculo.
function crescent() {
  const A = { x: 46, y: 52, r: 40 };
  const B = { x: 68, y: 36, r: 33 };
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const d = Math.hypot(dx, dy);
  const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
  const h = Math.sqrt(A.r * A.r - a * a);
  const mx = A.x + (a * dx) / d;
  const my = A.y + (a * dy) / d;
  const p1 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const p2 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  const ang = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);
  const TAU = Math.PI * 2;
  const midOf = (a1, a2, ccw) => {
    const span = ccw ? (((a1 - a2) % TAU) + TAU) % TAU : (((a2 - a1) % TAU) + TAU) % TAU;
    return ccw ? a1 - span / 2 : a1 + span / 2;
  };
  // arco do círculo grande pelo lado longe do círculo pequeno
  const a1 = ang(A, p1);
  const a2 = ang(A, p2);
  let ccwA = false;
  const mA = midOf(a1, a2, false);
  if (Math.hypot(A.x + Math.cos(mA) * A.r - B.x, A.y + Math.sin(mA) * A.r - B.y) < B.r) ccwA = true;
  // volta pelo círculo pequeno, por dentro do grande
  const b1 = ang(B, p2);
  const b2 = ang(B, p1);
  let ccwB = false;
  const mB = midOf(b1, b2, false);
  if (Math.hypot(B.x + Math.cos(mB) * B.r - A.x, B.y + Math.sin(mB) * B.r - A.y) > A.r) ccwB = true;
  const p = new Path2D();
  p.moveTo(p1.x, p1.y);
  p.arc(A.x, A.y, A.r, a1, a2, ccwA);
  p.arc(B.x, B.y, B.r, b1, b2, ccwB);
  p.closePath();
  return p;
}

const HEART = 'M50 90 C22 70 5 54 5 32 C5 16 17 6 31 6 C40 6 46 11 50 18 C54 11 60 6 69 6 C83 6 95 16 95 32 C95 54 78 70 50 90Z';
const SPARKLE = 'M50 3 C54 38 62 46 97 50 C62 54 54 62 50 97 C46 62 38 54 3 50 C38 46 46 38 50 3Z';
const shine = (x, y, rx, ry, rot) => ({ p: ellipse(x, y, rx, ry, rot), fill: 'rgba(255,255,255,0.55)', noEdge: true });

// parts(c): lista de { p: Path2D, fill?, stroke?, width?, noEdge? } desenhadas em ordem.
export const STICKERS = [
  { id: 'heart', name: 'Coração', color: '#ff5c93', parts: (c) => [{ p: P(HEART), fill: c }, shine(30, 28, 9, 5.5, -0.6)] },
  { id: 'star', name: 'Estrela', color: '#ffc93c', parts: (c) => [{ p: starPath(5, 47, 21, 50, 54), fill: c }] },
  { id: 'sparkle', name: 'Brilho', color: '#ffd84d', parts: (c) => [{ p: P(SPARKLE), fill: c }] },
  {
    id: 'bow',
    name: 'Laço',
    color: '#ff5c93',
    parts: (c) => [
      { p: P('M46 52 L32 86 L43 81 L50 92 L54 54Z'), fill: shade(c, -0.12) },
      { p: P('M54 52 L68 86 L57 81 L50 92 L46 54Z'), fill: shade(c, -0.12) },
      { p: P('M50 48 C36 24 8 18 7 38 C6 58 32 64 50 52Z'), fill: c },
      { p: P('M50 48 C64 24 92 18 93 38 C94 58 68 64 50 52Z'), fill: c },
      { p: ellipse(50, 50, 9, 10), fill: shade(c, -0.22) },
    ],
  },
  {
    id: 'flower',
    name: 'Flor',
    color: '#ff9cc2',
    parts: (c) => [
      ...[0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return { p: circle(50 + Math.cos(a) * 25, 52 + Math.sin(a) * 25, 18), fill: c };
      }),
      { p: circle(50, 52, 14), fill: '#ffd34d' },
    ],
  },
  {
    id: 'cloud',
    name: 'Nuvem',
    color: '#bfe0ff',
    parts: (c) => [
      { p: circle(30, 60, 17), fill: c },
      { p: circle(52, 46, 23), fill: c },
      { p: circle(74, 58, 17), fill: c },
      { p: rrect(16, 56, 72, 22, 11), fill: c },
    ],
  },
  {
    id: 'butterfly',
    name: 'Borboleta',
    color: '#b79cff',
    parts: (c) => [
      { p: ellipse(29, 36, 22, 17, -0.45), fill: c },
      { p: ellipse(71, 36, 22, 17, 0.45), fill: c },
      { p: ellipse(33, 67, 15, 12, 0.5), fill: shade(c, -0.12) },
      { p: ellipse(67, 67, 15, 12, -0.5), fill: shade(c, -0.12) },
      { p: circle(28, 35, 7), fill: 'rgba(255,255,255,0.6)', noEdge: true },
      { p: circle(72, 35, 7), fill: 'rgba(255,255,255,0.6)', noEdge: true },
      { p: rrect(46, 24, 8, 54, 4), fill: '#5a3a52' },
      { p: P('M48 27 Q42 12 34 9'), stroke: '#5a3a52', width: 3 },
      { p: P('M52 27 Q58 12 66 9'), stroke: '#5a3a52', width: 3 },
    ],
  },
  {
    id: 'crown',
    name: 'Coroa',
    color: '#ffc93c',
    parts: (c) => [
      { p: P('M18 80 L12 34 L33 54 L50 20 L67 54 L88 34 L82 80Z'), fill: c },
      { p: rrect(16, 72, 68, 12, 3), fill: shade(c, -0.14) },
      { p: circle(12, 32, 6), fill: '#ff5c93' },
      { p: circle(50, 18, 6), fill: '#6fb7ff' },
      { p: circle(88, 32, 6), fill: '#ff5c93' },
    ],
  },
  { id: 'moon', name: 'Lua', color: '#ffd84d', parts: (c) => [{ p: crescent(), fill: c }] },
  {
    id: 'note',
    name: 'Nota musical',
    color: '#7a52d1',
    parts: (c) => [
      { p: P('M47 18 C64 22 78 32 74 52 C70 42 62 37 51 36Z'), fill: c },
      { p: rrect(45, 16, 7, 60, 3), fill: c },
      { p: ellipse(36, 76, 15, 11, -0.35), fill: c },
    ],
  },
  {
    id: 'bubble',
    name: 'Balão de fala',
    color: '#ffffff',
    parts: (c) => [
      { p: P('M28 66 L18 93 L50 70Z'), fill: c },
      { p: rrect(5, 10, 90, 62, 22), fill: c },
      { p: rrect(5, 10, 90, 62, 22), stroke: shade(c, -0.3), width: 3, noEdge: true },
    ],
  },
  {
    id: 'smiley',
    name: 'Carinha',
    color: '#ffd84d',
    parts: (c) => [
      { p: circle(50, 50, 43), fill: c },
      { p: ellipse(36, 42, 5, 7), fill: '#43203a', noEdge: true },
      { p: ellipse(64, 42, 5, 7), fill: '#43203a', noEdge: true },
      { p: circle(26, 58, 7), fill: 'rgba(255,110,150,0.45)', noEdge: true },
      { p: circle(74, 58, 7), fill: 'rgba(255,110,150,0.45)', noEdge: true },
      { p: P('M33 60 Q50 78 67 60'), stroke: '#43203a', width: 6, noEdge: true },
    ],
  },
  { id: 'bolt', name: 'Raio', color: '#ffd84d', parts: (c) => [{ p: P('M60 3 L20 57 L46 57 L35 97 L81 40 L55 40 L67 3Z'), fill: c }] },
  {
    id: 'paw',
    name: 'Patinha',
    color: '#ff9cc2',
    parts: (c) => [
      { p: ellipse(50, 66, 23, 19), fill: c },
      { p: circle(24, 41, 9.5), fill: c },
      { p: circle(41, 27, 10), fill: c },
      { p: circle(59, 27, 10), fill: c },
      { p: circle(76, 41, 9.5), fill: c },
    ],
  },
  {
    id: 'cherry',
    name: 'Cerejas',
    color: '#ff4d6d',
    parts: (c) => [
      { p: P('M60 14 C71 5 85 8 90 17 C79 23 68 22 60 14Z'), fill: '#5cc49a' },
      { p: P('M35 66 Q42 34 60 14'), stroke: '#4a8a5c', width: 4 },
      { p: P('M67 70 Q62 40 60 14'), stroke: '#4a8a5c', width: 4 },
      { p: circle(34, 72, 16), fill: c },
      { p: circle(67, 75, 16), fill: shade(c, -0.08) },
      shine(28, 66, 5, 3.5, -0.6),
      shine(61, 69, 5, 3.5, -0.6),
    ],
  },
  {
    id: 'rainbow',
    name: 'Arco-íris',
    color: '#ff6b8b',
    fixed: true,
    parts: () => {
      const cols = ['#ff6b8b', '#ffb347', '#ffe066', '#7bd389', '#6fb7ff', '#b79cff'];
      const out = cols.map((col, i) => {
        const ro = 45 - i * 5.5;
        const ri = ro - 5.5;
        const p = new Path2D();
        p.arc(50, 72, ro, Math.PI, 0);
        p.arc(50, 72, ri, 0, Math.PI, true);
        p.closePath();
        return { p, fill: col };
      });
      out.push({ p: circle(14, 74, 9), fill: '#ffffff' }, { p: circle(24, 77, 8), fill: '#ffffff' });
      out.push({ p: circle(86, 74, 9), fill: '#ffffff' }, { p: circle(76, 77, 8), fill: '#ffffff' });
      return out;
    },
  },
  {
    id: 'tape',
    name: 'Fita adesiva',
    color: '#ff9cc2',
    custom: true,
  },
  { id: 'circle', name: 'Bolinha', color: '#b79cff', parts: (c) => [{ p: circle(50, 50, 44), fill: c }, shine(32, 30, 10, 6, -0.6)] },
];

export const EMOJIS = ['💖', '🎀', '🌸', '🦋', '🍓', '🐰', '🧸', '🌈', '👑', '🍒', '⭐', '✨', '🌙', '☁️', '🎵', '💌', '🐱', '🌷', '🍰', '💫'];

export const stickerInfo = (id) => STICKERS.find((s) => s.id === id) || STICKERS[0];

function drawTape(ctx, c) {
  const base = new Path2D();
  const teeth = 4;
  const y0 = 34;
  const y1 = 66;
  base.moveTo(10, y0);
  base.lineTo(90, y0);
  for (let i = 0; i < teeth; i++) {
    const ya = y0 + ((i + 0.5) * (y1 - y0)) / teeth;
    const yb = y0 + ((i + 1) * (y1 - y0)) / teeth;
    base.lineTo(95, ya);
    base.lineTo(90, yb);
  }
  base.lineTo(10, y1);
  for (let i = teeth - 1; i >= 0; i--) {
    const ya = y0 + ((i + 0.5) * (y1 - y0)) / teeth;
    const yb = y0 + (i * (y1 - y0)) / teeth;
    base.lineTo(5, ya);
    base.lineTo(10, yb);
  }
  base.closePath();
  ctx.save();
  ctx.translate(50, 50);
  ctx.rotate((-10 * Math.PI) / 180);
  ctx.translate(-50, -50);
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = c;
  ctx.fill(base);
  ctx.clip(base);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#ffffff';
  for (let x = -20; x < 120; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + 4, y0);
    ctx.lineTo(x + 4 - 32, y1);
    ctx.lineTo(x - 32, y1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Desenha um adesivo dentro da caixa 100 x 100 (o ctx já está na escala certa).
export function drawShape(ctx, id, color) {
  const s = stickerInfo(id);
  const c = color || s.color;
  if (s.custom) return drawTape(ctx, c);
  const parts = s.parts(c);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // borda branca de adesivo, por baixo de tudo
  ctx.strokeStyle = '#ffffff';
  for (const part of parts) {
    if (part.noEdge) continue;
    ctx.lineWidth = (part.width || 0) + 9;
    ctx.stroke(part.p);
  }
  for (const part of parts) {
    if (part.fill) {
      ctx.fillStyle = part.fill;
      ctx.fill(part.p);
    } else if (part.stroke) {
      ctx.strokeStyle = part.stroke;
      ctx.lineWidth = part.width || 3;
      ctx.stroke(part.p);
    }
  }
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// Desenha o adesivo da camada com centro em (px, py) na tela; k = px por mm.
export function drawSticker(ctx, layer, px, py, k) {
  const size = layer.size * k;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  if (layer.flip) ctx.scale(-1, 1);
  if (layer.kind === 'emoji') {
    ctx.font = `${size * 0.86}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(layer.name, 0, size * 0.04);
  } else {
    ctx.scale(size / 100, size / 100);
    ctx.translate(-50, -50);
    drawShape(ctx, layer.name, layer.color);
  }
  ctx.restore();
}

// Desenho pequeno para os botões.
export function stickerPreview(id, px = 56) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(px * dpr);
  c.style.width = c.style.height = `${px}px`;
  const ctx = c.getContext('2d');
  ctx.scale((px * dpr) / 116, (px * dpr) / 116);
  ctx.translate(8, 8);
  drawShape(ctx, id);
  return c;
}
