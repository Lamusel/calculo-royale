import { OBSTACLES } from './mapLayout.js';

// Colisiones 2D contra los obstáculos fijos del mapa. Rejilla espacial de celdas de CELL m:
// cada consulta revisa solo los obstáculos de las celdas que toca (el mapa grande tiene más
// de mil entre paredes, muebles, árboles y sacos de arena).

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const BOXES = OBSTACLES.map((o) =>
  o.shape === 'rect'
    ? { o, minX: o.x - o.w / 2, maxX: o.x + o.w / 2, minY: o.y - o.h / 2, maxY: o.y + o.h / 2 }
    : { o, minX: o.x - o.r, maxX: o.x + o.r, minY: o.y - o.r, maxY: o.y + o.r },
);

const CELL = 8;
const cellOf = (v) => Math.floor(v / CELL);
const key = (cx, cy) => (cx + 1000) * 4096 + (cy + 1000);
const GRID = new Map();
BOXES.forEach((b, i) => {
  for (let cx = cellOf(b.minX); cx <= cellOf(b.maxX); cx++) {
    for (let cy = cellOf(b.minY); cy <= cellOf(b.maxY); cy++) {
      const k = key(cx, cy);
      if (!GRID.has(k)) GRID.set(k, []);
      GRID.get(k).push(i);
    }
  }
});

// Obstáculos cuyas celdas tocan el rectángulo (sin repetir). El arreglo se reutiliza.
const seen = new Uint32Array(BOXES.length);
let stamp = 0;
const found = [];
function candidates(minX, minY, maxX, maxY) {
  stamp++;
  found.length = 0;
  for (let cx = cellOf(minX); cx <= cellOf(maxX); cx++) {
    for (let cy = cellOf(minY); cy <= cellOf(maxY); cy++) {
      const list = GRID.get(key(cx, cy));
      if (!list) continue;
      for (const i of list) {
        if (seen[i] === stamp) continue;
        seen[i] = stamp;
        if (BOXES[i].o.broken) continue; // destrucción ligera: ya no choca
        found.push(BOXES[i]);
      }
    }
  }
  return found;
}

const touchesBox = (b, x, y, r) => x + r > b.minX && x - r < b.maxX && y + r > b.minY && y - r < b.maxY;

// Empuja un círculo (pos: { x, y }) fuera de los obstáculos. Modifica pos.
export function resolveCircle(pos, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of DYNAMIC) {
      const dx = pos.x - o.x;
      const dy = pos.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = r + o.r;
      if (d < min && d > 1e-6) {
        pos.x = o.x + (dx / d) * min;
        pos.y = o.y + (dy / d) * min;
      }
    }
    for (const b of candidates(pos.x - r, pos.y - r, pos.x + r, pos.y + r)) {
      if (!touchesBox(b, pos.x, pos.y, r)) continue;
      const o = b.o;
      if (o.shape === 'circle') {
        const dx = pos.x - o.x;
        const dy = pos.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = r + o.r;
        if (d >= min) continue;
        if (d > 1e-6) {
          pos.x = o.x + (dx / d) * min;
          pos.y = o.y + (dy / d) * min;
        } else {
          pos.x = o.x + min;
        }
        continue;
      }
      const cx = clamp(pos.x, b.minX, b.maxX);
      const cy = clamp(pos.y, b.minY, b.maxY);
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1e-12) {
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.y = cy + (dy / d) * r;
      } else {
        // El centro quedó dentro del rectángulo: sale por el lado más cercano
        const left = pos.x - b.minX;
        const right = b.maxX - pos.x;
        const down = pos.y - b.minY;
        const up = b.maxY - pos.y;
        const m = Math.min(left, right, down, up);
        if (m === left) pos.x = b.minX - r;
        else if (m === right) pos.x = b.maxX + r;
        else if (m === down) pos.y = b.minY - r;
        else pos.y = b.maxY + r;
      }
    }
  }
}

export function overlapsObstacle(x, y, r) {
  for (const o of DYNAMIC) if (Math.hypot(x - o.x, y - o.y) < r + o.r) return true;
  for (const b of candidates(x - r, y - r, x + r, y + r)) {
    if (!touchesBox(b, x, y, r)) continue;
    const o = b.o;
    if (o.shape === 'circle') {
      if (Math.hypot(x - o.x, y - o.y) < r + o.r) return true;
    } else {
      const dx = x - clamp(x, b.minX, b.maxX);
      const dy = y - clamp(y, b.minY, b.maxY);
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// Distancia t ≥ 0 a la que el rayo (x, y) + t·(dx, dy) entra al círculo; Infinity si no lo toca.
// (dx, dy) debe ser unitario. Si el origen está dentro, devuelve 0.
export function rayCircle(x, y, dx, dy, cx, cy, r) {
  const ox = x - cx;
  const oy = y - cy;
  const b = ox * dx + oy * dy;
  const c = ox * ox + oy * oy - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (disc < 0 || b > 0) return Infinity;
  return -b - Math.sqrt(disc);
}

function rayBox(x, y, dx, dy, b) {
  let tMin = -Infinity;
  let tMax = Infinity;
  for (const [o, d, min, max] of [
    [x, dx, b.minX, b.maxX],
    [y, dy, b.minY, b.maxY],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (o < min || o > max) return Infinity;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  if (tMax < 0) return Infinity;
  return Math.max(tMin, 0);
}

// Distancia hasta el primer obstáculo en la dirección unitaria (dx, dy), o maxDist si no hay
// lastRayHit(): el obstáculo fijo donde se detuvo el último rayo (o null), para romperlo
let lastHit = null;
export const lastRayHit = () => lastHit;
export function raycastObstacles(x, y, dx, dy, maxDist) {
  let best = maxDist;
  lastHit = null;
  for (const o of DYNAMIC) best = Math.min(best, rayCircle(x, y, dx, dy, o.x, o.y, o.r));
  const ex = x + dx * maxDist;
  const ey = y + dy * maxDist;
  const minX = Math.min(x, ex);
  const maxX = Math.max(x, ex);
  const minY = Math.min(y, ey);
  const maxY = Math.max(y, ey);
  for (const b of candidates(minX, minY, maxX, maxY)) {
    if (b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY) continue;
    const o = b.o;
    const t = o.shape === 'circle' ? rayCircle(x, y, dx, dy, o.x, o.y, o.r) : rayBox(x, y, dx, dy, b);
    if (t < best) {
      best = t;
      lastHit = o;
    }
  }
  return best;
}

export function hasLineOfSight(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d < 1e-6) return true;
  return raycastObstacles(x1, y1, (x2 - x1) / d, (y2 - y1) / d, d) >= d - 1e-3;
}

// --- Obstáculos dinámicos (fase 29): las piezas de las granadas muro ---
// Círculos { x, y, r } que se revisan además de la rejilla fija. El servidor los fija al crear o
// romper un muro; el cliente, con cada snapshot (para predecir el movimiento igual).
let DYNAMIC = [];
export function setDynamicObstacles(circles) {
  DYNAMIC = circles;
}
export const dynamicObstacles = () => DYNAMIC;
