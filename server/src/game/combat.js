import {
  GRENADE, LAG_COMP_MAX_MS, MAP_HALF, PLAYER_RADIUS, TICK_MS, WEAPON_IDS, WEAPONS,
} from '@calculo-royale/shared/constants';
import { magazineOf, weaponWith } from '@calculo-royale/shared/inventory';
import { helmetFactor } from '@calculo-royale/shared/gear';
import { RECOIL } from '@calculo-royale/shared/constants';
import { BUTTONS, dummyTargetId, EVENTS } from '@calculo-royale/shared/protocol';
import { encodeShot } from '@calculo-royale/shared/codec';
import { hasLineOfSight, overlapsObstacle, raycastObstacles, rayCircle } from '@calculo-royale/shared/collision';
import { findAutoTarget, pelletAngles } from '@calculo-royale/shared/combat';
import { JEEP } from '@calculo-royale/shared/constants';
import { waterAt } from '@calculo-royale/shared/mapPlan';
import { worldLimits } from '@calculo-royale/shared/mapLayout';
import { isSniper, THROWABLES, vehicleType } from '@calculo-royale/shared/constants';
import { activateUav, blastTactical, damageSensor, damageWall, detonateTactical, smokeBlocks } from './throwables.js';
import { VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { damageVehicle, vehicleTargetId } from './vehicles.js';

// Margen extra del radio de impacto: hace los disparos un poco más indulgentes
const HIT_LENIENCY = 0.15;
const GRENADE_RADIUS = 0.2;
// Explosiones: fragmentación, cohete y granada del lanzagranadas
const BLASTS = { frag: { radius: GRENADE.radius, damage: GRENADE.damage }, rocket: { radius: WEAPONS.rpg.blast, damage: WEAPONS.rpg.damage }, lob: { radius: WEAPONS.gl.blast, damage: WEAPONS.gl.damage } };
const PROJECTILE_SPEED = { rocket: 32, lob: 20 };
const MAX_REWIND_TICKS = LAG_COMP_MAX_MS / TICK_MS;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Objetivos posibles para un disparo, en las posiciones que el tirador estaba viendo
export function targetsAt(game, shooter, viewTick) {
  const tick = clamp(viewTick, game.tick - MAX_REWIND_TICKS, game.tick);
  const targets = [];
  for (const p of game.room.players.values()) {
    if (p === shooter || !p.alive || p.deploying) continue;
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
      targets.push({ id: vehicleTargetId(v.id), x: v.x, y: v.y, vehicle: v, radius: vehicleType(v).radius });
    }
  }
  return targets;
}

export function startReload(game, p) {
  const w = WEAPONS[p.weaponId];
  if (p.reloadUntil || p.healing || p.mag >= magazineOf(p.weaponId, p.attachments) || p.reserve <= 0) return;
  p.reloadUntil = game.now + w.reloadMs;
}

export function finishReload(p) {
  const take = Math.min(magazineOf(p.weaponId, p.attachments) - p.mag, p.reserve);
  p.mag += take;
  p.reserve -= take;
  p.reloadUntil = 0;
}

// slot: 1 y 2 (principales) o 3 (secundaria)
export function switchWeapon(game, p, slot) {
  const i = Number(slot) - 1;
  if (![0, 1, 2].includes(i) || i === p.active || !p.weapons[i]) return;
  p.active = i;
  p.healing = null; // cambiar de arma cancela la curación
  p.reloadUntil = 0;
  p.nextFireAt = Math.max(p.nextFireAt, game.now + 250);
}

// ¿Sigue en la partida principal? (vivo, conectado y no peleando en el Gulag)
export const inMatch = (p) => p.alive && p.connected && p.arena == null;

// Jugadores vivos en la partida principal: decide la posición final y la victoria
export function aliveCount(game) {
  let n = 0;
  for (const p of game.room.players.values()) if (inMatch(p)) n++;
  return n;
}


