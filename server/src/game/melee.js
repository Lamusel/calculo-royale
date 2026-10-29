import { isMelee, MELEE, PLAYER_RADIUS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { hasLineOfSight } from '@calculo-royale/shared/collision';
import { DESTRUCTIBLES } from '@calculo-royale/shared/mapLayout';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { encodeShot } from '@calculo-royale/shared/codec';
import { damageTarget, targetsAt } from './combat.js';
import { damageProp } from './destruction.js';

// Cuerpo a cuerpo (7A): siempre disponible (V, "Golpear" o los puños en la mano en el Gulag). Usa el
// arma blanca de su ranura o, sin ella, los puños. Validado aquí: cadencia, alcance, cono al frente y
// línea de vista. Por la espalda pega más; el chaleco absorbe menos (combat.js: { melee: true }).

export const meleeWeaponOf = (p) => (isMelee(p.weaponId) && p.weaponId !== 'fists' ? p.weaponId : p.melee ?? 'fists');

export function meleeAttack(game, p, aim = p.aim, viewTick = game.tick, auto = false) {
  if (!p.alive || p.deploying || p.downed || p.reviving || p.frozen || p.question || p.engineQuestion || p.vehicleId !== null || p.zip) return false;
  if (game.now < (p.meleeReadyAt ?? 0)) return false;
  const id = meleeWeaponOf(p);
  const w = WEAPONS[id];
  p.meleeReadyAt = game.now + w.intervalMs;
  p.nextFireAt = Math.max(p.nextFireAt ?? 0, game.now + 200);
  p.healing = null;
  p.meleeAt = game.now;
  p.meleeWeapon = id;
  const targets = targetsAt(game, p, viewTick);
  // Auto (toque en celular): hacia el más cercano al alcance
  if (auto) {
    const near = targets.filter((t) => Math.hypot(t.x - p.x, t.y - p.y) <= w.range + PLAYER_RADIUS).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (near) aim = Math.atan2(near.y - p.y, near.x - p.x);
  }
  p.aim = aim;
  const dx = Math.cos(aim);
  const dy = Math.sin(aim);
  const index = WEAPON_IDS.indexOf(id);
  const hits = targets
    .map((t) => ({ t, d: Math.hypot(t.x - p.x, t.y - p.y) }))
    .filter(({ t, d }) => d <= w.range + (t.radius ?? PLAYER_RADIUS) && (d < 0.3 || ((t.x - p.x) * dx + (t.y - p.y) * dy) / d >= MELEE.arcCos) && hasLineOfSight(p.x, p.y, t.x, t.y))
    .sort((a, b) => a.d - b.d)
    .slice(0, w.arc ?? 1);
  for (const { t, d } of hits) {
    let amount = w.damage;
    // Por la espalda: el otro mira hacia el mismo lado que el golpe
    const q = t.player;
    if (q && d > 0.01 && Math.cos(q.aim) * ((q.x - p.x) / d) + Math.sin(q.aim) * ((q.y - p.y) / d) > MELEE.backCos) amount *= w.backstab ?? 1;
    const { dealt, killed } = damageTarget(game, t, amount, p.id, index, { melee: true });
    game.room.emitTo(p, EVENTS.COMBAT_HIT, [t.id, Math.round(dealt), t.x, t.y, killed ? 1 : 0]);
  }
  // Sin nadie al alcance: lo rompible del frente (el machete corta cercas y madera de un golpe)
  if (!hits.length) {
    const prop = DESTRUCTIBLES.find((o) => !o.broken && Math.hypot(o.x - p.x, o.y - p.y) <= w.range + 0.9 && ((o.x - p.x) * dx + (o.y - p.y) * dy) > 0);
    if (prop) damageProp(game, prop, w.cutsWood ? 1e4 : w.damage, p.id);
  }
  game.shots.push(encodeShot(p.id, index, p.x, p.y, [{ angle: aim, dist: w.range }], true));
  return true;
}
