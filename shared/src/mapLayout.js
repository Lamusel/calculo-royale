// Distribución del mapa: una sola fuente de verdad para colisiones (servidor y predicción)
// y para dibujar (cliente). Coordenadas matemáticas (x, y), x hacia el este, y hacia el norte.
// El plano (río, zonas, carreteras, puntos marcados) vive en mapPlan.js; aquí se llena cada zona.
// Las piezas (casas, muebles, torres, sacos de arena…) se generan en mapBuild.js.

import { MAP_HALF } from './constants.js';
import {
  antenna, barrel, cliff, container, crate, damWall, fence, furnishRoom, houseShell, localFrame, logs, parkedBus, partitions, rock,
  sandbags, seededRandom, silo, stall, stand, tomb, tree, towerLegs,
} from './mapBuild.js';
import { AREAS, BRIDGES, DAM, PARKING, RAILWAY, ROADS, riverY, waterAt } from './mapPlan.js';

export { WALL_HEIGHT, FURNITURE_SIZES } from './mapBuild.js';
export {
  AREAS, BRIDGES, DAM, DOCKS, FORD, MOUNTAINS, PARKING, PATHS, PLATFORMS, RAILWAY, RESERVOIR, RIVER, ROADS, ZIPLINES, riverY, waterAt,
} from './mapPlan.js';

// Desplaza piezas hechas para el mapa viejo (280 m) a su lugar en el mapa nuevo
const at = (dx, dy, list) => list.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
// Desplazamiento de cada zona vieja: centro nuevo − centro viejo
const OLD = {
  town: [-54, 46, 'suburb'], base: [57, 56, 'base'], containers: [55, -50, 'industrial'], terminal: [-114, 0, 'terminal'],
  market: [-4, 114, 'market'], airfield: [100, 112, 'airfield'], stadium: [114, -8, 'stadium'], canyon: [-104, -108, 'canyon'],
};
const SHIFT = Object.fromEntries(Object.entries(OLD).map(([k, [x, y, area]]) => [k, [AREAS[area].x - x, AREAS[area].y - y]]));
SHIFT.canyon[1] -= 25; // el cañón queda al fondo de su zona y las trincheras al frente
SHIFT.trenches = [AREAS.canyon.x, AREAS.canyon.y + 32 + 73];

// Puntos de interés donde puede haber cajas fuera de un edificio (fase 23): el bosque y el campo
// abierto no lo son. Toda caja posible está dentro de un edificio o de uno de estos.
export const POIS = Object.entries(AREAS).filter(([k, a]) => a.name && k !== 'forest').map(([, a]) => a);

const inRect = (r, x, y, margin = 0) => Math.abs(x - r.x) <= r.w / 2 + margin && Math.abs(y - r.y) <= r.h / 2 + margin;

// ¿El punto está dentro de la planta de un edificio o de un punto de interés?
export function strategicSpot(x, y) {
  return HOUSES.some((h) => inRect(h, x, y)) || POIS.some((a) => inRect(a, x, y));
}

// --- Edificios: el servidor usa sus paredes, tabiques y muebles; el cliente dibuja además techo ---
// type: casa | bodega | cabana | hangar | barraca | bunker | hospital | concreto. roomTypes: amueblado
// de cada cuarto. crates: rareza de la caja de cada cuarto con punto libre (null = sin caja); hot: siempre
// está. floors: pisos que se ven por fuera (el interior es la planta baja).
const H = (x, y, w, h, door, type, roomTypes, crates, extra = {}) => ({ x, y, w, h, door, type, rooms: roomTypes.length, roomTypes, crates, ...extra });

