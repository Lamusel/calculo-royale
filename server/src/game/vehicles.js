import { JEEP, PLAYER_RADIUS, TOPICS, VEHICLE_TYPE_IDS, vehicleType, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { hasLineOfSight, resolveCircle } from '@calculo-royale/shared/collision';
import { EVENTS, VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { VEHICLE_SPOTS } from '@calculo-royale/shared/mapLayout';
import { applyVehicleInput, seatPosition } from '@calculo-royale/shared/vehicle';
import { drawQuestion } from '../questions/QuestionBank.js';
import { damagePlayer } from './combat.js';
import { recordStats } from './crates.js';

// Vehículos (jeep, moto, camión y lancha): se encienden respondiendo el "código del motor". seats[0] es el
// conductor; los demás asientos son pasajeros que disparan.
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
  type: spot.type ?? 'jeep',
  speed: 0,
  hp: vehicleType(spot).hp,
  seats: Array(vehicleType(spot).seats).fill(null),
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

const driverOf = (v) => v.seats[0];

function placeOccupants(game, v) {
  for (let i = 0; i < v.seats.length; i++) {
    const p = game.room.players.get(v.seats[i]);
    if (!p) continue;
    const pos = seatPosition(v, i);
    p.x = pos.x;
    p.y = pos.y;
  }
}

export function nearestVehicle(game, x, y) {
  if (!active(game)) return null;
  let best = null;
  let bestDist = Infinity;
  for (const v of game.vehicles) {
    if (v.state === VEHICLE_STATE.DESTROYED) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d <= vehicleType(v).enterRadius && d <= bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best ? { vehicle: best, dist: bestDist } : null;
}

// seat: índice del asiento (0 = conductor)
function board(game, player, v, seat) {
  v.seats[seat] = player.id;
  player.vehicleId = v.id;
  player.seat = seat === 0 ? 'driver' : 'passenger';
  player.seatIndex = seat;
  player.inputs = [];
  placeOccupants(game, v);
}

// Cambiar de asiento (fase 32): al otro, si está libre. Pasar a conductor con el motor apagado no lo enciende.
export function switchSeat(game, player) {
  const v = game.vehicles[player.vehicleId];
  if (!v) return;
  const from = v.seats.indexOf(player.id);
  // El siguiente asiento libre (dando la vuelta)
  for (let k = 1; k < v.seats.length; k++) {
    const to = (from + k) % v.seats.length;
    if (v.seats[to] !== null) continue;
    v.seats[from] = null;
    board(game, player, v, to);
    return;
  }
}

export function exitVehicle(game, player) {
  const v = game.vehicles[player.vehicleId];
  if (!v) return;
  v.seats = v.seats.map((id) => (id === player.id ? null : id));
  player.vehicleId = null;
  player.seat = null;
  player.seatIndex = null;
  // Se baja por el costado izquierdo (−sen h, cos h), fuera de cualquier obstáculo
  const out = vehicleType(v).radius + 1;
  const pos = { x: v.x - Math.sin(v.heading) * out, y: v.y + Math.cos(v.heading) * out };
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
    loot: [`Encender ${vehicleType(v).name.toLowerCase()} y manejarlo`],
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
    const free = v.seats.indexOf(null);
    if (free >= 0) board(game, player, v, free);
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
    const free = v.seats.indexOf(null);
    if (free >= 0) board(game, player, v, free);
    game.room.emitTo(player, EVENTS.CRATE_RESULT, {
      crateId: null, outcome: 'correct', title: 'Motor encendido', loot: [`${vehicleType(v).name} listo: el joystick izquierdo maneja`], explicacion: pq.q.explicacion,
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
  for (const id of v.seats) {
    const p = game.room.players.get(id);
    if (p) exitVehicle(game, p);
  }
  game.explosions.push([r2(v.x), r2(v.y)]);
  for (const p of game.room.players.values()) {
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    const T = vehicleType(v);
    if (!p.alive || d > T.explosionRadius || !hasLineOfSight(v.x, v.y, p.x, p.y)) continue;
    damagePlayer(game, p, Math.round(T.explosionDamage * (1 - 0.7 * (d / T.explosionRadius))), attackerId ?? null, JEEP_INDEX);
  }
}

export function updateVehicles(game, dt) {
  if (!active(game)) return;
  for (const v of game.vehicles) {
    if (v.state === VEHICLE_STATE.JAMMED && game.now >= v.jamUntil) v.state = VEHICLE_STATE.LOCKED;
    if (v.state === VEHICLE_STATE.DESTROYED) continue;
    // Quien se desconectó o cayó deja el asiento
    v.seats = v.seats.map((id) => {
      const p = game.room.players.get(id);
      return id !== null && (!p || !p.alive || p.vehicleId !== v.id) ? null : id;
    });
    // Sin conductor frena solo
    if (driverOf(v) === null && v.speed !== 0) applyVehicleInput(v, { mx: 0, my: 0 }, dt);
    if (v.crashed && Math.abs(v.speed) > 2) damageVehicle(game, v, 10, null);
    v.crashed = false;
    placeOccupants(game, v);

    // Atropello: daño según la velocidad y empujón
    const T = vehicleType(v);
    if (Math.abs(v.speed) < T.runOverMinSpeed || T.water) continue;
    for (const p of game.room.players.values()) {
      if (!p.alive || p.vehicleId !== null || p.deploying) continue;
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d = Math.hypot(dx, dy);
      if (d > T.radius + PLAYER_RADIUS || game.now - (v.hits.get(p.id) ?? -Infinity) < RUN_OVER_COOLDOWN_MS) continue;
      v.hits.set(p.id, game.now);
      damagePlayer(game, p, Math.round(Math.abs(v.speed) * T.runOverDamagePerSpeed), driverOf(v), JEEP_INDEX);
      const push = T.radius + PLAYER_RADIUS + 0.8;
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
  // [id, x, y, rumbo, velocidad, vida, conductor, primer pasajero, estado, tipo, [todos los pasajeros]]
  return game.vehicles.map((v) => [
    v.id, r2(v.x), r2(v.y), r2(v.heading), r2(v.speed), Math.ceil(v.hp), v.seats[0] ?? 0, v.seats[1] ?? 0, v.state,
    VEHICLE_TYPE_IDS.indexOf(v.type), v.seats.slice(1).map((id) => id ?? 0),
  ]);
}
