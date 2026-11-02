// Modelos prontos: trocam fundo, moldura, colagem, textos e adesivos de um lado do card.
// As fotos que já estavam no card continuam (vão para os espaços do modelo).

import { cardSize, frameWindow, newStickerLayer, newTextLayer } from './card.js';
import { GRADIENTS } from './render.js';

const grad = (id) => {
  const g = GRADIENTS.find((x) => x.id === id);
  return { kind: 'gradient', id, stops: g.stops.slice(), angle: g.angle };
};

// Cada modelo recebe a largura e a altura do card (mm) e devolve o lado.
export const TEMPLATES = [
  {
    id: 'limpo',
    name: 'Só a foto',
    make: () => ({ bg: { kind: 'solid', color: '#ffffff' }, frame: { id: 'none', color: '#ffffff' }, layout: '1', layers: [] }),
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    make: (w, h, o) => {
      const frame = { id: 'polaroid', color: '#ffffff' };
      const win = frameWindow(frame, o);
      const bottom = h - (win.y + win.h);
      return {
        bg: { kind: 'solid', color: '#ffd9e8' },
        frame,
        layout: '1',
        layers: [
          newTextLayer({ text: 'meu dia ♡', font: 'caveat', size: Math.min(8, bottom * 0.55), color: '#6e4560', stroke: { color: null, width: 4 }, y: h / 2 - bottom / 2 }),
        ],
      };
    },
  },
  {
    id: 'coracoes',
    name: 'Corações',
    make: (w, h) => ({
      bg: { kind: 'solid', color: '#ffd9e8' },
      frame: { id: 'hearts', color: '#ff9cc2' },
      layout: '1',
      layers: [
        newStickerLayer({ name: 'heart', color: '#ff5c93', size: 12, x: -w / 2 + 7, y: -h / 2 + 7, rotation: -14 }),
        newStickerLayer({ name: 'heart', color: '#ffffff', size: 8, x: w / 2 - 8, y: h / 2 - 9, rotation: 12 }),
      ],
    }),
  },
  {
    id: 'idol',
    name: 'Idol',
    make: (w, h) => ({
      bg: { kind: 'solid', color: '#ffffff' },
      frame: { id: 'none', color: '#ffffff' },
      layout: '1',
      layers: [
        newTextLayer({ text: 'NOME', font: 'bungee', size: 7.5, color: '#ffffff', stroke: { color: '#c92f6c', width: 5 }, y: h / 2 - 9 }),
        newTextLayer({ text: '2026 ♡', font: 'caveat', size: 5, color: '#ffffff', stroke: { color: '#43203a', width: 3 }, x: w / 2 - 9, y: -h / 2 + 6, rotation: 8 }),
        newStickerLayer({ name: 'sparkle', color: '#ffd84d', size: 9, x: -w / 2 + 7, y: h / 2 - 17 }),
      ],
    }),
  },
  {
    id: 'estrelas',
    name: 'Céu estrelado',
    make: (w, h) => ({
      bg: grad('ceu'),
      frame: { id: 'solid', color: '#ffffff' },
      layout: '1',
      layers: [
        newStickerLayer({ name: 'star', color: '#ffd84d', size: 10, x: -w / 2 + 8, y: -h / 2 + 8, rotation: -12 }),
        newStickerLayer({ name: 'sparkle', color: '#ffffff', size: 7, x: w / 2 - 8, y: -h / 2 + 12 }),
        newStickerLayer({ name: 'moon', color: '#ffd84d', size: 10, x: w / 2 - 9, y: h / 2 - 10 }),
      ],
    }),
  },
  {
    id: 'duas',
    name: 'Duas fotos',
    make: () => ({ bg: { kind: 'solid', color: '#e6dcff' }, frame: { id: 'solid', color: '#ffffff' }, layout: '2h', layers: [] }),
  },
  {
    id: 'tres',
    name: 'Três fotos',
    make: () => ({ bg: { kind: 'solid', color: '#ffffff' }, frame: { id: 'dots', color: '#ff9cc2' }, layout: '3t', layers: [] }),
  },
  {
    id: 'aniversario',
    name: 'Aniversário',
    make: (w, h) => ({
      bg: { kind: 'pattern', pattern: 'dots', color: '#fff0b3' },
      frame: { id: 'stitch', color: '#ffb38a' },
      layout: '1',
      layers: [
        newStickerLayer({ name: 'crown', color: '#ffc93c', size: 13, y: -h / 2 + 10 }),
        newTextLayer({ text: 'Feliz\naniversário!', font: 'pacifico', size: 5.5, color: '#ffffff', stroke: { color: '#c92f6c', width: 5 }, y: h / 2 - 13, rotation: -4 }),
      ],
    }),
  },
  {
    id: 'figurinha',
    name: 'Figurinha',
    make: (w, h) => ({
      bg: { kind: 'pattern', pattern: 'stars', color: '#e6dcff' },
      frame: { id: 'solid', color: '#ffffff' },
      layout: '1',
      layers: [newTextLayer({ text: 'Use "Tirar fundo"\ne "Contorno" ♡', font: 'caveat', size: 4.2, color: '#5b3f9e', stroke: { color: '#ffffff', width: 4 }, y: h / 2 - 10 })],
    }),
  },
  {
    id: 'verso',
    name: 'Verso fofo',
    make: (w, h) => ({
      bg: { kind: 'pattern', pattern: 'hearts', color: '#ffd9e8' },
      frame: { id: 'stitch', color: '#ff9cc2' },
      layout: '0',
      layers: [
        newTextLayer({ text: 'Lavínia', font: 'pacifico', size: 9, color: '#c92f6c', stroke: { color: '#ffffff', width: 5 }, y: -2 }),
        newTextLayer({ text: 'photo card ♡', font: 'caveat', size: 5, color: '#6e4560', stroke: { color: '#ffffff', width: 4 }, y: 8 }),
      ],
    }),
  },
];

export function makeTemplate(id, orientation) {
  const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
  const { w, h } = cardSize(orientation);
  return t.make(w, h, orientation);
}
