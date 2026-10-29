import { AREAS } from '@calculo-royale/shared/mapPlan';

// Halloween y Navidad (7A): siempre activas, cada una en su lado del mapa para que no se mezclen.
// themeAt(x, y): 'halloween' | 'christmas' | null (con 40 m de alrededores)
export const HALLOWEEN_AREAS = ['cemetery', 'forest', 'farm', 'sawmill'];
export const CHRISTMAS_AREAS = ['city', 'market', 'suburb', 'university', 'terminal'];
const MARGIN = 40;

const inside = (a, x, y, margin) => Math.abs(x - a.x) < a.w / 2 + margin && Math.abs(y - a.y) < a.h / 2 + margin;
export function themeAt(x, y) {
  if (HALLOWEEN_AREAS.some((id) => inside(AREAS[id], x, y, MARGIN))) return 'halloween';
  if (CHRISTMAS_AREAS.some((id) => inside(AREAS[id], x, y, MARGIN))) return 'christmas';
  return null;
}

// Números pseudoaleatorios con semilla (la decoración es la misma para todos y en cada partida)
export function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