// Ciudad Central: manzanas entre las calles (anillo en ±80/±75 y cruz en x = 0, y = 0); la plaza
// central (campo de entrenamiento en el lobby) queda libre
function cityHouses() {
  const rand = seededRandom(20261027);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const rooms = ['sala', 'cocina', 'cuarto'];
  const out = [];
  for (const cx of [-58, -21, 21, 58]) {
    for (const cy of [-55, -20, 20, 55]) {
      const door = Math.abs(cx) < 40 ? (cx > 0 ? 'w' : 'e') : cx > 0 ? 'e' : 'w';
      const big = rand() < 0.5;
      if (big) {
        const types = rand() < 0.3 ? ['bodega', 'bodega'] : [pick(rooms), pick(rooms), pick(rooms)];
        out.push(H(cx, cy, 15, 12, door, types[0] === 'bodega' ? 'bodega' : 'casa', types, types.map(() => (rand() < 0.4 ? 2 : 1)), {
          floors: 2 + Math.floor(rand() * 2), hot: Math.abs(cx) < 40 && Math.abs(cy) < 40 && rand() < 0.5,
        }));
      } else {
        for (const dy of [-7.5, 7.5]) {
          const types = [pick(rooms), pick(rooms)];
          out.push(H(cx, cy + dy, 12, 9, door, 'casa', types, [1, rand() < 0.5 ? 1 : null], { floors: 1 + Math.floor(rand() * 2) }));
        }
      }
    }
  }
  return out;
}

