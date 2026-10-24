// Botín de battle royale (npm test): suelo, inventario, curación con tiempo, accesorios y caja al
// caer, en el Game real con una sala falsa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACHMENTS, BACKPACK, HEALING, HELMET, LOOT_IDS, LOOT_ITEMS, MAX_HP, TICK_MS, WEAPONS,
} from '@calculo-royale/shared/constants';
import { decodeShot } from '@calculo-royale/shared/codec';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { magazineOf, reserveCap, weaponWith } from '@calculo-royale/shared/inventory';
import { BUTTONS, EVENTS } from '@calculo-royale/shared/protocol';
import { damagePlayer, fire } from '../server/src/game/combat.js';
import { Game } from '../server/src/game/Game.js';
import { groundSpots, rollGroundItem, spawnGroundLoot } from '../server/src/game/loot.js';
import { Player } from '../server/src/game/Player.js';

function makeRoom(phase = 'playing') {
  const room = {
    phase,
    players: new Map(),
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
  };
  room.game = new Game(room);
  return room;
}

function addPlayer(room, id, x, y) {
  const p = new Player({ id, name: `P${id}`, color: '#fff', token: `t${id}` });
  p.teleport(x, y);
  p.connected = true;
  room.players.set(id, p);
  return p;
}

const seeded = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
const tick = (room, n = 1) => {
  for (let i = 0; i < n; i++) room.game.update();
};
// Deja un objeto en el suelo, en un lugar libre
const place = (room, item, x, y, state = null) => {
  const id = room.game.nextLootId++;
  room.game.loot.set(id, { id, item, state, x, y });
  return id;
};
const OPEN = { x: 10, y: 30 }; // campo abierto, sin obstáculos

test('botín del suelo: mismo mapa con la misma semilla, solo común o raro, en lugares libres', () => {
  const a = makeRoom();
  const b = makeRoom();
  spawnGroundLoot(a.game, seeded(42));
  spawnGroundLoot(b.game, seeded(42));
  const list = (r) => [...r.game.loot.values()].map((e) => `${e.item}@${e.x.toFixed(2)},${e.y.toFixed(2)}`);
  assert.deepEqual(list(a), list(b));
  assert.ok(a.game.loot.size > 200, `${a.game.loot.size} objetos`);
  for (const e of a.game.loot.values()) {
    assert.ok(LOOT_ITEMS[e.item].tier <= 1, `${e.item} en el suelo`);
    assert.ok(!overlapsObstacle(e.x, e.y, 0.5), `${e.item} dentro de un obstáculo`);
  }
  // Todos los comunes y raros salen alguna vez; ningún épico
  const rand = seeded(7);
  const seen = new Set(Array.from({ length: 3000 }, () => rollGroundItem(rand)));
  for (const id of LOOT_IDS.filter((i) => LOOT_ITEMS[i].tier <= 1)) assert.ok(seen.has(id), id);
  assert.equal(seen.has('sniper') || seen.has('armor3') || seen.has('scope4x'), false);
  assert.ok(groundSpots(seeded(1)).length > 200);
  // El sincronizado inicial llega a todos
  assert.ok(a.broadcasts.some((x) => x.event === EVENTS.LOOT_SYNC && x.data.length === a.game.loot.size));
});

test('tomar con E: arma nueva reemplaza a la vieja, que queda en el suelo con su munición', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  place(room, 'rifle', OPEN.x + 1, OPEN.y);
  room.game.interact(p);
  assert.equal(p.primary.id, 'rifle');
  p.primary.reserve = 7;
  place(room, 'shotgun', OPEN.x - 1, OPEN.y);
  room.game.interact(p);
  assert.equal(p.primary.id, 'shotgun');
  const dropped = [...room.game.loot.values()].find((e) => e.item === 'rifle');
  assert.ok(dropped, 'el rifle quedó en el suelo');
  assert.equal(dropped.state.reserve, 7);
  assert.ok(room.broadcasts.some((x) => x.event === EVENTS.LOOT_REMOVE));
  assert.ok(room.broadcasts.some((x) => x.event === EVENTS.LOOT_ADD));
  // Lejos no se toma nada
  const far = addPlayer(room, 2, OPEN.x + 30, OPEN.y);
  room.game.interact(far);
  assert.equal(far.primary, null);
});

