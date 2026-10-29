import { box, cylinder, merge, piece } from './build.js';
import { weaponMounts } from './weapons.js';

// Accesorios y equipo visibles (fase 25), construidos por código. Los del arma usan el mismo
// origen que weapons.js (empuñadura, cañón hacia +x, y arriba); casco y mochila van en los
// sockets HeadTopSocket y BackSocket del Master Rig.

const DARK = '#1c1d1f';
const STEEL = '#2a2c2f';
const LENS = '#7dd3fc';
const RED = '#ef4444';

// Dónde termina el cañón, dónde va la mira y hasta dónde llega la culata de cada arma (de su especificación)
const mountsOf = (id) => weaponMounts(id);

const BUILDERS = {
  reddot: (m) => [
    piece(box(0.08, 0.06, 0.05), DARK, { position: [m.rail[0], m.rail[1] + 0.03, 0] }),
    piece(box(0.012, 0.03, 0.03), RED, { position: [m.rail[0] - 0.04, m.rail[1] + 0.035, 0] }),
  ],
  scope2x: (m) => [
    piece(cylinder(0.035, 0.035, 0.2, 8), DARK, { position: [m.rail[0], m.rail[1] + 0.06, 0], rotation: [0, 0, Math.PI / 2] }),
    piece(cylinder(0.03, 0.03, 0.01, 8), LENS, { position: [m.rail[0] + 0.105, m.rail[1] + 0.06, 0], rotation: [0, 0, Math.PI / 2] }),
  ],
  scope4x: (m) => [
    piece(cylinder(0.05, 0.05, 0.32, 8), DARK, { position: [m.rail[0], m.rail[1] + 0.08, 0], rotation: [0, 0, Math.PI / 2] }),
    piece(cylinder(0.055, 0.055, 0.06, 8), DARK, { position: [m.rail[0] + 0.15, m.rail[1] + 0.08, 0], rotation: [0, 0, Math.PI / 2] }),
    piece(cylinder(0.045, 0.045, 0.01, 8), LENS, { position: [m.rail[0] + 0.185, m.rail[1] + 0.08, 0], rotation: [0, 0, Math.PI / 2] }),
  ],
  // Cargador ampliado: más largo y curvo hacia abajo
  extmag: (m) => [piece(box(0.07, 0.26, 0.05), STEEL, { position: [m.mag[0] + 0.02, m.mag[1] - 0.1, 0], rotation: [0, 0, -0.25] })],
  // Culata reforzada (o estabilizador en la pistola: placa bajo el cañón)
  stock: (m) =>
    m.stockEnd === null
      ? [piece(box(0.16, 0.04, 0.05), DARK, { position: [0.14, 0.0, 0] })]
      : [
          piece(box(0.12, 0.13, 0.08), '#3a3a2c', { position: [m.stockEnd + 0.02, 0.02, 0] }),
          piece(box(0.04, 0.16, 0.09), DARK, { position: [m.stockEnd - 0.03, 0.02, 0] }),
        ],
  // Silenciador: tubo grueso al final del cañón
  silencer: (m) => [piece(cylinder(0.04, 0.04, 0.24, 8), DARK, { position: [m.muzzle + 0.12, m.rail[1] - 0.05, 0], rotation: [0, 0, Math.PI / 2] })],
};

const cache = new Map();

// Geometría de un accesorio para un arma (null si no hay)
export function attachmentGeometry(kind, weaponId) {
  const m = mountsOf(weaponId);
  if (!m || !BUILDERS[kind]) return null;
  const key = `${kind}|${weaponId}`;
  if (!cache.has(key)) cache.set(key, merge(BUILDERS[kind](m)));
  return cache.get(key);
}

