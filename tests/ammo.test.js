// Munición finita y "Obtener balas" (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMMO, optionCount, TICK_MS, WEAPONS, AMMO_TYPES } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS } from '@calculo-royale/shared/protocol';
import { applyLoot } from '../server/src/game/crates.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';
import { BANK, drawQuestion, GENERATORS, QUICK_GENERATORS, trimOptions } from '../server/src/questions/QuestionBank.js';

function makeRoom() {
  const room = {
    phase: 'playing',
    players: new Map(),
    topics: ['integrales_dobles'],
    emitted: [],
    emitTo(p, event, data) {
      this.emitted.push({ to: p.id, event, data });
    },
    broadcast() {},
    broadcastState() {},
    respawnInLobby() {},
    finishMatch() {},
    sendClassStats() {},
  };
  room.game = new Game(room);
  const p = new Player({ id: 1, name: 'Ana', color: '#fff', token: 't' });
  p.teleport(0, -40);
  p.connected = true;
  room.players.set(1, p);
  return { room, p };
}
const last = (room, event) => [...room.emitted].reverse().find((e) => e.event === event)?.data;
let seq = 0;
const input = (p, buttons, mx = 0) => p.queueInput({ seq: ++seq, mx, my: 0, aim: 0, buttons, viewTick: 0, aimDist: 0 });
const advance = (room, ms) => {
  for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) room.game.update();
};

test('arranque tenso: la M1911 con 3 balas y sin reserva; vacía no recarga', () => {
  const { room, p } = makeRoom();
  assert.equal(p.weaponId, 'm1911');
  assert.equal(p.mag, 3);
  assert.equal(p.reserve, 0);
  for (let i = 0; i < 20 && p.mag > 0; i++) {
    input(p, BUTTONS.FIRE);
    advance(room, 350);
  }
  assert.equal(p.mag, 0);
  input(p, BUTTONS.RELOAD);
  advance(room, 2000);
  assert.equal(p.mag, 0, 'sin reserva no hay recarga');
});

test('Obtener balas: pregunta de 2 opciones sin la respuesta; se mueve pero no dispara', () => {
  const { room, p } = makeRoom();
  room.game.requestAmmo(p);
  const q = last(room, EVENTS.AMMO_QUESTION);
  assert.ok(q);
  assert.equal(q.opciones.length, 2);
  assert.equal(q.timeLimitMs, AMMO.questionMs);
  assert.ok(!JSON.stringify(q).match(/correcta|explicacion|valor/));
  const mag = p.mag;
  const x = p.x;
  input(p, BUTTONS.FIRE, 1);
  advance(room, TICK_MS * 2);
  assert.equal(p.mag, mag, 'no dispara mientras responde');
  assert.ok(p.x > x, 'sí se mueve');
});

test('acierto: un cargador de munición del arma en mano (nunca cohetes)', () => {
  const { room, p } = makeRoom();
  room.game.requestAmmo(p);
  room.game.answerAmmo(p, p.ammoQuestion.id, p.ammoQuestion.q.correcta);
  assert.equal(p.ammo['9mm'], WEAPONS.m1911.magazine);
  assert.equal(last(room, EVENTS.AMMO_RESULT).correct, true);
  p.giveItem('m4a1');
  const before = p.ammo['556'];
  advance(room, AMMO.okCooldownMs + TICK_MS);
  room.game.requestAmmo(p);
  room.game.answerAmmo(p, p.ammoQuestion.id, p.ammoQuestion.q.correcta);
  assert.equal(p.ammo['556'], before + WEAPONS.m4a1.magazine);
  p.giveItem('rpg');
  const rockets = p.ammo.rocket ?? 0;
  p.addMagazine();
  assert.equal(p.ammo.rocket ?? 0, rockets, 'los cohetes no salen de Obtener balas');
  assert.equal(p.stats.correct, 2, 'cuenta para el ranking');
});

