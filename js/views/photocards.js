// Tela de Photo cards: editor à esquerda (ou em cima, no tablet em pé) e a folha A4 ao lado.

import { createEditor } from '../editor.js';
import { defaultTransform, renderThumb, CARD } from '../card.js';
import { db, newId } from '../db.js';
import { importImageFile, blobToImage, releaseImage, canvasToBlob } from '../image.js';
import { buildPdf, paginate, slotPositions, SHEET, PER_PAGE } from '../pdf.js';
import { icon } from '../icons.js';
import { createBgRemover } from '../bg-remover.js';
import { toast } from '../toast.js';

export const title = 'Photo cards';

const BACKGROUNDS = [
  { color: '#ffffff', name: 'Branco' },
  { color: '#ffd9e8', name: 'Rosa' },
  { color: '#e6dcff', name: 'Lilás' },
  { color: '#d2f4e4', name: 'Verde menta' },
  { color: '#fff0b3', name: 'Amarelo' },
  { color: '#d5ebff', name: 'Azul céu' },
  { color: '#2a1d25', name: 'Preto' },
];

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n) => String(n).replace('.', ',');

function template() {
  const size = `${fmt(CARD.short / 10)} × ${fmt(CARD.long / 10)} cm`;
  return `
  <section class="pc">
    <div class="pc__editor">
      <div class="pc__head">
        <h1 class="pc__title">Photo card <span class="chip" data-editing hidden>${icon('edit', { size: 16 })} Editando um card da folha</span></h1>
        <div class="seg" role="group" aria-label="Posição do card">
          <button type="button" class="seg__btn" data-orient="portrait" aria-pressed="true">${icon('portrait', { size: 20 })}Em pé</button>
          <button type="button" class="seg__btn" data-orient="landscape" aria-pressed="false">${icon('landscape', { size: 20 })}Deitado</button>
        </div>
      </div>

      <div class="stage" data-stage>
        <canvas class="stage__canvas" tabindex="0" aria-label="Card. Arraste a foto para enquadrar; use as setas do teclado para mover."></canvas>
        <div class="stage__empty" data-empty>
          <button type="button" class="pick-btn" data-act="pick">
            ${icon('photo', { size: 34 })}
            <span>Escolher foto</span>
          </button>
          <p class="stage__or">${isTouch ? 'ou cole uma imagem que você copiou' : 'ou arraste uma imagem para cá, ou cole com Ctrl+V'}</p>
          <button type="button" class="link-btn" data-act="paste">${icon('upload', { size: 18 })} Colar imagem</button>
        </div>
        <div class="stage__drop" aria-hidden="true"><span>${icon('heart', { size: 28, fill: true })} Solte a imagem aqui</span></div>
        <span class="stage__size" data-size>${size}</span>
        <span class="stage__busy" data-busy hidden>${icon('wand', { size: 18 })}Apagando o fundo…</span>
        <span class="stage__layer" data-layer-chip hidden>${icon('layers', { size: 18 })}Mexendo no fundo</span>
      </div>
      <p class="stage__hint" data-hint hidden>
        ${isTouch ? 'Arraste com um dedo para mover. Com dois dedos, abra para aumentar e gire para inclinar.' : 'Arraste para mover. Use a rodinha do mouse para aumentar (com Shift, para girar).'}
      </p>

      <div class="tools" data-tools>
        <div class="slider">
          <span class="slider__label">${icon('zoom', { size: 20 })}Tamanho</span>
          <button type="button" class="round-btn" data-act="zoom-out" aria-label="Diminuir a foto">${icon('minus', { size: 20 })}</button>
          <input type="range" min="0" max="1000" value="0" data-zoom aria-label="Tamanho da foto">
          <button type="button" class="round-btn" data-act="zoom-in" aria-label="Aumentar a foto">${icon('plus', { size: 20 })}</button>
        </div>
        <div class="slider">
          <span class="slider__label">${icon('tilt', { size: 20 })}Inclinar</span>
          <input type="range" min="-180" max="180" step="1" value="0" data-rot aria-label="Inclinar a foto">
          <output class="slider__value" data-rot-out>0°</output>
        </div>
        <div class="tool-row">
          <button type="button" class="tool-btn" data-act="rotate90">${icon('rotate', { size: 22 })}Girar</button>
          <button type="button" class="tool-btn" data-act="flip">${icon('flip', { size: 22 })}Espelhar</button>
          <button type="button" class="tool-btn" data-act="fit">${icon('center', { size: 22 })}Encaixar</button>
          <button type="button" class="tool-btn tool-btn--magic" data-act="bg">${icon('wand', { size: 22 })}Tirar fundo</button>
          <button type="button" class="tool-btn tool-btn--layer" data-act="layer">${icon('layers', { size: 22 })}Pôr fundo</button>
          <button type="button" class="tool-btn" data-act="pick">${icon('photo', { size: 22 })}Trocar foto</button>
          <button type="button" class="tool-btn" data-act="paste">${icon('upload', { size: 22 })}Colar</button>
        </div>
        <div class="bg-panel" data-bg-panel hidden>
          <div class="bg-panel__head">
            <p class="bg-panel__title">${icon('wand', { size: 22 })}Tirar fundo da foto</p>
            <p class="bg-panel__help">${isTouch ? 'Toque' : 'Clique'} na cor que quer apagar. Pode ${isTouch ? 'tocar' : 'clicar'} em vários lugares. Para mover a foto, é só arrastar.</p>
          </div>
          <div class="slider">
            <span class="slider__label">Força</span>
            <input type="range" min="1" max="100" step="1" value="30" data-tol aria-label="Força do apagador">
            <output class="slider__value" data-tol-out>30</output>
          </div>
          <div class="bg-panel__row">
            <button type="button" class="tool-btn" data-act="bg-auto">${icon('sparkle', { size: 22 })}Automático</button>
            <button type="button" class="tool-btn" data-act="bg-undo">${icon('undo', { size: 22 })}Desfazer</button>
            <button type="button" class="tool-btn" data-act="bg-reset">${icon('photo', { size: 22 })}Foto original</button>
          </div>
          <button type="button" class="btn btn--primary" data-act="bg-done">${icon('check', { size: 22 })}Pronto</button>
        </div>
        <div class="bg-panel bg-panel--layer" data-layer-panel hidden>
          <div class="bg-panel__head">
            <p class="bg-panel__title">${icon('layers', { size: 22 })}Foto de fundo</p>
            <p class="bg-panel__help" data-layer-help></p>
          </div>
          <div class="bg-panel__row bg-panel__row--4">
            <button type="button" class="tool-btn" data-act="pick">${icon('photo', { size: 22 })}Escolher foto</button>
            <button type="button" class="tool-btn" data-act="paste">${icon('upload', { size: 22 })}Colar</button>
            <button type="button" class="tool-btn" data-act="fit" data-layer-needs>${icon('center', { size: 22 })}Encaixar</button>
            <button type="button" class="tool-btn" data-act="layer-remove" data-layer-needs>${icon('trash', { size: 22 })}Remover</button>
          </div>
          <button type="button" class="btn btn--primary" data-act="layer-done">${icon('check', { size: 22 })}Pronto</button>
        </div>
        <div class="swatches" role="radiogroup" aria-label="Cor de fundo do card">
          <span class="swatches__label">${icon('palette', { size: 20 })}Cor de fundo</span>
          ${BACKGROUNDS.map(
            (b) => `<button type="button" class="swatch" role="radio" aria-checked="false" aria-label="${b.name}" title="${b.name}" data-bg="${b.color}" style="--sw:${b.color}"></button>`
          ).join('')}
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--primary" data-act="save">${icon('sparkle', { size: 22, fill: true })}<span data-save-label>Colocar na folha</span></button>
        <button type="button" class="btn btn--soft" data-act="new"><span data-new-label>Começar outro card</span></button>
      </div>
    </div>

    <aside class="pc__sheet" aria-labelledby="sheet-title" data-sheet>
      <div class="sheet__head">
        <h2 id="sheet-title" class="sheet__title">Minha folha</h2>
        <span class="sheet__count" data-count></span>
      </div>
      <div class="pages" data-pages></div>
      <ul class="card-list" data-list></ul>

      <div class="print-box">
        <label class="check">
          <input type="checkbox" data-cutline checked>
          <span class="check__box">${icon('check', { size: 16 })}</span>
          Linha fininha em volta de cada card
        </label>
        <button type="button" class="btn btn--primary btn--wide" data-act="print">${icon('printer', { size: 22 })}<span data-print-label>Preparar folha para imprimir</span></button>
        <div class="ready" data-ready hidden>
          <p class="ready__title">${icon('heart', { size: 18, fill: true })} Sua folha está pronta!</p>
          <div class="ready__links">
            <a class="btn btn--primary" data-open target="_blank" rel="noopener">${icon('printer', { size: 20 })}Abrir e imprimir</a>
            <a class="btn btn--soft" data-download download="photo-cards-lavinia.pdf">${icon('download', { size: 20 })}Salvar PDF</a>
            <button type="button" class="btn btn--soft" data-act="share" hidden>${icon('upload', { size: 20 })}Compartilhar</button>
          </div>
        </div>
        <p class="print-tip">Na hora de imprimir, escolha <strong>tamanho real</strong> ou <strong>escala 100%</strong> (não use “ajustar à página”). No rodapé da folha tem uma régua de 5 cm para conferir.</p>
      </div>
    </aside>
    <input type="file" accept="image/*" hidden data-file>
  </section>`;
}

