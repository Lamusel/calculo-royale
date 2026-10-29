import { DESTRUCTIBLE_HP, DESTRUCTIBLES } from '@calculo-royale/shared/mapLayout';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { explode } from './combat.js';

// Destrucción ligera (6.5): balas y explosiones rompen cajas de madera, barriles y cercas. Lo roto sale
// de la colisión (o.broken, compartido con el cliente) y los barriles rojos explotan como una granada.

// Cada sala guarda lo suyo en game.broken (Set de destId); o.broken (compartido con la colisión) se pone
// desde ahí al empezar cada ciclo de la sala (syncProps)
const brokenIds = (game) => [...(game.broken ?? [])];
export function syncProps(game) {
  const set = game.broken ?? EMPTY;
  for (const o of DESTRUCTIBLES) o.broken = set.has(o.destId);
}
const EMPTY = new Set();

export function resetProps(game) {
  const had = game.broken?.size > 0;
  game.broken = new Set();
  for (const o of DESTRUCTIBLES) o.broken = false;
  game.propHp = new Map();
  if (had) game.room.broadcast?.(EVENTS.PROPS_BROKEN, []);
}

// Daño a un objeto (si se puede romper); devuelve true si lo era
export function damageProp(game, o, amount, ownerId = null) {
  if (!o || o.broken || o.destId === undefined || game.room.phase !== 'playing') return false;
  game.propHp ??= new Map();
  const hp = (game.propHp.get(o.destId) ?? DESTRUCTIBLE_HP[o.kind]) - amount;
  game.propHp.set(o.destId, hp);
  if (hp > 0) return true;
  o.broken = true;
  (game.broken ??= new Set()).add(o.destId);
  game.room.broadcast(EVENTS.PROPS_BROKEN, brokenIds(game));
  if (o.red) explode(game, { kind: 'frag', x: o.x, y: o.y, ownerId });
  return true;
}

// Explosión: daña lo rompible en el radio (los barriles rojos encadenan)
export function blastProps(game, x, y, radius, damage, ownerId) {
  if (game.room.phase !== 'playing') return;
  for (const o of DESTRUCTIBLES) {
    if (o.broken) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d <= radius) damageProp(game, o, damage * (1 - 0.6 * (d / radius)), ownerId);
  }
}
