// Botín de battle royale (npm test): suelo, inventario, curación con tiempo, accesorios y caja al
// caer, en el Game real con una sala falsa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKPACK, HEALING, HELMET, LOOT, LOOT_GROUND, MAX_HP, START_BULLETS, THROWABLES, TICK_MS, WEAPON_CATEGORIES, WEAPONS,
} from '@calculo-royale/shared/constants';
import { decodeShot } from '@calculo-royale/shared/codec';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { inventoryItems, magazineOf, weaponWith } from '@calculo-royale/shared/inventory';
import { BUTTONS, EVENTS } from '@calculo-royale/shared/protocol';
import { damagePlayer, fire } from '../server/src/game/combat.js';
import { Game } from '../server/src/game/Game.js';
import { groundSpots, rollGroundItem, spawnGroundLoot } from '../server/src/game/loot.js';
import { Player } from '../server/src/game/Player.js';
import { LootStore } from '../client/src/net/lootStore.js';

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

test('botín del suelo: mismo mapa con la misma semilla, en lugares libres', () => {
  const a = makeRoom();
  const b = makeRoom();
  spawnGroundLoot(a.game, seeded(42));
  spawnGroundLoot(b.game, seeded(42));
  const list = (r) => [...r.game.loot.values()].map((e) => `${e.item}@${e.x.toFixed(2)},${e.y.toFixed(2)}`);
  assert.deepEqual(list(a), list(b));
  assert.ok(a.game.loot.size > 200, `${a.game.loot.size} objetos`);
  for (const e of a.game.loot.values()) {
    assert.ok(!overlapsObstacle(e.x, e.y, 0.5), `${e.item} dentro de un obstáculo`);
  }
  // Los tres permitidos salen
  const rand = seeded(7);
  const seen = new Set(Array.from({ length: 3000 }, () => rollGroundItem(rand)));
  assert.deepEqual([...seen].sort(), [...LOOT_GROUND].sort());
  assert.ok(groundSpots(seeded(1)).length > 200);
  // El sincronizado inicial llega a todos
  assert.ok(a.broadcasts.some((x) => x.event === EVENTS.LOOT_SYNC && x.data.length === a.game.loot.size));
});

test('fase 23: en el suelo solo munición, vendas y casco 1 en muchas partidas (nada de armas ni poder gratis)', () => {
  const allowed = new Set(LOOT_GROUND);
  assert.ok(LOOT_GROUND.every((id) => id.startsWith('ammo_') || id === 'bandage' || id === 'helmet1' || id === 'knife'), '7A: el cuchillo también');
  for (let seed = 1; seed <= 6; seed++) {
    const room = makeRoom();
    spawnGroundLoot(room.game, seeded(seed * 104729));
    for (const e of room.game.loot.values()) assert.ok(allowed.has(e.item), `semilla ${seed}: ${e.item} en el suelo`);
  }
  // Al empezar: solo la pistola
  const p = new Player({ id: 9, name: 'N', color: '#fff', token: 't' });
  assert.deepEqual(p.weapons.map((w) => w?.id ?? null), [null, null, 'm1911']);
  const counts = [...Object.values(p.heals), ...Object.values(p.throwables)].reduce((a, b) => a + b, 0);
  assert.equal(counts + p.armorLevel + p.helmetLevel + p.backpackLevel + p.loose.length, 0);
});

test('fase 23: lo recogido desaparece para todos, también para quien entra después', () => {
  const room = makeRoom();
  // Dos clientes que reciben los mismos eventos que el servidor manda a la sala
  const a = new LootStore();
  const b = new LootStore();
  const apply = (store, { event, data }) => {
    if (event === EVENTS.LOOT_SYNC) store.sync(data);
    if (event === EVENTS.LOOT_ADD) store.add(data);
    if (event === EVENTS.LOOT_REMOVE) store.remove(data);
  };
  const forward = (from) => room.broadcasts.slice(from).forEach((m) => [a, b].forEach((store) => apply(store, m)));
  spawnGroundLoot(room.game, seeded(3));
  forward(0);
  const target = [...room.game.loot.values()][0];
  assert.ok(b.items.has(target.id));
  const versionB = b.version;
  const p = addPlayer(room, 1, target.x, target.y);
  p.helmetLevel = 0;
  p.heals.bandage = 0;
  p.ammo = {};
  const before = room.broadcasts.length;
  room.game.interact(p);
  forward(before);
  assert.equal(room.game.loot.has(target.id), false, 'el servidor lo quitó');
  assert.equal(b.items.has(target.id), false, 'el otro cliente deja de verlo');
  assert.ok(b.version > versionB, 'su escena tiene que redibujar');
  // Quien entra o reconecta después recibe la lista ya sin ese objeto
  const late = new LootStore();
  room.game.syncLoot(p);
  const sync = room.emitted.findLast((m) => m.event === EVENTS.LOOT_SYNC);
  late.sync(sync.data);
  assert.equal(late.items.has(target.id), false);
  assert.equal(late.items.size, room.game.loot.size);
});

