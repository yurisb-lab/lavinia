// Editor do card: a forma fica parada no meio e a foto é arrastada, aumentada e girada por baixo dela.
// Funciona com dedo (tablet), caneta e mouse.

import { cardSize, coverScale, drawCard, drawImage, roundRectPath, CARD } from './card.js';

const ZOOM_MIN = 0.25; // em relação ao "preencher o card"
const ZOOM_MAX = 8;
const SNAP_DEG = 4;

export function createEditor(canvas, { onChange, onCommit } = {}) {
  const ctx = canvas.getContext('2d');
  let img = null;
  let design = { orientation: 'portrait', bg: '#ffffff', transform: { x: 0, y: 0, scale: 1, rotation: 0, flip: false } };
  let view = { cw: 0, ch: 0, k: 1, cx: 0, cy: 0 };
  let raf = 0;

  const pointers = new Map();
  let gesture = null;

  // ---------- medidas da tela ----------
  function layout() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = Math.max(1, rect.width);
    const ch = Math.max(1, rect.height);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const { w, h } = cardSize(design.orientation);
    const pad = Math.max(24, Math.min(cw, ch) * 0.14);
    const k = Math.max(0.5, Math.min((cw - pad * 2) / w, (ch - pad * 2) / h));
    view = { cw, ch, k, cx: cw / 2, cy: ch / 2, dpr };
  }

  function cardRect() {
    const { w, h } = cardSize(design.orientation);
    return { left: view.cx - (w * view.k) / 2, top: view.cy - (h * view.k) / 2, w: w * view.k, h: h * view.k };
  }

  // ---------- desenho ----------
  function draw() {
    raf = 0;
    layout();
    const { dpr, k } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.cw, view.ch);
    const r = cardRect();

    // A parte da foto que fica fora do card aparece apagadinha, como no Canva.
    if (img) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawImage(ctx, img, design.transform, view.cx, view.cy, k);
      ctx.restore();
    }

    // Sombra do card
    ctx.save();
    ctx.shadowColor = 'rgba(122, 46, 84, 0.22)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    roundRectPath(ctx, r.left, r.top, r.w, r.h, CARD.radius * k);
    ctx.fillStyle = design.bg || '#fff';
    ctx.fill();
    ctx.restore();

    drawCard(ctx, img, design, r.left, r.top, k);

    // Contorno do card
    ctx.save();
    roundRectPath(ctx, r.left, r.top, r.w, r.h, CARD.radius * k);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    roundRectPath(ctx, r.left - 1.5, r.top - 1.5, r.w + 3, r.h + 3, CARD.radius * k + 1.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(214, 66, 128, 0.55)';
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function changed() {
    redraw();
    onChange && onChange(api.getDesign());
  }

  function commit() {
    onCommit && onCommit(api.getDesign());
  }

  // ---------- regras da foto ----------
  function baseCover() {
    if (!img) return 1;
    return coverScale(img.naturalWidth || img.width, img.naturalHeight || img.height, design.orientation, 0);
  }

  function clampScale(s) {
    const c = baseCover();
    return Math.min(c * ZOOM_MAX, Math.max(c * ZOOM_MIN, s));
  }

  function snapRotation(deg) {
    let d = ((deg + 180) % 360 + 360) % 360 - 180;
    for (const target of [-180, -90, 0, 90, 180]) {
      if (Math.abs(d - target) <= SNAP_DEG) return target === -180 ? 180 : target;
    }
    return Math.round(d * 10) / 10;
  }

  // Muda escala/rotação mantendo fixo um ponto da tela (o dedo ou o cursor).
  function transformAround(t0, px, py, newScale, newRotation, moveX = 0, moveY = 0) {
    const k = view.k;
    const ratio = newScale / t0.scale;
    const da = ((newRotation - t0.rotation) * Math.PI) / 180;
    const cos = Math.cos(da);
    const sin = Math.sin(da);
    const ix = view.cx + t0.x * k - px;
    const iy = view.cy + t0.y * k - py;
    const nx = px + moveX + ratio * (ix * cos - iy * sin);
    const ny = py + moveY + ratio * (ix * sin + iy * cos);
    return { ...t0, scale: newScale, rotation: newRotation, x: (nx - view.cx) / k, y: (ny - view.cy) / k };
  }

  // ---------- gestos ----------
  function localPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startGesture() {
    const pts = [...pointers.values()];
    const t0 = { ...design.transform };
    if (pts.length === 1) {
      gesture = { type: 'pan', t0, p0: { ...pts[0] } };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      gesture = {
        type: 'pinch',
        t0,
        m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        d0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        a0: Math.atan2(b.y - a.y, b.x - a.x),
      };
    } else {
      gesture = null;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!img) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* alguns navegadores recusam; o gesto funciona igual */
    }
    pointers.set(e.pointerId, localPoint(e));
    canvas.classList.add('is-grabbing');
    startGesture();
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, localPoint(e));
    const pts = [...pointers.values()];
    const g = gesture;
    if (g.type === 'pan' && pts.length === 1) {
      const p = pts[0];
      design.transform = { ...g.t0, x: g.t0.x + (p.x - g.p0.x) / view.k, y: g.t0.y + (p.y - g.p0.y) / view.k };
    } else if (g.type === 'pinch' && pts.length >= 2) {
      const [a, b] = pts;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const scale = clampScale(g.t0.scale * (d / g.d0));
      const rotation = snapRotation(g.t0.rotation + ((ang - g.a0) * 180) / Math.PI);
      design.transform = transformAround(g.t0, g.m0.x, g.m0.y, scale, rotation, m.x - g.m0.x, m.y - g.m0.y);
    }
    changed();
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      gesture = null;
      canvas.classList.remove('is-grabbing');
      commit();
    } else {
      startGesture();
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);

  let wheelTimer = 0;
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!img) return;
      e.preventDefault();
      const p = localPoint(e);
      const t0 = design.transform;
      if (e.shiftKey) {
        design.transform = transformAround(t0, view.cx, view.cy, t0.scale, snapRotation(t0.rotation + Math.sign(e.deltaY) * 3));
      } else {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        design.transform = transformAround(t0, p.x, p.y, clampScale(t0.scale * factor), t0.rotation);
      }
      changed();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(commit, 300);
    },
    { passive: false }
  );

  canvas.addEventListener('keydown', (e) => {
    if (!img) return;
    const step = e.shiftKey ? 5 : 1;
    const t = design.transform;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      design.transform = { ...t, x: t.x + moves[e.key][0], y: t.y + moves[e.key][1] };
    } else if (e.key === '+' || e.key === '=') {
      api.setZoom(api.getZoom() * 1.1);
      return e.preventDefault();
    } else if (e.key === '-') {
      api.setZoom(api.getZoom() / 1.1);
      return e.preventDefault();
    } else {
      return;
    }
    e.preventDefault();
    changed();
    commit();
  });

  const ro = new ResizeObserver(redraw);
  ro.observe(canvas);

  // ---------- API ----------
  const api = {
    hasImage: () => !!img,
    getImage: () => img,
    getDesign: () => ({ ...design, transform: { ...design.transform } }),

    load(newImg, newDesign) {
      img = newImg;
      design = { ...newDesign, transform: { ...newDesign.transform } };
      layout();
      redraw();
    },

    clear() {
      img = null;
      design = { ...design, transform: { x: 0, y: 0, scale: 1, rotation: 0, flip: false } };
      redraw();
    },

    fit() {
      if (!img) return;
      design.transform = { x: 0, y: 0, scale: baseCover(), rotation: 0, flip: design.transform.flip };
      changed();
      commit();
    },

    setOrientation(o) {
      if (o === design.orientation) return;
      design.orientation = o;
      if (img) {
        const t = design.transform;
        design.transform = { ...t, x: 0, y: 0, scale: coverScale(img.naturalWidth, img.naturalHeight, o, t.rotation) };
      }
      changed();
      commit();
    },

    setBackground(color) {
      design.bg = color;
      changed();
      commit();
    },

    getZoom: () => (img ? design.transform.scale / baseCover() : 1),
    setZoom(z, { silent } = {}) {
      if (!img) return;
      const t0 = design.transform;
      design.transform = transformAround(t0, view.cx, view.cy, clampScale(z * baseCover()), t0.rotation);
      changed();
      if (!silent) commit();
    },
    zoomLimits: () => ({ min: ZOOM_MIN, max: ZOOM_MAX }),

    getRotation: () => design.transform.rotation,
    setRotation(deg, { silent } = {}) {
      if (!img) return;
      const t0 = design.transform;
      design.transform = transformAround(t0, view.cx, view.cy, t0.scale, snapRotation(deg));
      changed();
      if (!silent) commit();
    },
    rotate90() {
      api.setRotation(design.transform.rotation + 90);
    },

    flip() {
      if (!img) return;
      design.transform = { ...design.transform, flip: !design.transform.flip };
      changed();
      commit();
    },

    commitNow: commit,

    destroy() {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },

    // Posição do card na tela (para a animação de "voar para a folha").
    cardScreenRect() {
      const r = cardRect();
      const c = canvas.getBoundingClientRect();
      return { left: c.left + r.left, top: c.top + r.top, width: r.w, height: r.h };
    },
  };

  layout();
  redraw();
  return api;
}
