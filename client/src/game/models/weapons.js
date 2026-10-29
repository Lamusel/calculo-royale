import { box, cylinder, merge, piece } from './build.js';

// Armas procedurales (fase 29: arsenal con nombres reales). Origen en la empuñadura (mano derecha),
// cañón hacia +x, y hacia arriba. Cada arma sale de una especificación (largo, colores, cargador,
// culata y extras) para que se distinga a simple vista; los puntos de montaje de los accesorios
// (mira, boca, cargador y culata) se calculan de la misma especificación.

const STEEL = '#2a2c2f';
const DARK = '#1c1d1f';
const POLYMER = '#3c3f2b';
const WOOD = '#6b4a2b';
const OLIVE = '#4f5a2a';
const TAN = '#a89060';
const GOLD = '#c9a227';
const GREEN = '#4f6b3a';

// L: largo del cuerpo · h: alto · b: largo del cañón · r: radio del cañón · mag: tipo de cargador
// stock: largo de la culata (0 = sin) · hand: guardamanos · extra: detalles propios
const SPECS = {
  m1911: { L: 0.3, h: 0.08, b: 0.04, r: 0.016, body: STEEL, grip: WOOD, mag: 'grip', stock: 0 },
  glock17: { L: 0.28, h: 0.09, b: 0.03, r: 0.016, body: DARK, grip: DARK, mag: 'grip', stock: 0, extra: 'square' },
  deagle: { L: 0.38, h: 0.11, b: 0.06, r: 0.024, body: GOLD, grip: DARK, mag: 'grip', stock: 0, extra: 'square', gold: true },
  mp5: { L: 0.4, h: 0.1, b: 0.12, r: 0.02, body: DARK, mag: 'curved', stock: 0.22, stockKind: 'skeleton', hand: DARK },
  ump45: { L: 0.42, h: 0.12, b: 0.1, r: 0.022, body: POLYMER, mag: 'box', stock: 0.24, stockKind: 'folded', hand: POLYMER },
  uzi: { L: 0.3, h: 0.12, b: 0.08, r: 0.018, body: STEEL, mag: 'grip', stock: 0.16, stockKind: 'skeleton' },
  m4a1: { L: 0.52, h: 0.11, b: 0.32, r: 0.024, body: DARK, mag: 'box', stock: 0.3, stockKind: 'solid', hand: DARK, extra: 'carry' },
  ak47: { L: 0.56, h: 0.11, b: 0.34, r: 0.026, body: STEEL, mag: 'curved', stock: 0.34, stockKind: 'wood', hand: WOOD },
  scarl: { L: 0.54, h: 0.12, b: 0.3, r: 0.025, body: TAN, mag: 'box', stock: 0.3, stockKind: 'solid', hand: TAN },
  aug: { L: 0.7, h: 0.13, b: 0.22, r: 0.024, body: OLIVE, mag: 'bullpup', stock: 0, hand: OLIVE, extra: 'optic' },
  spas12: { L: 0.36, h: 0.11, b: 0.62, r: 0.033, body: DARK, mag: 'tube', stock: 0.32, stockKind: 'skeleton', hand: DARK, extra: 'pump' },
  m870: { L: 0.32, h: 0.1, b: 0.62, r: 0.032, body: STEEL, mag: 'tube', stock: 0.36, stockKind: 'wood', hand: WOOD, extra: 'pump' },
  dbarrel: { L: 0.26, h: 0.1, b: 0.6, r: 0.03, body: STEEL, mag: 'none', stock: 0.38, stockKind: 'wood', hand: WOOD, extra: 'double' },
  sks: { L: 0.62, h: 0.1, b: 0.44, r: 0.022, body: WOOD, mag: 'fixed', stock: 0.4, stockKind: 'wood', hand: WOOD, scope: 1, extra: 'bayonet' },
  mini14: { L: 0.56, h: 0.1, b: 0.38, r: 0.022, body: STEEL, mag: 'box', stock: 0.34, stockKind: 'skeleton', hand: STEEL, scope: 1 },
  kar98k: { L: 0.66, h: 0.09, b: 0.62, r: 0.018, body: WOOD, mag: 'fixed', stock: 0.44, stockKind: 'wood', hand: WOOD, extra: 'bolt', scope: 2 },
  m24: { L: 0.6, h: 0.12, b: 0.66, r: 0.024, body: OLIVE, mag: 'fixed', stock: 0.42, stockKind: 'thumb', hand: OLIVE, extra: 'bolt', scope: 2 },
  awm: { L: 0.64, h: 0.15, b: 0.74, r: 0.03, body: GREEN, mag: 'box', stock: 0.46, stockKind: 'thumb', hand: GREEN, extra: 'brake', scope: 3, gold: true },
  m249: { L: 0.66, h: 0.15, b: 0.44, r: 0.03, body: DARK, mag: 'drum', stock: 0.34, stockKind: 'solid', hand: OLIVE, extra: 'bipod', carry: true },
  rpg: { L: 0.2, h: 0.1, b: 0, r: 0, body: OLIVE, mag: 'none', stock: 0, extra: 'rocket', gold: true },
  crossbow: { L: 0.5, h: 0.08, b: 0, r: 0, body: WOOD, mag: 'none', stock: 0.3, stockKind: 'wood', extra: 'bow', gold: true },
  gl: { L: 0.34, h: 0.12, b: 0.26, r: 0.05, body: DARK, mag: 'drumgl', stock: 0.26, stockKind: 'skeleton', extra: 'gl', gold: true },
};