const lastTaken = (room, p) => room.emitted.findLast((m) => m.to === p.id && m.event === EVENTS.LOOT_TAKEN)?.data;

test('arranque: solo la M1911 con 3 balas; ninguna arma tiene munición infinita (salvo los puños)', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  assert.deepEqual(p.weapons.map((w) => w?.id ?? null), [null, null, 'm1911']);
  assert.equal(p.mag + p.reserve, START_BULLETS);
  for (const [id, w] of Object.entries(WEAPONS)) if (w.category !== 'melee') assert.ok(w.magazine < 200 && w.ammo, id);
});

test('armas: con lugar van a una ranura libre; con las dos principales llenas pregunta y no cambia nada', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  place(room, 'm4a1', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  place(room, 'ak47', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  assert.deepEqual(p.weapons.map((w) => w?.id ?? null), ['m4a1', 'ak47', 'm1911']);
  const spas = place(room, 'spas12', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  assert.deepEqual(lastTaken(room, p).need, [0, 1], 'pregunta cuál reemplazar');
  assert.deepEqual(p.weapons.map((w) => w?.id ?? null), ['m4a1', 'ak47', 'm1911'], 'nada cambió solo');
  // Elige reemplazar la 1: la M4A1 queda en el suelo con su cargador
  room.game.inventoryOp(p, { op: 'take', lootId: spas, replace: 0 });
  assert.equal(p.weapons[0].id, 'spas12');
  assert.ok([...room.game.loot.values()].some((e) => e.item === 'm4a1' && e.state?.mag === WEAPONS.m4a1.magazine));
  // También la pistola se cambia y se suelta
  room.game.inventoryOp(p, { op: 'drop', what: { kind: 'weapon', slot: 2 } });
  assert.equal(p.weapons[2], null);
  assert.ok([...room.game.loot.values()].some((e) => e.item === 'm1911'));
});

test('mochila: munición por tipo con límite; lo que no cabe queda en el suelo', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  const cap = BACKPACK[0].ammo['556'];
  const id = place(room, 'ammo_556', OPEN.x + 0.5, OPEN.y, { n: cap + 12 });
  room.game.interact(p);
  assert.equal(p.ammo['556'], cap);
  const rest = [...room.game.loot.values()].find((e) => e.item === 'ammo_556');
  assert.ok(rest && rest.id !== id && rest.state.n === 12, 'sobran 12 en el suelo');
  room.game.interact(p);
  assert.ok(lastTaken(room, p).full, 'avisa que no cabe');
  // Soltar una cantidad
  room.game.inventoryOp(p, { op: 'drop', what: { kind: 'ammo', type: '556', n: 10 } });
  assert.equal(p.ammo['556'], cap - 10);
});

test('accesorios: se colocan solos en el arma compatible; si no hay, van a la mochila', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  place(room, 'scope4x', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  assert.deepEqual(p.loose, ['scope4x'], 'la pistola no lleva 4x');
  place(room, 'kar98k', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  assert.equal(p.weapons[0].att.scope, 'scope4x', 'al tomar el francotirador se le pone la que estaba suelta');
  assert.deepEqual(p.loose, []);
  place(room, 'extmag', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  assert.equal(p.weapons[2].att.mag, 'extmag', 'va a la pistola (el francotirador no lleva cargador)');
  assert.equal(magazineOf('m1911', p.weapons[2].att), Math.round(WEAPONS.m1911.magazine * 1.5));
  room.game.inventoryOp(p, { op: 'detach', slot: 2, att: 'mag' });
  assert.deepEqual(p.loose, ['extmag']);
});

test('caja de botín del caído: todo su inventario; se toma objeto por objeto o todo lo que quepa', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.giveItem('ak47');
  p.armorLevel = 2;
  p.armor = 30;
  p.heals.bandage = 2;
  p.throwables.smoke = 1;
  const contents = inventoryItems(p);
  damagePlayer(room.game, p, 500, null, 0, { ignoreArmor: true });
  const box = [...room.game.loot.values()].find((e) => e.box);
  assert.equal(box.box.length, contents.length);
  const q = addPlayer(room, 2, box.x, box.y);
  room.game.interact(q);
  assert.equal(lastTaken(room, q).box, box.id, 'abre la lista sin tomar nada');
  room.game.inventoryOp(q, { op: 'take', lootId: box.id, index: box.box.findIndex((c) => c.item === 'armor2') });
  assert.equal(q.armorLevel, 2);
  assert.equal(q.armor, 30);
  const next = [...room.game.loot.values()].find((e) => e.box);
  room.game.inventoryOp(q, { op: 'take', lootId: next.id, all: true });
  assert.equal(q.heals.bandage, 2);
  assert.equal(q.throwables.smoke, 1);
  assert.equal(q.weapons[0]?.id, 'ak47');
});

test('la caja de botín de quien muere en el agua aparece en el punto seco más cercano', async () => {
  const { riverY, waterAt } = await import('@calculo-royale/shared/mapPlan');
  const room = makeRoom();
  const p = addPlayer(room, 1, 0, riverY(0));
  p.heals.bandage = 1;
  damagePlayer(room.game, p, 500, null, 0);
  const box = [...room.game.loot.values()].find((e) => e.box);
  assert.equal(waterAt(box.x, box.y), 0);
});

test('premio de una caja: el jugador elige; lo demás queda junto a la caja, solo para él 10 s', () => {
  const room = makeRoom();
  room.game.startMatch();
  room.game.pickCrates(seeded(5));
  const crate = room.game.crates.find((c) => c.rarity === 2 && !c.practice && !c.airdrop);
  const p = addPlayer(room, 1, crate.x, crate.y);
  const q = addPlayer(room, 2, crate.x, crate.y);
  room.game.interact(p);
  room.game.answerCrate(p, crate.id, p.question.q.correcta);
  assert.equal(p.offer.options.length, 3, 'épico: 3 opciones');
  const before = JSON.stringify(p.weapons);
  assert.equal(JSON.stringify(p.weapons), before, 'nada cambia hasta que elige');
  room.game.chooseOffer(p, 0);
  assert.equal(p.offer, null);
  const left = [...room.game.loot.values()].filter((e) => e.owner === p.id);
  assert.ok(left.length >= 2, 'las otras opciones quedan en el suelo');
  // Otro jugador no las puede tomar durante 10 s
  const loot = left[0];
  room.game.inventoryOp(q, { op: 'take', lootId: loot.id });
  assert.ok(room.game.loot.has(loot.id));
  room.game.now += LOOT.privateMs + 1;
  room.game.inventoryOp(q, { op: 'take', lootId: loot.id, replace: 0 });
  assert.ok(!room.game.loot.has(loot.id) || lastTaken(room, q)?.full, 'después sí');
});

test('casco: resta un porcentaje del daño después del chaleco', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.helmetLevel = 3;
  damagePlayer(room.game, p, 50, 2, 0);
  assert.ok(Math.abs(p.hp - (MAX_HP - 50 * (1 - HELMET[3]))) < 1e-9);
});

test('curación con tiempo: venda +15 a los 2 s, botiquín completo a los 6 s; disparar cancela', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.hp = 40;
  p.heals.bandage = 1;
  room.game.useItem(p, 'bandage');
  assert.ok(p.healing);
  tick(room, Math.ceil(HEALING.bandage.useMs / TICK_MS) + 1);
  assert.equal(p.hp, 55);
  assert.equal(p.heals.bandage, 0);
  p.heals.medkit = 1;
  room.game.useItem(p, 'medkit');
  tick(room, 10);
  fire(room.game, p, { aim: 0, buttons: BUTTONS.FIRE, viewTick: room.game.tick });
  assert.equal(p.healing, null);
  assert.equal(p.heals.medkit, 1);
  room.game.useItem(p, 'medkit');
  tick(room, Math.ceil(HEALING.medkit.useMs / TICK_MS) + 1);
  assert.equal(p.hp, MAX_HP);
});

