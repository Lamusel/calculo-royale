import { hasLineOfSight } from './collision.js';

// Lógica de combate que comparten servidor (verdad) y cliente (efectos predichos).

// Ángulos de cada bala. La escopeta reparte sus perdigones en abanico; las demás armas
// desvían cada bala al azar dentro de su dispersión.
export function pelletAngles(weapon, aim, random = Math.random) {
  if (weapon.pellets === 1) return [aim + (random() * 2 - 1) * weapon.spread];
  const angles = [];
  const step = weapon.spread / (weapon.pellets - 1);
  for (let i = 0; i < weapon.pellets; i++) {
    angles.push(aim - weapon.spread / 2 + i * step + (random() * 2 - 1) * step * 0.3);
  }
  return angles;
}

// Enemigo visible más cercano dentro del alcance (auto apuntado del toque rápido).
// candidates: iterable de { id, x, y }. Devuelve el candidato o null.
export function findAutoTarget(x, y, range, candidates) {
  let best = null;
  let bestDist = range;
  for (const c of candidates) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d > bestDist || d < 1e-6) continue;
    if (!hasLineOfSight(x, y, c.x, c.y)) continue;
    best = c;
    bestDist = d;
  }
  return best;
}
