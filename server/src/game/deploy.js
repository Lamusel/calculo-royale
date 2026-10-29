import { DEPLOY, GULAG, MAP_HALF, PLATFORM, PLAYER_RADIUS, ZIPLINE } from '@calculo-royale/shared/constants';
import { JUMP_PADS, ZIPLINE_LINES } from '@calculo-royale/shared/mapLayout';
import { resolveCircle } from '@calculo-royale/shared/collision';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { insideZonePoint } from '@calculo-royale/shared/zone';
import { TIME_SCALE } from './match.js';

// Despliegue al iniciar la partida (servidor autoritativo).
//   bus: todos van en un bus que cruza el mapa; cada uno salta cuando quiere (o al final).
//   punto: 10 s para tocar el mapa; después todos caen en paracaídas donde eligieron.
// player.deploy = { phase: 'bus' | 'pick' | 'fall' | 'chute', z } mientras dura; null al aterrizar.

const r2 = (v) => Math.round(v * 100) / 100;
const LIMIT = MAP_HALF - PLAYER_RADIUS;
const clamp = (v) => Math.max(-LIMIT, Math.min(LIMIT, v));

// Ruta recta con dirección al azar que empieza y termina fuera del mapa. Una de cada tres va
// diagonal; el desplazamiento perpendicular hace que a veces pase por un costado y no por el centro.
export function busRoute(rand = Math.random) {
  const diagonal = rand() < 0.34;
  const angle = diagonal ? Math.PI / 4 + Math.floor(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.2 : rand() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // Desplazamiento perpendicular: la ruta no siempre pasa por el centro exacto
  const off = (rand() * 2 - 1) * MAP_HALF * DEPLOY.routeCenterJitter;
  const cx = -dy * off;
  const cy = dx * off;
  const half = MAP_HALF * Math.SQRT2 + DEPLOY.routeMargin;
  // Se recorta al cuadrado del mapa (más el margen) para no volar de más
  const reach = (t) => Math.abs(cx + dx * t) <= MAP_HALF + DEPLOY.routeMargin && Math.abs(cy + dy * t) <= MAP_HALF + DEPLOY.routeMargin;
  let t0 = -half;
  let t1 = half;
  while (!reach(t0)) t0 += 0.5;
  while (!reach(t1)) t1 -= 0.5;
  return { x0: r2(cx + dx * t0), y0: r2(cy + dy * t0), x1: r2(cx + dx * t1), y1: r2(cy + dy * t1) };
}

// Al iniciar: todos al bus (o a elegir punto)
export function startDeploy(game, mode = 'bus', rand = Math.random) {
  const players = [...game.room.players.values()];
  if (mode === 'punto') {
    game.deploy = { mode, pickUntil: game.now + DEPLOY.pickMs / TIME_SCALE, picks: new Map() };
    for (const p of players) p.deploy = { phase: 'pick', z: DEPLOY.pointAltitude };
    game.room.broadcast(EVENTS.MATCH_DEPLOY, { mode, pickMs: DEPLOY.pickMs / TIME_SCALE });
    return;
  }
  const route = busRoute(rand);
  const length = Math.hypot(route.x1 - route.x0, route.y1 - route.y0);
  const durationMs = (length / DEPLOY.busSpeed) * 1000;
  game.deploy = {
    mode,
    route,
    heading: Math.atan2(route.y1 - route.y0, route.x1 - route.x0),
    departAt: game.now + DEPLOY.busWaitMs / TIME_SCALE,
    durationMs,
    x: route.x0,
    y: route.y0,
    done: false,
  };
  for (const p of players) {
    p.deploy = { phase: 'bus', z: DEPLOY.busAltitude };
    p.x = clamp(route.x0);
    p.y = clamp(route.y0);
  }
  game.room.broadcast(EVENTS.MATCH_DEPLOY, {
    mode,
    route: [route.x0, route.y0, route.x1, route.y1],
    departInMs: DEPLOY.busWaitMs / TIME_SCALE,
    durationMs,
  });
}

export const busDeparted = (game) => game.deploy?.mode === 'bus' && game.now >= game.deploy.departAt;

// Saltar del bus (solo con el bus ya en marcha)
// Cayendo: Espacio otra vez abre el paracaídas antes (llega más lejos pero baja más lento)
export function jump(game, player) {
  const s = player.deploy;
  if (s?.phase === 'fall' && game.now - (s.since ?? 0) >= DEPLOY.chuteManualMs) {
    s.phase = 'chute';
    return;
  }
  if (s?.phase !== 'bus' || !busDeparted(game)) return;
  player.deploy = { phase: 'fall', z: DEPLOY.busAltitude, since: game.now };
}

// Velocidad de caída libre: inclinarse del todo (lean = 1) cae más rápido
export const fallSpeed = (lean = 0) => DEPLOY.fallSpeed + DEPLOY.fallLeanSpeed * lean;

// Empezar a caer en paracaídas en (x, y) desde cierta altura (elegir punto, reanimación)
export function dropWithChute(player, x, y, z) {
  player.teleport(clamp(x), clamp(y));
  player.deploy = { phase: 'chute', z };
}

// Regreso del Gulag: GULAG.returnPickMs para tocar dónde caer (solo dentro de la zona); si no elige,
// cae en `fallback`. Mientras elige no se dibuja (como en el bus) y no recibe daño.
export function startReturnPick(game, player, fallback) {
  player.teleport(clamp(fallback.x), clamp(fallback.y));
  player.deploy = { phase: 'pick', z: GULAG.returnAltitude, gulagReturn: true, until: game.now + GULAG.returnPickMs / TIME_SCALE, pick: fallback };
  game.room.emitTo(player, EVENTS.MATCH_DEPLOY, { mode: 'punto', pickMs: GULAG.returnPickMs / TIME_SCALE, gulag: true });
}

export function choosePoint(game, player, x, y) {
  if (player.deploy?.phase !== 'pick' || !Number.isFinite(x) || !Number.isFinite(y)) return;
  if (player.deploy.gulagReturn) {
    if (game.zone) {
      const p = insideZonePoint(game.zone.current, x, y);
      player.deploy.pick = { x: clamp(p.x), y: clamp(p.y) };
    }
    return;
  }
  if (game.deploy?.mode !== 'punto') return;
  game.deploy.picks.set(player.id, { x: clamp(x), y: clamp(y) });
}

function land(player) {
  player.deploy = null;
  const pos = { x: player.x, y: player.y };
  resolveCircle(pos, PLAYER_RADIUS);
  player.teleport(clamp(pos.x), clamp(pos.y));
}

export function updateDeploy(game, dt) {
  const d = game.deploy;
  if (d?.mode === 'bus' && !d.done) {
    const t = Math.max(0, Math.min(1, (game.now - d.departAt) / d.durationMs));
    d.x = d.route.x0 + (d.route.x1 - d.route.x0) * t;
    d.y = d.route.y0 + (d.route.y1 - d.route.y0) * t;
    // Al final de la ruta saltan todos los que queden
    if (t >= 1) d.done = true;
  }
  if (d?.mode === 'punto' && game.now >= d.pickUntil && !d.done) {
    d.done = true;
    for (const p of game.room.players.values()) {
      if (p.deploy?.phase !== 'pick') continue;
      const pick = d.picks.get(p.id) ?? { x: p.x, y: p.y };
      dropWithChute(p, pick.x, pick.y, DEPLOY.pointAltitude);
    }
  }
  for (const p of game.room.players.values()) {
    const s = p.deploy;
    if (!s) continue;
    if (s.phase === 'pick' && s.gulagReturn) {
      if (game.now >= s.until) dropWithChute(p, s.pick.x, s.pick.y, s.z);
    } else if (s.phase === 'bus') {
      p.x = clamp(d.x);
      p.y = clamp(d.y);
      // Quien no saltó sale expulsado al final de la ruta
      if (d.done) p.deploy = { phase: 'fall', z: s.z, since: game.now };
    } else if (s.phase === 'fall' && s.vz > 0) {
      // Impulso de la plataforma: sube frenando y arriba abre el paracaídas
      s.z += s.vz * dt;
      s.vz -= PLATFORM.gravity * dt;
      if (s.vz <= 0) s.phase = 'chute';
    } else if (s.phase === 'fall') {
      s.z -= fallSpeed(p.lean ?? 0) * dt;
      if (s.z <= DEPLOY.chuteAltitude) s.phase = 'chute';
    } else if (s.phase === 'chute') {
      s.z -= DEPLOY.chuteSpeed * dt;
      if (s.z <= 0) land(p);
    }
  }
}

// Bus en el snapshot: [x, y, rumbo, ms para arrancar] mientras exista; [] si ya terminó
export function encodeBus(game) {
  const d = game.deploy;
  if (d?.mode !== 'bus' || d.done) return [];
  return [r2(d.x), r2(d.y), r2(d.heading), Math.max(0, Math.round(d.departAt - game.now))];
}

// --- Movilidad (fase 35): plataformas de salto y tirolinas ---
// Plataforma: al pisarla te lanza alto y bajas planeando como desde el bus (paracaídas incluido).
// Se vuelve a armar cuando te alejas de ella.
export function updatePads(game) {
  if (game.room.phase !== 'playing') return;
  for (const p of game.room.players.values()) {
    if (!p.alive || p.deploy || p.vehicleId !== null || p.zip || p.arena != null) continue;
    if (p.padAt && Math.hypot(p.x - p.padAt.x, p.y - p.padAt.y) > PLATFORM.rearmDistance) p.padAt = null;
    if (p.padAt) continue;
    const pad = JUMP_PADS.find((j) => Math.hypot(j.x - p.x, j.y - p.y) < PLATFORM.radius);
    if (!pad) continue;
    p.padAt = pad;
    p.healing = null;
    p.deploy = { phase: 'fall', z: 1, vz: PLATFORM.launchSpeed, since: game.now };
  }
}

// Tirolina más cercana a una de sus puntas: { line, from, to } (o null)
export function nearestZipline(x, y) {
  for (const line of ZIPLINE_LINES) {
    if (Math.hypot(line.from[0] - x, line.from[1] - y) < ZIPLINE.grabRadius) return { line, from: line.from, to: line.to };
    if (Math.hypot(line.to[0] - x, line.to[1] - y) < ZIPLINE.grabRadius) return { line, from: line.to, to: line.from };
  }
  return null;
}

// Colgarse (botón Tirolina) o soltarse (otra vez, o Saltar): al soltarse baja en paracaídas
export function useZipline(game, p) {
  if (p.zip) {
    const z = ZIPLINE.height;
    p.zip = null;
    p.deploy = { phase: 'chute', z };
    return true;
  }
  if (!p.alive || p.deploy || p.vehicleId !== null) return false;
  const near = nearestZipline(p.x, p.y);
  if (!near) return false;
  const len = Math.hypot(near.to[0] - near.from[0], near.to[1] - near.from[1]);
  p.zip = { from: near.from, to: near.to, len, t: 0 };
  p.healing = null;
  return true;
}

export function updateZiplines(game, dt) {
  for (const p of game.room.players.values()) {
    const z = p.zip;
    if (!z) continue;
    if (!p.alive) {
      p.zip = null;
      continue;
    }
    z.t = Math.min(1, z.t + (ZIPLINE.speed * dt) / z.len);
    p.x = z.from[0] + (z.to[0] - z.from[0]) * z.t;
    p.y = z.from[1] + (z.to[1] - z.from[1]) * z.t;
    if (z.t >= 1) {
      p.zip = null;
      land(p);
    }
  }
}