test('fallo o tiempo agotado: 10 s de espera antes de volver a pedir; morir cancela', () => {
  const { room, p } = makeRoom();
  room.game.requestAmmo(p);
  room.game.answerAmmo(p, p.ammoQuestion.id, (p.ammoQuestion.q.correcta + 1) % 2);
  assert.equal(p.reserve, 0);
  assert.equal(last(room, EVENTS.AMMO_RESULT).cooldownMs, AMMO.failCooldownMs);
  room.game.requestAmmo(p);
  assert.equal(p.ammoQuestion, null, 'en espera');
  advance(room, AMMO.failCooldownMs + TICK_MS);
  room.game.requestAmmo(p);
  assert.ok(p.ammoQuestion);
  advance(room, AMMO.questionMs + TICK_MS * 2);
  assert.equal(p.ammoQuestion, null);
  assert.equal(last(room, EVENTS.AMMO_RESULT).timedOut, true);
  advance(room, AMMO.failCooldownMs + TICK_MS);
  room.game.requestAmmo(p);
  p.alive = false;
  advance(room, TICK_MS);
  assert.equal(p.ammoQuestion, null);
  assert.equal(last(room, EVENTS.AMMO_RESULT).cancelled, true);
});

test('la munición de las cajas va a la mochila según su tipo', () => {
  const p = new Player({ id: 2, name: 'Luis', color: '#fff', token: 'u' });
  applyLoot(p, 'ammo_9mm');
  assert.equal(p.ammo['9mm'], AMMO_TYPES['9mm'].pack);
  applyLoot(p, 'ammo_12g');
  assert.equal(p.ammo['12g'], AMMO_TYPES['12g'].pack);
  // Paquetes pequeños: menos de un cargador de rifle
  assert.ok(AMMO_TYPES['556'].pack < WEAPONS.m4a1.magazine / 2);
});

test('preguntas rápidas: correctas verificadas y 2 opciones distintas', () => {
  for (const g of QUICK_GENERATORS) {
    for (let seed = 1; seed <= 300; seed++) {
      let s = seed;
      const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
      const q = g.generar(rand, 2);
      assert.equal(q.opciones.length, 2, g.name);
      assert.equal(new Set(q.opciones).size, 2, `${g.name}: ${q.opciones}`);
      assert.equal(q.dificultad, 1);
      const correct = q.opciones[q.correcta].slice(1, -1);
      if (g.name === 'derivada-en-punto') assert.equal(Number(correct), q.valor);
      if (g.name === 'regla-potencia') {
        const [k, e] = q.valor;
        assert.equal(correct, `${k}x${e === 1 ? '' : `^{${e}}`}`);
      }
      if (g.name === 'limite-sustitucion') {
        const m = correct.match(/^(-?)\\frac\{(\d+)\}\{(\d+)\}$/);
        const v = m ? (m[1] ? -1 : 1) * (Number(m[2]) / Number(m[3])) : Number(correct);
        assert.ok(Math.abs(v - q.valor) < 1e-9, `${q.enunciado}: ${correct} ≠ ${q.valor}`);
      }
    }
  }
});

test('opciones por dificultad: 2 en 1 y 2, 3 en 3 y 4; la correcta y los primeros distractores se conservan', () => {
  assert.deepEqual([1, 2, 3, 4].map(optionCount), [2, 2, 3, 3]);
  for (const difficulty of [1, 2, 3, 4]) {
    for (let i = 0; i < 40; i++) {
      const q = drawQuestion({ difficulty });
      assert.equal(q.opciones.length, optionCount(difficulty), `${q.id}`);
      assert.equal(new Set(q.opciones).size, q.opciones.length);
    }
  }
  for (const q of BANK) {
    const t = trimOptions(q, 3);
    assert.equal(t.opciones[t.correcta], q.opciones[q.correcta], q.id);
    const distractors = q.opciones.filter((_, i) => i !== q.correcta);
    assert.deepEqual(t.opciones.slice(1), distractors.slice(0, 2), `${q.id}: los primeros en el orden escrito`);
  }
  for (const g of GENERATORS) assert.equal(g.generar(Math.random, 3).opciones.length, 3, g.name);
});
