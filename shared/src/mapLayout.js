// Distribución del mapa: una sola fuente de verdad para colisiones (servidor y predicción)
// y para dibujar (cliente). Coordenadas matemáticas (x, y), x hacia el este, y hacia el norte.
// Las piezas (casas, muebles, torres, sacos de arena…) se generan en mapBuild.js.

import { MAP_HALF } from './constants.js';
import {
  barrel, container, crate, fence, furnishRoom, houseShell, localFrame, partitions, rock, sandbags, seededRandom, tree, towerLegs,
} from './mapBuild.js';

export { WALL_HEIGHT, FURNITURE_SIZES } from './mapBuild.js';

// Zonas con nombre (el cliente tiñe el terreno y las rotula en el mapa táctico; la cobertura
// dispersa las evita)
export const AREAS = {
  town: { x: -54, y: 46, w: 44, h: 50, name: 'Pueblo' },
  base: { x: 57, y: 56, w: 54, h: 52, name: 'Base militar' },
  forest: { x: -56, y: -57, w: 64, h: 62, name: 'Bosque' },
  trenches: { x: 0, y: -73, w: 50, h: 30, name: 'Trincheras' },
  containers: { x: 55, y: -50, w: 48, h: 46, name: 'Contenedores' },
  training: { x: 0, y: 0, r: 16 },
};

// --- Edificios: el servidor usa sus paredes, tabiques y muebles; el cliente dibuja además techo ---
// type: casa | bodega | cabana | hangar | barraca | bunker. roomTypes: amueblado de cada cuarto.
// crate: rareza de la caja de cada cuarto con punto libre (null = sin caja); hot: siempre está.
export const HOUSES = [
  // Pueblo (noroeste)
  { x: -62, y: 62, w: 11, h: 9, door: 's', type: 'casa', rooms: 2, roomTypes: ['cuarto', 'sala'], crates: [2, 1] },
  { x: -46, y: 64, w: 9, h: 8, door: 's', type: 'casa', rooms: 1, roomTypes: ['cocina'] },
  { x: -66, y: 44, w: 9, h: 11, door: 'e', type: 'casa', rooms: 2, roomTypes: ['cuarto', 'cocina'], crates: [1] },
  { x: -50, y: 44, w: 12, h: 10, door: 'w', type: 'casa', rooms: 3, roomTypes: ['cuarto', 'sala', 'cocina'], crates: [2, 2], hot: true },
  { x: -36, y: 54, w: 8, h: 10, door: 'w', type: 'casa', rooms: 1, roomTypes: ['sala'], crates: [1] },
  { x: -54, y: 28, w: 10, h: 8, door: 'n', type: 'casa', rooms: 2, roomTypes: ['cocina', 'cuarto'], crates: [null, 1] },
  { x: -38, y: 34, w: 9, h: 8, door: 'w', type: 'casa', rooms: 1, roomTypes: ['cuarto'], crates: [1] },
  { x: -68, y: 28, w: 8, h: 8, door: 'e', type: 'bodega', rooms: 1, roomTypes: ['bodega'], crates: [1] },
  // Base militar (noreste)
  { x: 60, y: 68, w: 20, h: 13, door: 's', doorWidth: 7, type: 'hangar', rooms: 1, roomTypes: ['hangar'], crates: [3], hot: true },
  { x: 41, y: 62, w: 7, h: 13, door: 'e', type: 'barraca', rooms: 1, roomTypes: ['literas'], crates: [2] },
  { x: 70, y: 45, w: 14, h: 7, door: 'n', type: 'barraca', rooms: 1, roomTypes: ['literas'], crates: [1] },
  // Bosque (suroeste)
  { x: -62, y: -40, w: 8, h: 7, door: 'e', type: 'cabana', rooms: 1, roomTypes: ['cuarto'], crates: [1] },
  // Trincheras (sur)
  { x: 12, y: -81, w: 7, h: 6, door: 'n', type: 'bunker', rooms: 1, roomTypes: ['bunker'], crates: [2], hot: true },
];