const barrel = (length, radius, x, y, color = STEEL) =>
  piece(cylinder(radius, radius, length, 7), color, { position: [x, y, 0], rotation: [0, 0, Math.PI / 2] });

function gun(s) {
  const top = s.h / 2 + 0.06;
  const parts = [piece(box(s.L, s.h, 0.07), s.body, { position: [s.L / 2 - 0.08, 0.06, 0] })];
  const front = s.L - 0.08;
  if (s.b > 0) {
    parts.push(barrel(s.b, s.r, front + s.b / 2, 0.07));
    if (s.extra === 'double') parts.push(barrel(s.b, s.r, front + s.b / 2, 0.07 - s.r * 2.1));
  }
  if (s.hand) parts.push(piece(box(Math.min(0.26, s.b * 0.6 + 0.08), s.h * 0.8, 0.08), s.hand, { position: [front + 0.06, 0.05, 0] }));
  // Empuñadura
  parts.push(piece(box(0.07, 0.15, 0.05), s.grip ?? DARK, { position: [0, -0.04, 0], rotation: [0, 0, 0.2] }));
  // Cargador
  const mx = s.mag === 'bullpup' ? -0.12 : s.L * 0.35;
  if (s.mag === 'box' || s.mag === 'bullpup') parts.push(piece(box(0.07, 0.18, 0.05), DARK, { position: [mx, -0.08, 0] }));
  if (s.mag === 'curved') parts.push(piece(box(0.07, 0.2, 0.05), s.body === STEEL ? '#8a4b1f' : DARK, { position: [mx + 0.03, -0.09, 0], rotation: [0, 0, -0.35] }));
  if (s.mag === 'drum') parts.push(piece(box(0.16, 0.14, 0.12), OLIVE, { position: [mx, -0.08, 0.04] }));
  if (s.mag === 'drumgl') parts.push(piece(cylinder(0.08, 0.08, 0.12, 8), DARK, { position: [0.12, 0.04, 0], rotation: [0, 0, Math.PI / 2] }));
  if (s.mag === 'tube') parts.push(barrel(s.b * 0.75, s.r * 0.8, front + s.b * 0.38, 0.07 - s.r * 2));
  if (s.mag === 'fixed') parts.push(piece(box(0.1, 0.05, 0.05), DARK, { position: [mx, -0.01, 0] }));
  // Culata
  if (s.stock > 0) {
    const color = s.stockKind === 'wood' ? WOOD : s.stockKind === 'thumb' ? s.body : DARK;
    if (s.stockKind === 'skeleton' || s.stockKind === 'folded') {
      parts.push(piece(box(s.stock, 0.02, 0.03), DARK, { position: [-0.08 - s.stock / 2, 0.09, 0] }));
      parts.push(piece(box(s.stock, 0.02, 0.03), DARK, { position: [-0.08 - s.stock / 2, 0.01, 0] }));
      parts.push(piece(box(0.03, 0.1, 0.05), DARK, { position: [-0.08 - s.stock, 0.05, 0] }));
    } else {
      parts.push(piece(box(s.stock, 0.1, 0.06), color, { position: [-0.08 - s.stock / 2, 0.03, 0] }));
      if (s.stockKind === 'thumb') parts.push(piece(box(0.06, 0.05, 0.065), DARK, { position: [-0.14, 0.04, 0] }));
    }
  }
  // Detalles propios
  if (s.extra === 'carry') parts.push(piece(box(0.16, 0.04, 0.03), DARK, { position: [0.18, top, 0] }));
  if (s.extra === 'square') parts.push(piece(box(s.L * 0.9, 0.025, 0.072), DARK, { position: [s.L / 2 - 0.09, 0.105, 0] }));
  if (s.extra === 'optic') parts.push(barrel(0.2, 0.035, 0.2, top + 0.02, DARK));
  if (s.extra === 'pump') parts.push(piece(box(0.16, 0.06, 0.09), s.hand, { position: [front + 0.2, 0.03, 0] }));
  if (s.extra === 'bolt') parts.push(piece(box(0.03, 0.03, 0.08), STEEL, { position: [0.08, 0.1, 0.05] }));
  if (s.extra === 'bipod') for (const z of [-0.05, 0.05]) parts.push(piece(box(0.02, 0.18, 0.02), DARK, { position: [front + s.b * 0.7, -0.04, z], rotation: [0, 0, 0.3] }));
  if (s.extra === 'rocket') {
    parts.push(barrel(0.9, 0.055, 0.3, 0.12, OLIVE));
    parts.push(piece(cylinder(0, 0.08, 0.18, 7), '#6b6b5a', { position: [0.82, 0.12, 0], rotation: [0, 0, -Math.PI / 2] }));
  }
  if (s.extra === 'bow') {
    parts.push(piece(box(0.04, 0.03, 0.62), WOOD, { position: [s.L - 0.1, 0.08, 0] }));
    parts.push(piece(box(0.4, 0.008, 0.008), '#ddd6c0', { position: [s.L / 2 - 0.08, 0.1, 0] }));
  }
  if (s.extra === 'gl') parts.push(piece(box(0.1, 0.04, 0.04), STEEL, { position: [0.1, top, 0] }));
  if (s.extra === 'bayonet') parts.push(piece(box(0.18, 0.015, 0.02), '#c8c8c8', { position: [front + s.b + 0.06, 0.03, 0] }));
  if (s.extra === 'brake') parts.push(piece(box(0.08, 0.06, 0.06), DARK, { position: [front + s.b + 0.02, 0.07, 0] }));
  if (s.carry) parts.push(piece(box(0.2, 0.05, 0.03), DARK, { position: [0.2, top + 0.01, 0] }));
  // Mira telescópica: más larga y gruesa cuanto más lejos tira (1 tirador, 2–3 francotirador)
  if (s.scope) {
    const len = 0.16 + s.scope * 0.06;
    const rad = 0.03 + s.scope * 0.008;
    parts.push(barrel(len, rad, s.L * 0.3, top + 0.04, DARK));
    parts.push(piece(box(0.03, 0.04, 0.03), DARK, { position: [s.L * 0.3, top - 0.01, 0] }));
    parts.push(barrel(0.012, rad * 0.8, s.L * 0.3 + len / 2, top + 0.04, '#7dd3fc'));
  }
  // Legendarias: franjas doradas
  if (s.gold) parts.push(piece(box(0.05, s.h + 0.02, 0.075), GOLD, { position: [s.L * 0.6 - 0.08, 0.06, 0] }));
  return parts;
}

