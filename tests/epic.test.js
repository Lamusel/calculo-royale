// Mecánicas épicas: líder, clima, viento y jeeps (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JEEP, LEADER, PLAYER_RADIUS, TICK_MS, WEATHERS, WIND_ACCEL } from '@calculo-royale/shared/constants';
import { EVENTS, PLAYER_FLAGS, VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { applyVehicleInput } from '@calculo-royale/shared/vehicle';
import { damagePlayer, targetsAt } from '../server/src/game/combat.js';
import { pickWeather, windOf } from '../server/src/game/epic.js';
import { damageVehicle, vehicleTargetId } from '../server/src/game/vehicles.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';

function makeRoom() {
  const room = {
    phase: 'lobby',
    players: new Map(),
    topics: ['derivadas_parciales', 'gradiente'],
    emitted: [],
    broadcasts: [],
    emitTo(p, event, data) {
      this.emitted.push({ to: p.id, event, data });
    },
    broadcast(event, data) {
      this.broadcasts.push({ event, data });
    },
    broadcastState() {},
    respawnInLobby() {},
    finishMatch() {
      this.phase = 'results';
    },
    sendClassStats() {},
  };
  room.game = new Game(room);
  return room;
}

function addPlayers(room, n) {
  return Array.from({ length: n }, (_, i) => {
    const p = new Player({ id: i + 1, name: `P${i + 1}`, color: '#fff', token: `t${i}` });
    p.teleport(-50 + (i % 6) * 20, -50 + Math.floor(i / 6) * 20);
    p.connected = true;
    p.socketId = `s${i}`;
    room.players.set(p.id, p);
    return p;
  });
}

const start = (room) => {
  room.phase = 'playing';
  room.game.startMatch();
  // Que la zona no mate a nadie mientras se prueba
  for (const p of room.players.values()) p.hp = 1e9;
};
const advance = (room, ms) => {
  for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) room.game.update();
};
const last = (room, to, event) => [...room.emitted].reverse().find((e) => e.to === to && e.event === event)?.data;
let seq = 0;
const drive = (p, mx, my) => p.queueInput({ seq: ++seq, mx, my, aim: 0, buttons: 0, viewTick: 0, aimDist: 0 });

// Pone al jugador junto al jeep y le enciende el motor respondiendo bien
function startEngine(room, p, v) {
  p.teleport(v.x + 1, v.y);
  room.game.interact(p);
  room.game.answerCrate(p, null, p.engineQuestion.q.correcta);
}

test('el clima: el host elige o sale al azar; solo la arena trae viento', () => {
  assert.equal(pickWeather('niebla').weather, 'niebla');
  const random = pickWeather('aleatorio', () => 0.99);
  assert.ok(WEATHERS[random.weather]);
  assert.equal(windOf({ weather: 'lluvia', windAngle: 1 }), null);
  const wind = windOf({ weather: 'arena', windAngle: 0 });
  assert.equal(Math.round(wind.x), WIND_ACCEL);
  assert.equal(Math.round(wind.y), 0);
});

test('con arena el viento desvía la granada en vuelo', () => {
  const room = makeRoom();
  addPlayers(room, 2);
  start(room);
  room.game.wind = { x: 0, y: WIND_ACCEL };
  room.game.grenades.push({ id: 99, x: 0, y: 0, vx: 10, vy: 0, decel: 2, ownerId: 1, explodeAt: room.game.now + 5000 });
  advance(room, 300);
  const g = room.game.grenades.find((x) => x.id === 99);
  assert.ok(g.vy > 0, 'el viento empuja la granada');
});

test('el líder aparece desde la fase de zona indicada, lleva bandera y el que lo elimina cobra botín', () => {
  const room = makeRoom();
  const [a, b] = addPlayers(room, 3);
  start(room);
  a.kills = 2;
  advance(room, LEADER.checkMs + TICK_MS);
  assert.equal(room.game.leaderId, null, 'antes de la fase no hay líder');
  room.game.zone.phase = LEADER.fromPhase;
  advance(room, LEADER.checkMs + TICK_MS);
  assert.equal(room.game.leaderId, a.id);
  const snap = room.game.snapshot([...room.players.values()]);
  const entry = snap[1].find((e) => e[0] === a.id);
  assert.ok(entry[8] & PLAYER_FLAGS.LEADER);
  damagePlayer(room.game, a, 1e10, b.id, 0);
  assert.equal(room.game.leaderId, null);
  const reward = last(room, b.id, EVENTS.CRATE_RESULT);
  assert.equal(reward.title, 'Recompensa: eliminaste al líder');
  assert.ok(reward.loot.length > 0);
});