const houseObstacles = [];
export const FURNITURE = [];
const houseSpots = [];
HOUSES.forEach((h, i) => {
  houseObstacles.push(...houseShell(h.x, h.y, h.w, h.h, h.door, h.doorWidth).map((w) => ({ ...w, house: i })));
  const frame = localFrame(h);
  const { walls, rooms } = partitions(h, frame);
  houseObstacles.push(...walls.map((w) => ({ ...w, house: i })));
  rooms.forEach((room, r) => {
    const { furniture, obstacles, spot } = furnishRoom(h.roomTypes[r] ?? 'sala', room, frame, i);
    FURNITURE.push(...furniture);
    houseObstacles.push(...obstacles.map((o) => ({ ...o, house: i })));
    const rarity = h.crates?.[r];
    if (spot && rarity !== null && rarity !== undefined) houseSpots.push({ ...spot, rarity, tag: h.hot && r === Math.floor(rooms.length / 2) ? 'hot' : 'inside' });
  });
});
const furnitureObstacles = FURNITURE.filter((f) => f.solid).map((f) => ({
  kind: 'furniture', item: f.kind, shape: 'rect', x: f.x, y: f.y, w: f.w, h: f.h, height: f.height, house: f.house,
}));

// --- Pueblo: utilería entre las casas ---
const town = [fence(-28, 40, 0.3, 8), fence(-74, 54, 0.3, 10), barrel(-58, 54), barrel(-57, 55), barrel(-44, 30), crate(-72, 36), crate(-40, 44), rock(-30, 62, 1.2)];

// --- Base militar: cerca con dos portones, torres, sacos de arena y cajas militares ---
export const TOWERS = [
  { x: 37, y: 37 },
  { x: 77, y: 37 },
  { x: 37, y: 75 },
  { x: 77, y: 75 },
];
const base = [
  // Cerca perimetral (x 32..82, y 32..80): portón sur (x 49..55) y oeste (y 53..59)
  fence(40.5, 32, 17, 0.3),
  fence(68.5, 32, 27, 0.3),
  fence(57, 80, 50, 0.3),
  fence(82, 56, 0.3, 48),
  fence(32, 42.5, 0.3, 21),
  fence(32, 69.5, 0.3, 21),
  ...TOWERS.flatMap(towerLegs),
  sandbags(45.5, 35.5, 4, 0.9),
  sandbags(58.5, 35.5, 4, 0.9),
  sandbags(35.5, 52, 0.9, 3.5),
  sandbags(54, 57.5, 3, 0.9),
  sandbags(66, 57.5, 3, 0.9),
  crate(50, 48),
  crate(51.5, 48),
  crate(50.7, 49.5),
  barrel(76, 56),
  barrel(76, 57.2),
];

// --- Trincheras: dos zanjas de sacos de arena en zigzag unidas por una de comunicación ---
const trenches = [
  // Zanja norte (entre y = −64 y −67) con salidas
  sandbags(-14.5, -63.5, 11, 0.9),
  sandbags(4, -63.5, 18, 0.9),
  sandbags(18.5, -63.5, 5, 0.9),
  sandbags(-11, -67.5, 18, 0.9),
  sandbags(11, -67.5, 18, 0.9),
  sandbags(-20.5, -65.5, 0.9, 3.3),
  // Zanja sur (entre y = −73 y −77): el búnker se abre hacia ella
  sandbags(-6, -72.5, 26, 0.9),
  sandbags(15, -72.5, 8, 0.9),
  sandbags(-14, -77.5, 12, 0.9),
  sandbags(3, -77.5, 6, 0.9),
  sandbags(18.5, -77.5, 4, 0.9),
  sandbags(20.5, -75, 0.9, 4.1),
  // Zanja de comunicación (x ≈ −12, entre las dos)
  sandbags(-13.6, -70, 0.9, 4.1),
  sandbags(-9.4, -70, 0.9, 4.1),
  barrel(17, -75),
  crate(-18, -75, 1.2),
];

// --- Patio de contenedores (sureste) ---
const containers = [
  container(40, -36),
  container(48, -36, false, true),
  container(60, -36),
  container(36, -44, true),
  container(46, -44),
  container(56, -44),
  container(66, -44, true, true),
  container(42, -53),
  container(48.5, -52, true),
  container(58, -53, false, true),
  container(42, -62),
  container(58, -62),
  container(68, -58, true),
  container(74, -48, true),
  container(62, -70),
  container(46, -70, false, true),
  crate(53, -40),
  crate(54.5, -40),
  crate(52, -57),
  barrel(63, -49),
  barrel(64, -50.2),
];

