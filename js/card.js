// Medidas e desenho do photo card.
// Tudo é guardado em milímetros, então a tela e o PDF usam a mesma conta.

export const CARD = {
  long: 86, // mm
  short: 54, // mm
  radius: 3, // mm, raio dos cantos arredondados
};

export const PRINT_DPI = 300;
export const PX_PER_MM_PRINT = PRINT_DPI / 25.4;

export function cardSize(orientation) {
  return orientation === 'landscape'
    ? { w: CARD.long, h: CARD.short }
    : { w: CARD.short, h: CARD.long };
}

// Escala (mm por pixel da imagem) para a foto cobrir o card inteiro.
export function coverScale(imgW, imgH, orientation, rotation = 0) {
  const { w, h } = cardSize(orientation);
  const r = (rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  // Caixa do card vista no sistema da imagem girada.
  const needW = w * c + h * s;
  const needH = w * s + h * c;
  return Math.max(needW / imgW, needH / imgH);
}

export function defaultTransform(imgW, imgH, orientation) {
  return { x: 0, y: 0, scale: coverScale(imgW, imgH, orientation), rotation: 0, flip: false };
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

// Desenha a foto. cx/cy = centro do card em px; k = px por mm.
export function drawImage(ctx, img, t, cx, cy, k) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  ctx.save();
  ctx.translate(cx + t.x * k, cy + t.y * k);
  ctx.rotate((t.rotation * Math.PI) / 180);
  if (t.flip) ctx.scale(-1, 1);
  const dw = iw * t.scale * k;
  const dh = ih * t.scale * k;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// Desenha o card completo (fundo + foto, recortado com cantos arredondados).
export function drawCard(ctx, img, design, left, top, k) {
  const { w, h } = cardSize(design.orientation);
  ctx.save();
  roundRectPath(ctx, left, top, w * k, h * k, CARD.radius * k);
  ctx.clip();
  ctx.fillStyle = design.bg || '#ffffff';
  ctx.fillRect(left, top, w * k, h * k);
  drawImage(ctx, img, design.transform, left + (w * k) / 2, top + (h * k) / 2, k);
  ctx.restore();
}

// Gera o card em alta resolução, sempre em pé (54 x 86 mm), pronto para a folha.
// Cards deitados são girados 90° no sentido horário.
export function renderForPrint(img, design, pxPerMm = PX_PER_MM_PRINT) {
  const { w, h } = cardSize(design.orientation);
  const src = document.createElement('canvas');
  src.width = Math.round(w * pxPerMm);
  src.height = Math.round(h * pxPerMm);
  const sctx = src.getContext('2d');
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, src.width, src.height);
  drawCard(sctx, img, design, 0, 0, src.width / w);

  if (design.orientation !== 'landscape') return src;

  const out = document.createElement('canvas');
  out.width = src.height;
  out.height = src.width;
  const octx = out.getContext('2d');
  octx.translate(out.width, 0);
  octx.rotate(Math.PI / 2);
  octx.drawImage(src, 0, 0);
  return out;
}

// Miniatura na orientação do próprio card.
export function renderThumb(img, design, longSide = 360) {
  const { w, h } = cardSize(design.orientation);
  const k = longSide / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  drawCard(ctx, img, design, 0, 0, k);
  return c;
}
