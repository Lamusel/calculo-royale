import {
  GRENADE, LAG_COMP_MAX_MS, MAP_HALF, PLAYER_RADIUS, TICK_MS, WEAPON_IDS, WEAPONS,
} from '@calculo-royale/shared/constants';
import { BUTTONS, dummyTargetId, EVENTS } from '@calculo-royale/shared/protocol';
import { encodeShot } from '@calculo-royale/shared/codec';
import { hasLineOfSight, overlapsObstacle, raycastObstacles, rayCircle } from '@calculo-royale/shared/collision';
import { findAutoTarget, pelletAngles } from '@calculo-royale/shared/combat';
import { JEEP } from '@calculo-royale/shared/constants';
import { VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { damageVehicle, vehicleTargetId } from './vehicles.js';

// Margen extra del radio de impacto: hace los disparos un poco más indulgentes
const HIT_LENIENCY = 0.15;
const GRENADE_RADIUS = 0.2;
const GRENADE_INDEX = WEAPON_IDS.indexOf('grenade');
const MAX_REWIND_TICKS = LAG_COMP_MAX_MS / TICK_MS;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Objetivos posibles para un disparo, en las posiciones que el tirador estaba viendo
export function targetsAt(game, shooter, viewTick) {
  const tick = clamp(viewTick, game.tick - MAX_REWIND_TICKS, game.tick);
  const targets = [];
  for (const p of game.room.players.values()) {
    if (p === shooter || !p.alive) continue;
    const pos = p.positionAt(tick);
    targets.push({ id: p.id, x: pos.x, y: pos.y, player: p });
  }
  if (game.room.phase === 'lobby') {
    game.dummies.forEach((d, i) => targets.push({ id: dummyTargetId(i), x: d.x, y: d.y, dummy: d }));
  }
  // Jeeps (sin compensación de lag); el propio no cuenta: el pasajero dispara desde adentro
  if (game.room.phase === 'playing') {
    for (const v of game.vehicles) {
      if (v.state === VEHICLE_STATE.DESTROYED || v.id === shooter?.vehicleId) continue;
      targets.push({ id: vehicleTargetId(v.id), x: v.x, y: v.y, vehicle: v, radius: JEEP.radius });
    }
  }
  return targets;
}

export function startReload(game, p) {
  const w = WEAPONS[p.weaponId];
  if (p.reloadUntil || p.mag >= w.magazine || p.reserve <= 0) return;
  p.reloadUntil = game.now + w.reloadMs;
}

export function finishReload(p) {
  const w = WEAPONS[p.weaponId];
  const take = Math.min(w.magazine - p.mag, p.reserve);
  p.mag += take;
  if (p.weaponId !== 'pistol') p.primary.reserve -= take;
  p.reloadUntil = 0;
}

export function switchWeapon(game, p, slot) {
  if (slot === p.slot || (slot === 2 && !p.primary) || ![1, 2].includes(slot)) return;
  p.slot = slot;
  p.reloadUntil = 0;
  p.nextFireAt = Math.max(p.nextFireAt, game.now + 250);
}

// Jugadores vivos (y conectados) en la partida: decide la posición final y la victoria
export function aliveCount(game) {
  let n = 0;
  for (const p of game.room.players.values()) if (p.alive && p.connected) n++;
  return n;
}

// Aplica daño (primero al chaleco, salvo ignoreArmor). Devuelve { dealt, killed }.
export function damagePlayer(game, target, amount, attackerId, weaponIndex, { ignoreArmor = false } = {}) {
  if (!target.alive) return { dealt: 0, killed: false };
  const absorbed = ignoreArmor ? 0 : Math.min(target.armor, amount);
  target.armor -= absorbed;
  if (target.armor <= 0 && target.armorLevel > 0) {
    target.armor = 0;
    target.armorLevel = 0;
  }
  const toHp = amount - absorbed;
  target.hp -= toHp;
  if (target.hp > 0) return { dealt: amount, killed: false };

  target.hp = 0;
  target.alive = false;
  target.deathAt = game.now;
  target.killedBy = attackerId;
  target.killedWith = weaponIndex;
  target.reloadUntil = 0;
  // Posición final: los que siguen vivos + 1
  if (game.room.phase === 'playing') target.place = aliveCount(game) + 1;
  game.onPlayerDeath?.(target);
  const attacker = game.room.players.get(attackerId);
  if (attacker && attacker !== target) attacker.kills++;
  game.kills.push([attackerId, target.id, weaponIndex]);
  return { dealt: amount, killed: true };
}

function damageTarget(game, target, amount, attackerId, weaponIndex) {
  if (target.vehicle) {
    damageVehicle(game, target.vehicle, amount, attackerId);
    return { dealt: amount, killed: false };
  }
  if (target.dummy) {
    target.dummy.hp = Math.max(0, target.dummy.hp - amount);
    target.dummy.lastHitAt = game.now;
    return { dealt: amount, killed: false };
  }
  return damagePlayer(game, target.player, amount, attackerId, weaponIndex);
}

// Disparo hitscan con compensación de lag: los objetivos se ubican donde el tirador los veía
export function fire(game, p, input) {
  const id = p.weaponId;
  const w = WEAPONS[id];
  if (game.now < p.nextFireAt || p.reloadUntil) return;
  if (p.mag <= 0) {
    startReload(game, p);
    return;
  }
  p.nextFireAt = game.now + w.intervalMs;
  p.mag -= 1;

  const targets = targetsAt(game, p, input.viewTick);
  let aim = input.aim;
  if (input.buttons & BUTTONS.AUTO) {
    const target = findAutoTarget(p.x, p.y, w.range, targets);
    if (target) aim = Math.atan2(target.y - p.y, target.x - p.x);
    p.aim = aim;
  }

  const weaponIndex = WEAPON_IDS.indexOf(id);
  const damageByTarget = new Map();
  const pellets = pelletAngles(w, aim).map((angle) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let dist = raycastObstacles(p.x, p.y, dx, dy, w.range);
    let hit = null;
    for (const t of targets) {
      const d = rayCircle(p.x, p.y, dx, dy, t.x, t.y, t.radius ?? PLAYER_RADIUS + HIT_LENIENCY);
      if (d < dist) {
        dist = d;
        hit = t;
      }
    }
    if (hit) damageByTarget.set(hit, (damageByTarget.get(hit) ?? 0) + w.damage);
    return { angle, dist };
  });

  for (const [target, amount] of damageByTarget) {
    const { killed } = damageTarget(game, target, amount, p.id, weaponIndex);
    game.room.emitTo(p, EVENTS.COMBAT_HIT, [target.id, amount, target.x, target.y, killed ? 1 : 0]);
  }
  game.shots.push(encodeShot(p.id, weaponIndex, p.x, p.y, pellets));
  if (p.mag === 0) startReload(game, p);
}

