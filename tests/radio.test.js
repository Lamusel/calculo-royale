// Gulag, espectadores, puntaje y guardado (npm test). Fase 30: ya no hay bombardeo, intercepción ni reanimación por aciertos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GULAG, OPERATOR, SCORE, TICK_MS, WEAPONS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { GULAG_ARENAS, GULAG_HALF } from '@calculo-royale/shared/mapLayout';
import { insideZone } from '@calculo-royale/shared/zone';
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
  const t = p.transmission;
  room.game.answerTransmission(p, t.id, right ? t.q.correcta : (t.q.correcta + 1) % t.q.opciones.length);
}

const inArena = (p) => GULAG_ARENAS.some((a) => Math.abs(p.x - a.x) <= GULAG_HALF && Math.abs(p.y - a.y) <= GULAG_HALF);

test('al caer en las fases 1 a 3 se entra a la cola del Gulag; desde la fase 4, espectador con preguntas de práctica', () => {
  const room = makeRoom();
  const [a, b] = addPlayers(room, 4);
  start(room);
  kill(room, a);
  assert.equal(a.gulag.state, 'queue');
  assert.equal(a.operator, null);
  room.game.zone.phase = GULAG.untilPhase;
  kill(room, b);
  assert.equal(b.gulag, null);
  assert.ok(b.operator, 'espectador');
  advance(room, OPERATOR.firstDelayMs + TICK_MS);
  const t = last(room, b.id, EVENTS.TRANSMISSION);
  assert.equal(t.kind, 'operator');
  assert.ok(!JSON.stringify(t).includes('correcta'));
  const before = b.stats.correct;
  answer(room, b, true);
  assert.equal(b.stats.correct, before + 1, 'la práctica suma puntos');
  // Al pasar a la fase 4, la cola también pasa a espectador
  advance(room, TICK_MS);
  assert.equal(a.gulag, null);
  assert.ok(a.operator);
});

test('Gulag de 3: arena aparte, 3 preguntas (dificultad 1, 2 y 3) congelados y equipo según aciertos', () => {
  const room = makeRoom();
  const [a, b, c] = addPlayers(room, 6);
  start(room);
  for (const p of [a, b, c]) kill(room, p);
  advance(room, TICK_MS);
  for (const p of [a, b, c]) {
    assert.equal(p.alive, true);
    assert.ok(inArena(p), 'en la arena');
    assert.ok(p.frozen);
  }
  assert.equal(room.game.gulag.fights.length, 1);
  // a acierta las 3 (elige escopeta), b 1, c ninguna
  const plan = { [a.id]: [true, true, true], [b.id]: [true, false, false], [c.id]: [false, false, false] };
  for (let k = 0; k < 3; k++) {
    for (const p of [a, b, c]) {
      assert.equal(p.transmission.q.dificultad, k + 1);
      answer(room, p, plan[p.id][k]);
    }
  }
  room.game.chooseGulagWeapon(a, 'shotgun');
  advance(room, TICK_MS);
  assert.equal(a.weapons[0]?.id, 'm870');
  assert.equal(a.helmetLevel, 1);
  assert.equal(b.weaponId, 'm1911');
  assert.equal(b.mag, WEAPONS.m1911.magazine);
  assert.equal(b.reserve, 0);
  assert.equal(c.weaponId, 'fists');
  // Cuenta regresiva y combate: ya no están congelados
  advance(room, GULAG.countdownMs + TICK_MS);
  assert.ok(!a.frozen && !b.frozen && !c.frozen);
  // Los del Gulag no cuentan como vivos en la partida
  assert.equal(classStats(room.game).alive, 3);
});

