// Cajas de suministro (npm test): flujo completo en el Game real con una sala falsa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALARM_MS, CRATE_LOCK_MS, MAX_HP, RADAR_MS, RARITIES, TICK_MS, TOPICS } from '@calculo-royale/shared/constants';
import { CRATE_STATE, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { SUPPLY_CRATES, TRAINING } from '@calculo-royale/shared/mapLayout';
import { applyLoot, LOOT_TABLES, rollLoot } from '../server/src/game/crates.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';

function makeRoom(phase = 'playing', topics) {
  const room = {
    phase,
    topics,
    players: new Map(),
    emitted: [],
    emitTo(p, event, data) {
      this.emitted.push({ to: p.id, event, data });
    },
    broadcast() {},
    broadcastState() {},
    respawnInLobby() {},
  };
  room.game = new Game(room);
  return room;
}

function addPlayer(room, id, x, y) {
  const p = new Player({ id, name: `P${id}`, color: '#fff', token: `t${id}` });
  p.teleport(x, y);
  p.connected = true;
  p.socketId = `s${id}`;
  room.players.set(id, p);
  return p;
}

const tick = (room, n = 1) => {
  for (let i = 0; i < n; i++) room.game.update();
};
const last = (room, event) => [...room.emitted].reverse().find((e) => e.event === event)?.data;
let seq = 0;
const move = (room, p) => p.queueInput({ seq: ++seq, mx: 1, my: 0, aim: 0, buttons: 0, viewTick: 0, aimDist: 0 });

// Abre la caja más cercana y devuelve lo que recibió el cliente y la respuesta real (solo servidor)
function open(room, p) {
  room.game.interact(p);
  const question = last(room, EVENTS.CRATE_QUESTION);
  return { question, correct: p.question?.q.correcta };
}

test('abrir una caja manda la pregunta sin la respuesta correcta y marca al jugador expuesto', () => {
  const room = makeRoom();
  const c = SUPPLY_CRATES[0];
  const p = addPlayer(room, 1, c.x + 1, c.y);
  const { question } = open(room, p);
  assert.ok(question, 'llegó la pregunta');
  assert.equal(question.opciones.length, 4);
  assert.equal(question.timeLimitMs, RARITIES[c.rarity].timeMs);
  const json = JSON.stringify(question);
  assert.ok(!json.includes('correcta') && !json.includes('explicacion') && !json.includes('valor'), json);
  tick(room);
  const snap = room.game.snapshot([...room.players.values()]);
  assert.ok(snap[1][0][8] & PLAYER_FLAGS.ANSWERING);
  assert.equal(snap[6][0], CRATE_STATE.BUSY);
});

test('lejos de una caja no se abre nada', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, 0, -30);
  room.game.interact(p);
  assert.equal(p.question, null);
});

test('acierto: botín de la rareza, caja abierta y explicación', () => {
  const room = makeRoom();
  const rare = SUPPLY_CRATES.findIndex((c) => c.rarity === 1);
  const c = SUPPLY_CRATES[rare];
  const p = addPlayer(room, 1, c.x, c.y + 1);
  const { correct } = open(room, p);
  room.game.answerCrate(p, rare, correct);
  const result = last(room, EVENTS.CRATE_RESULT);
  assert.equal(result.outcome, 'correct');
  assert.ok(result.loot.length >= 1);
  assert.ok(result.explicacion.length > 0);
  assert.equal(room.game.crates[rare].state, CRATE_STATE.OPEN);
  assert.equal(p.stats.correct, 1);
  // Ya saqueada: no se puede volver a abrir
  room.game.interact(p);
  assert.equal(p.question, null);
});

test('fallo: caja bloqueada 15 s, alarma visible 3 s y la pregunta queda para los resultados', () => {
  const room = makeRoom();
  const c = SUPPLY_CRATES[0];
  const p = addPlayer(room, 1, c.x + 1, c.y);
  const { correct } = open(room, p);
  room.game.answerCrate(p, 0, (correct + 1) % 4);
  assert.equal(last(room, EVENTS.CRATE_RESULT).outcome, 'wrong');
  tick(room);
  assert.equal(room.game.crates[0].state, CRATE_STATE.LOCKED);
  assert.deepEqual(room.game.snapshot([...room.players.values()])[7], [[c.x, c.y]]);
  assert.equal(p.stats.failed.length, 1);
  assert.equal(p.stats.failed[0].correcta, correct);
  tick(room, ALARM_MS / TICK_MS);
  assert.deepEqual(room.game.alarms, []);
  tick(room, (CRATE_LOCK_MS - ALARM_MS) / TICK_MS);
  assert.equal(room.game.crates[0].state, CRATE_STATE.CLOSED);
});

test('moverse cancela sin bloquear la caja', () => {
  const room = makeRoom();
  const c = SUPPLY_CRATES[0];
  const p = addPlayer(room, 1, c.x + 1, c.y);
  open(room, p);
  move(room, p);
  tick(room);
  assert.equal(p.question, null);
  assert.equal(last(room, EVENTS.CRATE_RESULT).outcome, 'cancelled');
  assert.equal(room.game.crates[0].state, CRATE_STATE.CLOSED);
  assert.equal(p.stats.answered, 0);
});

