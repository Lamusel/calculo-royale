// Despliegue en bus y elegir punto (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOY, MAP_HALF, TICK_MS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { applyInput } from '@calculo-royale/shared/movement';
import { damagePlayer, targetsAt } from '../server/src/game/combat.js';
import { busRoute } from '../server/src/game/deploy.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';

function makeRoom(n = 3) {
  const room = {
    phase: 'playing',
    players: new Map(),
    topics: ['integrales_dobles'],
    broadcasts: [],
    emitTo() {},
    broadcast(event, data) {
      this.broadcasts.push({ event, data });
    },
    broadcastState() {},
    respawnInLobby() {},
    finishMatch() {},
    sendClassStats() {},
  };
  room.game = new Game(room);
  for (let i = 1; i <= n; i++) {
    const p = new Player({ id: i, name: `P${i}`, color: '#fff', token: `t${i}` });
    p.teleport(-30 + i * 10, -20);
    p.connected = true;
    room.players.set(i, p);
  }
  room.game.startMatch();
  return room;
}
const advance = (room, ms) => {
  for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) room.game.update();
};
let seq = 0;
const send = (p, buttons, mx = 0, my = 0) => p.queueInput({ seq: ++seq, mx, my, aim: 0, buttons, viewTick: 0, aimDist: 0 });
const flagsOf = (room, p) => room.game.snapshot([...room.players.values()])[1].find((e) => e[0] === p.id)[8];

test('ruta del bus: cruza el mapa, pasa cerca del centro y empieza y termina fuera', () => {
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 300; i++) {
    const r = busRoute(rand);
    const length = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
    assert.ok(length > MAP_HALF * 1.8, `cruza el mapa (${length})`);
    for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y1]]) {
      assert.ok(Math.max(Math.abs(x), Math.abs(y)) <= MAP_HALF + DEPLOY.routeMargin + 0.6, 'no vuela de más');
      assert.ok(Math.max(Math.abs(x), Math.abs(y)) >= MAP_HALF, 'empieza o termina en el borde o fuera');
    }
    // Distancia de la recta al centro
    const d = Math.abs((r.x1 - r.x0) * r.y0 - (r.y1 - r.y0) * r.x0) / length;
    assert.ok(d <= MAP_HALF * DEPLOY.routeCenterJitter + 1e-6);
  }
});

test('todos empiezan en el bus; no se puede saltar antes de que arranque; saltar → caída → paracaídas → suelo', () => {
  const room = makeRoom();
  room.game.startDeploy('bus');
  const [p] = room.players.values();
  const info = room.broadcasts.find((b) => b.event === EVENTS.MATCH_DEPLOY).data;
  assert.equal(info.mode, 'bus');
  assert.equal(info.route.length, 4);
  assert.ok(flagsOf(room, p) & PLAYER_FLAGS.IN_BUS);
  send(p, BUTTONS.JUMP);
  advance(room, TICK_MS);
  assert.equal(p.deploy.phase, 'bus', 'el bus todavía no arrancó');
  advance(room, DEPLOY.busWaitMs + 500);
  const bus = room.game.snapshot([...room.players.values()])[12];
  assert.equal(bus.length, 4);
  // Va en el bus (recortado al borde mientras el bus sobrevuela fuera del mapa)
  const edge = (v) => Math.max(-MAP_HALF + 0.6, Math.min(MAP_HALF - 0.6, v));
  assert.ok(Math.hypot(p.x - edge(bus[0]), p.y - edge(bus[1])) < 0.01, 'va en el bus');
  send(p, BUTTONS.JUMP);
  advance(room, TICK_MS);
  assert.equal(p.deploy.phase, 'fall');
  assert.ok(flagsOf(room, p) & PLAYER_FLAGS.FALLING);
  const entry = room.game.snapshot([...room.players.values()])[1].find((e) => e[0] === p.id);
  assert.ok(entry[9] > DEPLOY.chuteAltitude, 'la altura viaja en el snapshot');
  advance(room, ((DEPLOY.busAltitude - DEPLOY.chuteAltitude) / DEPLOY.fallSpeed) * 1000 + 200);
  assert.equal(p.deploy.phase, 'chute');
  advance(room, (DEPLOY.chuteAltitude / DEPLOY.chuteSpeed) * 1000 + 200);
  assert.equal(p.deploy, null, 'aterrizó');
  assert.equal(p.weaponId, 'm1911');
  const landed = room.game.snapshot([...room.players.values()])[1].find((e) => e[0] === p.id);
  assert.equal(landed[9], 0, 'en el suelo la altura es 0 (desde la fase 25 siempre viaja, seguida del equipo)');
});