export async function mount(root) {
  root.innerHTML = template();
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];

  const stage = $('[data-stage]');
  const canvas = $('canvas');
  const fileInput = $('[data-file]');
  const zoomInput = $('[data-zoom]');
  const rotInput = $('[data-rot]');
  const rotOut = $('[data-rot-out]');

  let cards = []; // { ...registro do banco, thumbUrl }
  let editingId = null;
  let currentBlob = null;
  let originalBlob = null; // foto antes de tirar o fundo (para poder voltar)
  let bgOps = null; // o que foi feito no "tirar fundo": { ops, tolerance }
  let layerBlob = null; // foto de fundo do card ("Pôr fundo")
  let pdfUrl = null;
  let pdfFile = null;
  let draftTimer = 0;
  let alive = true;

  const editor = createEditor(canvas, {
    onChange: syncControls,
    onCommit: () => {
      syncControls();
      saveDraftSoon();
    },
    onTap: (pt) => bgTap(pt),
  });

  // ---------- controles do editor ----------
  const { min: ZMIN, max: ZMAX } = editor.zoomLimits();
  const zoomToSlider = (z) => Math.round((Math.log(z / ZMIN) / Math.log(ZMAX / ZMIN)) * 1000);
  const sliderToZoom = (v) => ZMIN * Math.pow(ZMAX / ZMIN, v / 1000);

  function syncControls() {
    const d = editor.getDesign();
    const has = editor.hasImage();
    stage.classList.toggle('has-image', has);
    $('[data-empty]').hidden = has;
    $('[data-hint]').hidden = !has;
    $('[data-tools]').classList.toggle('is-off', !has);
    $$('[data-tools] input, [data-tools] .round-btn, [data-tools] .tool-btn:not([data-act="pick"]):not([data-act="paste"])').forEach(
      (b) => (b.disabled = !has)
    );
    if (document.activeElement !== zoomInput) zoomInput.value = zoomToSlider(editor.getZoom());
    if (document.activeElement !== rotInput) rotInput.value = Math.round(d.transform.rotation);
    rotOut.textContent = `${Math.round(d.transform.rotation)}°`;
    $$('[data-orient]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orient === d.orientation)));
    $('[data-size]').textContent =
      d.orientation === 'landscape' ? `${fmt(CARD.long / 10)} × ${fmt(CARD.short / 10)} cm` : `${fmt(CARD.short / 10)} × ${fmt(CARD.long / 10)} cm`;
    $$('[data-bg]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.bg === d.bg)));
    $('[data-editing]').hidden = !editingId;
    $('[data-save-label]').textContent = editingId ? 'Salvar card' : 'Colocar na folha';
    $('[data-new-label]').textContent = editingId ? 'Cancelar edição' : 'Começar outro card';
    $('[data-act="save"]').disabled = !has;
    syncBg();
    syncLayer();
  }

  zoomInput.addEventListener('input', () => editor.setZoom(sliderToZoom(+zoomInput.value), { silent: true }));
  zoomInput.addEventListener('change', () => editor.commitNow());
  rotInput.addEventListener('input', () => editor.setRotation(+rotInput.value, { silent: true }));
  rotInput.addEventListener('change', () => editor.commitNow());

  // ---------- abrir imagem (arquivo, arrastar, colar) ----------
  async function useImageBlob(fileOrBlob) {
    // Com o painel "Foto de fundo" aberto, a imagem vai para o fundo.
    if (layer.active) return useLayerBlob(fileOrBlob);
    try {
      const { blob, img } = await importImageFile(fileOrBlob);
      cancelBg();
      const prev = editor.getImage();
      const d = editor.getDesign();
      currentBlob = blob;
      originalBlob = null;
      bgOps = null;
      // Trocar a foto mantém a foto de fundo que já estava.
      editor.load(
        img,
        { orientation: d.orientation, bg: d.bg, transform: defaultTransform(img.naturalWidth, img.naturalHeight, d.orientation), bgTransform: d.bgTransform },
        editor.getBgImage()
      );
      if (prev && prev !== img) releaseImage(prev);
      syncControls();
      saveDraftSoon();
    } catch (err) {
      toast(err.message || 'Não consegui abrir essa imagem.', { kind: 'error' });
    }
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) useImageBlob(f);
    fileInput.value = '';
  });

  async function pasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast(isTouch ? 'Este tablet não deixou colar por aqui. Use “Escolher foto”.' : 'Use Ctrl+V para colar a imagem.', { kind: 'error' });
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) return useImageBlob(new File([await item.getType(type)], 'colada', { type }));
      }
      toast('Não tem imagem copiada. Copie uma foto e tente de novo.', { kind: 'error' });
    } catch (_) {
      toast('Não consegui colar. Copie uma imagem e tente de novo.', { kind: 'error' });
    }
  }

  function onPaste(e) {
    const items = e.clipboardData ? [...e.clipboardData.items] : [];
    const item = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    useImageBlob(item.getAsFile());
  }
  document.addEventListener('paste', onPaste);

  // Arrastar e soltar: vale soltar em qualquer lugar da tela.
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/uri-list');
  function onDragEnter(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    stage.classList.add('is-dropping');
  }
  function onDragOver(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeave() {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) stage.classList.remove('is-dropping');
  }
  async function onDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    stage.classList.remove('is-dropping');
    const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) return useImageBlob(file);
    // Imagem arrastada de outra página da internet.
    const url = (e.dataTransfer.getData('text/uri-list') || '').split('\n').find((l) => l && !l.startsWith('#'));
    if (!url) return toast('Isso não parece ser uma imagem.', { kind: 'error' });
    try {
      const res = await fetch(url.trim(), { mode: 'cors' });
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error();
      useImageBlob(blob);
    } catch (_) {
      toast('Esse site não deixou copiar a imagem. Salve a foto no aparelho e arraste o arquivo.', { kind: 'error', duration: 6000 });
    }
  }
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);

  // ---------- rascunho (para não perder o que está fazendo) ----------
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (!currentBlob || !editor.hasImage()) return db.deleteMeta('draft').catch(() => {});
      db.setMeta('draft', draftData()).catch(() => {});
    }, 400);
  }

  function draftData() {
    return { imageBlob: currentBlob, originalBlob, bgOps, layerBlob: editor.hasBgImage() ? layerBlob : null, design: editor.getDesign(), editingId };
  }

  async function restoreDraft() {
    try {
      const draft = await db.getMeta('draft');
      if (!draft || !draft.imageBlob) return;
      const img = await blobToImage(draft.imageBlob);
      const layerImg = draft.layerBlob && draft.design.bgTransform ? await blobToImage(draft.layerBlob).catch(() => null) : null;
      if (!alive) return;
      currentBlob = draft.imageBlob;
      originalBlob = draft.originalBlob || null;
      bgOps = draft.bgOps || null;
      layerBlob = layerImg ? draft.layerBlob : null;
      editingId = draft.editingId && cards.some((c) => c.id === draft.editingId) ? draft.editingId : null;
      editor.load(img, draft.design, layerImg);
      syncControls();
    } catch (_) {}
  }

  function resetEditor() {
    cancelBg();
    leaveLayer();
    const prev = editor.getImage();
    const prevLayer = editor.getBgImage();
    editor.clear();
    if (prev) releaseImage(prev);
    if (prevLayer) releaseImage(prevLayer);
    currentBlob = null;
    originalBlob = null;
    bgOps = null;
    layerBlob = null;
    editingId = null;
    db.deleteMeta('draft').catch(() => {});
    syncControls();
  }

  // ---------- tirar fundo ----------
  const bg = {
    active: false,
    remover: null,
    ops: [],
    tolerance: 30,
    originalImg: null, // foto original, já carregada
    shownBefore: null, // imagem que estava no editor ao entrar no modo
    result: null, // último resultado (canvas)
    running: false,
    timer: 0,
  };
  const tolInput = $('[data-tol]');

  function syncBg() {
    const has = editor.hasImage();
    $('[data-tools]').classList.toggle('is-bg-mode', bg.active);
    $('[data-bg-panel]').hidden = !bg.active;
    $('[data-busy]').hidden = !bg.running;
    $('[data-act="bg-undo"]').disabled = !bg.active || !bg.ops.length;
    $('[data-act="bg-reset"]').disabled = !bg.active || !bg.ops.length;
    $('[data-act="bg-auto"]').disabled = !bg.active || bg.ops.some((o) => o.kind === 'edges');
    $('[data-act="bg-done"]').disabled = !bg.active || bg.running;
    tolInput.disabled = !bg.active || !has;
    $('[data-tol-out]').textContent = bg.tolerance;
    $('[data-hint]').hidden = !has || bg.active || layer.active;
  }

  async function enterBg() {
    if (bg.active || !editor.hasImage()) return;
    bg.active = true;
    bg.running = true;
    editor.setTapMode(true);
    editor.setChecker(true);
    syncControls();
    try {
      bg.shownBefore = editor.getImage();
      bg.originalImg = await blobToImage(originalBlob || currentBlob);
      if (!bg.remover) bg.remover = createBgRemover();
      await bg.remover.load(bg.originalImg);
      bg.ops = bgOps ? bgOps.ops.map((o) => ({ ...o })) : [{ kind: 'edges' }];
      bg.tolerance = bgOps ? bgOps.tolerance : 30;
      tolInput.value = bg.tolerance;
      await runBg({ firstAuto: !bgOps });
    } catch (err) {
      console.error(err);
      toast('Não consegui tirar o fundo desta foto.', { kind: 'error' });
      cancelBg();
    }
  }

  async function runBg({ firstAuto = false } = {}) {
    if (!bg.active) return;
    bg.running = true;
    syncBg();
    const res = await bg.remover.run(bg.ops, bg.tolerance);
    if (!res || !bg.active) return; // chegou um pedido mais novo
    bg.running = false;
    bg.result = res.canvas;
    editor.swapImage(res.canvas);
    syncBg();
    if (firstAuto && res.coverage < 0.35) {
      toast(`O fundo desta foto tem muitas cores. ${isTouch ? 'Toque' : 'Clique'} nas partes que quer apagar.`, { duration: 6000 });
    }
  }

  function bgTap(pt) {
    if (!bg.active || bg.ops.length >= 200) return;
    bg.ops.push({ kind: 'point', x: pt.x, y: pt.y });
    runBg();
  }

  // Sai do modo sem aplicar (volta a imagem de antes).
  function cancelBg() {
    if (!bg.active) return;
    bg.active = false;
    bg.running = false;
    editor.setTapMode(false);
    editor.setChecker(false);
    if (bg.shownBefore && editor.hasImage()) editor.swapImage(bg.shownBefore);
    if (bg.originalImg && bg.originalImg !== bg.shownBefore) releaseImage(bg.originalImg);
    bg.originalImg = bg.shownBefore = bg.result = null;
    syncControls();
  }

  // Aplica o resultado e sai do modo.
  async function finishBg() {
    if (!bg.active) return;
    const done = $('[data-act="bg-done"]');
    done.disabled = true;
    try {
      // espera o último cálculo terminar
      while (bg.running) await new Promise((r) => setTimeout(r, 50));
      const before = bg.shownBefore;
      if (!bg.ops.length) {
        // Ficou igual à original: volta para ela.
        if (originalBlob) currentBlob = originalBlob;
        originalBlob = null;
        bgOps = null;
        editor.swapImage(bg.originalImg);
        if (before && before !== bg.originalImg) releaseImage(before);
      } else {
        const blob = await canvasToBlob(bg.result, 'image/png');
        const img = await blobToImage(blob);
        if (!originalBlob) originalBlob = currentBlob;
        currentBlob = blob;
        bgOps = { ops: bg.ops.map((o) => ({ ...o })), tolerance: bg.tolerance };
        editor.swapImage(img);
        releaseImage(before);
        releaseImage(bg.originalImg);
      }
      bg.active = false;
      bg.running = false;
      bg.originalImg = bg.shownBefore = bg.result = null;
      editor.setTapMode(false);
      editor.setChecker(false);
      syncControls();
      saveDraftSoon();
    } catch (err) {
      console.error(err);
      toast('Não consegui guardar a foto sem fundo. Tente de novo.', { kind: 'error' });
      done.disabled = false;
    }
  }

  tolInput.addEventListener('input', () => {
    bg.tolerance = +tolInput.value;
    $('[data-tol-out]').textContent = bg.tolerance;
    clearTimeout(bg.timer);
    bg.timer = setTimeout(() => runBg(), 90);
  });

  // ---------- pôr fundo (foto atrás da foto) ----------
  const layer = { active: false };

  function syncLayer() {
    const hasLayer = editor.hasBgImage();
    $('[data-tools]').classList.toggle('is-layer-mode', layer.active);
    $('[data-layer-panel]').hidden = !layer.active;
    $('[data-layer-chip]').hidden = !layer.active;
    if (!layer.active) return;
    // As barras "Tamanho" e "Inclinar" passam a mexer no fundo.
    [zoomInput, rotInput, ...$$('[data-act="zoom-in"], [data-act="zoom-out"], [data-layer-needs]')].forEach((b) => (b.disabled = !hasLayer));
    $('[data-layer-help]').textContent = hasLayer
      ? `Agora só o fundo se mexe: ${isTouch ? 'arraste, abra os dedos para aumentar e gire para inclinar' : 'arraste, use a rodinha para aumentar (com Shift, para girar)'}. Sua foto fica parada na frente.`
      : `Escolha uma foto${isTouch ? ' ou cole uma imagem que você copiou' : ', cole com Ctrl+V ou arraste uma imagem para cá'}. Ela vai ficar atrás da sua foto.`;
  }

  // A foto tem partes transparentes? (Se não tiver, o fundo novo fica escondido atrás dela.)
  function hasTransparency(im) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 200) return true;
      return false;
    } catch (_) {
      return true;
    }
  }

  function enterLayer() {
    if (layer.active || !editor.hasImage()) return;
    cancelBg();
    layer.active = true;
    editor.setTarget('bg');
    syncControls();
    if (!hasTransparency(editor.getImage())) {
      toast('Dica: tire o fundo da sua foto para o fundo novo aparecer atrás.', {
        action: 'Tirar fundo',
        duration: 7000,
        onAction: () => {
          leaveLayer();
          enterBg();
        },
      });
    }
  }

  function leaveLayer() {
    if (!layer.active) return;
    layer.active = false;
    editor.setTarget('photo');
    syncControls();
    saveDraftSoon();
  }

  async function useLayerBlob(fileOrBlob) {
    try {
      const { blob, img } = await importImageFile(fileOrBlob);
      if (!alive || !editor.hasImage()) return releaseImage(img);
      const prev = editor.getBgImage();
      layerBlob = blob;
      editor.setBgImage(img);
      if (prev && prev !== img) releaseImage(prev);
      syncControls();
    } catch (err) {
      toast(err.message || 'Não consegui abrir essa imagem.', { kind: 'error' });
    }
  }

  function removeLayer() {
    const prev = editor.getBgImage();
    if (!prev) return;
    editor.clearBgImage();
    releaseImage(prev);
    layerBlob = null;
    syncControls();
  }

  // ---------- folha ----------
  async function loadCards() {
    const list = await db.allCards();
    cards.forEach((c) => c.thumbUrl && URL.revokeObjectURL(c.thumbUrl));
    cards = list.map((c) => ({ ...c, thumbUrl: URL.createObjectURL(c.thumbBlob) }));
  }

  function thumbImg(card, cls = '') {
    const land = card.design.orientation === 'landscape';
    return `<img class="${cls} ${land ? 'is-landscape' : ''}" src="${card.thumbUrl}" alt="" draggable="false">`;
  }

  function renderSheet() {
    invalidatePdf();
    const pages = paginate(cards);
    const total = pages.reduce((n, p) => n + p.length, 0);
    $('[data-count]').textContent = total ? `${total} ${total === 1 ? 'card' : 'cards'} · ${pages.length} ${pages.length === 1 ? 'folha' : 'folhas'}` : '';
    const slots = slotPositions();
    const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
    const shown = pages.length ? pages : [[]];
    $('[data-pages]').innerHTML = shown
      .map(
        (page, p) => `
      <figure class="page" data-page="${p}">
        <div class="page__paper">
          ${slots
            .map((s, i) => {
              const card = page[i];
              const style = `left:${pct(s.x, SHEET.pageW)};top:${pct(s.y, SHEET.pageH)};width:${pct(SHEET.slotW, SHEET.pageW)};height:${pct(SHEET.slotH, SHEET.pageH)}`;
              return card
                ? `<button type="button" class="slot is-filled" style="${style}" data-edit="${card.id}" data-slot="${p * PER_PAGE + i}" aria-label="Editar este card">${thumbImg(card)}</button>`
                : `<span class="slot" style="${style}" data-slot="${p * PER_PAGE + i}"></span>`;
            })
            .join('')}
        </div>
        ${shown.length > 1 ? `<figcaption>Folha ${p + 1} de ${shown.length}</figcaption>` : ''}
      </figure>`
      )
      .join('');

    const list = $('[data-list]');
    if (!cards.length) {
      list.innerHTML = `<li class="card-list__empty">Sua folha ainda está vazia. Escolha uma foto, encaixe no card e toque em <strong>Colocar na folha</strong>. Cabem ${PER_PAGE} cards em cada folha A4.</li>`;
    } else {
      list.innerHTML = cards
        .map(
          (c, i) => `
        <li class="card-item${c.id === editingId ? ' is-editing' : ''}">
          <button type="button" class="card-item__thumb" data-edit="${c.id}" aria-label="Editar card ${i + 1}">${thumbImg(c)}</button>
          <div class="card-item__copies">
            <span class="card-item__label" id="cp-${c.id}">Cópias</span>
            <div class="stepper" role="group" aria-labelledby="cp-${c.id}">
              <button type="button" class="round-btn" data-copies="-1" data-id="${c.id}" aria-label="Uma cópia a menos" ${c.copies <= 1 ? 'disabled' : ''}>${icon('minus', { size: 18 })}</button>
              <output>${c.copies}</output>
              <button type="button" class="round-btn" data-copies="1" data-id="${c.id}" aria-label="Uma cópia a mais" ${c.copies >= 99 ? 'disabled' : ''}>${icon('plus', { size: 18 })}</button>
            </div>
          </div>
          <div class="card-item__actions">
            <button type="button" class="round-btn" data-edit="${c.id}" aria-label="Editar card ${i + 1}">${icon('edit', { size: 20 })}</button>
            <button type="button" class="round-btn round-btn--danger" data-del="${c.id}" aria-label="Apagar card ${i + 1}">${icon('trash', { size: 20 })}</button>
          </div>
        </li>`
        )
        .join('');
    }
    $('[data-act="print"]').disabled = !cards.length;
  }

  async function saveCard() {
    if (!editor.hasImage()) return;
    const btn = $('[data-act="save"]');
    btn.disabled = true;
    try {
      if (bg.active) await finishBg();
      leaveLayer();
      const design = editor.getDesign();
      const img = editor.getImage();
      const layerImg = editor.getBgImage();
      const thumbBlob = await canvasToBlob(renderThumb(img, design, layerImg), 'image/png');
      const fromRect = editor.cardScreenRect();
      const wasEditing = editingId;
      let record;
      if (editingId) {
        const old = cards.find((c) => c.id === editingId);
        record = { id: old.id, createdAt: old.createdAt, copies: old.copies, design, imageBlob: currentBlob, thumbBlob };
      } else {
        record = { id: newId(), createdAt: Date.now(), copies: 1, design, imageBlob: currentBlob, thumbBlob };
      }
      if (originalBlob) {
        record.originalBlob = originalBlob;
        record.bgOps = bgOps;
      }
      if (layerImg && layerBlob) record.layerBlob = layerBlob;
      await db.putCard(record);
      await loadCards();
      resetEditor();
      renderSheet();
      flyToSheet(record.id, fromRect);
      toast(wasEditing ? 'Card salvo!' : 'Card colocado na folha!', {
        action: window.innerWidth < 1000 ? 'Ver folha' : undefined,
        onAction: () => $('[data-sheet]').scrollIntoView({ behavior: 'smooth', block: 'start' }),
      });
    } catch (err) {
      console.error(err);
      toast('Não consegui salvar o card. Tente de novo.', { kind: 'error' });
    } finally {
      syncControls();
    }
  }

  // O card "voa" do editor até o lugar dele na folha.
  function flyToSheet(id, from) {
    const target = root.querySelector(`.slot[data-edit="${id}"]`);
    if (!target) return;
    target.classList.add('is-new');
    setTimeout(() => target.classList.remove('is-new'), 900);
    if (reduceMotion()) return;
    const card = cards.find((c) => c.id === id);
    const to = target.getBoundingClientRect();
    const ghost = document.createElement('img');
    ghost.src = card.thumbUrl;
    ghost.className = 'fly-ghost';
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.appendChild(ghost);
    const land = card.design.orientation === 'landscape';
    const sx = (land ? to.height : to.width) / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const endRot = land ? 90 : 0;
    ghost
      .animate(
        [
          { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(${(1 + sx) / 2}) rotate(${endRot / 2 - 8}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}) rotate(${endRot}deg)`, opacity: 0.9 },
        ],
        { duration: 720, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      )
      .finished.then(() => ghost.remove(), () => ghost.remove());
  }

  async function editCard(id) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    try {
      const img = await blobToImage(card.imageBlob);
      const layerImg = card.layerBlob && card.design.bgTransform ? await blobToImage(card.layerBlob).catch(() => null) : null;
      cancelBg();
      leaveLayer();
      const prev = editor.getImage();
      const prevLayer = editor.getBgImage();
      editingId = id;
      currentBlob = card.imageBlob;
      originalBlob = card.originalBlob || null;
      bgOps = card.bgOps || null;
      layerBlob = layerImg ? card.layerBlob : null;
      editor.load(img, card.design, layerImg);
      if (prev) releaseImage(prev);
      if (prevLayer) releaseImage(prevLayer);
      syncControls();
      renderSheet();
      saveDraftSoon();
      if (window.innerWidth < 1000) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {
      toast('Não consegui abrir esse card.', { kind: 'error' });
    }
  }

  async function changeCopies(id, delta) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    card.copies = Math.max(1, Math.min(99, card.copies + delta));
    const { thumbUrl, ...rec } = card;
    await db.putCard(rec);
    renderSheet();
  }

  async function deleteCard(id) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const { thumbUrl, ...rec } = card;
    await db.deleteCard(id);
    if (editingId === id) resetEditor();
    await loadCards();
    renderSheet();
    toast('Card apagado.', {
      action: 'Desfazer',
      duration: 6000,
      onAction: async () => {
        await db.putCard(rec);
        await loadCards();
        renderSheet();
      },
    });
  }

  // ---------- impressão ----------
  function invalidatePdf() {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = null;
    pdfFile = null;
    const ready = $('[data-ready]');
    if (ready) ready.hidden = true;
  }

  async function preparePdf() {
    if (!cards.length) return;
    const btn = $('[data-act="print"]');
    const label = $('[data-print-label]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    label.textContent = 'Montando a folha…';
    try {
      const withImages = await Promise.all(
        cards.map(async (c) => ({
          ...c,
          img: await blobToImage(c.imageBlob),
          bgImg: c.layerBlob && c.design.bgTransform ? await blobToImage(c.layerBlob) : null,
        }))
      );
      const doc = await buildPdf(withImages, {
        cutLine: $('[data-cutline]').checked,
        onProgress: (p) => (label.textContent = `Montando a folha… ${Math.round(p * 100)}%`),
      });
      withImages.forEach((c) => {
        releaseImage(c.img);
        releaseImage(c.bgImg);
      });
      if (!alive) return;
      const blob = doc.output('blob');
      invalidatePdf();
      pdfUrl = URL.createObjectURL(blob);
      pdfFile = new File([blob], 'photo-cards-lavinia.pdf', { type: 'application/pdf' });
      $('[data-open]').href = pdfUrl;
      $('[data-download]').href = pdfUrl;
      const canShare = navigator.canShare && navigator.canShare({ files: [pdfFile] });
      $('[data-act="share"]').hidden = !canShare;
      $('[data-ready]').hidden = false;
      $('[data-ready]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      console.error(err);
      toast(err.message || 'Não consegui montar a folha. Tente de novo.', { kind: 'error' });
    } finally {
      btn.classList.remove('is-busy');
      btn.disabled = !cards.length;
      label.textContent = 'Preparar folha para imprimir';
    }
  }

  async function sharePdf() {
    if (!pdfFile) return;
    try {
      await navigator.share({ files: [pdfFile], title: 'Photo cards da Lavínia' });
    } catch (_) {}
  }

  // ---------- cliques ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t || !root.contains(t)) return;
    const act = t.dataset.act;
    if (act === 'pick') fileInput.click();
    else if (act === 'paste') pasteFromClipboard();
    else if (act === 'rotate90') editor.rotate90();
    else if (act === 'flip') editor.flip();
    else if (act === 'fit') editor.fit();
    else if (act === 'bg') enterBg();
    else if (act === 'layer') enterLayer();
    else if (act === 'layer-done') leaveLayer();
    else if (act === 'layer-remove') removeLayer();
    else if (act === 'bg-done') finishBg();
    else if (act === 'bg-undo') {
      bg.ops.pop();
      runBg();
    } else if (act === 'bg-reset') {
      bg.ops = [];
      runBg();
    } else if (act === 'bg-auto') {
      bg.ops.unshift({ kind: 'edges' });
      runBg();
    }
    else if (act === 'zoom-in') editor.setZoom(editor.getZoom() * 1.15);
    else if (act === 'zoom-out') editor.setZoom(editor.getZoom() / 1.15);
    else if (act === 'save') saveCard();
    else if (act === 'new') {
      resetEditor();
      renderSheet();
    } else if (act === 'print') preparePdf();
    else if (act === 'share') sharePdf();
    else if (t.dataset.orient) editor.setOrientation(t.dataset.orient);
    else if (t.dataset.bg) editor.setBackground(t.dataset.bg);
    else if (t.dataset.edit) editCard(t.dataset.edit);
    else if (t.dataset.del) deleteCard(t.dataset.del);
    else if (t.dataset.copies) changeCopies(t.dataset.id, +t.dataset.copies);
  });
  $('[data-cutline]').addEventListener('change', invalidatePdf);

  // Setas nos círculos de cor (padrão de grupo de opções).
  $('.swatches').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const all = $$('[data-bg]');
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const next = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    next.focus();
    next.click();
    e.preventDefault();
  });

  // ---------- início ----------
  try {
    await loadCards();
  } catch (_) {
    toast('Não consegui abrir os cards guardados neste aparelho.', { kind: 'error' });
  }
  renderSheet();
  syncControls();
  await restoreDraft();
  renderSheet();

  return () => {
    alive = false;
    clearTimeout(draftTimer);
    cancelBg();
    if (bg.remover) bg.remover.destroy();
    if (editor.hasImage()) db.setMeta('draft', draftData()).catch(() => {});
    editor.destroy();
    document.removeEventListener('paste', onPaste);
    window.removeEventListener('dragenter', onDragEnter);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
    invalidatePdf();
    cards.forEach((c) => c.thumbUrl && URL.revokeObjectURL(c.thumbUrl));
  };
}