test('se acaba el tiempo: cuenta como fallo', () => {
  const room = makeRoom();
  const c = SUPPLY_CRATES[0];
  const p = addPlayer(room, 1, c.x + 1, c.y);
  open(room, p);
  tick(room, RARITIES[c.rarity].timeMs / TICK_MS + 2);
  assert.equal(last(room, EVENTS.CRATE_RESULT).outcome, 'timeout');
  assert.equal(room.game.crates[0].state, CRATE_STATE.LOCKED);
});

test('dos jugadores no pueden abrir la misma caja a la vez', () => {
  const room = makeRoom();
  const c = SUPPLY_CRATES[0];
  const a = addPlayer(room, 1, c.x + 1, c.y);
  const b = addPlayer(room, 2, c.x - 1, c.y);
  open(room, a);
  room.game.interact(b);
  assert.equal(b.question, null);
});

test('racha de 3 aciertos = radar 10 s', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, 0, 0);
  for (let i = 0; i < 3; i++) {
    const c = SUPPLY_CRATES[i];
    p.teleport(c.x + 1, c.y);
    const { correct } = open(room, p);
    room.game.answerCrate(p, i, correct);
  }
  assert.equal(p.streak, 3);
  assert.equal(last(room, EVENTS.CRATE_RESULT).radar, true);
  assert.ok(p.radarUntil - room.game.now === RADAR_MS);
});

test('Todo o nada: la dorada da botín doble o quita el chaleco', () => {
  const gold = SUPPLY_CRATES.findIndex((c) => c.rarity === 3);
  const c = SUPPLY_CRATES[gold];

  const win = makeRoom();
  const p = addPlayer(win, 1, c.x + 1, c.y);
  const { correct } = open(win, p);
  win.game.answerCrate(p, gold, correct);
  // Dos tiradas épicas: al menos 2 objetos (si las dos salen "Chaleco 3", son justo 2)
  assert.equal(last(win, EVENTS.CRATE_RESULT).loot.length >= 2, true, 'dos tiradas épicas');

  const lose = makeRoom();
  const q = addPlayer(lose, 1, c.x + 1, c.y);
  q.giveItem('armor');
  q.giveItem('armor');
  assert.equal(q.armorLevel, 2);
  const r = open(lose, q);
  lose.game.answerCrate(q, gold, (r.correct + 1) % 4);
  assert.equal(q.armorLevel, 0);
  assert.equal(last(lose, EVENTS.CRATE_RESULT).lostArmor, true);
});

test('las preguntas respetan los temas de la sala y la dificultad de la rareza', () => {
  const room = makeRoom('playing', ['lagrange']);
  const epic = SUPPLY_CRATES.findIndex((c) => c.rarity === 2);
  const c = SUPPLY_CRATES[epic];
  const p = addPlayer(room, 1, c.x + 1, c.y);
  const { question } = open(room, p);
  assert.equal(question.tema, TOPICS.lagrange);
  assert.equal(p.question.q.dificultad, 3);
});

test('caja de práctica: solo en el lobby, no cuenta en las estadísticas y se vuelve a cerrar', () => {
  const room = makeRoom('lobby');
  const practice = room.game.crates.findIndex((c) => c.practice);
  const p = addPlayer(room, 1, TRAINING.crate.x + 1, TRAINING.crate.y);
  const { correct } = open(room, p);
  room.game.answerCrate(p, practice, correct);
  assert.equal(p.stats.answered, 0);
  tick(room);
  assert.equal(room.game.crates[practice].state, CRATE_STATE.OPEN);
  tick(room, 4000 / TICK_MS + 1);
  assert.equal(room.game.crates[practice].state, CRATE_STATE.CLOSED);
  // En el lobby las del mapa no existen
  const states = room.game.snapshot([...room.players.values()])[6];
  assert.equal(states[0], CRATE_STATE.HIDDEN);
});

test('botín: venda, botiquín, munición y armas', () => {
  const p = new Player({ id: 1, name: 'A', color: '#fff', token: 't' });
  p.hp = 50;
  applyLoot(p, 'bandage');
  assert.equal(p.hp, 75);
  applyLoot(p, 'medkit');
  assert.equal(p.hp, MAX_HP);
  applyLoot(p, 'rifle');
  const reserve = p.primary.reserve;
  applyLoot(p, 'ammo');
  assert.ok(p.primary.reserve > reserve);
  applyLoot(p, 'armor3');
  applyLoot(p, 'armor1');
  assert.equal(p.armorLevel, 3, 'no baja de nivel');
  for (const table of LOOT_TABLES) for (const combo of table) for (const item of combo) assert.ok(applyLoot(p, item));
  assert.equal(rollLoot(3).length >= 2, true);
});
