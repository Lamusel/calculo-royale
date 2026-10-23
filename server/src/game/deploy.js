import { DEPLOY, MAP_HALF, PLAYER_RADIUS } from '@calculo-royale/shared/constants';
import { resolveCircle } from '@calculo-royale/shared/collision';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { TIME_SCALE } from './match.js';

// Despliegue al iniciar la partida (servidor autoritativo).
//   bus: todos van en un bus que cruza el mapa; cada uno salta cuando quiere (o al final).
//   punto: 10 s para tocar el mapa; después todos caen en paracaídas donde eligieron.
// player.deploy = { phase: 'bus' | 'pick' | 'fall' | 'chute', z } mientras dura; null al aterrizar.

const r2 = (v) => Math.round(v * 100) / 100;
const LIMIT = MAP_HALF - PLAYER_RADIUS;
const clamp = (v) => Math.max(-LIMIT, Math.min(LIMIT, v));

// Ruta recta con dirección al azar que pasa cerca del centro y empieza y termina fuera del mapa
export function busRoute(rand = Math.random) {
  const angle = rand() * Math.PI * 2;
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
export function jump(game, player) {
  if (player.deploy?.phase !== 'bus' || !busDeparted(game)) return;
  player.deploy = { phase: 'fall', z: DEPLOY.busAltitude };
}

// Empezar a caer en paracaídas en (x, y) desde cierta altura (elegir punto, reanimación)
export function dropWithChute(player, x, y, z) {
  player.teleport(clamp(x), clamp(y));
  player.deploy = { phase: 'chute', z };
}

export function choosePoint(game, player, x, y) {
  if (game.deploy?.mode !== 'punto' || player.deploy?.phase !== 'pick' || !Number.isFinite(x) || !Number.isFinite(y)) return;
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
    if (s.phase === 'bus') {
      p.x = clamp(d.x);
      p.y = clamp(d.y);
      if (d.done) p.deploy = { phase: 'fall', z: s.z };
    } else if (s.phase === 'fall') {
      s.z -= DEPLOY.fallSpeed * dt;
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