test('el ganador vuelve en paracaídas dentro de la zona; los perdedores quedan de espectadores', () => {
  const room = makeRoom();
  const [a, b] = addPlayers(room, 5);
  start(room);
  kill(room, a);
  kill(room, b);
  advance(room, GULAG.pairWaitMs + TICK_MS);
  assert.equal(room.game.gulag.fights.length, 1, 'con 2, a los 10 s');
  for (let k = 0; k < 3; k++) for (const p of [a, b]) answer(room, p, true);
  advance(room, GULAG.countdownMs + 2 * TICK_MS);
  kill(room, b);
  advance(room, TICK_MS);
  assert.equal(a.alive, true);
  assert.equal(a.arena, null);
  // Elige en el mapa: un punto fuera de la zona se ajusta adentro
  assert.equal(a.deploy?.phase, 'pick');
  assert.equal(last(room, a.id, EVENTS.MATCH_DEPLOY).gulag, true);
  room.game.chooseDeployPoint(a, 9999, 9999);
  advance(room, GULAG.returnPickMs + TICK_MS);
  assert.equal(a.deploy?.phase, 'chute');
  assert.ok(insideZone(room.game.zone.current, a.x, a.y));
  assert.equal(a.weapons[0]?.id, 'm4a1', 'vuelve con su equipo (M4A1 por defecto)');
  assert.ok(b.operator, 'el perdedor es espectador');
  assert.ok(room.broadcasts.some((m) => m.event === EVENTS.RADIO_MESSAGE && m.data.text.includes('ganó en el Gulag')));
  // Una oportunidad por partida
  kill(room, a);
  assert.equal(a.gulag, null);
  assert.ok(a.operator);
});

test('quien gana a puños vuelve con la pistola y unas pocas balas', () => {
  const room = makeRoom();
  const [a, b] = addPlayers(room, 5);
  start(room);
  kill(room, a);
  kill(room, b);
  advance(room, GULAG.pairWaitMs + TICK_MS);
  for (let k = 0; k < 3; k++) for (const p of [a, b]) answer(room, p, false);
  advance(room, GULAG.countdownMs + 2 * TICK_MS);
  assert.equal(a.weaponId, 'fists');
  kill(room, b);
  advance(room, TICK_MS);
  assert.equal(a.weaponId, 'm1911');
  assert.equal(a.mag, GULAG.returnBullets);
});

test('solo 45 s en cola: pelea contra un bot del Gulag; muerte súbita después de 60 s', () => {
  const room = makeRoom();
  const [a] = addPlayers(room, 4);
  start(room);
  kill(room, a);
  advance(room, GULAG.botWaitMs + TICK_MS);
  const bot = [...room.players.values()].find((p) => p.gulagBot);
  assert.ok(bot, 'hay guardia');
  assert.ok(inArena(bot));
  for (let k = 0; k < 3; k++) answer(room, a, false);
  advance(room, GULAG.countdownMs + GULAG.fightMs + 2 * TICK_MS);
  const [fight] = room.game.gulag.fights;
  if (fight) assert.ok(fight.radius < GULAG.suddenStartRadius, 'el círculo se cierra');
  // Pase lo que pase, al final el bot desaparece
  advance(room, GULAG.suddenMs + 30_000);
  assert.equal([...room.players.values()].some((p) => p.gulagBot), false);
});

