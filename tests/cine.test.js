// Cine: duelo final y repetición de la mejor jugada (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUEL, REPLAY, TICK_MS, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { damagePlayer } from '../server/src/game/combat.js';
import { downsample, duelCircle } from '../server/src/game/cine.js';
import { zoneContains } from '../server/src/game/Zone.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';

function makeRoom() {
  const room = {
    phase: 'lobby',
    players: new Map(),
    topics: ['derivadas_parciales'],
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
    p.teleport(-20 + i * 8, -10);
    p.connected = true;
    p.socketId = `s${i}`;
    room.players.set(p.id, p);
    return p;
  });
}

const start = (room) => {
  room.phase = 'playing';
  room.game.startMatch();
  for (const p of room.players.values()) p.hp = 1e9;
};
const advance = (room, ms) => {
  for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) room.game.update();
};
const kill = (room, target, by, weapon = 'pistol') => damagePlayer(room.game, target, 1e10, by?.id ?? null, WEAPON_IDS.indexOf(weapon));
let seq = 0;
const walk = (p) => p.queueInput({ seq: ++seq, mx: 1, my: 0, aim: 0, buttons: 0, viewTick: 0, aimDist: 0 });

test('duelo final: al quedar 2 se anuncia una vez, se congela la presentación y la zona salta al último círculo', () => {
  const room = makeRoom();
  const [a, b, c] = addPlayers(room, 3);
  start(room);
  advance(room, TICK_MS);
  kill(room, c, a);
  advance(room, TICK_MS);
  const duels = room.broadcasts.filter((e) => e.event === EVENTS.MATCH_DUEL);
  assert.equal(duels.length, 1);
  assert.deepEqual(duels[0].data.ids.sort(), [a.id, b.id]);
  // Congelados: el input no mueve
  const x = a.x;
  walk(a);
  advance(room, TICK_MS * 2);
  assert.equal(a.x, x);
  // Zona: último círculo de radio DUEL.radius que se cierra después de la presentación
  const zone = room.game.zone;
  assert.equal(zone.target.p, DUEL.radius);
  assert.equal(zone.target.q, DUEL.radius);
  advance(room, DUEL.introMs);
  assert.equal(zone.state, 'shrinking');
  walk(a);
  advance(room, TICK_MS * 2);
  assert.notEqual(a.x, x, 'después de la presentación ya se mueve');
  advance(room, 2000);
  assert.equal(room.broadcasts.filter((e) => e.event === EVENTS.MATCH_DUEL).length, 1, 'una sola vez');
});

test('el círculo del duelo cabe en la zona actual aunque los finalistas estén en el borde', () => {
  const current = { cx: 0, cy: 0, p: 15, q: 15 };
  const circle = duelCircle(current, { x: 14, y: 0 }, { x: 0, y: 14 });
  assert.ok(zoneContains(current, circle));
  assert.ok(Number.isInteger(circle.cx) && Number.isInteger(circle.cy));
});

test('con solo 2 jugadores desde el inicio no hay duelo', () => {
  const room = makeRoom();
  addPlayers(room, 2);
  start(room);
  advance(room, 500);
  assert.equal(room.game.duel, null);
});

test('la repetición elige la mejor jugada: el atropello le gana a una baja simple', () => {
  const room = makeRoom();
  const [a, b, c, d] = addPlayers(room, 5);
  start(room);
  advance(room, 3000);
  kill(room, c, a);
  advance(room, 3000);
  kill(room, d, b, 'jeep');
  advance(room, 2000);
  const replay = room.game.recorder.take();
  assert.equal(replay.kind, 'runover');
  assert.equal(replay.focusId, b.id);
  assert.match(replay.title, /Atropello de P2 a P4/);
  // Rango del clip alrededor del momento clave, a 10 Hz
  const ticks = replay.frames.map((f) => f[0]);
  assert.ok(ticks[0] >= replay.keyTick - REPLAY.beforeMs / TICK_MS);
  assert.ok(ticks.at(-1) <= replay.keyTick + REPLAY.afterMs / TICK_MS);
  assert.ok(ticks.includes(replay.keyTick) || ticks.includes(replay.keyTick + 1));
  assert.ok(ticks[1] - ticks[0] === REPLAY.sendEvery);
});

test('doble baja y francotirador de larga distancia puntúan más que una baja normal', () => {
  const room = makeRoom();
  const [a, , c, d, e] = addPlayers(room, 6);
  start(room);
  advance(room, 1000);
  kill(room, c, a);
  kill(room, d, a);
  advance(room, 2000);
  let replay = room.game.recorder.take();
  assert.equal(replay.kind, 'multikill');
  assert.match(replay.title, /Doble baja de P1/);
  // Francotirador a más de 30 m
  a.teleport(-40, -40);
  e.teleport(20, 20);
  kill(room, e, a, 'sniper');
  advance(room, 2000);
  replay = room.game.recorder.take();
  assert.equal(replay.kind, 'sniper');
});

test('al bajar a 10 Hz no se pierden disparos ni explosiones', () => {
  const frames = Array.from({ length: 5 }, (_, i) => [i, [], [], [], [[`s${i}`]], i === 1 ? [[1, 2]] : []]);
  const out = downsample(frames, 2);
  assert.deepEqual(out.map((f) => f[0]), [0, 2, 4]);
  assert.equal(out.flatMap((f) => f[4]).length, 5);
  assert.deepEqual(out[1][5], [[1, 2]]);
});

test('siempre hay repetición si hubo alguna baja de un jugador, y no trae respuestas', () => {
  const room = makeRoom();
  const [a, b] = addPlayers(room, 3);
  start(room);
  advance(room, 1000);
  kill(room, b, a);
  advance(room, 2000);
  const replay = room.game.recorder.take();
  assert.ok(replay.frames.length > 5);
  assert.ok(!JSON.stringify(replay).includes('correcta'));
});