// Casco por nivel (sobre la cabeza): 1 gorra de combate, 2 casco con visera, 3 casco pesado con barbuquejo
const HELMETS = {
  1: () => [piece(box(0.36, 0.1, 0.36), '#556b2f', { position: [0, 0.02, 0] }), piece(box(0.14, 0.03, 0.3), '#556b2f', { position: [0.2, -0.02, 0] })],
  2: () => [
    piece(box(0.4, 0.16, 0.4), '#4a5a3a', { position: [0, 0.04, 0] }),
    piece(box(0.06, 0.08, 0.32), '#1e293b', { position: [0.21, -0.04, 0] }),
  ],
  3: () => [
    piece(box(0.44, 0.2, 0.44), '#3f4a30', { position: [0, 0.05, 0] }),
    piece(box(0.46, 0.06, 0.46), '#2f3824', { position: [0, -0.05, 0] }),
    piece(box(0.05, 0.22, 0.04), DARK, { position: [0.05, -0.18, 0.2] }),
    piece(box(0.05, 0.22, 0.04), DARK, { position: [0.05, -0.18, -0.2] }),
  ],
};

// Mochila por nivel (en la espalda): más grande cuanto mayor el nivel
const BACKPACKS = {
  1: () => [piece(box(0.16, 0.3, 0.32), '#6b5a3a', { position: [-0.08, 0, 0] })],
  2: () => [
    piece(box(0.2, 0.4, 0.38), '#5f6b3a', { position: [-0.1, 0, 0] }),
    piece(box(0.08, 0.14, 0.3), '#4f5a2a', { position: [-0.22, -0.08, 0] }),
  ],
  3: () => [
    piece(box(0.26, 0.52, 0.44), '#4a4f2e', { position: [-0.13, 0.04, 0] }),
    piece(box(0.1, 0.18, 0.36), '#3c4126', { position: [-0.28, -0.1, 0] }),
    piece(box(0.22, 0.1, 0.46), '#6b5a3a', { position: [-0.13, 0.33, 0] }),
  ],
};

// Accesorios de temporada (7A): sobre la cabeza (HeadTopSocket), solo en las skins procedurales
const HAT_PIECES = {
  bruja: () => [
    piece(cylinder(0.32, 0.32, 0.03, 14), '#1c1424', { position: [0, 0.02, 0] }),
    piece(cylinder(0.02, 0.17, 0.42, 10), '#1c1424', { position: [-0.04, 0.24, 0], rotation: [0, 0, 0.25] }),
    piece(cylinder(0.175, 0.175, 0.05, 10), '#7c3aed', { position: [0, 0.06, 0] }),
  ],
  calabaza: () => [
    piece(box(0.34, 0.3, 0.36), '#e8731a', { position: [0.02, -0.12, 0] }),
    piece(box(0.02, 0.06, 0.06), '#ffd36b', { position: [0.2, -0.08, 0.08] }),
    piece(box(0.02, 0.06, 0.06), '#ffd36b', { position: [0.2, -0.08, -0.08] }),
    piece(box(0.02, 0.04, 0.2), '#ffd36b', { position: [0.2, -0.2, 0] }),
    piece(cylinder(0.03, 0.04, 0.1, 6), '#4b5a2a', { position: [0, 0.07, 0] }),
  ],
  navidad: () => [
    piece(cylinder(0.2, 0.2, 0.07, 12), '#f8fafc', { position: [0, 0.02, 0] }),
    piece(cylinder(0.03, 0.18, 0.32, 10), '#c81e1e', { position: [-0.06, 0.2, 0], rotation: [0, 0, 0.5] }),
    piece(cylinder(0.05, 0.05, 0.06, 8), '#f8fafc', { position: [-0.17, 0.33, 0] }),
  ],
};
export function hatGeometry(id) {
  if (!HAT_PIECES[id]) return null;
  const key = `hat|${id}`;
  if (!cache.has(key)) cache.set(key, merge(HAT_PIECES[id]()));
  return cache.get(key);
}

export function helmetGeometry(level) {
  if (!HELMETS[level]) return null;
  const key = `helmet|${level}`;
  if (!cache.has(key)) cache.set(key, merge(HELMETS[level]()));
  return cache.get(key);
}

export function backpackGeometry(level) {
  if (!BACKPACKS[level]) return null;
  const key = `backpack|${level}`;
  if (!cache.has(key)) cache.set(key, merge(BACKPACKS[level]()));
  return cache.get(key);
}
