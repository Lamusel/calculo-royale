// Zona, lanzamiento aéreo y victoria (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIRDROP, MAP_HALF, MAX_HP, TICK_MS, ZONE_FIRST_DELAY_MS, ZONE_PHASES, ZONE_START } from '@calculo-royale/shared/constants';
import { CRATE_STATE, EVENTS } from '@calculo-royale/shared/protocol';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { ALL_SECTORS, insideZone, sectorBounds, sectorOf, zoneInequality } from '@calculo-royale/shared/zone';
import { Game } from '../server/src/game/Game.js';
import { damagePlayer } from '../server/src/game/combat.js';
import { airdropSpot } from '../server/src/game/match.js';
import { Player } from '../server/src/game/Player.js';
import { nextZone, Zone, zoneContains } from '../server/src/game/Zone.js';

function makeRoom() {
  const room = {
    phase: 'lobby',
    players: new Map(),
    emitted: [],
    broadcasts: [],
    finished: null,
    emitTo(p, event, data) {
      this.emitted.push({ to: p.id, event, data });
    },
    broadcast(event, data) {
      this.broadcasts.push({ event, data });
    },
    broadcastState() {},
    respawnInLobby() {},
    finishMatch(winnerId) {
      this.phase = 'results';
      this.finished = winnerId;
    },
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

const startMatch = (room) => {
  room.phase = 'playing';
  room.game.startMatch();
};
const advance = (room, ms) => {
  for (let i = 0; i < ms / TICK_MS; i++) room.game.update();
};

let seed = 3;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('cada zona nueva queda dentro de la anterior (500 partidas simuladas)', () => {
  for (let run = 0; run < 500; run++) {
    let cur = { ...ZONE_START };
    for (const def of ZONE_PHASES) {
      const next = nextZone(cur, def, rand);
      assert.ok(zoneContains(cur, next), JSON.stringify({ cur, next }));
      assert.ok(Number.isInteger(next.cx) && Number.isInteger(next.cy) && Number.isInteger(next.p));
      cur = next;
    }
  }
});

test('la zona avisa, se cierra interpolando y termina en la zona anunciada', () => {
  const zone = new Zone(rand);
  const [announce] = zone.start(0, 0);
  assert.equal(announce.type, 'announce');
  const def = ZONE_PHASES[0];
  assert.deepEqual(zone.update(def.waitMs - 1), []);
  assert.equal(zone.dps, 0, 'en el primer aviso todavía no hay daño');
  assert.equal(zone.update(def.waitMs)[0].type, 'closing');
  zone.update(def.waitMs + def.shrinkMs / 2);
  assert.ok(zone.current.p < ZONE_START.p && zone.current.p > announce.zone.p, 'a mitad del cierre');
  assert.equal(zone.dps, def.dps);
  const events = zone.update(def.waitMs + def.shrinkMs);
  assert.deepEqual(zone.current, announce.zone);
  assert.equal(events[0].type, 'announce');
  assert.equal(events[0].phase, 1);
});

test('una fase usa elipse y la desigualdad se escribe bien', () => {
  assert.ok(ZONE_PHASES.some((p) => p.ellipse));
  assert.equal(zoneInequality({ cx: 12, cy: -5, p: 20, q: 20 }), '(x - 12)^2 + (y + 5)^2 \\le 400');
  assert.equal(zoneInequality({ cx: 0, cy: 3, p: 35, q: 20 }), '\\frac{x^2}{1225} + \\frac{(y - 3)^2}{400} \\le 1');
  const e = { cx: 2, cy: 1, p: 10, q: 4 };
  assert.equal(insideZone(e, 11, 1), true);
  assert.equal(insideZone(e, 2, 6), false);
});

test('sectores A1 (noroeste) a J10 (sureste)', () => {
  assert.equal(sectorOf(-MAP_HALF + 1, MAP_HALF - 1), 'A1');
  assert.equal(sectorOf(MAP_HALF - 1, -MAP_HALF + 1), 'J10');
  assert.equal(sectorOf(0.5, 0.5), 'F5');
  const b = sectorBounds('C4');
  assert.equal(sectorOf(b.cx, b.cy), 'C4');
  // 10×10: 100 sectores de 100 m que cubren el mapa sin huecos
  assert.equal(ALL_SECTORS.length, 100);
  assert.equal(ALL_SECTORS.at(-1), 'J10');
  assert.equal(b.maxX - b.minX, 100);
  for (const s of ALL_SECTORS) assert.equal(sectorOf(sectorBounds(s).cx, sectorBounds(s).cy), s);
});

test('fuera de la zona se recibe daño que el chaleco no absorbe', () => {
  const room = makeRoom();
  const inside = addPlayer(room, 1, 0, 0);
  const outside = addPlayer(room, 2, 0, 0);
  startMatch(room);
  const zone = room.game.zone;
  // Al terminar el primer cierre, se pone a uno fuera de la zona
  advance(room, ZONE_FIRST_DELAY_MS + ZONE_PHASES[0].waitMs + ZONE_PHASES[0].shrinkMs);
  const z = zone.current;
  inside.teleport(z.cx, z.cy);
  const edge = MAP_HALF - 2;
  outside.teleport(Math.max(-edge, Math.min(edge, z.cx + z.p + 3)), z.cy);
  if (insideZone(z, outside.x, outside.y)) outside.teleport(z.cx > 0 ? -edge : edge, z.cy > 0 ? -edge : edge);
  outside.giveItem('armor');
  advance(room, 1000);
  assert.equal(inside.hp, MAX_HP);
  assert.ok(outside.hp < MAX_HP, `vida ${outside.hp}`);
  assert.equal(outside.armorLevel, 1, 'el chaleco no se gasta');
  const radio = room.broadcasts.filter((b) => b.event === EVENTS.RADIO_MESSAGE);
  assert.ok(radio.some((r) => r.data.text.includes('\\le')), 'el mando anuncia la desigualdad');
});

test('lanzamiento aéreo: se anuncia con coordenadas y aterriza como caja dorada dentro de la zona', () => {
  const room = makeRoom();
  addPlayer(room, 1, 0, 0);
  addPlayer(room, 2, 5, 0);
  startMatch(room);
  advance(room, AIRDROP.atMs + TICK_MS);
  const crate = room.game.airdropCrate;
  assert.equal(crate.active, true);
  assert.ok(insideZone(room.game.zone.target, crate.x, crate.y));
  const msg = room.broadcasts.find((b) => b.event === EVENTS.RADIO_MESSAGE && b.data.kind === 'airdrop');
  assert.ok(msg.data.text.includes(`(${crate.x}, ${crate.y})`));
  const states = () => room.game.snapshot([...room.players.values()])[6];
  assert.equal(+states()[crate.id], CRATE_STATE.HIDDEN, 'todavía en el aire');
  advance(room, AIRDROP.fallMs + TICK_MS);
  assert.equal(+states()[crate.id], CRATE_STATE.CLOSED);
  assert.equal(crate.rarity, 3);
});

test('el punto del lanzamiento aéreo nunca cae sobre un obstáculo', () => {
  for (let i = 0; i < 200; i++) {
    const zone = { cx: Math.round(rand() * 40 - 20), cy: Math.round(rand() * 40 - 20), p: 30, q: 20 };
    const { x, y } = airdropSpot(zone, rand);
    assert.ok(!overlapsObstacle(x, y, 1.5) || (x === zone.cx && y === zone.cy));
  }
});

test('último en pie gana; las posiciones salen del orden de caída', () => {
  const room = makeRoom();
  const a = addPlayer(room, 1, 0, 0);
  const b = addPlayer(room, 2, 5, 0);
  const c = addPlayer(room, 3, 10, 0);
  startMatch(room);
  damagePlayer(room.game, c, 200, a.id, 0);
  assert.equal(c.place, 3);
  damagePlayer(room.game, b, 200, a.id, 0);
  assert.equal(b.place, 2);
  room.game.update();
  assert.equal(room.finished, a.id);
});

test('con un solo jugador no hay victoria automática (prueba en solitario)', () => {
  const room = makeRoom();
  addPlayer(room, 1, 0, 0);
  startMatch(room);
  advance(room, 2000);
  assert.equal(room.finished, null);
});