// Lanzables: fragmentación, humo, aturdidora, molotov, sensor, muro y UAV
const THROWN = {
  frag: () => [
    piece(cylinder(0.08, 0.08, 0.16, 8), OLIVE),
    piece(cylinder(0.05, 0.08, 0.05, 8), OLIVE, { position: [0, 0.1, 0] }),
    piece(box(0.03, 0.12, 0.03), STEEL, { position: [0.06, 0.06, 0] }),
  ],
  smoke: () => [piece(cylinder(0.065, 0.065, 0.22, 8), '#8d9196'), piece(cylinder(0.066, 0.066, 0.04, 8), '#e5e7eb', { position: [0, 0.06, 0] })],
  flash: () => [piece(cylinder(0.06, 0.06, 0.2, 8), DARK), piece(cylinder(0.062, 0.062, 0.05, 8), '#f8fafc', { position: [0, 0.02, 0] })],
  molotov: () => [piece(cylinder(0.06, 0.07, 0.2, 7), '#3f7d3f'), piece(cylinder(0.025, 0.04, 0.08, 6), '#3f7d3f', { position: [0, 0.13, 0] }), piece(box(0.04, 0.08, 0.03), '#e8dcc0', { position: [0, 0.2, 0] })],
  sensor: () => [piece(box(0.14, 0.08, 0.14), '#2f3b45'), piece(cylinder(0.01, 0.01, 0.22, 4), STEEL, { position: [0.03, 0.14, 0] }), piece(box(0.04, 0.02, 0.04), '#ef4444', { position: [0.03, 0.26, 0] })],
  wall: () => [piece(cylinder(0.07, 0.07, 0.2, 8), '#38bdf8'), piece(cylinder(0.072, 0.072, 0.03, 8), '#e0f2fe', { position: [0, 0.07, 0] })],
  uav: () => [piece(box(0.18, 0.04, 0.18), DARK), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => piece(cylinder(0.05, 0.05, 0.01, 8), STEEL, { position: [sx * 0.1, 0.03, sz * 0.1] })))],
};

