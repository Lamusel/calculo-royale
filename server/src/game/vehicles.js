import { JEEP, PLAYER_RADIUS, TOPICS, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { hasLineOfSight, resolveCircle } from '@calculo-royale/shared/collision';
import { EVENTS, VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { VEHICLE_SPOTS } from '@calculo-royale/shared/mapLayout';
import { applyVehicleInput, seatPosition } from '@calculo-royale/shared/vehicle';
import { drawQuestion } from '../questions/QuestionBank.js';
import { damagePlayer } from './combat.js';
import { recordStats } from './crates.js';

// Jeeps: se encienden respondiendo el "código del motor". Conductor y un pasajero.
// El servidor mueve el jeep con la física compartida (shared/vehicle.js).

const JEEP_INDEX = WEAPON_IDS.indexOf('jeep');
const RUN_OVER_COOLDOWN_MS = 800;
const r2 = (v) => Math.round(v * 100) / 100;

// En COMBAT_HIT los jeeps se identifican como −(100 + id)
export const vehicleTargetId = (id) => -(100 + id);

const fresh = (spot) => ({
  x: spot.x,
  y: spot.y,
  heading: spot.heading,
  speed: 0,
  hp: JEEP.hp,
  driverId: null,
  passengerId: null,
  state: VEHICLE_STATE.LOCKED,
  jamUntil: 0,
  hits: new Map(), // atropellos recientes: id del jugador → momento
});

export function createVehicles() {
  return VEHICLE_SPOTS.map((spot, id) => ({ id, spot, ...fresh(spot) }));
}

export function resetVehicles(game) {
  for (const v of game.vehicles) Object.assign(v, fresh(v.spot));
  for (const p of game.room.players.values()) {
    p.vehicleId = null;
    p.seat = null;
    p.engineQuestion = null;
  }
}

const active = (game) => game.room.phase === 'playing';

function placeOccupants(game, v) {
  for (const seat of ['driver', 'passenger']) {
    const p = game.room.players.get(seat === 'driver' ? v.driverId : v.passengerId);
    if (!p) continue;
    const pos = seatPosition(v, seat);
    p.x = pos.x;
    p.y = pos.y;
  }
}

export function nearestVehicle(game, x, y) {
  if (!active(game)) return null;
  let best = null;
  let bestDist = JEEP.enterRadius;
  for (const v of game.vehicles) {
    if (v.state === VEHICLE_STATE.DESTROYED) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d <= bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best ? { vehicle: best, dist: bestDist } : null;
}

function board(game, player, v, seat) {
  if (seat === 'driver') v.driverId = player.id;
  else v.passengerId = player.id;
  player.vehicleId = v.id;
  player.seat = seat;
  player.inputs = [];
  placeOccupants(game, v);
}

export function exitVehicle(game, player) {
  const v = game.vehicles[player.vehicleId];
  if (!v) return;
  if (v.driverId === player.id) v.driverId = null;
  if (v.passengerId === player.id) v.passengerId = null;
  player.vehicleId = null;
  player.seat = null;
  // Se baja por el costado izquierdo (−sen h, cos h), fuera de cualquier obstáculo
  const pos = { x: v.x - Math.sin(v.heading) * 2.3, y: v.y + Math.cos(v.heading) * 2.3 };
  resolveCircle(pos, PLAYER_RADIUS);
  player.teleport(pos.x, pos.y);
}

function askEngine(game, player, v) {
  const q = drawQuestion({ topics: game.room.topics, difficulty: 2, seen: player.seenQuestions, easy: game.room.easy });
  player.engineQuestion = { vehicleId: v.id, q, expiresAt: game.now + JEEP.questionMs };
  game.room.emitTo(player, EVENTS.CRATE_QUESTION, {
    crateId: null,
    vehicleId: v.id,
    rarity: 1,
    title: 'Código del motor',
    tema: TOPICS[q.tema],
    enunciado: q.enunciado,
    opciones: q.opciones,
    timeLimitMs: JEEP.questionMs,
    loot: ['Encender el jeep y manejarlo'],
  });
}

// E / botón: bajarse, o encender, o subir (conductor si está libre, si no pasajero)
export function interactVehicle(game, player, v) {
  if (player.vehicleId !== null) {
    exitVehicle(game, player);
    return;
  }
  if (v.state === VEHICLE_STATE.LOCKED) askEngine(game, player, v);
  else if (v.state === VEHICLE_STATE.READY) {
    if (v.driverId === null) board(game, player, v, 'driver');
    else if (v.passengerId === null) board(game, player, v, 'passenger');
  }
}

export function answerEngine(game, player, index) {
  const pq = player.engineQuestion;
  if (!pq) return false;
  const v = game.vehicles[pq.vehicleId];
  player.engineQuestion = null;
  const timedOut = game.now > pq.expiresAt;
  const correct = !timedOut && index === pq.q.correcta;
  recordStats(player, pq.q, correct, index);
  if (correct && v.state === VEHICLE_STATE.LOCKED) {
    v.state = VEHICLE_STATE.READY;
    board(game, player, v, v.driverId === null ? 'driver' : 'passenger');
    game.room.emitTo(player, EVENTS.CRATE_RESULT, {
      crateId: null, outcome: 'correct', title: 'Motor encendido', loot: ['Jeep listo: el joystick izquierdo maneja'], explicacion: pq.q.explicacion,
    });
  } else {
    if (v.state === VEHICLE_STATE.LOCKED) {
      v.state = VEHICLE_STATE.JAMMED;
      v.jamUntil = game.now + JEEP.engineLockMs;
    }
    game.room.emitTo(player, EVENTS.CRATE_RESULT, {
      crateId: null, outcome: timedOut ? 'timeout' : 'wrong', title: 'El motor no arrancó', loot: [], engine: true,
    });
  }
  return true;
}

export function cancelEngine(game, player, reason) {
  if (!player.engineQuestion) return false;
  player.engineQuestion = null;
  game.room.emitTo(player, EVENTS.CRATE_RESULT, { crateId: null, outcome: 'cancelled', loot: [], reason });
  return true;
}

// Movimiento de quien va en un jeep: el conductor lo maneja; el pasajero solo apunta
export function driveInput(game, player, input, dt) {
  player.aim = input.aim;
  const v = game.vehicles[player.vehicleId];
  if (v && player.seat === 'driver' && v.state !== VEHICLE_STATE.DESTROYED) applyVehicleInput(v, input, dt);
  if (v) placeOccupants(game, v);
}

export function damageVehicle(game, v, amount, attackerId) {
  if (v.state === VEHICLE_STATE.DESTROYED) return;
  v.hp -= amount;
  if (v.hp <= 0) destroyVehicle(game, v, attackerId);
}

function destroyVehicle(game, v, attackerId) {
  v.state = VEHICLE_STATE.DESTROYED;
  v.hp = 0;
  v.speed = 0;
  for (const id of [v.driverId, v.passengerId]) {
    const p = game.room.players.get(id);
    if (p) exitVehicle(game, p);
  }
  game.explosions.push([r2(v.x), r2(v.y)]);
  for (const p of game.room.players.values()) {
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (!p.alive || d > JEEP.explosionRadius || !hasLineOfSight(v.x, v.y, p.x, p.y)) continue;
    damagePlayer(game, p, Math.round(JEEP.explosionDamage * (1 - 0.7 * (d / JEEP.explosionRadius))), attackerId ?? null, JEEP_INDEX);
  }
}

export function updateVehicles(game, dt) {
  if (!active(game)) return;
  for (const v of game.vehicles) {
    if (v.state === VEHICLE_STATE.JAMMED && game.now >= v.jamUntil) v.state = VEHICLE_STATE.LOCKED;
    if (v.state === VEHICLE_STATE.DESTROYED) continue;
    // Quien se desconectó o cayó deja el asiento
    for (const key of ['driverId', 'passengerId']) {
      const p = game.room.players.get(v[key]);
      if (v[key] !== null && (!p || !p.alive || p.vehicleId !== v.id)) v[key] = null;
    }
    // Sin conductor el jeep frena solo
    if (v.driverId === null && v.speed !== 0) applyVehicleInput(v, { mx: 0, my: 0 }, dt);
    if (v.crashed && Math.abs(v.speed) > 2) damageVehicle(game, v, 10, null);
    v.crashed = false;
    placeOccupants(game, v);

    // Atropello: daño según la velocidad y empujón
    if (Math.abs(v.speed) < JEEP.runOverMinSpeed) continue;
    for (const p of game.room.players.values()) {
      if (!p.alive || p.vehicleId !== null || p.deploying) continue;
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d = Math.hypot(dx, dy);
      if (d > JEEP.radius + PLAYER_RADIUS || game.now - (v.hits.get(p.id) ?? -Infinity) < RUN_OVER_COOLDOWN_MS) continue;
      v.hits.set(p.id, game.now);
      damagePlayer(game, p, Math.round(Math.abs(v.speed) * JEEP.runOverDamagePerSpeed), v.driverId, JEEP_INDEX);
      const push = JEEP.radius + PLAYER_RADIUS + 0.8;
      const nx = d > 1e-6 ? dx / d : 1;
      const ny = d > 1e-6 ? dy / d : 0;
      const pos = { x: v.x + nx * push, y: v.y + ny * push };
      resolveCircle(pos, PLAYER_RADIUS);
      p.teleport(pos.x, pos.y);
    }
  }
}

export function encodeVehicles(game) {
  if (!active(game)) return [];
  return game.vehicles.map((v) => [
    v.id, r2(v.x), r2(v.y), r2(v.heading), r2(v.speed), Math.ceil(v.hp), v.driverId ?? 0, v.passengerId ?? 0, v.state,
  ]);
}