// Aplica daño: el casco lo reduce (más contra el francotirador), después el chaleco absorbe y el
// resto va a la vida (salvo ignoreArmor: zona y bombardeo). Devuelve { dealt (ya reducido), killed }.
export function damagePlayer(game, target, amount, attackerId, weaponIndex, { ignoreArmor = false } = {}) {
  if (!target.alive) return { dealt: 0, killed: false };
  // Sin fuego amigo (dúos y escuadras)
  const from = game.room.players.get(attackerId);
  if (from && from !== target && from.team != null && from.team === target.team) return { dealt: 0, killed: false };
  // Derribado: el daño baja su barra de derribo (rematar); en cero, muere
  const finishing = Boolean(target.downed);
  if (finishing) {
    target.downed.hp -= amount;
    if (target.downed.hp > 0) return { dealt: amount, killed: false };
    target.downed = null;
    amount = target.hp;
  }
  if (!ignoreArmor && !finishing) amount *= helmetFactor(target.helmetLevel ?? 0, isSniper(WEAPON_IDS[weaponIndex]));
  const absorbed = ignoreArmor || finishing ? 0 : Math.min(target.armor, amount);
  target.armor -= absorbed;
  if (target.armor <= 0 && target.armorLevel > 0) {
    target.armor = 0;
    target.armorLevel = 0;
  }
  const toHp = amount - absorbed;
  target.hp -= toHp;
  const hitter = game.room.players.get(attackerId);
  if (hitter && hitter !== target) hitter.damageDealt = (hitter.damageDealt ?? 0) + amount;
  if (target.hp > 0) return { dealt: amount, killed: false };
  // En equipos: derribado en vez de muerto si le queda un compañero en pie
  if (!finishing && game.tryDown?.(target, attackerId)) return { dealt: amount, killed: false, downed: true };

  target.hp = 0;
  target.alive = false;
  target.deathAt = game.now;
  target.killedBy = attackerId;
  target.killedWith = weaponIndex;
  target.reloadUntil = 0;
  // Posición final: los que siguen vivos + 1
  // En el Gulag ya tenía su puesto de la primera caída
  if (game.room.phase === 'playing' && target.arena == null) target.place = aliveCount(game) + 1;
  game.onPlayerDeath?.(target);
  const attacker = game.room.players.get(attackerId);
  if (attacker && attacker !== target) {
    attacker.kills++;
    attacker.longestKill = Math.max(attacker.longestKill ?? 0, Math.hypot(attacker.x - target.x, attacker.y - target.y));
  }
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

// Retroceso que queda ahora (se recupera RECOIL.recoverPerSec por segundo desde el último disparo)
export function currentRecoil(game, p) {
  return Math.max(0, (p.recoil ?? 0) - ((game.now - (p.recoilAt ?? game.now)) / 1000) * RECOIL.recoverPerSec);
}

// Cuánto sube el retroceso por disparo (con culata, menos)
export const recoilStep = (weaponId, attachments) => (RECOIL.perShot[weaponId] ?? 0.3) * (attachments?.stock ? RECOIL.stock : 1);

// Disparo hitscan con compensación de lag: los objetivos se ubican donde el tirador los veía
export function fire(game, p, input) {
  const id = p.weaponId;
  // Nadando (agua honda) no se dispara
  if (game.now < p.nextFireAt || p.reloadUntil || waterAt(p.x, p.y) === 2) return;
  // Colgado de la tirolina: solo la pistola
  if (p.zip && WEAPONS[p.weaponId].category !== 'pistol') return;
  // Retroceso acumulado (se recupera con el tiempo); culata y punto rojo cierran la dispersión
  p.recoil = currentRecoil(game, p);
  const w = weaponWith(id, p.attachments, p.recoil);
  p.healing = null; // disparar cancela la curación
  if (p.mag <= 0) {
    startReload(game, p);
    return;
  }
  p.nextFireAt = game.now + w.intervalMs;
  p.mag -= 1;

  // El humo tapa a quien está detrás (también para el auto apuntado)
  const targets = targetsAt(game, p, input.viewTick).filter((t) => !smokeBlocks(game, p.x, p.y, t.x, t.y));
  let aim = input.aim;
  if (input.buttons & BUTTONS.AUTO) {
    const target = findAutoTarget(p.x, p.y, w.range, targets);
    if (target) aim = Math.atan2(target.y - p.y, target.x - p.x);
    p.aim = aim;
  }

  const weaponIndex = WEAPON_IDS.indexOf(id);
  // Lanzacohetes y lanzagranadas: proyectil que explota (no hitscan)
  if (w.projectile) {
    launchProjectile(game, p, w, aim);
    game.shots.push(encodeShot(p.id, weaponIndex, p.x, p.y, [{ angle: aim, dist: 1 }], false));
    if (p.mag === 0) startReload(game, p);
    return;
  }
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
    // Muros de espuma y sensores: la bala se detiene ahí y les hace daño
    for (const wall of game.walls ?? []) {
      for (const c of wall.pieces) {
        const d = rayCircle(p.x, p.y, dx, dy, c.x, c.y, c.r);
        if (d <= dist) {
          dist = d;
          hit = { wall };
        }
      }
    }
    for (const sensor of game.sensors ?? []) {
      const d = rayCircle(p.x, p.y, dx, dy, sensor.x, sensor.y, 0.5);
      if (d < dist) {
        dist = d;
        hit = { sensor };
      }
    }
    if (hit?.wall) damageWall(game, hit.wall, w.damage);
    else if (hit?.sensor) damageSensor(game, hit.sensor, w.damage);
    else if (hit) damageByTarget.set(hit, (damageByTarget.get(hit) ?? 0) + w.damage);
    // La flecha de la ballesta queda en el suelo y se puede recoger
    if (id === 'crossbow') game.dropLoot?.(p.x + dx * Math.max(0, dist - 0.8), p.y + dy * Math.max(0, dist - 0.8), [{ item: 'ammo_bolt', state: { n: 1 } }]);
    return { angle, dist };
  });

  for (const [target, amount] of damageByTarget) {
    // El número que ve el que dispara es el daño real (con el casco del otro ya descontado)
    const { dealt, killed } = damageTarget(game, target, amount, p.id, weaponIndex);
    game.room.emitTo(p, EVENTS.COMBAT_HIT, [target.id, Math.round(dealt), target.x, target.y, killed ? 1 : 0]);
  }
  game.shots.push(encodeShot(p.id, weaponIndex, p.x, p.y, pellets, p.attachments?.muzzle === 'silencer' || Boolean(w.silent)));
  p.recoil = Math.min(RECOIL.max, p.recoil + recoilStep(id, p.attachments));
  p.recoilAt = game.now;
  if (p.mag === 0) startReload(game, p);
}

