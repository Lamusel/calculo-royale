// Distribución del mapa: una sola fuente de verdad para colisiones (servidor y predicción)
// y para dibujar (cliente). Coordenadas matemáticas (x, y); rectángulos alineados a los ejes.
//
// Obstáculo rectangular: { kind, shape: 'rect', x, y, w, h, height }  (centro, ancho en x, alto en y)
// Obstáculo circular:    { kind, shape: 'circle', x, y, r, height }

import { MAP_HALF } from './constants.js';

const WALL = 0.5; // grosor de las paredes
export const WALL_HEIGHT = 3.2;
const DOOR = 2.2; // ancho de las puertas

// Casa de 4 paredes con una puerta en el lado indicado ('n', 's', 'e', 'w')
function house(cx, cy, w, h, door) {
  const walls = [];
  const wall = (x, y, ww, hh) => walls.push({ kind: 'wall', shape: 'rect', x, y, w: ww, h: hh, height: WALL_HEIGHT });

  // Las horizontales cubren las esquinas; las verticales llegan justo hasta ellas
  const horizontal = (y, withDoor) => {
    if (!withDoor) return wall(cx, y, w + WALL, WALL);
    const len = (w - DOOR) / 2 + WALL / 2;
    const offset = DOOR / 2 + len / 2;
    wall(cx - offset, y, len, WALL);
    wall(cx + offset, y, len, WALL);
  };
  const vertical = (x, withDoor) => {
    if (!withDoor) return wall(x, cy, WALL, h - WALL);
    const len = (h - DOOR) / 2 - WALL / 2;
    const offset = DOOR / 2 + len / 2;
    wall(x, cy - offset, WALL, len);
    wall(x, cy + offset, WALL, len);
  };

  horizontal(cy + h / 2, door === 'n');
  horizontal(cy - h / 2, door === 's');
  vertical(cx + w / 2, door === 'e');
  vertical(cx - w / 2, door === 'w');
  return walls;
}

const CONTAINER = { long: 6, short: 2.4, height: 2.6 };

function container(x, y, vertical = false, stacked = false) {
  return {
    kind: 'container',
    shape: 'rect',
    x,
    y,
    w: vertical ? CONTAINER.short : CONTAINER.long,
    h: vertical ? CONTAINER.long : CONTAINER.short,
    height: stacked ? CONTAINER.height * 2 : CONTAINER.height,
  };
}

const crate = (x, y, size = 1.4) => ({ kind: 'crate', shape: 'rect', x, y, w: size, h: size, height: size });
const barrel = (x, y) => ({ kind: 'barrel', shape: 'circle', x, y, r: 0.5, height: 1.2 });
const rock = (x, y, r) => ({ kind: 'rock', shape: 'circle', x, y, r, height: r * 1.2 });
const fence = (x, y, w, h) => ({ kind: 'fence', shape: 'rect', x, y, w, h, height: 1.1 });

// Zonas con nombre (el cliente las usa para teñir el terreno; el resto de la cobertura las evita)
export const AREAS = {
  town: { x: -34, y: 30, w: 38, h: 42 },
  containers: { x: 33, y: -33, w: 40, h: 34 },
  training: { x: 0, y: 0, r: 16 },
};

// --- Pueblo abandonado (noroeste) ---
// Planta de cada casa: el servidor solo usa sus paredes; el cliente dibuja además piso y techo
export const HOUSES = [
  { x: -44, y: 42, w: 10, h: 8, door: 's' },
  { x: -30, y: 44, w: 8, h: 7, door: 's' },
  { x: -46, y: 26, w: 8, h: 10, door: 'e' },
  { x: -32, y: 28, w: 10, h: 8, door: 'w' },
  { x: -20, y: 38, w: 7, h: 9, door: 'w' },
  { x: -38, y: 14, w: 9, h: 7, door: 'n' },
];

const town = [
  ...HOUSES.flatMap((h, i) => house(h.x, h.y, h.w, h.h, h.door).map((wall) => ({ ...wall, house: i }))),
  fence(-24, 19, 8, 0.3),
  fence(-49, 34, 0.3, 5),
  barrel(-37, 35),
  barrel(-36, 36),
  barrel(-26, 33),
  crate(-41, 33),
  crate(-27, 20),
];

// --- Patio de contenedores (sureste) ---
const containers = [
  container(22, -20),
  container(30, -20, false, true),
  container(42, -20),
  container(18, -28, true),
  container(28, -28),
  container(36, -28),
  container(48, -28, true, true),
  container(24, -36),
  container(30, -35, true),
  container(40, -36, false, true),
  container(24, -46),
  container(40, -46),
  container(50, -42, true),
  crate(35, -24),
  crate(36.5, -24),
  crate(33, -41),
  barrel(45, -32),
  barrel(46, -33),
];

// --- Cobertura dispersa (rocas y cajas), generada con semilla fija ---
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function insideArea(x, y, margin) {
  const { town: t, containers: c, training: tr } = AREAS;
  const inRect = (a) => Math.abs(x - a.x) < a.w / 2 + margin && Math.abs(y - a.y) < a.h / 2 + margin;
  return inRect(t) || inRect(c) || Math.hypot(x - tr.x, y - tr.y) < tr.r + margin;
}

function scatteredCover() {
  const rand = seededRandom(20261022);
  const items = [];
  const limit = MAP_HALF - 4;
  let attempts = 0;
  while (items.length < 46 && attempts++ < 2000) {
    const x = (rand() * 2 - 1) * limit;
    const y = (rand() * 2 - 1) * limit;
    if (insideArea(x, y, 3)) continue;
    if (items.some((o) => Math.hypot(o.x - x, o.y - y) < 7)) continue;
    items.push(rand() < 0.6 ? rock(x, y, 0.8 + rand() * 0.9) : crate(x, y, rand() < 0.5 ? 1.4 : 2));
  }
  return items;
}

export const OBSTACLES = [...town, ...containers, ...scatteredCover()];

// Caminos de tierra (solo visuales): polilíneas de puntos (x, y)
export const PATHS = [
  [[0, 0], [-10, 8], [-22, 16], [-34, 20], [-50, 20]],
  [[-34, 20], [-34, 36], [-26, 50]],
  [[0, 0], [12, -10], [22, -24], [34, -32], [52, -36]],
  [[0, 0], [6, 20], [10, 40], [16, 58]],
  [[0, 0], [-8, -20], [-20, -40], [-30, -58]],
];

// Campo de entrenamiento (solo existe en el lobby): armeros y blancos de práctica
export const TRAINING = {
  racks: [
    { item: 'shotgun', x: -8, y: 10 },
    { item: 'rifle', x: -4, y: 10 },
    { item: 'sniper', x: 0, y: 10 },
    { item: 'grenade', x: 4, y: 10 },
    { item: 'armor', x: 8, y: 10 },
  ],
  dummies: [
    { x: -8, y: -11 },
    { x: -4, y: -11 },
    { x: 0, y: -11 },
    { x: 4, y: -11 },
    { x: 8, y: -11 },
  ],
};

// Armero más cercano dentro del radio (o null). Servidor y cliente usan la misma regla.
export function nearestRack(x, y, radius) {
  let best = null;
  let bestDist = radius;
  for (const rack of TRAINING.racks) {
    const d = Math.hypot(rack.x - x, rack.y - y);
    if (d <= bestDist) {
      best = rack;
      bestDist = d;
    }
  }
  return best;
}