export const HOUSES = [
  // Barrio residencial (el pueblo de antes, con casas de dos pisos alrededor)
  ...at(...SHIFT.town, [
    H(-62, 62, 11, 9, 's', 'casa', ['cuarto', 'sala'], [2, 1]),
    H(-46, 64, 9, 8, 's', 'casa', ['cocina'], undefined),
    H(-66, 44, 9, 11, 'e', 'casa', ['cuarto', 'cocina'], [1]),
    H(-50, 44, 12, 10, 'w', 'casa', ['cuarto', 'sala', 'cocina'], [2, 2], { hot: true }),
    H(-36, 54, 8, 10, 'w', 'casa', ['sala'], [1]),
    H(-54, 28, 10, 8, 'n', 'casa', ['cocina', 'cuarto'], [null, 1]),
    H(-38, 34, 9, 8, 'w', 'casa', ['cuarto'], [1]),
    H(-68, 28, 8, 8, 'e', 'bodega', ['bodega'], [1]),
  ]),
  H(-114, 386, 10, 9, 'w', 'casa', ['sala', 'cuarto'], [1, 1], { floors: 2 }),
  H(-114, 408, 10, 9, 'w', 'casa', ['cocina', 'cuarto'], [1, null], { floors: 2 }),
  H(-114, 428, 10, 8, 'w', 'casa', ['sala'], [1], { floors: 2 }),
  H(-184, 392, 10, 9, 'e', 'casa', ['cuarto', 'sala'], [1, 1], { floors: 2 }),
  H(-184, 414, 10, 9, 'e', 'casa', ['cocina'], [1], { floors: 2 }),
  // Base militar: hangar y barracas de antes, más barracas y búnker
  ...at(...SHIFT.base, [
    H(60, 68, 20, 13, 's', 'hangar', ['hangar'], [3], { doorWidth: 7, hot: true }),
    H(41, 62, 7, 13, 'e', 'barraca', ['literas'], [2]),
    H(70, 45, 14, 7, 'n', 'barraca', ['literas'], [1]),
  ]),
  H(-362, 355, 7, 13, 'e', 'barraca', ['literas'], [1]),
  H(-270, 290, 14, 7, 'n', 'barraca', ['literas'], [1]),
  H(-366, 284, 7, 6, 'n', 'bunker', ['bunker'], [2]),
  // Aeródromo: hangar grande, segundo hangar y barraca de pilotos
  ...at(...SHIFT.airfield, [
    H(116, 124, 20, 13, 's', 'hangar', ['hangar'], [3], { doorWidth: 7, hot: true }),
    H(84, 125, 8, 7, 's', 'barraca', ['literas'], [1]),
  ]),
  H(-325, 124, 20, 13, 's', 'hangar', ['hangar'], [2], { doorWidth: 7 }),
  // Represa: sala de máquinas (orilla sur) y casa de control (orilla norte)
  H(-398, -120, 22, 12, 'n', 'concreto', ['bodega', 'hangar'], [2, 3], { floors: 2, hot: true }),
  H(-398, -52, 10, 10, 's', 'concreto', ['bunker'], [2], { floors: 3 }),
  // Estadio: camerinos detrás de la tribuna norte
  ...at(...SHIFT.stadium, [H(124, 28, 10, 8, 's', 'barraca', ['literas'], [2])]),
  // Terminal de buses: sala de espera y taquilla
  ...at(...SHIFT.terminal, [
    H(-118, 14, 18, 12, 'e', 'hangar', ['hangar'], [2], { doorWidth: 6, hot: true }),
    H(-103, -15, 9, 8, 'n', 'casa', ['sala'], [1]),
  ]),
  // Plaza de mercado: almacén y tienda
  ...at(...SHIFT.market, [
    H(-24, 125, 10, 8, 's', 'casa', ['cocina', 'sala'], [1, 1]),
    H(16, 125, 10, 8, 's', 'bodega', ['bodega'], [2], { hot: true }),
  ]),
  // Hospital: edificio de tres pisos y anexo
  H(-120, 220, 24, 14, 's', 'hospital', ['literas', 'sala', 'literas'], [2, 1, 2], { floors: 3, hot: true }),
  H(-100, 196, 10, 8, 'w', 'hospital', ['cocina'], [1]),
  // Universidad: aulas, biblioteca y cafetería (la cancha va aparte)
  H(30, 402, 22, 12, 's', 'casa', ['sala', 'sala', 'sala'], [1, 1, 2], { floors: 2 }),
  H(84, 406, 16, 12, 's', 'bodega', ['bodega', 'sala'], [2, 1], { floors: 2, hot: true }),
  H(104, 372, 10, 8, 'w', 'casa', ['cocina'], [1]),
  // Zona industrial: bodegas alrededor del patio de contenedores
  H(286, -270, 18, 12, 's', 'bodega', ['bodega', 'bodega'], [1, 2], { hot: true }),
  H(356, -334, 16, 10, 'n', 'bodega', ['bodega'], [1]),
  H(282, -332, 12, 10, 'e', 'bodega', ['bodega'], [1]),
  // Cañón: cabaña del guardabosques al fondo; búnker de las trincheras
  ...at(...SHIFT.canyon, [H(-110, -125, 8, 7, 'n', 'cabana', ['cuarto'], [2], { hot: true })]),
  ...at(...SHIFT.trenches, [H(12, -81, 7, 6, 'n', 'bunker', ['bunker'], [2], { hot: true })]),
  // Ciudad Central
  ...cityHouses(),
  // Granja: establo y casa
  H(-78, -318, 16, 10, 'e', 'bodega', ['bodega'], [1]),
  H(-40, -312, 10, 8, 's', 'casa', ['cocina', 'cuarto'], [1, null]),
  // Gasolinera y taller
  H(160, -40, 12, 8, 'n', 'casa', ['cocina'], [1]),
  H(138, -40, 10, 9, 'n', 'bodega', ['bodega'], [1]),
  // Muelle, cantera, campamento, cementerio, antena, aserradero, hacienda y estación
  H(188, -124, 8, 7, 's', 'cabana', ['cuarto'], [1]),
  H(446, -402, 10, 8, 'w', 'bodega', ['bodega'], [1]),
  H(-436, 197, 8, 7, 'e', 'cabana', ['cuarto'], [1]),
  H(-410, 160, 7, 6, 'w', 'cabana', ['cuarto'], [2]),
  H(-440, -326, 8, 12, 's', 'casa', ['sala'], [2]),
  H(400, 281, 6, 6, 'w', 'bunker', ['bunker'], [2], { hot: true }),
  H(140, -372, 16, 10, 's', 'bodega', ['bodega'], [1]),
  H(422, 72, 14, 10, 's', 'casa', ['sala', 'cocina', 'cuarto'], [1, 1, 2], { floors: 2 }),
  H(400, 46, 10, 8, 'e', 'bodega', ['bodega'], [1]),
  H(-170, -212, 20, 8, 's', 'bodega', ['bodega'], [1]),
  // Ranchos y casas sueltas en las carreteras
  ...['ranch1', 'ranch2', 'ranch3', 'ranch4', 'ranch5', 'ranch6'].map((k, i) =>
    H(AREAS[k].x, AREAS[k].y + 2, 9, 8, 's', i % 2 ? 'casa' : 'cabana', [i % 2 ? 'cocina' : 'cuarto'], [1])),
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

// --- Torres de vigilancia (con caja dorada arriba): base militar, aeródromo, represa e industrial ---
export const TOWERS = [
  ...at(...SHIFT.base, [{ x: 37, y: 37 }, { x: 77, y: 37 }, { x: 37, y: 75 }, { x: 77, y: 75 }]),
  ...at(...SHIFT.airfield, [{ x: 97, y: 126 }]),
  { x: -412, y: -48 },
  { x: 366, y: -262 },
];

// --- Utilería de las zonas viejas, reubicada ---
const suburb = at(...SHIFT.town, [fence(-28, 40, 0.3, 8), fence(-74, 54, 0.3, 10), barrel(-58, 54), barrel(-57, 55), barrel(-44, 30), crate(-72, 36), crate(-40, 44), rock(-30, 62, 1.2)]);

const base = [
  ...at(...SHIFT.base, [
    // Cerca perimetral: portón sur y oeste
    fence(40.5, 32, 17, 0.3), fence(68.5, 32, 27, 0.3), fence(57, 80, 50, 0.3), fence(82, 56, 0.3, 48), fence(32, 42.5, 0.3, 21), fence(32, 69.5, 0.3, 21),
    sandbags(45.5, 35.5, 4, 0.9), sandbags(58.5, 35.5, 4, 0.9), sandbags(35.5, 52, 0.9, 3.5), sandbags(54, 57.5, 3, 0.9), sandbags(66, 57.5, 3, 0.9),
    crate(50, 48), crate(51.5, 48), crate(50.7, 49.5), barrel(76, 56), barrel(76, 57.2),
  ]),
  ...TOWERS.flatMap(towerLegs),
  sandbags(-352, 300, 0.9, 6), sandbags(-276, 345, 6, 0.9), crate(-280, 270), crate(-281.5, 270),
];

const trenches = at(...SHIFT.trenches, [
  sandbags(-14.5, -63.5, 11, 0.9), sandbags(4, -63.5, 18, 0.9), sandbags(18.5, -63.5, 5, 0.9), sandbags(-11, -67.5, 18, 0.9), sandbags(11, -67.5, 18, 0.9),
  sandbags(-20.5, -65.5, 0.9, 3.3), sandbags(-6, -72.5, 26, 0.9), sandbags(15, -72.5, 8, 0.9), sandbags(-14, -77.5, 12, 0.9), sandbags(3, -77.5, 6, 0.9),
  sandbags(18.5, -77.5, 4, 0.9), sandbags(20.5, -75, 0.9, 4.1), sandbags(-13.6, -70, 0.9, 4.1), sandbags(-9.4, -70, 0.9, 4.1), barrel(17, -75), crate(-18, -75, 1.2),
]);

const containers = at(...SHIFT.containers, [
  container(40, -36), container(48, -36, false, true), container(60, -36), container(36, -44, true), container(46, -44), container(56, -44),
  container(66, -44, true, true), container(42, -53), container(48.5, -52, true), container(58, -53, false, true), container(42, -62), container(58, -62),
  container(68, -58, true), container(74, -48, true), container(62, -70), container(46, -70, false, true),
  crate(53, -40), crate(54.5, -40), crate(52, -57), barrel(63, -49), barrel(64, -50.2),
]);

const terminal = at(...SHIFT.terminal, [
  parkedBus(-123, -6, true), parkedBus(-117, -6, true), parkedBus(-121, -24), parkedBus(-114, 24),
  crate(-109, 4, 1.2), crate(-109, -1, 1.2), barrel(-104, 22), barrel(-103, 23.2), fence(-114, -30, 26, 0.3),
]);

const market = at(...SHIFT.market, [
  ...[-22, -15, -8].map((x) => stall(x, 110)), ...[2, 9, 16].map((x) => stall(x, 110)), ...[-20, -12].map((x) => stall(x, 101)), ...[4, 12].map((x) => stall(x, 101)),
  rock(-4, 105, 1.6), barrel(-28, 104), barrel(22, 104), crate(-30, 114), crate(24, 116),
]);

const airfield = at(...SHIFT.airfield, [
  barrel(104, 112), barrel(105.2, 112), barrel(104.6, 113.1), crate(88, 112), crate(89.5, 112), crate(128, 110, 2), sandbags(74, 118, 0.9, 6),
]);

const stadium = at(...SHIFT.stadium, [
  stand(114, 16, 30, 5, 's'), stand(114, -32, 30, 5, 'n'), stand(131, -8, 5, 36, 'w'), stand(97, 4, 5, 14, 'e'), stand(97, -20, 5, 14, 'e'),
  fence(103, -8, 0.3, 6), fence(125, -8, 0.3, 6), crate(114, -1, 1.2), crate(114, -15, 1.2),
]);

const canyon = at(...SHIFT.canyon, [
  cliff(-116, -94, 24, 4), cliff(-92, -104, 20, 4), cliff(-118, -112, 22, 4), cliff(-93, -120, 18, 4),
  rock(-104, -100, 1.6), rock(-100, -114, 1.4), rock(-122, -104, 1.8), rock(-86, -112, 1.5), rock(-100, -125, 1.2),
]);

// --- Zonas nuevas ---
const city = [
  // Esquinas de la plaza: bancas de piedra y canecas (la plaza misma queda libre)
  ...[[-30, 30], [30, 30], [-30, -30], [30, -30]].flatMap(([x, y]) => [rock(x, y, 1.1), barrel(x + 2, y)]),
  crate(-40, 38), crate(40, -38), crate(39, 38), sandbags(-8, 78, 5, 0.9), sandbags(8, -78, 5, 0.9),
  parkedBus(-40, 78), parkedBus(42, -78),
];

const dam = [
  // Dos muros de concreto con el paso peatonal por encima
  damWall(DAM.x - DAM.w / 2 + 1, DAM.y, 2, DAM.h),
  damWall(DAM.x + DAM.w / 2 - 1, DAM.y, 2, DAM.h - 20),
  crate(-392, -104), crate(-393.5, -104), barrel(-410, -132), barrel(-411.2, -132), sandbags(-398, -64, 6, 0.9),
];

const hospital = [fence(-120, 236, 40, 0.3), barrel(-134, 200), crate(-108, 206, 1.2), parkedBus(-140, 196, true)];

const university = [
  // Cancha con cerca y dos entradas
  fence(48, 360, 0.3, 18), fence(80, 360, 0.3, 18), fence(56, 369, 16, 0.3), fence(72, 369, 8, 0.3), fence(64, 351, 32, 0.3),
  rock(20, 380, 1.3), crate(96, 390), crate(10, 392, 1.2),
];

const industrial = [container(300, -262, true), container(372, -300, true), container(340, -340), crate(300, -345), crate(301.5, -345), barrel(372, -282)];

const farm = [
  silo(-92, -340), silo(-92, -330), silo(-86, -350),
  fence(-60, -362, 70, 0.3), fence(-25, -340, 0.3, 40), fence(-95, -300, 0.3, 30),
  crate(-60, -322), barrel(-70, -310), barrel(-71, -311.2),
];

const gas = [barrel(150, -22), barrel(154, -22), barrel(158, -22), crate(170, -30), sandbags(144, -26, 4, 0.9)];
const dock = [crate(204, -122), crate(205.5, -122), barrel(212, -124), barrel(213, -125.2)];
const quarry = [
  cliff(410, -440, 30, 4), cliff(450, -430, 4, 24), cliff(420, -405, 4, 18), rock(430, -425, 2), rock(415, -420, 1.6), rock(440, -445, 1.8), crate(436, -410, 2),
];
const forestCamp = [crate(-420, 190), barrel(-424, 172), rock(-450, 160, 1.2)];
const cemetery = [
  ...[-452, -446, -434, -428].flatMap((x) => [-348, -354, -360].map((y) => tomb(x, y))),
  fence(-440, -365, 46, 0.3), fence(-463, -342, 0.3, 46), fence(-417, -342, 0.3, 46),
];
const lookout = [sandbags(304, 212, 6, 0.9), sandbags(316, 218, 0.9, 6), crate(310, 210, 1.2)];
const antennaTop = [antenna(386, 292), sandbags(380, 284, 6, 0.9), barrel(394, 296)];
const sawmill = [logs(124, -380), logs(124, -386), logs(158, -384, true), logs(164, -384, true), crate(150, -362)];
const coffee = [fence(420, 40, 40, 0.3), barrel(436, 56), crate(408, 60)];
const station = [parkedBus(-140, RAILWAY.y), parkedBus(-128, RAILWAY.y), crate(-186, -222), barrel(-150, -222)];
const ranches = ['ranch1', 'ranch2', 'ranch3', 'ranch4', 'ranch5', 'ranch6'].flatMap((k) => {
  const a = AREAS[k];
  return [fence(a.x, a.y - 8, 20, 0.3), barrel(a.x + 7, a.y + 2), crate(a.x - 7, a.y - 3)];
});
// Barandas de los puentes (los puentes mismos se pintan en el cliente)
// Barandas de concreto de los puentes (borde: los vehículos se deslizan, sin daño)
const bridges = BRIDGES.flatMap((b) => [-1, 1].map((s) => ({ kind: 'rail', shape: 'rect', x: b.x + s * (b.w / 2 + 0.2), y: b.y, w: 0.4, h: b.h, height: 1 })));

const NAMED = [
  ...houseObstacles, ...furnitureObstacles, ...suburb, ...base, ...trenches, ...containers, ...terminal, ...market, ...airfield, ...stadium, ...canyon,
  ...city, ...dam, ...hospital, ...university, ...industrial, ...farm, ...gas, ...dock, ...quarry, ...forestCamp, ...cemetery, ...lookout, ...antennaTop,
  ...sawmill, ...coffee, ...station, ...ranches, ...bridges,
];

// --- Naturaleza entre zonas ---
const segDist = (x, y, [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
export function distanceToRoads(x, y) {
  let best = Infinity;
  for (const line of ROADS) for (let i = 1; i < line.length; i++) best = Math.min(best, segDist(x, y, line[i - 1], line[i]));
  return best;
}
function insideArea(x, y, margin) {
  return Object.values(AREAS).some((a) => (a.r ? Math.hypot(x - a.x, y - a.y) < a.r + margin : inRect(a, x, y, margin)));
}
// Campo libre: lejos de zonas, casas, agua, carreteras, vía del tren y estacionamientos
function openGround(x, y, margin) {
  if (Math.abs(x) > MAP_HALF - 4 || Math.abs(y) > MAP_HALF - 4) return false;
  if (insideArea(x, y, margin) || Math.abs(y - riverY(x)) < 22 || waterAt(x, y) || (x < DAM.x + 10 && waterAt(x - 6, y) + waterAt(x, y + 6) + waterAt(x, y - 6))) return false;
  if (Math.abs(y - RAILWAY.y) < 4 && x < RAILWAY.x1 + 2) return false;
  if (PARKING.some((p) => Math.hypot(p.x - x, p.y - y) < 6)) return false;
  return distanceToRoads(x, y) > 5;
}

// Cultivos (solo visuales: surcos en el terreno) de la granja, la hacienda y algunos ranchos
export const FIELDS = [
  { x: -60, y: -385, w: 60, h: 34 }, { x: -10, y: -330, w: 26, h: 50 }, { x: 445, y: 100, w: 40, h: 30 }, { x: 465, y: 30, w: 30, h: 40 },
  { x: -300, y: -180, w: 36, h: 24 }, { x: 225, y: -225, w: 26, h: 20 }, { x: -470, y: 420, w: 40, h: 30 },
];

// Bosque del campamento: árboles con semilla, con claros y las cabañas libres
function forest() {
  const rand = seededRandom(20261023);
  const a = AREAS.forest;
  const clearings = [{ x: -436, y: 197, r: 8 }, { x: -410, y: 160, r: 7 }, { x: -420, y: 180, r: 9 }];
  const items = [];
  for (let attempts = 0; items.length < 230 && attempts < 8000; attempts++) {
    const x = a.x + (rand() - 0.5) * (a.w - 4);
    const y = a.y + (rand() - 0.5) * (a.h - 4);
    if (Math.abs(x) > MAP_HALF - 3 || clearings.some((c) => Math.hypot(x - c.x, y - c.y) < c.r)) continue;
    if (items.some((o) => Math.hypot(o.x - x, o.y - y) < 3.6)) continue;
    items.push(rand() < 0.1 ? rock(x, y, 0.7 + rand() * 0.8) : tree(x, y, rand() < 0.6 ? 0 : 1));
  }
  return items;
}

// Bosquecitos entre zonas (puntos de cobertura y de referencia)
function groves() {
  const rand = seededRandom(20261028);
  const centers = [];
  for (let i = 0; i < 4000 && centers.length < 22; i++) {
    const x = (rand() * 2 - 1) * (MAP_HALF - 30);
    const y = (rand() * 2 - 1) * (MAP_HALF - 30);
    if (!openGround(x, y, 25) || centers.some((c) => Math.hypot(c.x - x, c.y - y) < 95)) continue;
    centers.push({ x, y, r: 12 + rand() * 10 });
  }
  const items = [];
  for (const c of centers) {
    const want = Math.round(c.r * 1.2);
    for (let n = 0, tries = 0; n < want && tries < 300; tries++) {
      const ang = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * c.r;
      const x = c.x + Math.cos(ang) * d;
      const y = c.y + Math.sin(ang) * d;
      if (!openGround(x, y, 2) || items.some((o) => Math.hypot(o.x - x, o.y - y) < 3.4)) continue;
      items.push(rand() < 0.12 ? rock(x, y, 0.8 + rand() * 0.7) : tree(x, y, rand() < 0.5 ? 0 : 1));
      n++;
    }
  }
  return items;
}

// Jeeps (solo en partida): en los estacionamientos marcados en el plano
export const VEHICLE_SPOTS = PARKING;

// Cobertura dispersa (rocas, cajas, árboles sueltos y cercas de potrero), con semilla fija
function scatteredCover(taken) {
  const rand = seededRandom(20261022);
  const items = [];
  const clear = (x, y, d) => !taken.some((o) => Math.abs(o.x - x) < d && Math.abs(o.y - y) < d) && !items.some((o) => Math.hypot(o.x - x, o.y - y) < d);
  for (let attempts = 0; items.length < 900 && attempts < 30000; attempts++) {
    const x = (rand() * 2 - 1) * (MAP_HALF - 5);
    const y = (rand() * 2 - 1) * (MAP_HALF - 5);
    if (!openGround(x, y, 3) || FIELDS.some((f) => inRect(f, x, y, 2)) || !clear(x, y, 9)) continue;
    const pick = rand();
    items.push(
      pick < 0.42 ? rock(x, y, 0.8 + rand() * 1.1)
        : pick < 0.62 ? crate(x, y, rand() < 0.5 ? 1.4 : 2)
          : pick < 0.92 ? tree(x, y, rand() < 0.5 ? 0 : 1)
            : rand() < 0.5 ? fence(x, y, 10, 0.3) : fence(x, y, 0.3, 10),
    );
  }
  return items;
}

// --- Gulag (fase 30): patios de prisión privados, fuera del mapa de 1 km (al este) ---
// Cada arena es un cuadrado de GULAG_HALF m de semilado por dentro, con muros y cobertura simétrica.
export const GULAG_HALF = 14;
export const GULAG_ARENAS = [[700, 200], [790, 200], [700, 300], [790, 300]].map(([x, y], index) => ({ index, x, y }));
// Esquinas donde empieza cada combatiente (relativas al centro)
export const GULAG_SPAWNS = [[-10, -10], [10, 10], [-10, 10]];
const gulagWall = (x, y, w, h) => ({ kind: 'gulagwall', shape: 'rect', x, y, w, h, height: 3.5, gulag: true });
const gulag = GULAG_ARENAS.flatMap(({ x, y }) => {
  const H2 = GULAG_HALF + 0.5;
  return [
    gulagWall(x, y + H2, GULAG_HALF * 2 + 2, 1), gulagWall(x, y - H2, GULAG_HALF * 2 + 2, 1),
    gulagWall(x + H2, y, 1, GULAG_HALF * 2), gulagWall(x - H2, y, 1, GULAG_HALF * 2),
    ...[[-5, 0], [5, 0], [0, -5], [0, 5]].map(([dx, dy]) => ({ ...crate(x + dx, y + dy, 2), gulag: true })),
    ...[[-7, 7], [7, -7]].map(([dx, dy]) => ({ ...sandbags(x + dx, y + dy, 4, 0.9), gulag: true })),
  ];
});

// Arena que contiene el punto (o null)
export const gulagArenaAt = (x, y) => GULAG_ARENAS.find((a) => Math.abs(x - a.x) <= GULAG_HALF + 2 && Math.abs(y - a.y) <= GULAG_HALF + 2) ?? null;

// Límite del mundo para un círculo de radio r: el mapa, o la arena del Gulag si está adentro de una
export function worldLimits(x, y, r) {
  const a = Math.abs(x) > MAP_HALF ? gulagArenaAt(x, y) : null;
  if (a) return { minX: a.x - GULAG_HALF + r, maxX: a.x + GULAG_HALF - r, minY: a.y - GULAG_HALF + r, maxY: a.y + GULAG_HALF - r };
  return { minX: -MAP_HALF + r, maxX: MAP_HALF - r, minY: -MAP_HALF + r, maxY: MAP_HALF - r };
}

const NATURE = [...forest(), ...groves()];
export const OBSTACLES = [...NAMED, ...NATURE, ...scatteredCover(NATURE), ...gulag];
export const TREES = OBSTACLES.filter((o) => o.kind === 'tree');

// Pista del aeródromo (solo visual): rectángulo de asfalto
export const RUNWAY = { x: AREAS.airfield.x + 2, y: AREAS.airfield.y - 14, w: 130, h: 8 };
// Cancha del estadio (solo visual)
export const PITCH = { x: AREAS.stadium.x, y: AREAS.stadium.y, w: 26, h: 42 };

// Cajas de suministro (sin colisión): todos los puntos posibles. En cada partida se elige una
// parte con semilla (ver server/src/game/crates.js): 'hot' siempre, la mayoría de 'inside' y
// pocas 'open'. rarity: 0 común, 1 raro, 2 épico, 3 legendario (índice en RARITIES).
const C = (x, y, rarity, tag = 'inside') => ({ x, y, rarity, tag });
export const SUPPLY_CRATES = [
  // Lugares más disputados (siempre): plaza del barrio, centro del patio de contenedores y torres
  ...at(...SHIFT.town, [C(-53, 53.5, 3, 'hot')]),
  ...at(...SHIFT.containers, [C(51, -48, 3, 'hot')]),
  ...TOWERS.map((t) => C(t.x, t.y, 2, 'hot')),
  // Dentro de los edificios (cada cuarto con caja)
  ...houseSpots,
  // Patio de contenedores y base militar
  ...at(...SHIFT.containers, [
    C(44, -40, 1), C(62, -40, 1), C(52, -66, 2), C(70, -64, 1), C(38, -57, 1), C(40, -48, 1), C(66, -52, 1), C(52, -62, 1), C(36, -66, 1),
  ]),
  ...at(...SHIFT.base, [C(48, 44, 1), C(72, 54, 1), C(54, 66, 2), C(66, 66, 2), C(60, 50, 1), C(76, 66, 1)]),
  // Trincheras
  ...at(...SHIFT.trenches, [C(-16, -65.5, 1), C(14, -65.5, 1), C(-4, -75, 2), C(-11.5, -70, 1), C(6, -65.5, 1), C(8, -75, 1)]),
  // Terminal, mercado, aeródromo, estadio (el centro de la cancha siempre) y cañón
  ...at(...SHIFT.terminal, [C(-112, -14, 1), C(-106, 6, 1)]),
  ...at(...SHIFT.market, [C(-18, 104, 1), C(8, 104, 1), C(-4, 118, 2)]),
  ...at(...SHIFT.airfield, [C(80, 106, 1), C(128, 104, 1), C(102, 116, 2)]),
  ...at(...SHIFT.stadium, [C(114, -8, 2, 'hot'), C(106, 8, 1), C(122, -24, 1)]),
  ...at(...SHIFT.canyon, [C(-106, -104, 1), C(-98, -112, 2), C(-122, -120, 1)]),
  // Zonas nuevas: puntos al aire libre dentro de cada una
  C(-25, 45, 1), C(45, -45, 1), C(-45, -10, 1), C(60, 38, 2),
  C(-415, -88, 3, 'hot'), C(-404, -70, 1),
  C(-120, 200, 1), C(64, 360, 2), C(40, 380, 1),
  C(320, -300, 1), C(340, -275, 2),
  C(-60, -345, 1), C(-80, -335, 2), C(150, -30, 1), C(204, -132, 1), C(430, -420, 2),
  C(-440, -340, 2), C(310, 214, 2), C(390, 287, 3, 'hot'),
  C(150, -385, 1), C(420, 55, 1), C(-160, -222, 1),
];

// Campo de entrenamiento (solo existe en el lobby): armeros y blancos de práctica
export const TRAINING = {
  // Caja de práctica: va al final de la lista de cajas del snapshot
  crate: { x: 11, y: 3, rarity: 0 },
  racks: [
    { item: 'm870', x: -8, y: 10 },
    { item: 'ak47', x: -4, y: 10 },
    { item: 'kar98k', x: 0, y: 10 },
    { item: 'frag', x: 4, y: 10 },
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