test('lanzables: humo tapa, muro bloquea balas y se rompe, molotov quema, UAV marca a 3, aturdidora frena', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  const throwKind = (kind, aimDist = 8) => {
    p.throwables[kind] = 1;
    p.throwSel = kind;
    p.nextGrenadeAt = 0;
    room.game.handleInput(p, { aim: 0, buttons: BUTTONS.GRENADE, viewTick: room.game.tick, aimDist, mx: 0, my: 0 });
    tick(room, 40);
  };
  throwKind('smoke');
  assert.equal(room.game.smokes.length, 1);
  throwKind('wall');
  assert.equal(room.game.walls.length, 1);
  const wall = room.game.walls[0];
  // Una bala hacia el muro se detiene ahí
  const target = addPlayer(room, 2, OPEN.x + 14, OPEN.y);
  p.giveItem('awm');
  p.aim = 0;
  const hp = target.hp;
  fire(room.game, p, { aim: 0, buttons: BUTTONS.FIRE, viewTick: room.game.tick });
  assert.equal(target.hp, hp, 'el muro lo cubrió');
  assert.ok(wall.hp < THROWABLES.wall.hp);
  // Molotov a los pies del blanco
  room.game.smokes.length = 0;
  p.teleport(OPEN.x + 10, OPEN.y);
  throwKind('molotov', 4);
  tick(room, 40);
  assert.ok(target.hp < hp, 'se quema');
  // UAV: marca a los 3 más cercanos
  for (let i = 3; i <= 6; i++) addPlayer(room, i, OPEN.x + i * 3, OPEN.y + 20);
  throwKind('uav');
  assert.equal(p.marks.ids.length, 3);
  // Aturdidora mirándola de cerca
  const r = addPlayer(room, 9, OPEN.x + 4, OPEN.y + 0.5);
  r.aim = 0; // mira hacia donde cae la granada
  p.teleport(OPEN.x, OPEN.y);
  throwKind('flash', 8);
  assert.ok(r.flashUntil > room.game.now || r.speedFactor < 1);
});