// Cohete (recto, explota al chocar) o granada del lanzagranadas (en arco, explota al chocar o al caer)
function launchProjectile(game, p, w, aim) {
  const kind = w.projectile;
  const speed = PROJECTILE_SPEED[kind];
  const flight = w.range / speed;
  game.grenades.push({
    id: game.nextGrenadeId++,
    ownerId: p.id,
    kind,
    weapon: p.weaponId,
    impact: true,
    x: p.x + Math.cos(aim) * (PLAYER_RADIUS + 0.4),
    y: p.y + Math.sin(aim) * (PLAYER_RADIUS + 0.4),
    vx: Math.cos(aim) * speed,
    vy: Math.sin(aim) * speed,
    decel: kind === 'lob' ? speed / flight : 0,
    explodeAt: game.now + flight * 1000,
  });
}

// Lanza el lanzable elegido (G o el botón de lanzables). El UAV no se lanza: se activa.
export function throwGrenade(game, p, input) {
  const kind = p.throwSel;
  if (!THROWABLES[kind] || (p.throwables[kind] ?? 0) <= 0 || game.now < p.nextGrenadeAt || waterAt(p.x, p.y) === 2) return;
  p.throwables[kind] -= 1;
  p.healing = null;
  p.nextGrenadeAt = game.now + GRENADE.intervalMs;
  // Si se acabó, queda elegido el siguiente que tenga
  if (p.throwables[kind] === 0) p.throwSel = Object.keys(THROWABLES).find((t) => p.throwables[t] > 0) ?? kind;
  if (THROWABLES[kind].instant) {
    activateUav(game, p);
    return;
  }

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

  // Desaceleración constante: recorre `dist` y se detiene al cabo de flightMs. La fragmentación
  // explota a los 2 s; la aturdidora a 1,5 s; las demás al detenerse.
  const flight = GRENADE.flightMs / 1000;
  const speed = (2 * dist) / flight;
  const fuse = kind === 'frag' ? GRENADE.fuseMs : kind === 'flash' ? 1500 : GRENADE.flightMs + 50;
  game.grenades.push({
    id: game.nextGrenadeId++,
    ownerId: p.id,
    kind,
    fromX: p.x,
    fromY: p.y,
    x: p.x + Math.cos(aim) * (PLAYER_RADIUS + 0.3),
    y: p.y + Math.sin(aim) * (PLAYER_RADIUS + 0.3),
    vx: Math.cos(aim) * speed,
    vy: Math.sin(aim) * speed,
    decel: speed / flight,
    explodeAt: game.now + fuse,
  });
}

