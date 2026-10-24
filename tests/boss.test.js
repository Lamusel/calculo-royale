// Modo Profe Jefe Final (npm test): escudo que solo baja con aciertos del equipo, tres fases,
// volver a los 20 s con un acierto, sin fuego amigo y límite de 8 minutos, en la sala real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS, BOSS_TARGET_ID, TICK_MS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS } from '@calculo-royale/shared/protocol';
import { Room } from '../server/src/rooms/Room.js';
import { damagePlayer, fire } from '../server/src/game/combat.js';
import { damageBoss } from '../server/src/game/boss.js';

function makeRoom(humans = 3) {
  const sent = [];
  const io = { to: () => ({ emit: (event, data) => sent.push({ event, data }), volatile: { emit() {} } }), sockets: { sockets: new Map() } };
  const room = new Room('JEFE', io, () => {});
  room.game.stop();
  room.sent = sent;
  const emitted = [];
  room.emitTo = (p, event, data) => emitted.push({ to: p.id, event, data });
  room.emitted = emitted;
  const players = Array.from({ length: humans }, (_, i) => room.addPlayer({ id: `s${i}`, data: {}, join() {}, leave() {}, emit() {} }, `P${i}`));
  room.mode = 'jefe';
  room.start();
  return { room, game: room.game, players };
}
const ticks = (game, ms) => {
  for (let i = 0; i < ms / TICK_MS; i++) game.update();
};
// Responde la pregunta pendiente (bien o mal) con la respuesta que solo conoce el servidor
const answer = (game, p, right = true) => {
  const q = p.bossQuestion;
  game.answerBoss(p, q.id, right ? q.q.correcta : (q.q.correcta + 1) % q.q.opciones.length);
};
const breakShield = (game, players) => {
  let i = 0;
  while (game.boss.shieldUp) {
    const p = players[i++ % players.length];
    if (!p.alive) continue;
    p.bossCooldownUntil = 0;
    assert.ok(game.bossRequest(p, 'shield') !== false);
    if (p.bossQuestion) answer(game, p);
    assert.ok(i < 50, 'el escudo tendría que bajar');
  }
};

test('modo jefe: todos en la cancha del estadio, equipados, sin despliegue, cajas ni zona', () => {
  const { game, players } = makeRoom();
  for (const p of players) {
    assert.ok(Math.hypot(p.x - BOSS.arena.x, p.y - BOSS.arena.y) < 20, 'en la cancha');
    assert.equal(p.deploy, null);
    assert.equal(p.primary.id, BOSS.loadout.weapon);
    assert.equal(p.armorLevel, BOSS.loadout.armor);
  }
  assert.equal(game.zone, null);
  assert.ok(game.crates.every((c) => c.inMatch === false || c.practice || c.airdrop));
  const snap = game.snapshot([...game.room.players.values()]);
  const boss = snap[13];
  assert.equal(boss.length, 11);
  assert.equal(boss[6], 1, 'empieza con escudo');
  assert.equal(boss[8], game.boss.goal);
});

test('el escudo solo baja con aciertos del equipo; con escudo las balas no le hacen nada', () => {
  const { game, players } = makeRoom();
  const hp = game.boss.hp;
  assert.equal(damageBoss(game, 100, players[0].id), 0);
  assert.equal(game.boss.hp, hp);
  // Pregunta sin la respuesta para el cliente
  game.bossRequest(players[0], 'shield');
  const msg = game.room.emitted.find((e) => e.event === EVENTS.BOSS_QUESTION);
  assert.ok(msg && !('correcta' in msg.data) && !('explicacion' in msg.data));
  // Un fallo no suma y deja esperar
  answer(game, players[0], false);
  assert.equal(game.boss.progress, 0);
  game.bossRequest(players[0], 'shield');
  assert.equal(players[0].bossQuestion, null, 'en espera tras fallar');
  breakShield(game, players.slice(1));
  assert.equal(game.boss.shieldUp, false);
  assert.ok(damageBoss(game, 50, players[1].id) > 0);
  assert.equal(players[1].bossDamage, 50);
  // A los 15 s vuelve
  ticks(game, BOSS.shieldDownMs + 200);
  assert.equal(game.boss.shieldUp, true);
  assert.equal(game.boss.progress, 0);
});

test('tres fases y victoria del equipo; ranking por daño y aciertos', () => {
  const { room, game, players } = makeRoom();
  for (let phase = 0; phase < BOSS.phases.length; phase++) {
    assert.equal(game.boss.phase, phase);
    breakShield(game, players);
    damageBoss(game, game.boss.hp, players[phase % players.length].id);
  }
  assert.equal(room.phase, 'results');
  assert.equal(room.results.boss.victory, true);
  assert.ok(room.results.ranking.every((r) => r.place === 1));
  assert.ok(room.results.ranking[0].bossDamage > 0);
});

test('sin fuego amigo: las balas de un jugador no dañan a los compañeros, sí al jefe', () => {
  const { game, players } = makeRoom(2);
  const [a, b] = players;
  b.teleport(a.x + 3, a.y);
  game.boss.x = a.x - 30; // lejos y detrás
  fire(game, a, { aim: 0, buttons: BUTTONS.FIRE, viewTick: game.tick });
  assert.equal(b.hp, 100);
  // El jefe sí aparece como blanco
  game.boss.shieldUp = false;
  game.boss.x = a.x + 6;
  game.boss.y = a.y;
  b.teleport(a.x, a.y + 10);
  a.nextFireAt = 0;
  a.reloadUntil = 0;
  const before = game.boss.hp;
  fire(game, a, { aim: 0, buttons: BUTTONS.FIRE, viewTick: game.tick });
  assert.ok(game.boss.hp < before, 'le pegó al jefe');
  assert.equal(game.room.emitted.some((e) => e.event === EVENTS.COMBAT_HIT && e.data[0] === BOSS_TARGET_ID), true);
});

test('caído: vuelve a los 20 s si acierta; si falla, espera 10 s más', () => {
  const { game, players } = makeRoom(2);
  const p = players[0];
  damagePlayer(game, p, 500, 0, 2);
  assert.equal(p.alive, false);
  assert.ok(!game.loot?.size, 'sin caja de botín en el modo jefe');
  game.bossRequest(p, 'revive');
  assert.equal(p.bossQuestion, null, 'todavía no');
  ticks(game, BOSS.reviveMs + 100);
  game.bossRequest(p, 'revive');
  answer(game, p, false);
  assert.equal(p.alive, false);
  ticks(game, BOSS.reviveRetryMs + 100);
  game.bossRequest(p, 'revive');
  answer(game, p, true);
  assert.equal(p.alive, true);
  assert.equal(p.hp, BOSS.reviveHp);
  assert.ok(Math.hypot(p.x - BOSS.arena.x, p.y - BOSS.arena.y) < 20);
});

test('el jefe dispara a los jugadores y a los 8 minutos gana él', () => {
  const { room, game, players } = makeRoom(3);
  let taken = 0;
  ticks(game, 20_000);
  for (const p of players) taken += 100 - p.hp + (p.alive ? 0 : 100);
  assert.ok(taken > 0, 'recibieron daño del jefe');
  ticks(game, BOSS.limitMs);
  assert.equal(room.phase, 'results');
  assert.equal(room.results.boss.victory, false);
});
