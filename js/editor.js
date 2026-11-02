// Editor do card: a forma fica parada no meio e a foto é arrastada, aumentada e girada por baixo dela.
// Funciona com dedo (tablet), caneta e mouse.
// Tem duas camadas: a foto (na frente) e a foto de fundo (atrás). Os gestos mexem na camada escolhida.

import { cardSize, coverScale, drawCard, drawImage, roundRectPath, CARD } from './card.js';

const ZOOM_MIN = 0.25; // em relação ao "preencher o card"
const ZOOM_MAX = 8;
const SNAP_DEG = 4;

export function createEditor(canvas, { onChange, onCommit, onTap } = {}) {
  const ctx = canvas.getContext('2d');
  let img = null;
  let bgImg = null; // foto de fundo (opcional)
  let target = 'photo'; // camada que os gestos mexem: 'photo' ou 'bg'
  let design = { orientation: 'portrait', bg: '#ffffff', transform: { x: 0, y: 0, scale: 1, rotation: 0, flip: false }, bgTransform: null };
  let view = { cw: 0, ch: 0, k: 1, cx: 0, cy: 0 };
  let raf = 0;

  const pointers = new Map();
  let gesture = null;
  let tap = null; // toque rápido, sem arrastar
  let tapMode = false; // no modo "tirar fundo", tocar apaga a cor em vez de mover
  let checker = false; // xadrez no lugar do fundo, para ver o que ficou transparente
  let checkerPattern = null;

  // Camada que está sendo mexida agora.
  const layerImg = () => (target === 'bg' ? bgImg : img);
  const tKey = () => (target === 'bg' ? 'bgTransform' : 'transform');
  const getT = () => design[tKey()];
  const setT = (t) => (design[tKey()] = t);

  function getChecker() {
    if (checkerPattern) return checkerPattern;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#f2dbe6';
    g.fillRect(0, 0, 8, 8);
    g.fillRect(8, 8, 8, 8);
    checkerPattern = ctx.createPattern(c, 'repeat');
    return checkerPattern;
  }

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
    if (layerImg() && getT()) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawImage(ctx, layerImg(), getT(), view.cx, view.cy, k);
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

    if (checker) {
      ctx.save();
      ctx.translate(r.left, r.top);
      drawCard(ctx, img, { ...design, bg: getChecker() }, 0, 0, k); // sem a foto de fundo, para ver o transparente
      ctx.restore();
    } else {
      drawCard(ctx, img, design, r.left, r.top, k, bgImg);
    }

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
    const li = layerImg();
    if (!li) return 1;
    return coverScale(li.naturalWidth || li.width, li.naturalHeight || li.height, design.orientation, 0);
  }

  function coverFor(im, orientation, rotation = 0) {
    return coverScale(im.naturalWidth || im.width, im.naturalHeight || im.height, orientation, rotation);
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
    const t0 = { ...getT() };
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
    if (!layerImg()) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* alguns navegadores recusam; o gesto funciona igual */
    }
    pointers.set(e.pointerId, localPoint(e));
    tap = pointers.size === 1 ? { id: e.pointerId, ...localPoint(e) } : null;
    canvas.classList.add('is-grabbing');
    startGesture();
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    const lp = localPoint(e);
    pointers.set(e.pointerId, lp);
    if (tap && tap.id === e.pointerId) {
      if (Math.hypot(lp.x - tap.x, lp.y - tap.y) > 8) tap = null;
      else if (tapMode) return; // ainda pode ser um toque: não mexe na foto
    }
    const pts = [...pointers.values()];
    const g = gesture;
    if (g.type === 'pan' && pts.length === 1) {
      const p = pts[0];
      setT({ ...g.t0, x: g.t0.x + (p.x - g.p0.x) / view.k, y: g.t0.y + (p.y - g.p0.y) / view.k });
    } else if (g.type === 'pinch' && pts.length >= 2) {
      const [a, b] = pts;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const scale = clampScale(g.t0.scale * (d / g.d0));
      const rotation = snapRotation(g.t0.rotation + ((ang - g.a0) * 180) / Math.PI);
      setT(transformAround(g.t0, g.m0.x, g.m0.y, scale, rotation, m.x - g.m0.x, m.y - g.m0.y));
    }
    changed();
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      const t = tap;
      tap = null;
      gesture = null;
      canvas.classList.remove('is-grabbing');
      if (t && tapMode && e.type === 'pointerup' && t.id === e.pointerId && onTap) {
        const pt = api.screenToImage(t.x, t.y);
        if (pt) onTap(pt);
        return;
      }
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
      if (!layerImg()) return;
      e.preventDefault();
      const p = localPoint(e);
      const t0 = getT();
      if (e.shiftKey) {
        setT(transformAround(t0, view.cx, view.cy, t0.scale, snapRotation(t0.rotation + Math.sign(e.deltaY) * 3)));
      } else {
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        setT(transformAround(t0, p.x, p.y, clampScale(t0.scale * factor), t0.rotation));
      }
      changed();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(commit, 300);
    },
    { passive: false }
  );

  canvas.addEventListener('keydown', (e) => {
    if (!layerImg()) return;
    const step = e.shiftKey ? 5 : 1;
    const t = getT();
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      setT({ ...t, x: t.x + moves[e.key][0], y: t.y + moves[e.key][1] });
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
    getDesign: () => ({
      ...design,
      transform: { ...design.transform },
      bgTransform: bgImg && design.bgTransform ? { ...design.bgTransform } : null,
    }),

    // newBgImg: foto de fundo (opcional), enquadrada por newDesign.bgTransform.
    load(newImg, newDesign, newBgImg = null) {
      img = newImg;
      bgImg = newBgImg && newDesign.bgTransform ? newBgImg : null;
      target = 'photo';
      design = { ...newDesign, transform: { ...newDesign.transform }, bgTransform: bgImg ? { ...newDesign.bgTransform } : null };
      layout();
      redraw();
    },

    clear() {
      img = null;
      bgImg = null;
      target = 'photo';
      design = { ...design, transform: { x: 0, y: 0, scale: 1, rotation: 0, flip: false }, bgTransform: null };
      redraw();
    },

    fit() {
      if (!layerImg()) return;
      setT({ x: 0, y: 0, scale: baseCover(), rotation: 0, flip: getT().flip });
      changed();
      commit();
    },

    setOrientation(o) {
      if (o === design.orientation) return;
      design.orientation = o;
      if (img) {
        const t = design.transform;
        design.transform = { ...t, x: 0, y: 0, scale: coverFor(img, o, t.rotation) };
      }
      if (bgImg) {
        const t = design.bgTransform;
        design.bgTransform = { ...t, x: 0, y: 0, scale: coverFor(bgImg, o, t.rotation) };
      }
      changed();
      commit();
    },

    // ---------- foto de fundo ----------
    hasBgImage: () => !!bgImg,
    getBgImage: () => bgImg,
    // Coloca (ou troca) a foto de fundo, já cobrindo o card inteiro.
    setBgImage(newBgImg) {
      bgImg = newBgImg;
      design.bgTransform = { x: 0, y: 0, scale: coverFor(newBgImg, design.orientation), rotation: 0, flip: false };
      changed();
      commit();
    },
    clearBgImage() {
      bgImg = null;
      design.bgTransform = null;
      changed();
      commit();
    },
    // Qual camada os gestos, as barras e os botões mexem: 'photo' ou 'bg'.
    setTarget(t) {
      target = t === 'bg' ? 'bg' : 'photo';
      canvas.classList.toggle('is-bg-target', target === 'bg');
      redraw();
    },
    getTarget: () => target,

    setBackground(color) {
      design.bg = color;
      changed();
      commit();
    },

    getZoom: () => (layerImg() ? getT().scale / baseCover() : 1),
    setZoom(z, { silent } = {}) {
      if (!layerImg()) return;
      const t0 = getT();
      setT(transformAround(t0, view.cx, view.cy, clampScale(z * baseCover()), t0.rotation));
      changed();
      if (!silent) commit();
    },
    zoomLimits: () => ({ min: ZOOM_MIN, max: ZOOM_MAX }),

    getRotation: () => (getT() ? getT().rotation : 0),
    setRotation(deg, { silent } = {}) {
      if (!layerImg()) return;
      const t0 = getT();
      setT(transformAround(t0, view.cx, view.cy, t0.scale, snapRotation(deg)));
      changed();
      if (!silent) commit();
    },
    rotate90() {
      api.setRotation(api.getRotation() + 90);
    },

    flip() {
      if (!layerImg()) return;
      setT({ ...getT(), flip: !getT().flip });
      changed();
      commit();
    },

    commitNow: commit,

    // Troca só a imagem, mantendo o enquadramento (usado pelo "tirar fundo").
    swapImage(newImg) {
      img = newImg;
      redraw();
    },
    setTapMode(on) {
      tapMode = !!on;
      canvas.classList.toggle('is-tap-mode', tapMode);
    },
    setChecker(on) {
      checker = !!on;
      redraw();
    },

    // Ponto da tela -> pixel da foto (ou null se caiu fora dela).
    screenToImage(px, py) {
      if (!img) return null;
      const t = design.transform;
      const k = view.k;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      let vx = px - (view.cx + t.x * k);
      let vy = py - (view.cy + t.y * k);
      const a = (-t.rotation * Math.PI) / 180;
      const rx = vx * Math.cos(a) - vy * Math.sin(a);
      const ry = vx * Math.sin(a) + vy * Math.cos(a);
      vx = (t.flip ? -rx : rx) / (t.scale * k) + iw / 2;
      vy = ry / (t.scale * k) + ih / 2;
      if (vx < 0 || vy < 0 || vx >= iw || vy >= ih) return null;
      return { x: vx, y: vy };
    },

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