test('arsenal: ningún arma tiene un DPS absurdo frente a su categoría', () => {
  const sustained = (w) => (w.magazine * w.damage * w.pellets) / ((w.magazine * w.intervalMs + w.reloadMs) / 1000);
  const byCat = {};
  for (const [id, w] of Object.entries(WEAPONS)) if (!['special', 'melee'].includes(w.category)) (byCat[w.category] ??= []).push([id, sustained(w)]);
  for (const [cat, list] of Object.entries(byCat)) {
    const mean = list.reduce((t, [, d]) => t + d, 0) / list.length;
    for (const [id, d] of list) assert.ok(d > mean * 0.6 && d < mean * 1.6, `${id} (${cat}): ${d.toFixed(0)} vs ${mean.toFixed(0)}`);
  }
  // Las categorías tampoco se pasan entre sí (nada por encima de 3 veces la pistola)
  const pistol = sustained(WEAPONS.m1911);
  for (const [id, w] of Object.entries(WEAPONS)) if (w.category !== 'melee' && w.category !== 'special') assert.ok(sustained(w) < pistol * 4, id);
  assert.ok(WEAPON_CATEGORIES.pistol.secondary);
});

test('el servidor valida: sin vida, sin objeto o en el bus no se cura ni toma', () => {
  const room = makeRoom();
  const p = addPlayer(room, 1, OPEN.x, OPEN.y);
  p.hp = 50;
  room.game.useItem(p, 'medkit');
  assert.equal(p.healing, null, 'no tiene botiquín');
  p.heals.medkit = 1;
  p.deploy = { phase: 'fall' };
  room.game.useItem(p, 'medkit');
  assert.equal(p.healing, null, 'cayendo del bus');
  place(room, 'm4a1', OPEN.x + 0.5, OPEN.y);
  room.game.interact(p);
  assert.equal(p.weapons[0], null, 'cayendo no toma');
  room.game.inventoryOp(p, { op: 'drop', what: { kind: 'weapon', slot: 2 } });
  assert.equal(p.weapons[2]?.id, 'm1911', 'cayendo no suelta');
});
