import { box, cylinder, merge, piece } from './build.js';

// Armas procedurales. Origen en la empuñadura (mano derecha), cañón hacia +x, y hacia arriba.

const STEEL = '#2a2c2f';
const DARK = '#1c1d1f';
const POLYMER = '#3c3f2b';
const WOOD = '#6b4a2b';
const OLIVE = '#4f5a2a';

const barrel = (length, radius, x, y) =>
  piece(cylinder(radius, radius, length, 6), STEEL, { position: [x, y, 0], rotation: [0, 0, Math.PI / 2] });

const BUILDERS = {
  pistol: () => [
    piece(box(0.34, 0.08, 0.06), STEEL, { position: [0.12, 0.07, 0] }),
    piece(box(0.08, 0.17, 0.06), DARK, { position: [0, -0.02, 0], rotation: [0, 0, 0.2] }),
  ],
  rifle: () => [
    piece(box(0.5, 0.11, 0.07), STEEL, { position: [0.18, 0.06, 0] }),
    piece(box(0.26, 0.09, 0.08), POLYMER, { position: [0.48, 0.06, 0] }),
    barrel(0.34, 0.025, 0.72, 0.07),
    piece(box(0.3, 0.1, 0.06), POLYMER, { position: [-0.2, 0.04, 0] }),
    piece(box(0.07, 0.19, 0.05), DARK, { position: [0.22, -0.09, 0], rotation: [0, 0, -0.2] }),
    piece(box(0.06, 0.13, 0.05), DARK, { position: [0, -0.04, 0] }),
    piece(box(0.1, 0.04, 0.03), DARK, { position: [0.2, 0.14, 0] }),
  ],
  shotgun: () => [
    piece(box(0.32, 0.1, 0.07), STEEL, { position: [0.12, 0.06, 0] }),
    barrel(0.62, 0.032, 0.58, 0.09),
    piece(box(0.22, 0.07, 0.08), WOOD, { position: [0.5, 0.02, 0] }),
    piece(box(0.34, 0.1, 0.06), WOOD, { position: [-0.24, 0.03, 0] }),
    piece(box(0.06, 0.12, 0.05), WOOD, { position: [0, -0.04, 0] }),
  ],
  sniper: () => [
    piece(box(0.46, 0.1, 0.07), STEEL, { position: [0.16, 0.06, 0] }),
    barrel(0.78, 0.022, 0.78, 0.08),
    piece(cylinder(0.045, 0.045, 0.34, 8), DARK, { position: [0.16, 0.18, 0], rotation: [0, 0, Math.PI / 2] }),
    piece(box(0.04, 0.06, 0.04), DARK, { position: [0.08, 0.12, 0] }),
    piece(box(0.04, 0.06, 0.04), DARK, { position: [0.24, 0.12, 0] }),
    piece(box(0.38, 0.11, 0.06), OLIVE, { position: [-0.26, 0.03, 0] }),
    piece(box(0.06, 0.12, 0.05), DARK, { position: [0, -0.04, 0] }),
  ],
  grenade: () => [
    piece(cylinder(0.08, 0.08, 0.16, 8), OLIVE),
    piece(cylinder(0.05, 0.08, 0.05, 8), OLIVE, { position: [0, 0.1, 0] }),
    piece(box(0.03, 0.12, 0.03), STEEL, { position: [0.06, 0.06, 0] }),
  ],
};

const cache = new Map();

// Geometría fusionada de un arma por id ('pistol', 'rifle', ...)
export function weaponGeometry(id) {
  if (!cache.has(id)) cache.set(id, merge((BUILDERS[id] ?? BUILDERS.pistol)()));
  return cache.get(id);
}