const BUILDERS = {
  // Puños (Gulag sin aciertos): solo una venda en la mano
  fists: () => [piece(box(0.1, 0.09, 0.12), '#d8cfb8', { position: [0.02, 0, 0] })],
  // Armas blancas (7A): mango en la mano, hoja hacia +x
  knife: () => [
    piece(box(0.11, 0.035, 0.03), '#3a2a1a', { position: [0, 0, 0] }),
    piece(box(0.02, 0.06, 0.05), '#6b6f5a', { position: [0.065, 0, 0] }),
    piece(box(0.17, 0.03, 0.008), '#c9ccd1', { position: [0.16, 0.004, 0] }),
  ],
  // Patecabra: navaja de punta larga y fina, cachas claras con remaches
  patecabra: () => [
    piece(box(0.12, 0.03, 0.026), '#d6c7a1', { position: [0, 0, 0] }),
    piece(box(0.02, 0.02, 0.03), '#b8912a', { position: [-0.03, 0, 0] }),
    piece(box(0.02, 0.02, 0.03), '#b8912a', { position: [0.03, 0, 0] }),
    piece(box(0.2, 0.022, 0.006), '#e2e5ea', { position: [0.16, 0.003, 0] }),
    piece(box(0.05, 0.012, 0.006), '#e2e5ea', { position: [0.285, 0.003, 0] }),
  ],
  // Machete: hoja ancha y larga, mango negro
  machete: () => [
    piece(box(0.13, 0.04, 0.035), '#1c1d1f', { position: [0, 0, 0] }),
    piece(box(0.46, 0.07, 0.008), '#a7abb0', { position: [0.3, 0.012, 0] }),
    piece(box(0.08, 0.05, 0.008), '#a7abb0', { position: [0.56, 0.02, 0], rotation: [0, 0, 0.25] }),
  ],
  // Katana: tsuka con ito, tsuba redonda y hoja larga apenas curva
  katana: () => [
    piece(box(0.24, 0.035, 0.03), '#2b2b4a', { position: [-0.02, 0, 0] }),
    piece(cylinder(0.05, 0.05, 0.012, 10), '#b8912a', { position: [0.11, 0, 0], rotation: [0, 0, Math.PI / 2] }),
    piece(box(0.4, 0.028, 0.007), '#d9dde3', { position: [0.32, 0.004, 0] }),
    piece(box(0.38, 0.026, 0.007), '#d9dde3', { position: [0.7, 0.016, 0], rotation: [0, 0, 0.06] }),
  ],
  ...Object.fromEntries(Object.entries(SPECS).map(([id, s]) => [id, () => gun(s)])),
  ...THROWN,
  grenade: THROWN.frag,
  // Proyectiles en vuelo
  rocket: () => [barrel(0.5, 0.05, 0, 0, OLIVE), piece(cylinder(0, 0.06, 0.16, 7), '#6b6b5a', { position: [0.32, 0, 0], rotation: [0, 0, -Math.PI / 2] })],
  lob: () => [piece(cylinder(0.05, 0.05, 0.1, 8), '#6b6b5a', { rotation: [0, 0, Math.PI / 2] })],
};

// Puntos de montaje de los accesorios (gear.js): boca del cañón, riel de la mira, fin de la culata y cargador
export function weaponMounts(id) {
  const s = SPECS[id];
  if (!s) return null;
  const front = s.L - 0.08;
  return {
    muzzle: front + s.b,
    rail: [s.L * 0.3, s.h / 2 + 0.08],
    stockEnd: s.stock > 0 ? -0.08 - s.stock : null,
    mag: [s.mag === 'bullpup' ? -0.12 : s.L * 0.35, -0.12],
  };
}

const cache = new Map();

// Geometría fusionada de un arma o lanzable por id ('m4a1', 'frag', …)
export function weaponGeometry(id) {
  if (!cache.has(id)) cache.set(id, merge((BUILDERS[id] ?? BUILDERS.m1911)()));
  return cache.get(id);
}
