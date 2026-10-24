// Accesorios que se notan (npm test): equipo visible en la red y en el modelo, dispersión, retroceso,
// capacidad, casco (más contra el francotirador) y el número de daño ya reducido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACHMENTS, BACKPACK, HELMET, HELMET_SNIPER, LOOT_ITEMS, RECOIL, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { decodeGear, encodeGear, GEAR_INFO, helmetFactor } from '@calculo-royale/shared/gear';
import { capacityOf, magazineOf, reserveCap, weaponWith } from '@calculo-royale/shared/inventory';
import { BUTTONS, EVENTS } from '@calculo-royale/shared/protocol';
import { currentRecoil, damagePlayer, fire } from '../server/src/game/combat.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';
import { Character } from '../client/src/game/character/Character.js';

function makeRoom() {
  const room = { phase: 'playing', players: new Map(), emitted: [], emitTo(p, event, data) { this.emitted.push({ to: p.id, event, data }); }, broadcast() {}, broadcastState() {}, respawnInLobby() {} };
  room.game = new Game(room);
  return room;
}
const addPlayer = (room, id, x, y) => {
  const p = new Player({ id, name: `P${id}`, color: '#fff', token: `t${id}` });
  p.teleport(x, y);
  p.connected = true;
  room.players.set(id, p);
  return p;
};

test('equipo visible: viaja en el snapshot y vuelve igual', () => {
  const p = new Player({ id: 1, name: 'A', color: '#fff', token: 't' });
  Object.assign(p, { helmetLevel: 2, backpackLevel: 3 });
  Object.assign(p.attachments, { scope: 'scope4x', mag: 'extmag', stock: 'stock', muzzle: 'silencer' });
  assert.deepEqual(decodeGear(encodeGear(p)), { helmet: 2, backpack: 3, scope: 'scope4x', mag: true, stock: true, muzzle: true });
  assert.deepEqual(decodeGear(0), { helmet: 0, backpack: 0, scope: null, mag: false, stock: false, muzzle: false });
  const room = makeRoom();
  room.players.set(1, p);
  assert.equal(room.game.snapshot([p])[1][0][10], encodeGear(p));
});

test('en el modelo: mira, cargador, culata y silenciador en el arma; casco y mochila en el cuerpo', () => {
  const ch = new Character({ skin: 'soldado', color: '#f00' });
  ch.setWeapon(WEAPON_IDS.indexOf('rifle'));
  ch.setGear({ helmet: 2, backpack: 3, scope: 'scope2x', mag: true, stock: true, muzzle: true });
  assert.equal(ch.gearMeshes.length, 6);
  const weapon = ch.weapons[WEAPON_IDS.indexOf('rifle')];
  assert.equal(weapon.children.length, 4, 'cuatro accesorios montados en el rifle');
  assert.equal(ch.rig.sockets.HeadTopSocket.children.length >= 1, true);
  // Mochila más grande con más nivel
  const size = (level) => {
    ch.setGear({ helmet: 0, backpack: level, scope: null, mag: false, stock: false, muzzle: false });
    ch.gearMeshes[0].geometry.computeBoundingBox();
    const b = ch.gearMeshes[0].geometry.boundingBox;
    return (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z);
  };
  assert.ok(size(1) < size(2) && size(2) < size(3));
  ch.setGear(null);
  assert.equal(ch.gearMeshes.length, 0);
});

test('dispersión: punto rojo y culata la cierran; disparar seguido la abre (retroceso)', () => {
  const base = WEAPONS.rifle.spread;
  assert.ok(Math.abs(weaponWith('rifle', { scope: 'reddot' }).spread - base * ATTACHMENTS.reddot) < 1e-12);
  assert.ok(Math.abs(weaponWith('rifle', { stock: 'stock' }).spread - base * ATTACHMENTS.stock) < 1e-12);
  assert.ok(weaponWith('rifle', {}, 1).spread > base, 'con retroceso, más dispersión');
  assert.equal(weaponWith('shotgun', {}, 2).spread, WEAPONS.shotgun.spread, 'el abanico de la escopeta no cambia');
});

test('retroceso: sube con cada disparo, se recupera y la culata lo reduce a la mitad', () => {
  const room = makeRoom();
  const shoot = (stock) => {
    const p = addPlayer(room, stock ? 2 : 1, 10, 30);
    p.giveItem('rifle');
    if (stock) p.attachments.stock = 'stock';
    p.primary.mag = 30;
    for (let i = 0; i < 5; i++) {
      p.nextFireAt = 0;
      fire(room.game, p, { aim: 0, buttons: BUTTONS.FIRE, viewTick: room.game.tick });
    }
    return p.recoil;
  };
  const without = shoot(false);
  const withStock = shoot(true);
  assert.ok(without > 0.8, `${without}`);
  assert.ok(Math.abs(withStock - without * RECOIL.stock) < 1e-9, 'la culata la mitad');
  const p = room.players.get(1);
  room.game.now += 2000;
  assert.ok(currentRecoil(room.game, p) < without, 'se recupera con el tiempo');
});

test('capacidad: cargador ampliado y mochila cambian los límites', () => {
  assert.equal(magazineOf('rifle', { mag: 'extmag' }), Math.round(WEAPONS.rifle.magazine * ATTACHMENTS.extmag));
  assert.equal(magazineOf('rifle', {}), WEAPONS.rifle.magazine);
  for (let l = 1; l <= 3; l++) {
    assert.ok(capacityOf('bandage', l) > capacityOf('bandage', l - 1));
    assert.ok(reserveCap('rifle', l) > reserveCap('rifle', l - 1));
  }
  assert.equal(capacityOf('grenade', 3), BACKPACK[3].grenade);
});

test('casco: reduce el daño y más el del francotirador; el número de daño lo refleja', () => {
  const room = makeRoom();
  const target = addPlayer(room, 2, 10, 30);
  target.helmetLevel = 3;
  damagePlayer(room.game, target, 40, 1, WEAPON_IDS.indexOf('rifle'));
  assert.ok(Math.abs(target.hp - (100 - 40 * (1 - HELMET[3]))) < 1e-9);
  const hp = target.hp;
  const { dealt } = damagePlayer(room.game, target, 40, 1, WEAPON_IDS.indexOf('sniper'));
  assert.ok(Math.abs(dealt - 40 * (1 - HELMET_SNIPER[3])) < 1e-9);
  assert.ok(Math.abs(target.hp - (hp - dealt)) < 1e-9);
  assert.ok(helmetFactor(3, true) < helmetFactor(3, false));
  // El que dispara ve el daño ya reducido
  const shooter = addPlayer(room, 1, 4, 30);
  shooter.giveItem('sniper');
  room.emitted.length = 0;
  fire(room.game, shooter, { aim: 0, buttons: BUTTONS.FIRE, viewTick: room.game.tick });
  const hit = room.emitted.find((e) => e.event === EVENTS.COMBAT_HIT);
  assert.equal(hit.data[1], Math.round(WEAPONS.sniper.damage * (1 - HELMET_SNIPER[3])));
});

test('cada objeto de equipo tiene icono, nombre corto y efecto explicado', () => {
  for (const [id, def] of Object.entries(LOOT_ITEMS)) {
    if (!['attachment', 'helmet', 'backpack', 'armor'].includes(def.kind)) continue;
    assert.ok(GEAR_INFO[id]?.icon && GEAR_INFO[id].short && GEAR_INFO[id].effect.length > 10, id);
  }
});