// --- Bosque: árboles con semilla, con claros y la cabaña libres ---
const CLEARINGS = [
  { x: -48, y: -50, r: 7 },
  { x: -70, y: -72, r: 6 },
];
function forest() {
  const rand = seededRandom(20261023);
  const a = AREAS.forest;
  const items = [];
  for (let attempts = 0; items.length < 150 && attempts < 6000; attempts++) {
    const x = a.x + (rand() - 0.5) * (a.w - 4);
    const y = a.y + (rand() - 0.5) * (a.h - 4);
    if (Math.abs(x) > MAP_HALF - 3 || Math.abs(y) > MAP_HALF - 3) continue;
    if (CLEARINGS.some((c) => Math.hypot(x - c.x, y - c.y) < c.r)) continue;
    if (Math.abs(x - -62) < 7 && Math.abs(y - -40) < 6.5) continue; // cabaña
    if (items.some((o) => Math.hypot(o.x - x, o.y - y) < 3.3)) continue;
    items.push(rand() < 0.12 ? rock(x, y, 0.7 + rand() * 0.8) : tree(x, y, rand() < 0.55 ? 0 : 1));
  }
  return items;
}

// --- Cobertura dispersa (rocas, cajas y árboles sueltos), con semilla fija ---
function insideArea(x, y, margin) {
  return Object.values(AREAS).some((a) =>
    a.r ? Math.hypot(x - a.x, y - a.y) < a.r + margin : Math.abs(x - a.x) < a.w / 2 + margin && Math.abs(y - a.y) < a.h / 2 + margin,
  );
}
// Cajas en campo abierto: pocas y comunes
const OPEN_CRATES = [
  { x: 20, y: 30, rarity: 0, tag: 'open' },
  { x: -22, y: -20, rarity: 0, tag: 'open' },
  { x: 30, y: -8, rarity: 0, tag: 'open' },
  { x: -30, y: 6, rarity: 0, tag: 'open' },
  { x: 10, y: 52, rarity: 0, tag: 'open' },
  { x: -10, y: -42, rarity: 0, tag: 'open' },
  { x: 84, y: 20, rarity: 0, tag: 'open' },
  { x: -84, y: 8, rarity: 0, tag: 'open' },
  { x: 24, y: -84, rarity: 0, tag: 'open' },
  { x: -20, y: 84, rarity: 0, tag: 'open' },
  { x: 86, y: -84, rarity: 0, tag: 'open' },
  { x: -86, y: 84, rarity: 0, tag: 'open' },
  { x: -36, y: -34, rarity: 0, tag: 'open' },
  { x: -78, y: -48, rarity: 0, tag: 'open' },
  { x: -50, y: -80, rarity: 0, tag: 'open' },
  { x: -60, y: 36, rarity: 0, tag: 'open' },
  { x: -44, y: 56, rarity: 0, tag: 'open' },
  { x: 60, y: 10, rarity: 0, tag: 'open' },
  { x: -60, y: -10, rarity: 0, tag: 'open' },
  { x: 40, y: 86, rarity: 0, tag: 'open' },
  { x: 80, y: -30, rarity: 0, tag: 'open' },
];

// Jeeps (solo en partida): en campo abierto. heading en radianes.
export const VEHICLE_SPOTS = [
  { x: 22, y: 18, heading: Math.PI },
  { x: -22, y: -14, heading: 0.4 },
  { x: 86, y: 4, heading: Math.PI / 2 },
  { x: -86, y: 18, heading: -Math.PI / 2 },
  { x: 18, y: -46, heading: 0 },
  { x: -8, y: 82, heading: Math.PI },
];

// Puntos que la cobertura dispersa deja libres (cajas en campo abierto y jeeps)
const RESERVED = [...OPEN_CRATES, ...VEHICLE_SPOTS];
function scatteredCover() {
  const rand = seededRandom(20261022);
  const items = [];
  const limit = MAP_HALF - 4;
  for (let attempts = 0; items.length < 110 && attempts < 5000; attempts++) {
    const x = (rand() * 2 - 1) * limit;
    const y = (rand() * 2 - 1) * limit;
    if (insideArea(x, y, 3)) continue;
    if (items.some((o) => Math.hypot(o.x - x, o.y - y) < 7.5)) continue;
    if (RESERVED.some((p) => Math.hypot(p.x - x, p.y - y) < 4)) continue;
    const pick = rand();
    items.push(pick < 0.45 ? rock(x, y, 0.8 + rand() * 0.9) : pick < 0.75 ? crate(x, y, rand() < 0.5 ? 1.4 : 2) : tree(x, y, rand() < 0.5 ? 0 : 1));
  }
  return items;
}