test('al final de la ruta saltan todos los que queden', () => {
  const room = makeRoom();
  room.game.startDeploy('bus');
  const { durationMs } = room.game.deploy;
  advance(room, DEPLOY.busWaitMs + durationMs + 200);
  for (const p of room.players.values()) assert.notEqual(p.deploy?.phase, 'bus');
  assert.deepEqual(room.game.snapshot([...room.players.values()])[12], [], 'el bus ya no está');
});

test('en el aire: se dirige con el joystick, no dispara, no es blanco y no recibe daño de zona ni granadas', () => {
  const room = makeRoom();
  room.game.startDeploy('bus');
  const [p, q] = room.players.values();
  advance(room, DEPLOY.busWaitMs + 200);
  send(p, BUTTONS.JUMP);
  advance(room, TICK_MS);
  const x = p.x;
  const mag = p.mag;
  const toCenter = -Math.sign(x) || 1;
  send(p, BUTTONS.FIRE, toCenter, 0);
  advance(room, TICK_MS * 2);
  assert.ok((p.x - x) * toCenter > 0, 'se mueve en el aire');
  assert.equal(p.mag, mag, 'no dispara');
  assert.ok(!targetsAt(room.game, q, room.game.tick).some((t) => t.id === p.id), 'no es blanco');
  // La zona no le hace daño aunque esté afuera
  const hp = p.hp;
  room.game.zone.current = { cx: 1000, cy: 1000, p: 1, q: 1 };
  room.game.zone.state = 'shrinking';
  room.game.zone.phase = 0;
  advance(room, 500);
  assert.equal(p.hp, hp);
});

test('movimiento compartido en el aire: más rápido en caída libre que con paracaídas, sin chocar', () => {
  const free = { x: 0, y: 0, aim: 0, air: 'fall' };
  const chute = { x: 0, y: 0, aim: 0, air: 'chute' };
  applyInput(free, { mx: 1, my: 0, aim: 0, buttons: 0 }, 1);
  applyInput(chute, { mx: 1, my: 0, aim: 0, buttons: 0 }, 1);
  assert.ok(Math.abs(free.x - DEPLOY.airSpeed) < 1e-9);
  assert.ok(Math.abs(chute.x - DEPLOY.chuteAirSpeed) < 1e-9);
});

test('elegir punto: 10 s para tocar el mapa; caen en paracaídas donde eligieron (o al azar)', () => {
  const room = makeRoom();
  room.game.startDeploy('punto');
  const [p, q] = room.players.values();
  assert.equal(room.broadcasts.find((b) => b.event === EVENTS.MATCH_DEPLOY).data.mode, 'punto');
  assert.ok(flagsOf(room, p) & PLAYER_FLAGS.IN_BUS, 'esperando, no se dibuja');
  room.game.chooseDeployPoint(p, 12, -7);
  room.game.chooseDeployPoint(p, 9999, 9999); // fuera del mapa: se recorta
  advance(room, DEPLOY.pickMs + 200);
  assert.equal(p.deploy.phase, 'chute');
  assert.ok(Math.abs(p.x) <= MAP_HALF && Math.abs(p.y) <= MAP_HALF);
  assert.equal(q.deploy.phase, 'chute', 'quien no eligió cae igual');
  advance(room, (DEPLOY.pointAltitude / DEPLOY.chuteSpeed) * 1000 + 200);
  assert.equal(p.deploy, null);
});