test('en equipos nunca pelean compañeros', () => {
  const room = makeRoom();
  const [a, b, c] = addPlayers(room, 6);
  a.team = 1;
  b.team = 1;
  c.team = 2;
  start(room);
  for (const p of [a, b, c]) kill(room, p);
  advance(room, GULAG.pairWaitMs + TICK_MS);
  for (const f of room.game.gulag.fights) {
    const teams = f.ids.map((id) => room.players.get(id).team);
    assert.equal(new Set(teams).size, teams.length);
  }
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
  assert.equal('votes' in s, false);
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

test('equipos: sin fuego amigo; derribado se levanta con Reanimar (5 s y pregunta); sin compañeros en pie, muere; gana el último equipo', async () => {
  const { assignTeams } = await import('../server/src/game/teams.js');
  const room = makeRoom();
  room.teamMode = 'duos';
  const [a, b, c, d] = addPlayers(room, 4);
  a.teamChoice = 1;
  b.teamChoice = 1;
  assignTeams(room);
  assert.equal(a.team, b.team);
  assert.notEqual(c.team, a.team);
  assert.equal(c.team, d.team);
  start(room);
  // Sin fuego amigo
  damagePlayer(room.game, a, 50, b.id, 0);
  assert.equal(a.hp, 100);
  // c derriba a a: queda derribado (b sigue en pie)
  damagePlayer(room.game, a, 500, c.id, 0, { ignoreArmor: true });
  assert.ok(a.alive && a.downed);
  // b lo levanta: 5 s y la pregunta rápida
  b.teleport(a.x + 1, a.y);
  room.game.interact(b, 'revive');
  advance(room, 5000 + TICK_MS * 2);
  assert.equal(b.transmission?.kind, 'revive');
  answer(room, b, true);
  assert.equal(a.downed, null);
  assert.ok(a.hp > 1);
  // Si cae el último en pie del equipo, el derribado también muere
  damagePlayer(room.game, a, 500, c.id, 0, { ignoreArmor: true });
  assert.ok(a.downed);
  damagePlayer(room.game, b, 500, c.id, 0, { ignoreArmor: true });
  advance(room, TICK_MS * 2);
  assert.equal(a.alive, false);
  assert.equal(b.alive, false);
  assert.equal(room.phase, 'results', 'gana el equipo de c y d');
});

test('6.5: derribado con barra propia (se gasta sola y los enemigos lo rematan); si muere, quien reanimaba queda libre', async () => {
  const { assignTeams, DOWN_HP } = await import('../server/src/game/teams.js');
  const room = makeRoom();
  room.teamMode = 'duos';
  const [a, b, c, d] = addPlayers(room, 4);
  a.teamChoice = 1;
  b.teamChoice = 1;
  assignTeams(room);
  start(room);
  damagePlayer(room.game, a, 500, c.id, 0, { ignoreArmor: true });
  assert.equal(a.downed.hp, DOWN_HP);
  // Se gasta sola: en 10 s pierde un tercio
  advance(room, 10_000);
  assert.ok(a.downed.hp < DOWN_HP * 0.7 && a.downed.hp > DOWN_HP * 0.6, `${a.downed.hp}`);
  // b empieza a reanimar y c lo remata disparándole: b queda libre
  b.teleport(a.x + 1, a.y);
  room.game.interact(b, 'revive');
  assert.ok(b.reviving);
  damagePlayer(room.game, a, 30, c.id, 0);
  assert.ok(a.alive && a.downed, 'un disparo baja la barra pero no lo mata');
  damagePlayer(room.game, a, 100, c.id, 0);
  assert.equal(a.alive, false);
  assert.equal(a.downed, null);
  assert.equal(c.kills, 1);
  advance(room, TICK_MS * 2);
  assert.equal(b.reviving, null, 'ya no queda atascado reanimando');
  void d;
});

test('6.5: chat corto con antispam, filtro, solo-equipo y apagado por el anfitrión', async () => {
  const { sayChat, cleanChat } = await import('../server/src/game/phrases.js');
  const room = makeRoom();
  const [a, b, c] = addPlayers(room, 3);
  a.team = 1;
  b.team = 1;
  c.team = 2;
  assert.equal(cleanChat('eres un idiota'), 'eres un ******');
  assert.equal(cleanChat('x'.repeat(200)).length, 80);
  assert.ok(sayChat(room, a, { text: 'hola', team: true }, 0));
  assert.deepEqual(room.emitted.filter((e) => e.event === EVENTS.CHAT).map((e) => e.to), [a.id, b.id]);
  assert.equal(sayChat(room, a, { text: 'otra' }, 1000), false, 'uno cada 2 s');
  assert.ok(sayChat(room, a, { text: 'otra' }, 2100));
  assert.equal(room.broadcasts.at(-1).event, EVENTS.CHAT);
  room.chatOff = true;
  assert.equal(sayChat(room, c, { text: 'hola' }, 9000), false);
});

test('6.5: destrucción ligera: los barriles rojos explotan y encadenan, lo roto sale de la colisión', async () => {
  const { DESTRUCTIBLES } = await import('@calculo-royale/shared/mapLayout');
  const { overlapsObstacle } = await import('@calculo-royale/shared/collision');
  const { damageProp } = await import('../server/src/game/destruction.js');
  const room = makeRoom();
  addPlayers(room, 2);
  start(room);
  const red = DESTRUCTIBLES.find((o) => o.kind === 'barrel' && o.red);
  assert.ok(overlapsObstacle(red.x, red.y, 0.3), 'antes choca');
  damageProp(room.game, red, 10);
  assert.ok(!red.broken, 'con poco daño sigue en pie');
  damageProp(room.game, red, 100);
  assert.equal(red.broken, true);
  assert.ok(room.game.explosions.length > 0, 'el barril rojo explota');
  assert.ok(room.broadcasts.some((b) => b.event === EVENTS.PROPS_BROKEN && b.data.includes(red.destId)));
  const wall = DESTRUCTIBLES.find((o) => o.kind === 'fence');
  damageProp(room.game, wall, 1000);
  assert.ok(wall.broken);
  // Al volver al lobby todo se arregla
  room.game.resetWorld();
  assert.ok(DESTRUCTIBLES.every((o) => !o.broken));
  assert.ok(overlapsObstacle(red.x, red.y, 0.3));
});