test('mochila: limita consumibles y munición; lo que no cabe se queda en el suelo', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  for (let i = 0; i < BACKPACK[0].bandage + 2; i++) {
    place(room, 'bandage', OPEN.x + 0.5, OPEN.y);
    room.game.interact(p);
  }
  assert.equal(p.bandages, BACKPACK[0].bandage);
  assert.ok([...room.game.loot.values()].some((e) => e.item === 'bandage'), 'la que sobra sigue en el suelo');
  assert.ok(room.emitted.some((e) => e.event === EVENTS.LOOT_TAKEN && e.data.full));
  // Con mochila 2 cabe más
  place(room, 'backpack2', OPEN.x + 0.3, OPEN.y);
  room.game.interact(p);
  assert.equal(p.backpackLevel, 2);
  room.game.interact(p);
  assert.equal(p.bandages, BACKPACK[0].bandage + 1);
  // Munición hasta el tope de la mochila
  p.pistolReserve = reserveCap('pistol', 2) - 2;
  place(room, 'ammo', OPEN.x + 0.3, OPEN.y);
  room.game.interact(p);
  assert.equal(p.pistolReserve, reserveCap('pistol', 2));
});

test('equipo: chaleco, casco y mochila solo si son mejores; el viejo queda en el suelo', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  for (const item of ['helmet1', 'helmet3']) {
    place(room, item, OPEN.x + 0.5, OPEN.y);
    room.game.interact(p);
  }
  assert.equal(p.helmetLevel, 3);
  assert.ok([...room.game.loot.values()].some((e) => e.item === 'helmet1'));
  place(room, 'helmet2', OPEN.x + 0.2, OPEN.y);
  room.game.interact(p);
  assert.equal(p.helmetLevel, 3, 'no baja de nivel');
});

test('casco: resta un porcentaje del daño después del chaleco', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.helmetLevel = 3;
  damagePlayer(room.game, p, 50, 2, 0);
  assert.ok(Math.abs(p.hp - (MAX_HP - 50 * (1 - HELMET[3]))) < 1e-9);
  // El daño que ignora el chaleco (zona) también ignora el casco
  const hp = p.hp;
  damagePlayer(room.game, p, 10, null, 5, { ignoreArmor: true });
  assert.ok(Math.abs(p.hp - (hp - 10)) < 1e-9);
});

test('curación con tiempo: venda +15 a los 2 s, botiquín completo a los 6 s; disparar cancela', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.hp = 40;
  p.bandages = 1;
  room.game.useItem(p, 'bandage');
  assert.ok(p.healing);
  tick(room, Math.ceil(HEALING.bandage.useMs / TICK_MS) - 2);
  assert.equal(p.hp, 40, 'todavía no');
  assert.equal(p.speedFactor, HEALING.moveFactor, 'camina más lento');
  tick(room, 3);
  assert.equal(p.hp, 55);
  assert.equal(p.bandages, 0);
  assert.equal(p.speedFactor, 1);
  // Sin vendas no hay nada que usar
  room.game.useItem(p, 'bandage');
  assert.equal(p.healing, null);
  // Botiquín, cancelado por disparar: no se gasta
  p.medkits = 1;
  room.game.useItem(p, 'medkit');
  tick(room, 10);
  fire(room.game, p, { aim: 0, buttons: BUTTONS.FIRE, viewTick: room.game.tick });
  assert.equal(p.healing, null);
  assert.equal(p.medkits, 1);
  room.game.useItem(p, 'medkit');
  tick(room, Math.ceil(HEALING.medkit.useMs / TICK_MS) + 1);
  assert.equal(p.hp, MAX_HP);
  assert.equal(p.medkits, 0);
  // Con la vida llena no se gasta un botiquín
  p.medkits = 1;
  room.game.useItem(p, 'medkit');
  assert.equal(p.healing, null);
});

test('bebida: +40 repartido en 10 s y algo de velocidad', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.hp = 30;
  p.drinks = 1;
  room.game.useItem(p, 'drink');
  tick(room, Math.ceil(HEALING.drink.useMs / TICK_MS) + 1);
  assert.equal(p.drinks, 0);
  assert.equal(p.speedFactor, HEALING.drink.speedBoost);
  tick(room, Math.ceil(HEALING.drink.durationMs / TICK_MS / 2));
  assert.ok(p.hp > 45 && p.hp < 55, `a la mitad: ${p.hp}`);
  tick(room, Math.ceil(HEALING.drink.durationMs / TICK_MS / 2) + 2);
  assert.ok(Math.abs(p.hp - 70) < 1, `al final: ${p.hp}`);
  assert.equal(p.speedFactor, 1);
});

