// Generadores de piezas del mapa (los usa mapLayout.js). Coordenadas matemáticas (x, y).
//
// Obstáculo rectangular: { kind, shape: 'rect', x, y, w, h, height }  (centro, ancho en x, alto en y)
// Obstáculo circular:    { kind, shape: 'circle', x, y, r, height }
// Mueble: { kind, x, y, w, h, height, rot, solid, house } (rot: hacia dónde mira, en radianes)

export const WALL = 0.5; // grosor de las paredes
export const WALL_HEIGHT = 3.2;
export const DOOR = 2.2; // ancho de las puertas
const ROOM_DOOR = 1.3; // vano en los tabiques

export const wall = (x, y, w, h, extra = {}) => ({ kind: 'wall', shape: 'rect', x, y, w, h, height: WALL_HEIGHT, ...extra });
export const crate = (x, y, size = 1.4) => ({ kind: 'crate', shape: 'rect', x, y, w: size, h: size, height: size });
export const barrel = (x, y) => ({ kind: 'barrel', shape: 'circle', x, y, r: 0.5, height: 1.2 });
export const rock = (x, y, r) => ({ kind: 'rock', shape: 'circle', x, y, r, height: r * 1.2 });
export const fence = (x, y, w, h) => ({ kind: 'fence', shape: 'rect', x, y, w, h, height: 1.1 });
export const tree = (x, y, variant = 0) => ({ kind: 'tree', shape: 'circle', x, y, r: 0.45, height: 7, variant });
// Muro de sacos de arena (bloquea balas y el paso; se ve por encima)
export const sandbags = (x, y, w, h) => ({ kind: 'sandbag', shape: 'rect', x, y, w, h, height: 1.1 });

