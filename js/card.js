// Medidas e modelo do photo card.
// Tudo é guardado em milímetros, então a tela e o PDF usam a mesma conta.

export const CARD = {
  long: 85, // mm
  short: 53, // mm
  radius: 3, // mm, raio dos cantos arredondados
};

export const PRINT_DPI = 300;
export const PX_PER_MM_PRINT = PRINT_DPI / 25.4;

const CELL_GAP = 1.6; // mm entre as fotos de uma colagem
const CELL_RADIUS = 1.5; // mm

export function cardSize(orientation) {
  return orientation === 'landscape' ? { w: CARD.long, h: CARD.short } : { w: CARD.short, h: CARD.long };
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ---------- molduras ----------
// inset = largura da borda (mm). A foto fica na "janela" de dentro.
export const FRAMES = [
  { id: 'none', name: 'Sem moldura', inset: 0 },
  { id: 'solid', name: 'Borda', inset: 3 },
  { id: 'polaroid', name: 'Polaroid', inset: 3.5, bottom: 14, bottomLandscape: 11, color: '#ffffff' },
  { id: 'double', name: 'Borda dupla', inset: 4 },
  { id: 'stitch', name: 'Costurinha', inset: 4 },
  { id: 'dots', name: 'Bolinhas', inset: 4.5 },
  { id: 'hearts', name: 'Corações', inset: 5 },
  { id: 'checker', name: 'Xadrez', inset: 4.5 },
  { id: 'stripes', name: 'Listras', inset: 4.5 },
];

export const frameInfo = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0];

// Janela da moldura, em mm a partir do canto de cima à esquerda do card.
export function frameWindow(frame, orientation) {
  const { w, h } = cardSize(orientation);
  const f = frameInfo(frame && frame.id);
  if (!f.inset) return { x: 0, y: 0, w, h, r: CARD.radius };
  const bottom = f.bottom ? (orientation === 'landscape' ? f.bottomLandscape : f.bottom) : f.inset;
  return { x: f.inset, y: f.inset, w: w - 2 * f.inset, h: h - f.inset - bottom, r: CELL_RADIUS };
}

// ---------- colagem ----------
// Cada espaço é [x, y, largura, altura] em frações da janela.
export const LAYOUTS = [
  { id: '0', name: 'Sem foto', cells: [] },
  { id: '1', name: 'Uma foto', cells: [[0, 0, 1, 1]] },
  { id: '2h', name: 'Duas, uma em cima da outra', cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: '2v', name: 'Duas, lado a lado', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: '3t', name: 'Três, uma grande em cima', cells: [[0, 0, 1, 0.58], [0, 0.58, 0.5, 0.42], [0.5, 0.58, 0.5, 0.42]] },
  { id: '3r', name: 'Três em fileira', cells: [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]] },
  { id: '3l', name: 'Três, uma grande ao lado', cells: [[0, 0, 0.58, 1], [0.58, 0, 0.42, 0.5], [0.58, 0.5, 0.42, 0.5]] },
  { id: '4', name: 'Quatro', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
];

export const layoutInfo = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[1];

// Espaços das fotos em mm. x/y = canto; cx/cy = centro em relação ao centro do card.
export function cellRects(side, orientation) {
  const { w, h } = cardSize(orientation);
  const win = frameWindow(side.frame, orientation);
  const layout = layoutInfo(side.layout);
  const g = CELL_GAP / 2;
  return layout.cells.map(([fx, fy, fw, fh]) => {
    const l = fx > 0.001 ? g : 0;
    const r = fx + fw < 0.999 ? g : 0;
    const t = fy > 0.001 ? g : 0;
    const b = fy + fh < 0.999 ? g : 0;
    const x = win.x + fx * win.w + l;
    const y = win.y + fy * win.h + t;
    const cw = fw * win.w - l - r;
    const ch = fh * win.h - t - b;
    return { x, y, w: cw, h: ch, r: layout.cells.length === 1 ? win.r : CELL_RADIUS, cx: x + cw / 2 - w / 2, cy: y + ch / 2 - h / 2 };
  });
}

// Foto de fundo: ocupa o card inteiro, atrás da moldura e das outras fotos.
export const BG_CELL = -1;

// Espaço de uma foto (o card inteiro, se for a foto de fundo).
export function cellFor(side, orientation, index) {
  if (index === BG_CELL) {
    const { w, h } = cardSize(orientation);
    return { x: 0, y: 0, w, h, r: CARD.radius, cx: 0, cy: 0 };
  }
  return cellRects(side, orientation)[index] || null;
}

export const isBgPhoto = (l) => !!l && l.type === 'photo' && l.cell === BG_CELL;

