// Modo presentación (npm test): modo fácil, bots del servidor, medallas, frases rápidas con
// antispam, CSV de resultados y director de cámara del proyector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTOR, PHRASE_LIMIT, QUICK_PHRASES, TICK_MS } from '@calculo-royale/shared/constants';
import { EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import aritmetica from '../server/src/questions/basic/aritmetica.js';
import { drawQuestion, drawQuickQuestion } from '../server/src/questions/QuestionBank.js';
import { Room } from '../server/src/rooms/Room.js';
import { awardMedals } from '../server/src/game/medals.js';
import { sayPhrase } from '../server/src/game/phrases.js';
import { recordToCsv } from '../server/src/storage.js';
import { direct, scorePlayers } from '../client/src/game/director.js';

// Sala real con un io falso (sin red); el loop se detiene para manejar los ticks a mano
function makeRoom() {
  const sent = [];
  const io = {
    to: () => { const t = { emit: (event, data) => sent.push({ event, data }), volatile: { emit() {} }, except: () => t }; return t; },
    sockets: { sockets: new Map() },
  };
  let closed = false;
  const room = new Room('ABCD', io, () => (closed = true));
  room.game.stop();
  room.sent = sent;
  room.isClosed = () => closed;
  return room;
}
const fakeSocket = (id) => ({ id, data: {}, join() {}, leave() {}, emit() {} });

test('modo fácil: aritmética con la respuesta bien calculada, sube con la dificultad', () => {
  let s = 3;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const ops = { 1: '+', 2: '-', 3: '\\times', 4: '\\times' };
  for (let d = 1; d <= 4; d++) {
    for (let i = 0; i < 50; i++) {
      const q = aritmetica.generar(rand, 3, d);
      const expr = q.enunciado.match(/\$(.*)\$/)[1];
      assert.ok(expr.includes(ops[d]), expr);
      const value = Function(`return ${expr.replace(/\\times/g, '*')}`)();
      assert.equal(q.opciones[q.correcta], `$${value}$`);
      assert.equal(new Set(q.opciones).size, 3, 'opciones distintas');
    }
  }
  assert.equal(drawQuestion({ difficulty: 3, easy: true, rand }).tema, 'facil');
  assert.equal(drawQuickQuestion(rand, true).tema, 'facil');
  assert.notEqual(drawQuestion({ difficulty: 3, rand }).tema, 'facil');
});

test('bots: completar hasta N, quitarlos, y sin personas la sala se cierra', () => {
  const room = makeRoom();
  const human = room.addPlayer(fakeSocket('s1'), 'Profe');
  room.fillBots(8);
  assert.equal(room.players.size, 8);
  assert.equal([...room.players.values()].filter((p) => p.bot).length, 7);
  assert.ok(room.info().players.some((p) => p.bot));
  room.fillBots(4);
  assert.equal(room.players.size, 4);
  room.fillBots(0);
  assert.equal(room.players.size, 1);
  room.fillBots(5);
  room.removePlayer(human.id);
  assert.equal(room.isClosed(), true, 'los bots no mantienen viva la sala');
});

test('bots en partida: saltan del bus, aterrizan y caminan', () => {
  const room = makeRoom();
  room.addPlayer(fakeSocket('s1'), 'Profe');
  room.fillBots(10);
  room.start();
  const bots = [...room.players.values()].filter((p) => p.bot);
  let landedAt = null;
  for (let i = 0; i < 60_000 / TICK_MS; i++) {
    room.game.update();
    if (landedAt === null && bots.every((b) => !b.deploy)) landedAt = new Map(bots.map((b) => [b.id, { x: b.x, y: b.y }]));
  }
  assert.ok(landedAt, 'todos aterrizaron');
  const moved = bots.filter((b) => !b.alive || Math.hypot(b.x - landedAt.get(b.id).x, b.y - landedAt.get(b.id).y) > 5).length;
  assert.ok(moved >= 8, `se movieron ${moved}`);
});

test('medallas: una por categoría para la mejor persona (sin bots); nada si nadie hizo nada', () => {
  const p = (id, extra) => ({ id, name: `P${id}`, kills: 0, stats: { correct: 0, answered: 0 }, damageDealt: 0, longestKill: 0, pickups: 0, ...extra });
  const medals = awardMedals([
    p(1, { kills: 3, pickups: 10 }),
    p(2, { stats: { correct: 4, answered: 5 }, longestKill: 41.6 }),
    p(3, { kills: 9, bot: true }),
  ]);
  const by = Object.fromEntries(medals.map((m) => [m.id, m]));
  assert.equal(by.bajas.playerId, 1, 'el bot no gana medallas');
  assert.equal(by.calculista.playerId, 2);
  assert.equal(by.precision.value, 80);
  assert.equal(by.francotirador.value, 42);
  assert.equal(by.saqueador.value, 10);
  assert.equal(by.dano, undefined, 'nadie hizo daño');
});

test('frases rápidas: solo las de la lista y con antispam', () => {
  const sent = [];
  const room = { phase: 'playing', broadcast: (event, data) => sent.push({ event, data }) };
  const player = { id: 7, alive: true, phrases: [] };
  assert.equal(sayPhrase(room, player, QUICK_PHRASES.length, 0), false, 'índice fuera de la lista');
  assert.equal(sayPhrase(room, player, 'hola', 0), false);
  assert.equal(sayPhrase(room, player, 0, 1000), true);
  assert.equal(sayPhrase(room, player, 1, 1000 + PHRASE_LIMIT.gapMs - 1), false, 'muy seguido');
  let t = 1000;
  let said = 1;
  // Dentro de una misma ventana: aunque respete la espera, no pasa del tope
  for (let i = 0; i < 6; i++) {
    t += PHRASE_LIMIT.gapMs;
    if (sayPhrase(room, player, 2, t)) said++;
  }
  assert.equal(said, PHRASE_LIMIT.max, 'tope por ventana');
  assert.ok(sayPhrase(room, player, 3, t + PHRASE_LIMIT.windowMs), 'pasada la ventana vuelve a poder');
  assert.deepEqual(sent[0], { event: EVENTS.PHRASE, data: { id: 7, index: 0 } });
  assert.equal(sayPhrase(room, { id: 8, alive: false }, 0, 0), false, 'los caídos no hablan en partida');
});

test('CSV: una fila por jugador, modo fácil y bots marcados, comillas escapadas', () => {
  const csv = recordToCsv({
    codigo: 'ABCD',
    fecha: '2026-10-23T15:00:00.000Z',
    modo_facil: true,
    ranking: [{ name: 'Ana; "la profe"', score: 50 }, { name: 'Bot 1', score: 10 }],
    jugadores: [
      { nombre: 'Bot 1', bot: true, puesto: 2, bajas: 0, aciertos: 0, respuestas: 0, por_tema: {} },
      { nombre: 'Ana; "la profe"', bot: false, puesto: 1, bajas: 2, aciertos: 3, respuestas: 4, por_tema: { polares: { correct: 1, total: 2 } } },
    ],
  });
  assert.ok(csv.startsWith('﻿'), 'BOM para las tildes en Excel');
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes('jugador;equipo;tipo;puesto'));
  assert.ok(lines[1].includes('"Ana; ""la profe"""'), 'escapado');
  assert.ok(lines[1].includes('fácil (no cuenta)') && lines[1].endsWith(';polares'));
  assert.ok(lines[2].includes(';bot;'));
});

