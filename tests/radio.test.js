// Operadores de radio, bombardeo, intercepción, puntaje y guardado (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BOMBING, INTERCEPT, MAX_HP, OPERATOR, SCORE, TICK_MS, ZONE_PHASES } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { insideZone, sectorBounds } from '@calculo-royale/shared/zone';
import { damagePlayer } from '../server/src/game/combat.js';
import { classStats } from '../server/src/game/radio.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';
import { score } from '../server/src/rooms/Room.js';
import { saveLocal, saveResults } from '../server/src/storage.js';

function makeRoom() {
  const room = {
    phase: 'lobby',
    players: new Map(),
    emitted: [],
    broadcasts: [],
    stats: [],
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
    sendClassStats(s) {
      this.stats.push(s);
    },
  };
  room.game = new Game(room);
  return room;
}

// Jugadores repartidos lejos unos de otros (sectores distintos)
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
};
const advance = (room, ms) => {
  for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) room.game.update();
};
const last = (room, to, event) => [...room.emitted].reverse().find((e) => e.to === to && e.event === event)?.data;
const kill = (room, p) => damagePlayer(room.game, p, 500, null, 0);

// Responde la transmisión pendiente del jugador (bien o mal)
function answer(room, p, right) {
  const t = p.transmission ?? p.intercept;
  room.game.answerTransmission(p, t.id, right ? t.q.correcta : (t.q.correcta + 1) % 4);
}

test('al caer en la fase 1 de la zona: operador que puede reanimar; la transmisión no trae la respuesta', () => {
  const room = makeRoom();
  const [p] = addPlayers(room, 3);
  start(room);
  kill(room, p);
  assert.equal(p.operator.mode, 'revive');
  advance(room, OPERATOR.firstDelayMs + TICK_MS);
  const t = last(room, p.id, EVENTS.TRANSMISSION);
  assert.equal(t.kind, 'operator');
  assert.ok(!JSON.stringify(t).includes('correcta'));
});

test('3 aciertos seguidos reaniman una vez dentro de la zona con pistola y 75 de vida; un fallo reinicia la cuenta', () => {
  const room = makeRoom();
  const [p] = addPlayers(room, 3);
  start(room);
  kill(room, p);
  const next = () => advance(room, OPERATOR.gapMs + OPERATOR.firstDelayMs + TICK_MS);
  next();
  answer(room, p, true);
  next();
  answer(room, p, true);
  next();
  answer(room, p, false);
  assert.equal(p.operator.streak, 0, 'el fallo reinicia');
  for (let i = 0; i < OPERATOR.reviveStreak; i++) {
    next();
    answer(room, p, true);
  }
  assert.equal(p.alive, true);
  assert.equal(p.hp, OPERATOR.reviveHp);
  assert.equal(p.weaponId, 'pistol');
  assert.equal(p.revived, true);
  assert.ok(insideZone(room.game.zone.current, p.x, p.y));
  assert.equal(last(room, p.id, EVENTS.TRANSMISSION_RESULT).revived, true);
  // Las respuestas de operador cuentan para el ranking
  assert.equal(p.stats.answered, 6);
  // Si vuelve a caer, ya no puede reanimar: vota
  kill(room, p);
  assert.equal(p.operator.mode, 'votes');
});

test('al caer después de la fase 2 se vota; el bombardeo cae en el sector más votado', () => {
  const room = makeRoom();
  const players = addPlayers(room, 10);
  start(room);
  room.game.zone.phase = 2;
  const [voter, target] = players;
  kill(room, voter);
  assert.equal(voter.operator.mode, 'votes');
  const sector = 'C3';
  room.game.voteSector(voter, sector);
  advance(room, OPERATOR.firstDelayMs + TICK_MS);
  answer(room, voter, true);
  assert.equal(room.game.votes.get(sector), 1);
  // Alguien queda dentro del sector
  const b = sectorBounds(sector);
  target.teleport(b.cx, b.cy);
  target.armor = 0;
  target.armorLevel = 0;
  room.game.nextBombAt = room.game.now;
  advance(room, TICK_MS);
  assert.equal(room.game.bombing.sector, sector);
  assert.ok(room.broadcasts.some((x) => x.event === EVENTS.RADIO_MESSAGE && x.data.kind === 'bombing'));
  advance(room, BOMBING.warningMs + TICK_MS);
  assert.ok(target.hp <= MAX_HP - BOMBING.damage, `vida ${target.hp}`);
  assert.equal(room.game.lastBombed, sector);
});