test('física del jeep: acelera hacia el joystick, gira con límite y no pasa de la velocidad máxima', () => {
  // Carril libre de obstáculos en y = −10
  const v = { x: -10, y: -10, heading: 0, speed: 0 };
  for (let i = 0; i < 30; i++) applyVehicleInput(v, { mx: 1, my: 0 }, 0.05);
  assert.ok(v.speed > JEEP.maxSpeed * 0.9 && v.speed <= JEEP.maxSpeed + 1e-9);
  assert.ok(v.x > 0);
  const before = v.heading;
  applyVehicleInput(v, { mx: 0, my: 1 }, 0.05);
  assert.ok(Math.abs(v.heading - before - JEEP.turnRate * 0.05) < 1e-9, 'gira como mucho turnRate·dt');
  for (let i = 0; i < 100; i++) applyVehicleInput(v, { mx: 0, my: 0 }, 0.05);
  assert.equal(v.speed, 0, 'sin joystick frena');
  // Joystick hacia atrás: reversa sin dar la vuelta
  const r = { x: -10, y: -10, heading: 0, speed: 0 };
  for (let i = 0; i < 20; i++) applyVehicleInput(r, { mx: -1, my: 0 }, 0.05);
  assert.ok(r.speed < 0 && r.x < -10, 'va en reversa');
  assert.ok(Math.abs(r.heading) < 1e-9, 'sigue mirando al frente');
});

test('código del motor: la pregunta no trae la respuesta; acertar enciende y sube como conductor', () => {
  const room = makeRoom();
  const [p, q] = addPlayers(room, 3);
  start(room);
  const v = room.game.vehicles[0];
  p.teleport(v.x + 1, v.y);
  room.game.interact(p);
  const ask = last(room, p.id, EVENTS.CRATE_QUESTION);
  assert.equal(ask.title, 'Código del motor');
  assert.ok(!JSON.stringify(ask).includes('correcta'));
  room.game.answerCrate(p, null, p.engineQuestion.q.correcta);
  assert.equal(v.state, VEHICLE_STATE.READY);
  assert.equal(p.vehicleId, v.id);
  assert.equal(p.seat, 'driver');
  // El segundo sube de pasajero
  q.teleport(v.x - 1, v.y);
  room.game.interact(q);
  assert.equal(q.seat, 'passenger');
  const snap = room.game.snapshot([...room.players.values()]);
  assert.deepEqual(snap[11][0].slice(6, 9), [p.id, q.id, VEHICLE_STATE.READY]);
  // Bajarse lo deja fuera del jeep
  room.game.interact(q);
  assert.equal(q.vehicleId, null);
  assert.ok(Math.hypot(q.x - v.x, q.y - v.y) > JEEP.radius);
});

test('fallar el código atasca el motor un rato', () => {
  const room = makeRoom();
  const [p] = addPlayers(room, 2);
  start(room);
  const v = room.game.vehicles[1];
  p.teleport(v.x + 1, v.y);
  room.game.interact(p);
  room.game.answerCrate(p, null, (p.engineQuestion.q.correcta + 1) % 4);
  assert.equal(v.state, VEHICLE_STATE.JAMMED);
  room.game.interact(p);
  assert.equal(p.engineQuestion, null, 'atascado no pregunta');
  advance(room, JEEP.engineLockMs + TICK_MS);
  assert.equal(v.state, VEHICLE_STATE.LOCKED);
  room.game.interact(p);
  assert.ok(p.engineQuestion, 'destrabado vuelve a preguntar');
});

test('el conductor mueve el jeep y atropella a quien está a pie', () => {
  const room = makeRoom();
  const [driver, victim] = addPlayers(room, 3);
  start(room);
  const v = room.game.vehicles[0];
  startEngine(room, driver, v);
  // Se lleva el jeep a un lugar abierto apuntando en +x
  Object.assign(v, { x: 0, y: 40, heading: 0, speed: JEEP.maxSpeed });
  victim.teleport(v.x + JEEP.radius + PLAYER_RADIUS - 0.1, v.y);
  const hp = victim.hp;
  drive(driver, 1, 0);
  advance(room, TICK_MS);
  assert.ok(victim.hp < hp, 'el atropello hace daño');
  assert.ok(Math.hypot(victim.x - v.x, victim.y - v.y) > JEEP.radius, 'lo empuja fuera');
  assert.ok(Math.hypot(driver.x - v.x, driver.y - v.y) < 1.5, 'el conductor va sentado en el jeep');
});

test('el pasajero no le pega a su propio jeep; destruirlo expulsa a todos y explota', () => {
  const room = makeRoom();
  const [driver, passenger, outsider] = addPlayers(room, 3);
  start(room);
  const v = room.game.vehicles[0];
  startEngine(room, driver, v);
  passenger.teleport(v.x - 1, v.y);
  room.game.interact(passenger);
  const ids = (shooter) => targetsAt(room.game, shooter, room.game.tick).map((t) => t.id);
  assert.ok(!ids(passenger).includes(vehicleTargetId(v.id)));
  assert.ok(ids(outsider).includes(vehicleTargetId(v.id)));
  damageVehicle(room.game, v, JEEP.hp, outsider.id);
  assert.equal(v.state, VEHICLE_STATE.DESTROYED);
  assert.equal(driver.vehicleId, null);
  assert.equal(passenger.vehicleId, null);
  assert.ok(room.game.explosions.length > 0);
});
