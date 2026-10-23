import * as THREE from 'three';
import { box, cylinder, limb, merge, piece } from './build.js';
import { styleOf } from './skins.js';

// Soldado procedural low-poly. Mira hacia +x local, y hacia arriba, el suelo en y = 0.
// Partes separadas para animarlas: piernas (giran en la cadera), torso (gira hacia la mira)
// y brazos (giran en los hombros, con el arma en la mano derecha).
// La skin (models/skins.js) cambia colores y agrega piezas; por defecto es el uniforme
// verde oliva, y el color del jugador va en la banda del casco, el brazalete y la mochila.

export const HIP = 0.95;
export const SHOULDER = 1.47;
// Mano derecha relativa al pivote de los hombros: ahí se coloca el arma
export const HAND = [0.5, -0.18, 0.12];
// Articulaciones de los brazos relativas al pivote de los hombros (también las usa el Master Rig)
export const ARM_JOINTS = {
  shoulderR: [0, 0, 0.38],
  elbowR: [0.22, -0.22, 0.33],
  handR: HAND,
  shoulderL: [0, 0, -0.38],
  elbowL: [0.3, -0.2, -0.28],
  handL: [0.8, -0.14, -0.02],
};

const OLIVE = '#56602f';
const OLIVE_DARK = '#434b25';
const SKIN = '#c49a72';
const BOOT = '#2a2620';
const BELT = '#3a3829';
const GOGGLES = '#1f2326';
const VEST = ['#56602f', '#666b3a', '#71703f', '#7c6c45'];
const POUCH = '#545a31';

const cache = new Map();
const cached = (key, build) => {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
};

// Pierna con el pivote en la cadera (origen); cuelga hacia abajo
export const legGeometry = (skin = 'soldado') =>
  cached(`leg|${skin}`, () => {
    const s = styleOf(skin);
    return merge([
      piece(box(0.26, 0.86, 0.27), s.pants ?? s.uniform ?? OLIVE, { position: [0, -0.43, 0] }),
      piece(box(0.36, 0.16, 0.29), s.boots ?? BOOT, { position: [0.05, -0.87, 0] }),
      piece(box(0.28, 0.12, 0.29), s.pantsDark ?? s.pants ?? OLIVE_DARK, { position: [0.02, -0.35, 0] }),
    ]);
  });

function vestPieces(level, colors) {
  if (level === 0) return [];
  const color = colors[level];
  const pieces = [
    piece(box(0.08, 0.42, 0.54), color, { position: [0.25, 1.36, 0] }),
    piece(box(0.06, 0.4, 0.52), color, { position: [-0.24, 1.36, 0] }),
  ];
  if (level >= 2) {
    for (const z of [-0.17, 0, 0.17]) pieces.push(piece(box(0.1, 0.14, 0.13), POUCH, { position: [0.31, 1.2, z] }));
    for (const z of [-0.35, 0.35]) pieces.push(piece(box(0.38, 0.36, 0.05), color, { position: [0, 1.34, z] }));
  }
  if (level >= 3) {
    pieces.push(piece(box(0.46, 0.1, 0.7), color, { position: [0, 1.62, 0] }));
    for (const z of [-0.37, 0.37]) pieces.push(piece(box(0.32, 0.09, 0.2), color, { position: [0, 1.6, z] }));
  }
  return pieces;
}

// Torso, cabeza, casco o accesorios de la skin, mochila y chaleco (gira hacia la mira).
// El chaleco se ve en todas las skins: es información de juego.
export const torsoGeometry = (color, vestLevel, skin = 'soldado') =>
  cached(`torso|${skin}|${color}|${vestLevel}`, () => {
    const s = styleOf(skin);
    const pieces = [
      piece(box(0.4, 0.14, 0.62), s.belt ?? BELT, { position: [0, 1.0, 0] }),
      piece(box(0.42, 0.56, 0.66), s.uniform ?? OLIVE, { position: [0, 1.34, 0] }),
      piece(box(0.16, 0.08, 0.16), s.face ?? SKIN, { position: [0, 1.66, 0] }),
      piece(box(0.3, 0.3, 0.28), s.face ?? SKIN, { position: [0, 1.82, 0] }),
    ];
    if (s.goggles !== false) pieces.push(piece(box(0.04, 0.06, 0.22), GOGGLES, { position: [0.16, 1.85, 0] }));
    if (s.helmet !== false) {
      const helmet = new THREE.SphereGeometry(0.25, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      pieces.push(
        piece(helmet, OLIVE_DARK, { position: [0, 1.88, 0], scale: [1.1, 0.9, 1.06] }),
        piece(cylinder(0.275, 0.275, 0.04, 8), OLIVE_DARK, { position: [0, 1.88, 0] }),
        piece(cylinder(0.264, 0.272, 0.07, 8, true), color, { position: [0, 1.93, 0] }),
      );
    }
    if (s.backpack !== false) {
      pieces.push(
        piece(box(0.24, 0.46, 0.5), OLIVE_DARK, { position: [-0.34, 1.32, 0] }),
        piece(box(0.03, 0.16, 0.3), color, { position: [-0.47, 1.4, 0] }),
      );
    }
    pieces.push(...vestPieces(vestLevel, s.vest ?? VEST), ...(s.extra?.(color) ?? []));
    return merge(pieces);
  });

// Un brazo sosteniendo el arma, relativo al pivote de los hombros. El derecho lleva el
// brazalete del color del jugador (en todas las skins) y las piezas extra de la skin.
export const armGeometry = (side, color, skin = 'soldado') =>
  cached(`arm${side}|${skin}|${color}`, () => {
    const s = styleOf(skin);
    const sleeve = s.sleeve ?? s.uniform ?? OLIVE;
    const hand = s.gloves ?? s.face ?? SKIN;
    const mid = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    if (side === 'L') {
      const { shoulderL, elbowL, handL } = ARM_JOINTS;
      return merge([limb(shoulderL, elbowL, 0.16, sleeve), limb(elbowL, handL, 0.14, sleeve), piece(box(0.12, 0.12, 0.12), hand, { position: handL })]);
    }
    const { shoulderR, elbowR, handR } = ARM_JOINTS;
    return merge([
      limb(shoulderR, elbowR, 0.16, sleeve),
      limb(elbowR, handR, 0.14, sleeve),
      limb(mid(shoulderR, elbowR, 0.3), mid(shoulderR, elbowR, 0.7), 0.18, color),
      piece(box(0.12, 0.12, 0.12), hand, { position: handR }),
      ...(s.armExtra?.(color) ?? []),
    ]);
  });