function explode(game, g) {
  const kind = g.kind ?? 'frag';
  // Humo, aturdidora, molotov, sensor y muro: su efecto (sin daño de explosión)
  if (!BLASTS[kind]) {
    detonateTactical(game, g);
    return;
  }
  const { radius, damage } = BLASTS[kind];
  const index = WEAPON_IDS.indexOf(g.weapon ?? 'frag');
  game.explosions.push([Math.round(g.x * 100) / 100, Math.round(g.y * 100) / 100]);
  blastTactical(game, g.x, g.y, radius, damage);
  const owner = game.room.players.get(g.ownerId);
  const hurt = (target, x, y) => {
    const d = Math.hypot(x - g.x, y - g.y);
    if (d > radius || !hasLineOfSight(g.x, g.y, x, y)) return;
    const amount = Math.round(damage * (1 - 0.8 * (d / radius)));
    const { dealt, killed } = damageTarget(game, target, amount, g.ownerId, index);
    if (owner) game.room.emitTo(owner, EVENTS.COMBAT_HIT, [target.id, Math.round(dealt), x, y, killed ? 1 : 0]);
  };
  for (const p of game.room.players.values()) {
    if (p.alive && !p.deploying) hurt({ id: p.id, player: p }, p.x, p.y);
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
      // El borde del mapa o, en el Gulag, el de la arena
      const box = worldLimits(g.x, g.y, GRENADE_RADIUS);
      const nx = g.x + g.vx * dt;
      if (g.impact) {
        const ny0 = g.y + g.vy * dt;
        const hitPlayer = [...game.room.players.values()].some((q) => q.id !== g.ownerId && q.alive && !q.deploying && Math.hypot(q.x - nx, q.y - ny0) < PLAYER_RADIUS + 0.4);
        const hitVehicle = (game.vehicles ?? []).some((v) => v.state !== VEHICLE_STATE.DESTROYED && Math.hypot(v.x - nx, v.y - ny0) < vehicleType(v).radius + 0.3);
        if (hitPlayer || hitVehicle || overlapsObstacle(nx, ny0, GRENADE_RADIUS) || nx < box.minX || nx > box.maxX || ny0 < box.minY || ny0 > box.maxY) {
          explode(game, g);
          return false;
        }
        g.x = nx;
        g.y = ny0;
        if (game.now < g.explodeAt && (g.decel === 0 || Math.hypot(g.vx, g.vy) > 0.5)) return true;
        explode(game, g);
        return false;
      }
      if (nx < box.minX || nx > box.maxX || overlapsObstacle(nx, g.y, GRENADE_RADIUS)) g.vx *= -0.5;
      else g.x = nx;
      const ny = g.y + g.vy * dt;
      if (ny < box.minY || ny > box.maxY || overlapsObstacle(g.x, ny, GRENADE_RADIUS)) g.vy *= -0.5;
      else g.y = ny;
    }
    if (game.now < g.explodeAt) return true;
    explode(game, g);
    return false;
  });
}