export const OBSTACLES = [...houseObstacles, ...furnitureObstacles, ...town, ...base, ...trenches, ...containers, ...forest(), ...scatteredCover()];
export const TREES = OBSTACLES.filter((o) => o.kind === 'tree');

// Caminos de tierra (solo visuales): polilíneas de puntos (x, y)
export const PATHS = [
  [[0, 0], [-14, 10], [-30, 22], [-44, 30], [-52, 34]],
  [[-52, 34], [-52, 52], [-48, 74]],
  [[0, 0], [14, 12], [32, 22], [52, 30]],
  [[52, 30], [52, 50], [58, 58]],
  [[0, 0], [14, -12], [30, -26], [42, -38]],
  [[0, 0], [-14, -12], [-28, -26], [-42, -40], [-48, -50]],
  [[0, 0], [2, -24], [0, -46], [-2, -60]],
  [[-40, 64], [-14, 72], [14, 70], [28, 56], [34, 56]],
  [[-42, -40], [-26, -60], [-14, -66]],
  [[42, -38], [30, -56], [20, -66]],
  [[52, 30], [72, 12], [80, -20], [70, -36]],
];

// Cajas de suministro (sin colisión): todos los puntos posibles. En cada partida se elige una
// parte con semilla (ver server/src/game/crates.js): 'hot' siempre, la mayoría de 'inside' y
// pocas 'open'. rarity: 0 común, 1 raro, 2 épico, 3 legendario (índice en RARITIES).
export const SUPPLY_CRATES = [
  // Lugares más disputados (siempre): plaza, centro del patio de contenedores y torres
  { x: -53, y: 53.5, rarity: 3, tag: 'hot' },
  { x: 51, y: -48, rarity: 3, tag: 'hot' },
  ...TOWERS.map((t) => ({ x: t.x, y: t.y, rarity: 2, tag: 'hot' })),
  // Dentro de casas, bodega, hangar, barracas, cabaña y búnker (cada cuarto con caja)
  ...houseSpots,
  // Patio de contenedores (entre contenedores) y base militar
  { x: 44, y: -40, rarity: 1, tag: 'inside' },
  { x: 62, y: -40, rarity: 1, tag: 'inside' },
  { x: 52, y: -66, rarity: 2, tag: 'inside' },
  { x: 70, y: -64, rarity: 1, tag: 'inside' },
  { x: 38, y: -57, rarity: 1, tag: 'inside' },
  { x: 48, y: 44, rarity: 1, tag: 'inside' },
  { x: 72, y: 54, rarity: 1, tag: 'inside' },
  { x: 54, y: 66, rarity: 2, tag: 'inside' },
  { x: 66, y: 66, rarity: 2, tag: 'inside' },
  { x: 60, y: 50, rarity: 1, tag: 'inside' },
  { x: 76, y: 66, rarity: 1, tag: 'inside' },
  { x: 40, y: -48, rarity: 1, tag: 'inside' },
  { x: 66, y: -52, rarity: 1, tag: 'inside' },
  { x: 52, y: -62, rarity: 0, tag: 'inside' },
  { x: 36, y: -66, rarity: 0, tag: 'inside' },
  // Trincheras
  { x: -16, y: -65.5, rarity: 1, tag: 'inside' },
  { x: 14, y: -65.5, rarity: 1, tag: 'inside' },
  { x: -4, y: -75, rarity: 2, tag: 'inside' },
  { x: -11.5, y: -70, rarity: 1, tag: 'inside' },
  { x: 6, y: -65.5, rarity: 0, tag: 'inside' },
  { x: 8, y: -75, rarity: 1, tag: 'inside' },
  // Claros del bosque
  { x: -48, y: -50, rarity: 1, tag: 'inside' },
  { x: -70, y: -72, rarity: 0, tag: 'inside' },
  ...OPEN_CRATES,
];


// Campo de entrenamiento (solo existe en el lobby): armeros y blancos de práctica
export const TRAINING = {
  // Caja de práctica: va al final de la lista de cajas del snapshot
  crate: { x: 11, y: 3, rarity: 0 },
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