test('nunca el mismo sector dos veces seguidas', () => {
  const room = makeRoom();
  const players = addPlayers(room, 10);
  start(room);
  room.game.lastBombed = 'C3';
  room.game.votes.set('C3', 5);
  room.game.votes.set('A1', 1);
  room.game.nextBombAt = room.game.now;
  advance(room, TICK_MS);
  assert.equal(room.game.bombing.sector, 'A1');
  assert.ok(players.length);
});

test('con 5 vivos o menos no hay bombardeo', () => {
  const room = makeRoom();
  const players = addPlayers(room, 7);
  start(room);
  kill(room, players[0]);
  kill(room, players[1]);
  room.game.votes.set('B2', 9);
  room.game.nextBombAt = room.game.now;
  advance(room, TICK_MS);
  assert.equal(room.game.bombing, null);
});

test('interceptar: los 5 primeros reciben el centro de la zona que después se anuncia', () => {
  const room = makeRoom();
  const players = addPlayers(room, 8);
  // Nadie debe morir por la zona en esta prueba (si no, la partida termina y la zona se congela)
  for (const p of players) p.hp = 1e9;
  start(room);
  advance(room, INTERCEPT.everyMs + TICK_MS);
  assert.ok(players.every((p) => p.intercept), 'a todos los vivos les llega');
  for (const p of players) answer(room, p, true);
  const winners = players.filter((p) => p.intel);
  assert.equal(winners.length, INTERCEPT.winners);
  assert.equal(last(room, players[7].id, EVENTS.TRANSMISSION_RESULT).late, true);
  const intel = winners[0].intel;
  // Cuando se anuncia la zona siguiente, es la misma que recibieron los ganadores
  const phase = room.game.zone.phase;
  advance(room, room.game.zone.msToNextAnnounce(room.game.now) + TICK_MS);
  assert.equal(room.game.zone.phase, phase + 1);
  assert.equal(room.game.zone.target.cx, intel.cx);
  assert.equal(room.game.zone.target.cy, intel.cy);
  assert.equal(winners[0].intel, null, 'la pista desaparece al anunciarse');
  assert.ok(ZONE_PHASES[phase + 1]);
});

test('puntaje: puestos superados, bajas y aciertos', () => {
  assert.equal(score(1, 10, 2, 3), 9 * SCORE.place + 2 * SCORE.kill + 3 * SCORE.correct);
  assert.equal(score(10, 10, 0, 0), 0);
});

test('estadísticas de clase: suma los aciertos por tema de todos', () => {
  const room = makeRoom();
  const [a, b] = addPlayers(room, 2);
  a.stats.byTopic = { polares: { ok: 2, total: 3 } };
  b.stats.byTopic = { polares: { ok: 1, total: 1 }, lagrange: { ok: 0, total: 2 } };
  const s = classStats(room.game);
  assert.deepEqual(s.byTopic, { polares: { ok: 3, total: 4 }, lagrange: { ok: 0, total: 2 } });
  assert.equal(s.alive, 2);
});

test('sin Supabase los resultados se guardan en un JSON local', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cr-'));
  const record = { codigo: 'ABCD', fecha: new Date().toISOString(), ranking: [] };
  const file = await saveLocal(record, dir);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), record);
  // Con Supabase mal configurado, cae al archivo local sin romper la partida
  const saved = await saveResults(record, { SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_KEY: 'x' }, dir);
  assert.equal(saved.where, 'local');
});