const CONTAINER = { long: 6, short: 2.4, height: 2.6 };
export function container(x, y, vertical = false, stacked = false) {
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

// Cuatro paredes con una puerta en el lado indicado ('n', 's', 'e', 'w')
export function houseShell(cx, cy, w, h, door, doorWidth = DOOR) {
  const walls = [];
  // Las horizontales cubren las esquinas; las verticales llegan justo hasta ellas
  const horizontal = (y, withDoor) => {
    if (!withDoor) return walls.push(wall(cx, y, w + WALL, WALL));
    const len = (w - doorWidth) / 2 + WALL / 2;
    const offset = doorWidth / 2 + len / 2;
    walls.push(wall(cx - offset, y, len, WALL), wall(cx + offset, y, len, WALL));
  };
  const vertical = (x, withDoor) => {
    if (!withDoor) return walls.push(wall(x, cy, WALL, h - WALL));
    const len = (h - doorWidth) / 2 - WALL / 2;
    const offset = doorWidth / 2 + len / 2;
    walls.push(wall(x, cy - offset, WALL, len), wall(x, cy + offset, WALL, len));
  };
  horizontal(cy + h / 2, door === 'n');
  horizontal(cy - h / 2, door === 's');
  vertical(cx + w / 2, door === 'e');
  vertical(cx - w / 2, door === 'w');
  return walls;
}

// Marco local de un edificio: u corre a lo largo de la pared del fondo (la opuesta a la puerta)
// y v entra desde el fondo hacia la puerta. Así un mismo amueblado sirve para cualquier puerta.
export function localFrame(b) {
  const x0 = b.x - b.w / 2 + WALL / 2;
  const x1 = b.x + b.w / 2 - WALL / 2;
  const y0 = b.y - b.h / 2 + WALL / 2;
  const y1 = b.y + b.h / 2 - WALL / 2;
  const alongX = b.door === 's' || b.door === 'n';
  const f = {
    s: { at: (u, v) => [u, y1 - v], rot: -Math.PI / 2 },
    n: { at: (u, v) => [u, y0 + v], rot: Math.PI / 2 },
    e: { at: (u, v) => [x0 + v, u], rot: 0 },
    w: { at: (u, v) => [x1 - v, u], rot: Math.PI },
  }[b.door];
  return {
    ...f,
    uMin: alongX ? x0 : y0,
    uMax: alongX ? x1 : y1,
    depth: alongX ? y1 - y0 : x1 - x0,
    // Rectángulo en coordenadas locales → { x, y, w, h } del mapa
    rect(uc, vc, len, dep) {
      const [x, y] = f.at(uc, vc);
      return alongX ? { x, y, w: len, h: dep } : { x, y, w: dep, h: len };
    },
  };
}

// Tabiques perpendiculares al fondo con un vano a media profundidad. Devuelve paredes y cuartos.
export function partitions(b, frame) {
  const span = frame.uMax - frame.uMin;
  const c = (frame.uMin + frame.uMax) / 2;
  const splits = b.rooms === 3 ? [c - span * 0.2, c + span * 0.2] : b.rooms === 2 ? [c - span * 0.2] : [];
  const walls = [];
  const gapV = frame.depth * 0.55;
  for (const s of splits) {
    const a = gapV - ROOM_DOOR / 2;
    const z = gapV + ROOM_DOOR / 2;
    walls.push({ ...wall(0, 0, 0, 0), ...frame.rect(s, a / 2, WALL, a) });
    walls.push({ ...wall(0, 0, 0, 0), ...frame.rect(s, (z + frame.depth) / 2, WALL, frame.depth - z) });
  }
  const edges = [frame.uMin, ...splits.flatMap((s) => [s - WALL / 2, s + WALL / 2]), frame.uMax];
  const rooms = [];
  for (let i = 0; i < edges.length; i += 2) rooms.push({ u0: edges[i], u1: edges[i + 1] });
  return { walls, rooms };
}

// Medidas de cada mueble: largo a lo largo de la pared, fondo y alto
export const FURNITURE_SIZES = {
  sofa: [2.0, 0.85, 0.9],
  shelf: [1.4, 0.45, 2.0],
  coffeeTable: [1.0, 0.55, 0.45],
  bed: [1.4, 2.0, 0.6],
  wardrobe: [1.1, 0.6, 2.0],
  nightstand: [0.45, 0.45, 0.55],
  counter: [2.2, 0.65, 0.95],
  fridge: [0.75, 0.7, 1.85],
  table: [1.2, 0.8, 0.75],
  chair: [0.45, 0.45, 0.9],
  rug: [2.0, 1.4, 0.02],
  painting: [0.9, 0.05, 0.7],
  plant: [0.45, 0.45, 1.1],
  bunk: [1.0, 2.0, 1.7],
  locker: [0.9, 0.5, 1.9],
  rack: [3.0, 0.8, 2.4],
};
// Muebles grandes: chocan y sirven de cobertura; el resto es decoración
const SOLID = new Set(['sofa', 'shelf', 'coffeeTable', 'bed', 'wardrobe', 'counter', 'fridge', 'table', 'bunk', 'locker', 'rack']);

// Amueblado de un cuarto según su tipo. Devuelve muebles, obstáculos extra y el punto libre
// para una caja de suministro (o null).
export function furnishRoom(type, room, frame, house) {
  const out = { furniture: [], obstacles: [], spot: null };
  const width = room.u1 - room.u0;
  const uc = (room.u0 + room.u1) / 2;
  const depth = frame.depth;
  // lenOverride: largo a lo largo de la pared, si el cuarto es angosto
  const add = (kind, u, v, rotOffset = 0, lenOverride = null) => {
    const [baseLen, dep, height] = FURNITURE_SIZES[kind];
    const len = lenOverride ?? baseLen;
    const r = frame.rect(u, v, len, dep);
    out.furniture.push({ kind, ...r, height, rot: frame.rot + rotOffset, solid: SOLID.has(kind), house });
  };
  const spotAt = (u, v) => {
    const [x, y] = frame.at(u, v);
    out.spot = { x, y };
  };

  if (type === 'sala') {
    const sofaU = width >= 4.2 ? room.u1 - 1.15 : uc;
    add('sofa', sofaU, 0.45);
    if (width >= 4.2) add('shelf', room.u0 + 0.8, 0.25);
    add('rug', sofaU, 1.75);
    add('coffeeTable', sofaU, 1.75);
    add('painting', sofaU, 0.03);
    add('plant', room.u0 + 0.35, depth - 0.4);
    spotAt(uc, Math.min(depth - 1.3, 3.6));
  } else if (type === 'cuarto') {
    const bedU = width >= 3.6 ? room.u0 + 0.85 : uc;
    add('bed', bedU, 1.02);
    if (width >= 3.6) add('wardrobe', room.u1 - 0.65, 0.32);
    if (width >= 3.6) add('nightstand', bedU + 1.05, 0.25);
    add('painting', bedU, 0.03);
    spotAt(uc, Math.min(depth - 1.2, 3.8));
  } else if (type === 'cocina') {
    const counterLen = Math.min(2.2, width - 1.4);
    add('counter', room.u0 + counterLen / 2 + 0.05, 0.35, 0, counterLen);
    if (width >= counterLen + 1.2) add('fridge', room.u1 - 0.42, 0.37);
    if (depth >= 4.5) {
      const v = depth * 0.55;
      add('table', uc, v);
      add('chair', uc - 0.85, v, Math.PI / 2);
      add('chair', uc + 0.85, v, -Math.PI / 2);
    }
  } else if (type === 'bodega') {
    for (let u = room.u0 + 0.85; u <= room.u1 - 0.8; u += 1.6) {
      const [x, y] = frame.at(u, 0.75);
      out.obstacles.push(crate(x, y, 1.2));
    }
    const [bx, by] = frame.at(room.u1 - 0.6, depth - 0.7);
    out.obstacles.push(barrel(bx, by));
    spotAt(uc, depth * 0.55);
  } else if (type === 'literas') {
    const count = Math.floor((width - 0.4) / 1.5);
    for (let i = 0; i < count; i++) add('bunk', room.u0 + 0.75 + i * 1.5, 1.02);
    add('locker', room.u0 + 0.5, depth - 0.3, Math.PI);
    add('locker', room.u1 - 0.5, depth - 0.3, Math.PI);
    spotAt(uc, Math.min(depth - 1.2, 3.4));
  } else if (type === 'hangar') {
    for (let u = room.u0 + 2.2; u <= room.u1 - 1.6; u += 4.2) add('rack', u, 0.45);
    for (const u of [room.u0 + 1.3, room.u1 - 1.3]) {
      const [x, y] = frame.at(u, depth - 2.2);
      out.obstacles.push(crate(x, y, 1.6));
    }
    spotAt(uc, depth * 0.55);
  } else if (type === 'bunker') {
    add('shelf', uc, 0.25);
    const [x, y] = frame.at(room.u0 + 0.7, depth - 0.8);
    out.obstacles.push(crate(x, y, 1.0));
    spotAt(uc, depth * 0.55);
  }
  return out;
}

// Torre de vigilancia: cuatro patas (la plataforma se dibuja arriba); bajo ella cabe una caja
export function towerLegs(t) {
  return [-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({ kind: 'post', shape: 'circle', x: t.x + sx * 1.25, y: t.y + sy * 1.25, r: 0.22, height: 7 })));
}

// Generador con semilla (el mapa es el mismo en el servidor y en todos los clientes)
export function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
