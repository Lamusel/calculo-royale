import { PATHS, ROADS } from '@calculo-royale/shared/mapLayout';

const ALL = [...PATHS, ...ROADS];

// Distancia de un punto al segmento AB
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Distancia al camino de tierra más cercano (solo visual: terreno y decoración)
export function distanceToPaths(x, y, paths = ALL) {
  let best = Infinity;
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      best = Math.min(best, segmentDistance(x, y, ax, ay, bx, by));
    }
  }
  return best;
}