// Escala (mm por pixel da imagem) para a foto cobrir um espaço inteiro.
export function coverScale(imgW, imgH, w, h, rotation = 0) {
  const r = (rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  const needW = w * c + h * s;
  const needH = w * s + h * c;
  return Math.max(needW / imgW, needH / imgH);
}

// ---------- modelo do card ----------
export const defaultFx = () => ({ filter: 'normal', brightness: 0, contrast: 0, saturation: 0 });
export const defaultOutline = () => ({ on: false, size: 4, color: '#ffffff' });

export function newSide(layout = '1') {
  return { bg: { kind: 'solid', color: '#ffffff' }, frame: { id: 'none', color: '#ffffff' }, layout, layers: [] };
}

// O verso começa sem espaço de foto (dá para pôr uma em "Colagem" ou escolhendo uma foto).
export function newDesign(orientation = 'portrait') {
  return { v: 2, orientation, front: newSide('1'), back: newSide('0') };
}

export function newPhotoLayer(imageKey, cell, img, rect) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  return {
    id: uid(),
    type: 'photo',
    cell,
    imageKey,
    originalKey: null,
    bgOps: null,
    x: 0,
    y: 0,
    scale: coverScale(iw, ih, rect.w, rect.h, 0),
    rotation: 0,
    flip: false,
    fx: defaultFx(),
    outline: defaultOutline(),
  };
}

export function newTextLayer(props = {}) {
  return {
    id: uid(),
    type: 'text',
    text: 'Seu texto',
    font: 'fredoka',
    size: 7,
    color: '#c92f6c',
    stroke: { color: '#ffffff', width: 4 },
    shadow: false,
    align: 'center',
    x: 0,
    y: 0,
    rotation: 0,
    ...props,
  };
}

export function newStickerLayer(props = {}) {
  return { id: uid(), type: 'sticker', kind: 'shape', name: 'heart', color: '#ff5c93', size: 14, x: 0, y: 0, rotation: 0, flip: false, ...props };
}

// O lado tem alguma coisa além do fundo branco liso?
export function sideHasContent(side) {
  if (!side) return false;
  return (
    side.layers.length > 0 ||
    side.bg.kind !== 'solid' ||
    String(side.bg.color).toLowerCase() !== '#ffffff' ||
    side.frame.id !== 'none'
  );
}

// Chaves de todas as fotos usadas no card (para guardar só o que precisa).
export function imageKeys(design) {
  const keys = new Set();
  for (const s of [design.front, design.back]) {
    for (const l of s.layers) {
      if (l.type !== 'photo') continue;
      if (l.imageKey) keys.add(l.imageKey);
      if (l.originalKey) keys.add(l.originalKey);
    }
  }
  return keys;
}

// Cards guardados antes da versão com textos e adesivos: uma foto só, sem moldura.
export function migrateRecord(rec) {
  if (!rec || (rec.v === 2 && rec.design && rec.design.front)) return rec;
  const old = rec.design || {};
  const t = old.transform || { x: 0, y: 0, scale: 1, rotation: 0, flip: false };
  const design = newDesign(old.orientation || 'portrait');
  design.front.bg = { kind: 'solid', color: old.bg || '#ffffff' };
  const images = {};
  if (rec.imageBlob) {
    images.a = rec.imageBlob;
    if (rec.originalBlob) images.o = rec.originalBlob;
    design.front.layers.push({
      id: uid(),
      type: 'photo',
      cell: 0,
      imageKey: 'a',
      originalKey: rec.originalBlob ? 'o' : null,
      bgOps: rec.originalBlob ? rec.bgOps || null : null,
      x: t.x,
      y: t.y,
      scale: t.scale,
      rotation: t.rotation,
      flip: !!t.flip,
      fx: defaultFx(),
      outline: defaultOutline(),
    });
  }
  // foto de fundo ("Pôr fundo") da versão anterior
  const bt = old.bgTransform;
  if (rec.layerBlob && bt) {
    images.f = rec.layerBlob;
    design.front.layers.unshift({
      id: uid(),
      type: 'photo',
      cell: BG_CELL,
      imageKey: 'f',
      originalKey: null,
      bgOps: null,
      x: bt.x,
      y: bt.y,
      scale: bt.scale,
      rotation: bt.rotation,
      flip: !!bt.flip,
      fx: defaultFx(),
      outline: defaultOutline(),
    });
  }
  return { id: rec.id, createdAt: rec.createdAt, copies: rec.copies || 1, v: 2, design, images, thumbBlob: rec.thumbBlob };
}

// ---------- cores ----------
export function hexToRgb(hex) {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

// amt > 0 clareia, amt < 0 escurece.
export function shade(hex, amt) {
  const c = hexToRgb(hex);
  const target = amt > 0 ? 255 : 0;
  const a = Math.abs(amt);
  return rgbToHex(c.map((v) => v + (target - v) * a));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex([h, s, l]) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return rgbToHex([f(0), f(8), f(4)]);
}

// Cor do desenho por cima de uma cor de fundo (bolinhas, listras…):
// num fundo clarinho, a mesma cor mais forte; num fundo escuro, branco.
export function inkFor(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  if (s < 0.05 && l > 0.9) return '#ffa8c8';
  if (l > 0.66) return hslToHex([h, Math.min(1, s * 0.9 + 0.25), l - 0.17]);
  return '#ffffff';
}

// Desenho da moldura: branco, a não ser que a moldura seja bem clarinha.
export function frameInk(hex) {
  return rgbToHsl(hexToRgb(hex))[2] > 0.88 ? inkFor(hex) : '#ffffff';
}