test('director: sigue la pelea o la baja, respeta la duración mínima y cambia si hay algo mucho mejor', () => {
  const players = new Map([
    [1, { x: 0, y: 0, flags: 0 }],
    [2, { x: 5, y: 0, flags: 0 }],
    [3, { x: 100, y: 100, flags: 0 }],
    [4, { x: -100, y: 0, flags: PLAYER_FLAGS.DEAD }],
  ]);
  const state = { phase: 'playing', players, killfeed: [], lastShot: new Map([[1, 9_500]]) };
  const scores = Object.fromEntries(scorePlayers(state, 10_000).map((s) => [s.id, s.score]));
  assert.ok(scores[1] > scores[3], 'el que pelea vale más');
  assert.equal(scores[4], undefined, 'los caídos no');
  let shot = direct(state, null, 10_000, () => 0);
  assert.equal(shot.id, 1);
  // Una baja lejos no lo mueve antes del mínimo…
  const later = { ...state, killfeed: [{ killer: 3, at: 15_000 }] };
  assert.equal(direct(later, shot, 11_000).id, 1);
  // …pero sí después del mínimo, si es claramente mejor
  shot = direct({ ...later, lastShot: new Map() }, shot, 10_000 + DIRECTOR.minShotMs + 1);
  assert.equal(shot.id, 3);
  // Si muere el protagonista, cambia ya
  players.set(3, { ...players.get(3), flags: PLAYER_FLAGS.DEAD });
  assert.notEqual(direct(state, shot, 10_000 + DIRECTOR.minShotMs + 2).id, 3);
  assert.equal(direct({ ...state, phase: 'lobby' }, shot, 0), null, 'en el lobby, plano general');
});
