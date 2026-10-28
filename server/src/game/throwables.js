import { THROWABLES, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { hasLineOfSight, setDynamicObstacles } from '@calculo-royale/shared/collision';
import { wallPieces } from '@calculo-royale/shared/throwables';
import { damagePlayer, inMatch } from './combat.js';

// Lanzables y equipo táctico (fase 29): humo, aturdidora, molotov, sensor de movimiento, granada muro
// y UAV. La fragmentación (y los proyectiles de las armas especiales) explotan en combat.js.

const MOLOTOV_INDEX = WEAPON_IDS.indexOf('molotov');
let nextEffectId = 1;
const sameTeam = (a, b) => a && b && a !== b && a.team != null && a.team === b.team;

export function resetThrowables(game) {
  game.smokes = [];
  game.fires = [];
  game.sensors = [];
  game.walls = [];
  setDynamicObstacles([]);
}

const refreshWalls = (game) => setDynamicObstacles(game.walls.flatMap((w) => w.pieces));

// La granada llegó a su punto: según su tipo
export function detonateTactical(game, g) {
  const owner = game.room.players.get(g.ownerId);
  const until = (ms) => game.now + ms;
  switch (g.kind) {
    case 'smoke':
      game.smokes.push({ id: nextEffectId++, x: g.x, y: g.y, r: THROWABLES.smoke.radius, until: until(THROWABLES.smoke.ms) });
      break;
    case 'molotov':
      game.fires.push({ id: nextEffectId++, x: g.x, y: g.y, r: THROWABLES.molotov.radius, born: game.now, until: until(THROWABLES.molotov.ms), ownerId: g.ownerId });
      break;
    case 'sensor':
      game.sensors.push({ id: nextEffectId++, x: g.x, y: g.y, hp: THROWABLES.sensor.hp, until: until(THROWABLES.sensor.ms), ownerId: g.ownerId, nextPulse: game.now, last: new Map() });
      break;
    case 'wall': {
      const angle = Math.atan2(g.y - g.fromY, g.x - g.fromX);
      game.walls.push({ id: nextEffectId++, x: g.x, y: g.y, angle, hp: THROWABLES.wall.hp, until: until(THROWABLES.wall.ms), pieces: wallPieces(g.x, g.y, angle) });
      refreshWalls(game);
      break;
    }
    case 'flash':
      for (const p of game.room.players.values()) {
        if (!p.alive || p.deploying) continue;
        const d = Math.hypot(p.x - g.x, p.y - g.y);
        if (d > THROWABLES.flash.radius || !hasLineOfSight(g.x, g.y, p.x, p.y)) continue;
        // Solo si la mira (o está muy cerca): el coseno entre su mira y la dirección hacia la granada
        const facing = Math.cos(p.aim) * (g.x - p.x) + Math.sin(p.aim) * (g.y - p.y);
        if (d > 3 && facing / Math.max(d, 1e-6) < 0.2) continue;
        p.flashUntil = Math.max(p.flashUntil, game.now + THROWABLES.flash.ms * (1 - (0.5 * d) / THROWABLES.flash.radius));
      }
      break;
    default:
      break;
  }
  if (owner && g.kind === 'sensor') owner.marks = owner.marks ?? null;
}

// UAV: marca 8 s a los 3 enemigos más cercanos (en equipos, para todo el equipo)
export function activateUav(game, p) {
  const enemies = [...game.room.players.values()]
    .filter((q) => q !== p && inMatch(q) && !sameTeam(p, q))
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
    .slice(0, THROWABLES.uav.targets)
    .map((q) => q.id);
  const marks = { ids: enemies, until: game.now + THROWABLES.uav.ms, kind: 'uav' };
  for (const q of game.room.players.values()) if (q === p || sameTeam(p, q)) q.marks = marks;
}

// Daño a muros y sensores por balas o explosiones (devuelve true si pegó en algo)
export function damageWall(game, wall, amount) {
  wall.hp -= amount;
  if (wall.hp <= 0) {
    game.walls = game.walls.filter((w) => w !== wall);
    refreshWalls(game);
  }
}
export function damageSensor(game, sensor, amount) {
  sensor.hp -= amount;
  if (sensor.hp <= 0) game.sensors = game.sensors.filter((s) => s !== sensor);
}

// Explosión cerca: rompe muros y sensores
export function blastTactical(game, x, y, radius, damage) {
  for (const w of [...game.walls]) if (w.pieces.some((c) => Math.hypot(c.x - x, c.y - y) < radius + c.r)) damageWall(game, w, damage * 2);
  for (const s of [...game.sensors]) if (Math.hypot(s.x - x, s.y - y) < radius) damageSensor(game, s, damage);
}

// ¿El humo tapa la línea entre dos puntos? (para el auto apuntado y los bots)
export function smokeBlocks(game, x1, y1, x2, y2) {
  for (const s of game.smokes ?? []) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((s.x - x1) * dx + (s.y - y1) * dy) / len2));
    if (Math.hypot(x1 + dx * t - s.x, y1 + dy * t - s.y) < s.r) return true;
  }
  return false;
}