test('accesorios: cargador ampliado, culata y punto rojo, mejor mira, silenciador', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  for (const item of ['rifle', 'extmag', 'stock', 'reddot', 'silencer']) {
    place(room, item, OPEN.x + 0.5, OPEN.y);
    room.game.interact(p);
  }
  assert.equal(magazineOf('rifle', p.attachments), Math.round(WEAPONS.rifle.magazine * ATTACHMENTS.extmag));
  assert.ok(Math.abs(weaponWith('rifle', p.attachments).spread - WEAPONS.rifle.spread * ATTACHMENTS.stock * ATTACHMENTS.reddot) < 1e-12);
  // Recarga hasta el cargador ampliado
  p.primary.mag = 0;
  p.primary.reserve = 100;
  room.game.handleInput(p, { mx: 0, my: 0, aim: 0, buttons: BUTTONS.RELOAD, viewTick: room.game.tick });
  tick(room, Math.ceil(WEAPONS.rifle.reloadMs / TICK_MS) + 1);
  assert.equal(p.primary.mag, magazineOf('rifle', p.attachments));
  // Mira 2x reemplaza al punto rojo (que queda en el suelo); otra culata no se toma
  place(room, 'scope2x', OPEN.x + 0.2, OPEN.y);
  room.game.interact(p);
  assert.equal(p.attachments.scope, 'scope2x');
  assert.ok([...room.game.loot.values()].some((e) => e.item === 'reddot'));
  // El disparo con silenciador va marcado
  fire(room.game, p, { aim: 0, buttons: BUTTONS.FIRE, viewTick: room.game.tick });
  const shot = decodeShot(room.game.shots.at(-1));
  assert.equal(shot.silent, true);
  assert.equal(shot.weaponIndex, 2);
});

test('caja de botín al caer: tiene todo lo del caído y se toma lo que sirve', () => {
  const room = makeRoom();
  const victim = addPlayer(room, 1, OPEN.x, OPEN.y);
  const looter = addPlayer(room, 2, OPEN.x + 1, OPEN.y);
  Object.assign(victim, { helmetLevel: 2, backpackLevel: 1, bandages: 2, armorLevel: 2, armor: 30 });
  victim.attachments.scope = 'scope2x';
  victim.giveItem('sniper');
  looter.giveItem('rifle');
  damagePlayer(room.game, victim, 500, looter.id, 2);
  const box = [...room.game.loot.values()].find((e) => e.box);
  assert.ok(box, 'quedó la caja');
  assert.ok(box.box.some((c) => c.item === 'sniper') && box.box.some((c) => c.item === 'helmet2'));
  room.game.interact(looter);
  assert.equal(looter.helmetLevel, 2);
  assert.equal(looter.backpackLevel, 1);
  assert.equal(looter.bandages, 2);
  assert.equal(looter.attachments.scope, 'scope2x');
  assert.equal(looter.primary.id, 'rifle', 'no cambia su arma por la de la caja');
  // El francotirador sigue en la caja
  const rest = [...room.game.loot.values()].find((e) => e.box);
  assert.ok(rest.box.some((c) => c.item === 'sniper'));
  // En el lobby no hay caja de botín
  const lobby = makeRoom('lobby');
  const q = addPlayer(lobby, 1, OPEN.x, OPEN.y);
  q.bandages = 2;
  damagePlayer(lobby.game, q, 500, null, 0);
  assert.equal(lobby.game.loot.size, 0);
});

test('el servidor valida: sin vida, sin objeto o en el bus no se cura ni toma', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.hp = 50;
  room.game.useItem(p, 'medkit');
  assert.equal(p.healing, null, 'no tiene botiquín');
  room.game.useItem(p, 'cualquier cosa');
  assert.equal(p.healing, null);
  p.medkits = 1;
  p.deploy = { phase: 'fall' };
  room.game.useItem(p, 'medkit');
  assert.equal(p.healing, null, 'cayendo del bus');
  place(room, 'rifle', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  assert.equal(p.primary, null, 'cayendo no toma');
});
