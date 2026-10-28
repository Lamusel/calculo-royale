import { TERRAIN } from './constants.js';
import { BRIDGES, DAM, FORD, MOUNTAINS, RESERVOIR, RIVER, riverY } from './mapPlan.js';

// Superficie del mapa: z = f(x, y). Solo interna: da la altura del terreno y,
// con su gradiente, el factor de velocidad según la pendiente.
// f = colinas suaves + lomas amplias + montaña al noreste, con el cauce del río y el embalse
// hundidos y los puentes y la represa nivelados.

const { amplitude: A, scale: K } = TERRAIN;
export const WATER_LEVEL = -0.6;
const BED = -2.4; // fondo del cauce
const FORD_BED = -0.95; // vado: el agua llega a la rodilla
const DECK = 0.4; // puentes y represa

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

// Peso de un rectángulo con borde suave (puentes, represa)
function flat(r, x, y, fade) {
  const dx = Math.abs(x - r.x) - r.w / 2;
  const dy = Math.abs(y - r.y) - r.h / 2;
  return 1 - smooth(Math.max(dx, dy) / fade + 1);
}

export function terrainHeight(x, y) {
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
    for (const b of [...BRIDGES, DAM]) {
      const f = flat(b, x, y, 3);
      if (f > 0) h += (DECK - h) * f;
    }
  }
  return h;
}

// ∇f = (∂f/∂x, ∂f/∂y) por diferencias centrales
const E = 0.25;
export function terrainGradient(x, y) {
  return [
    (terrainHeight(x + E, y) - terrainHeight(x - E, y)) / (2 * E),
    (terrainHeight(x, y + E) - terrainHeight(x, y - E)) / (2 * E),
  ];
}