export function updateThrowables(game, dt) {
  if (!game.smokes) resetThrowables(game);
  const now = game.now;
  game.smokes = game.smokes.filter((s) => s.until > now);
  // Molotov: daño por segundo a quien esté adentro (sin atravesar paredes); se extiende un poco
  game.fires = game.fires.filter((f) => f.until > now);
  for (const f of game.fires) {
    const life = (now - f.born) / THROWABLES.molotov.ms;
    f.r = THROWABLES.molotov.radius + (THROWABLES.molotov.maxRadius - THROWABLES.molotov.radius) * Math.min(1, life * 1.5);
    const owner = game.room.players.get(f.ownerId);
    for (const p of game.room.players.values()) {
      if (!p.alive || p.deploying || Math.hypot(p.x - f.x, p.y - f.y) > f.r || !hasLineOfSight(f.x, f.y, p.x, p.y)) continue;
      const factor = sameTeam(owner, p) ? THROWABLES.molotov.teamFactor : 1;
      damagePlayer(game, p, THROWABLES.molotov.dps * factor * dt, f.ownerId, MOLOTOV_INDEX);
    }
  }
  // Sensor: cada pulso marca a los enemigos que se movieron dentro de su radio
  game.sensors = game.sensors.filter((s) => s.until > now);
  for (const s of game.sensors) {
    if (now < s.nextPulse) continue;
    s.nextPulse = now + THROWABLES.sensor.pulseMs;
    const owner = game.room.players.get(s.ownerId);
    if (!owner) continue;
    const moved = [];
    for (const p of game.room.players.values()) {
      if (p === owner || !inMatch(p) || sameTeam(owner, p) || Math.hypot(p.x - s.x, p.y - s.y) > THROWABLES.sensor.radius) continue;
      const last = s.last.get(p.id);
      if (last && Math.hypot(p.x - last.x, p.y - last.y) > 0.5) moved.push(p.id);
      s.last.set(p.id, { x: p.x, y: p.y });
    }
    if (moved.length) owner.marks = { ids: moved, until: now + THROWABLES.sensor.pulseMs + 300, kind: 'sensor' };
  }
  const before = game.walls.length;
  game.walls = game.walls.filter((w) => w.until > now);
  if (game.walls.length !== before) refreshWalls(game);
}

// Snapshot: [[tipo, id, x, y, extra], …] — 0 humo (radio), 1 fuego (radio), 2 sensor, 3 muro (rumbo)
const r2 = (v) => Math.round(v * 100) / 100;
export function encodeEffects(game) {
  return [
    ...(game.smokes ?? []).map((s) => [0, s.id, r2(s.x), r2(s.y), s.r]),
    ...(game.fires ?? []).map((f) => [1, f.id, r2(f.x), r2(f.y), r2(f.r)]),
    ...(game.sensors ?? []).map((s) => [2, s.id, r2(s.x), r2(s.y), 0]),
    ...(game.walls ?? []).map((w) => [3, w.id, r2(w.x), r2(w.y), r2(w.angle)]),
  ];
}
