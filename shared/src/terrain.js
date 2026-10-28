import { TERRAIN } from './constants.js';
import { BRIDGES, DAM, FORD, MOUNTAINS, RESERVOIR, RIVER, riverY } from './mapPlan.js';

// Superficie del mapa: z = f(x, y). Solo interna: da la altura del terreno y,
// con su gradiente, el factor de velocidad según la pendiente.
// f = colinas suaves + lomas amplias + montaña al noreste, con el cauce del río y el embalse
// hundidos y la represa nivelada. Los puentes (correcciones 6.2) son una sola función continua:
// tablero elevado sobre el agua y rampas en terraplén que bajan suave hasta el terreno.

const { amplitude: A, scale: K } = TERRAIN;
export const WATER_LEVEL = -0.6;
const BED = -2.4; // fondo del cauce
const FORD_BED = -0.95; // vado: el agua llega a la rodilla
const DECK = 0.4; // represa
// Puentes: tablero a 2,2 m (las lanchas pasan por debajo) sobre el agua y rampas hasta las puntas
export const BRIDGE_DECK = 2.2;
export const BRIDGE_SPAN = RIVER.halfWidth + 1.5; // medio largo del tramo elevado sobre el agua
const TALUD = 5; // ancho de los taludes de tierra a los lados de las rampas

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// Peso del cauce en (x, y): 1 en el agua, 0 pasada la orilla
function channel(x, y) {
  if (x < DAM.x) {
    const d = Math.hypot((x - RESERVOIR.x) / RESERVOIR.rx, (y - RESERVOIR.y) / RESERVOIR.ry);
    return 1 - smooth((d - 0.92) / 0.25);
  }
  const d = Math.abs(y - riverY(x));
  return 1 - smooth((d - RIVER.halfWidth + 1) / RIVER.bank);
}

// Peso de un rectángulo con borde suave (represa)
function flat(r, x, y, fade) {
  const dx = Math.abs(x - r.x) - r.w / 2;
  const dy = Math.abs(y - r.y) - r.h / 2;
  return 1 - smooth(Math.max(dx, dy) / fade + 1);
}

// Terreno natural (sin puentes)
function natural(x, y) {
  let h = A * Math.sin(x / K) * Math.cos(y / K) + 2.5 * Math.sin(x / 97 + 1) * Math.cos(y / 83);
  for (const m of MOUNTAINS) {
    const d2 = (x - m.x) ** 2 + (y - m.y) ** 2;
    if (d2 < 9 * m.sigma * m.sigma) h += m.height * Math.exp(-d2 / (2 * m.sigma * m.sigma));
  }
  // El río solo existe cerca de su curva (ahorra cuentas en el resto del mapa)
  if (Math.abs(y - riverY(x)) < RIVER.halfWidth + RIVER.bank + 2 || x < DAM.x + 4) {
    const w = channel(x, y);
    if (w > 0) {
      const bed = Math.abs(x - FORD.x) < FORD.w / 2 ? FORD_BED : BED;
      h += (bed - h) * w;
    }
    const f = flat(DAM, x, y, 3);
    if (f > 0) h += (DECK - h) * f;
  }
  return h;
}

// Altura de cada punta del puente (donde la rampa toca el terreno): fija por puente
const ENDS = BRIDGES.map((b) => ({ n: natural(b.x, b.y + b.h / 2), s: natural(b.x, b.y - b.h / 2) }));

// Perfil del puente a lo largo de su eje: tablero sobre el agua y rampa suave a cada lado
function profile(i, y) {
  const b = BRIDGES[i];
  const along = Math.abs(y - b.y);
  if (along <= BRIDGE_SPAN) return BRIDGE_DECK;
  const end = y > b.y ? ENDS[i].n : ENDS[i].s;
  return BRIDGE_DECK + (end - BRIDGE_DECK) * smooth((along - BRIDGE_SPAN) / (b.h / 2 - BRIDGE_SPAN));
}

// Puente cercano: { i, dx (distancia al eje), along } o null
function bridgeNear(x, y) {
  for (let i = 0; i < BRIDGES.length; i++) {
    const b = BRIDGES[i];
    const dx = Math.abs(x - b.x);
    const along = Math.abs(y - b.y);
    if (dx <= b.w / 2 + TALUD && along <= b.h / 2) return { i, dx, along, b };
  }
  return null;
}

// deck: true = superficie para caminar y conducir (incluye el tablero); false = malla del terreno
// (bajo el tramo elevado se ve el agua)
function surface(x, y, deck) {
  const h = natural(x, y);
  const near = bridgeNear(x, y);
  if (!near) return h;
  const top = profile(near.i, y);
  const inside = near.dx <= near.b.w / 2;
  if (near.along <= BRIDGE_SPAN) return inside && deck ? top : h;
  // Rampas: terraplén con taludes a los lados
  if (inside) return Math.max(h, top);
  return Math.max(h, top - (near.dx - near.b.w / 2) * ((top - h) / TALUD + 0.2));
}

export const terrainHeight = (x, y) => surface(x, y, true);
export const groundMeshHeight = (x, y) => surface(x, y, false);

// ¿Está sobre un puente o sus rampas? (los vehículos se deslizan contra las barandas sin daño)
export const onBridgeArea = (x, y, margin = 0) => BRIDGES.some((b) => Math.abs(x - b.x) <= b.w / 2 + margin && Math.abs(y - b.y) <= b.h / 2 + margin);

// ∇f = (∂f/∂x, ∂f/∂y) por diferencias centrales
const E = 0.25;
export function terrainGradient(x, y) {
  return [
    (terrainHeight(x + E, y) - terrainHeight(x - E, y)) / (2 * E),
    (terrainHeight(x, y + E) - terrainHeight(x, y - E)) / (2 * E),
  ];
}