export function throwGrenade(game, p, input) {
  if (p.grenades <= 0 || game.now < p.nextGrenadeAt) return;
  p.grenades -= 1;
  p.nextGrenadeAt = game.now + GRENADE.intervalMs;

  let aim = input.aim;
  let dist = input.aimDist || GRENADE.maxRange * 0.75;
  if (input.buttons & BUTTONS.AUTO) {
    const target = findAutoTarget(p.x, p.y, GRENADE.maxRange, targetsAt(game, p, input.viewTick));
    if (target) {
      aim = Math.atan2(target.y - p.y, target.x - p.x);
      dist = Math.hypot(target.x - p.x, target.y - p.y);
    }
    p.aim = aim;
  }
  dist = clamp(dist, GRENADE.minRange, GRENADE.maxRange);

  // Desaceleración constante: recorre `dist` y se detiene al cabo de flightMs
  const flight = GRENADE.flightMs / 1000;
  const speed = (2 * dist) / flight;
  game.grenades.push({
    id: game.nextGrenadeId++,
    ownerId: p.id,
    x: p.x + Math.cos(aim) * (PLAYER_RADIUS + 0.3),
    y: p.y + Math.sin(aim) * (PLAYER_RADIUS + 0.3),
    vx: Math.cos(aim) * speed,
    vy: Math.sin(aim) * speed,
    decel: speed / flight,
    explodeAt: game.now + GRENADE.fuseMs,
  });
}

function explode(game, g) {
  game.explosions.push([Math.round(g.x * 100) / 100, Math.round(g.y * 100) / 100]);
  const owner = game.room.players.get(g.ownerId);
  const hurt = (target, x, y) => {
    const d = Math.hypot(x - g.x, y - g.y);
    if (d > GRENADE.radius || !hasLineOfSight(g.x, g.y, x, y)) return;
    const amount = Math.round(GRENADE.damage * (1 - 0.8 * (d / GRENADE.radius)));
    const { killed } = damageTarget(game, target, amount, g.ownerId, GRENADE_INDEX);
    if (owner) game.room.emitTo(owner, EVENTS.COMBAT_HIT, [target.id, amount, x, y, killed ? 1 : 0]);
  };
  for (const p of game.room.players.values()) {
    if (p.alive) hurt({ id: p.id, player: p }, p.x, p.y);
  }
  if (game.room.phase === 'lobby') {
    game.dummies.forEach((d, i) => hurt({ id: dummyTargetId(i), dummy: d }, d.x, d.y));
  }
  if (game.room.phase === 'playing') {
    for (const v of game.vehicles) {
      if (v.state !== VEHICLE_STATE.DESTROYED) hurt({ id: vehicleTargetId(v.id), vehicle: v }, v.x, v.y);
    }
  }
}

// Mueve las granadas (rebotan en obstáculos) y detona las que cumplieron su tiempo
export function updateGrenades(game, dt) {
  const limit = MAP_HALF - GRENADE_RADIUS;
  game.grenades = game.grenades.filter((g) => {
    const speed = Math.hypot(g.vx, g.vy);
    // Tormenta de arena: el viento empuja las granadas mientras vuelan
    if (speed > 0 && game.wind) {
      g.vx += game.wind.x * dt;
      g.vy += game.wind.y * dt;
    }
    if (speed > 0) {
      const next = Math.max(0, speed - g.decel * dt);
      g.vx *= next / speed;
      g.vy *= next / speed;
      const nx = g.x + g.vx * dt;
      if (Math.abs(nx) > limit || overlapsObstacle(nx, g.y, GRENADE_RADIUS)) g.vx *= -0.5;
      else g.x = nx;
      const ny = g.y + g.vy * dt;
      if (Math.abs(ny) > limit || overlapsObstacle(g.x, ny, GRENADE_RADIUS)) g.vy *= -0.5;
      else g.y = ny;
    }
    if (game.now < g.explodeAt) return true;
    explode(game, g);
    return false;
  });
}
