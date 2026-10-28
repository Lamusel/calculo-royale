// Pruebas del combate y las colisiones (npm test). Usan el Game real con una sala falsa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARMOR_ABSORB, GRENADE, MAX_HP, RESPAWN_MS, SLOPE_SPEED, TICK_MS, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS } from '@calculo-royale/shared/protocol';
import { decodeInput } from '@calculo-royale/shared/codec';
import { raycastObstacles } from '@calculo-royale/shared/collision';
import { findAutoTarget } from '@calculo-royale/shared/combat';
import { applyInput, slopeFactor } from '@calculo-royale/shared/movement';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';
import { HOUSES } from '@calculo-royale/shared/mapLayout';

// Las casas del pueblo viejo ahora están en el barrio residencial: mismo diseño, desplazado
const DX = HOUSES[1].x + 46;
const DY = HOUSES[1].y - 64;

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
    respawnInLobby(p) {
      p.resetCombat();
      p.teleport(0, 0);
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

let seq = 0;
// Encola un input con los botones dados y avanza un tick
function act(room, p, fields = {}) {
  p.queueInput({ seq: ++seq, mx: 0, my: 0, aim: p.aim, buttons: 0, viewTick: room.game.tick + 1, aimDist: 0, ...fields });
}
const tick = (room, n = 1) => {
  for (let i = 0; i < n; i++) room.game.update();
};

// --- Movimiento y colisiones ---

// Casa del pueblo en (−46, 64) + desplazamiento, 9 × 8, puerta al sur: la pared este por dentro está en x = −41,75
test('las paredes detienen el movimiento', () => {
  const p = { x: -44 + DX, y: 62 + DY, aim: 0 };
  for (let i = 0; i < 40; i++) applyInput(p, { mx: 1, my: 0, aim: 0 }, 0.05);
  assert.ok(Math.abs(p.x - (-41.75 - 0.6 + DX)) < 1e-6, `x = ${p.x}`);
});

test('se puede salir por la puerta de una casa', () => {
  const p = { x: -46 + DX, y: 61.5 + DY, aim: 0 };
  for (let i = 0; i < 40; i++) applyInput(p, { mx: 0, my: -1, aim: 0 }, 0.05);
  assert.ok(p.y < 57 + DY, `y = ${p.y}`);
});

test('los rayos se detienen en la primera pared', () => {
  assert.equal(raycastObstacles(-44 + DX, 62 + DY, 1, 0, 50), 2.25);
});

test('la pendiente cambia la velocidad solo entre 80 % y 115 %', () => {
  let min = Infinity;
  let max = -Infinity;
  for (let x = -60; x <= 60; x += 2) {
    for (let y = -60; y <= 60; y += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const f = slopeFactor(x, y, Math.cos(a), Math.sin(a));
        min = Math.min(min, f);
        max = Math.max(max, f);
      }
    }
  }
  assert.ok(min >= SLOPE_SPEED.min && max <= SLOPE_SPEED.max, `rango [${min}, ${max}]`);
  // En (0, 0) el gradiente apunta hacia +x: subir cuesta, bajar ayuda
  assert.ok(slopeFactor(0, 0, 1, 0) < 1 && slopeFactor(0, 0, -1, 0) > 1);
});

test('el servidor rechaza inputs inválidos', () => {
  assert.equal(decodeInput(null), null);
  assert.equal(decodeInput(['x', 1, 1, 0]), null);
  assert.equal(decodeInput([1, NaN, 0, 0]), null);
  assert.deepEqual(decodeInput([3, 5, -5, 1, 1, 10, 4]), { seq: 3, mx: 1, my: -1, aim: 1, buttons: 1, viewTick: 10, aimDist: 4 });
});

// --- Daño, chaleco y muerte ---

test('la pistola hace daño y el chaleco lo absorbe primero', () => {
  const room = makeRoom();
  const shooter = addPlayer(room, 1, 0, 0);
  const target = addPlayer(room, 2, 8, 0);
  target.giveItem('armor'); // nivel 1: absorbe 25
  assert.equal(target.armor, ARMOR_ABSORB[1]);

  act(room, shooter, { aim: 0, buttons: BUTTONS.FIRE });
  tick(room);
  tick(room, WEAPONS.m1911.intervalMs / TICK_MS);
  act(room, shooter, { aim: 0, buttons: BUTTONS.FIRE });
  tick(room);

  // 2 disparos de 18 = 36: 25 al chaleco (se rompe) y 11 a la vida
  assert.equal(target.armorLevel, 0);
  assert.equal(target.hp, MAX_HP - (2 * WEAPONS.m1911.damage - ARMOR_ABSORB[1]));
  const hits = room.emitted.filter((e) => e.event === EVENTS.COMBAT_HIT);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].to, 1);
});

test('la cadencia limita los disparos', () => {
  const room = makeRoom();
  const shooter = addPlayer(room, 1, 0, 0);
  for (let i = 0; i < 10; i++) {
    act(room, shooter, { aim: 0, buttons: BUTTONS.FIRE });
    tick(room);
  }
  // 10 ticks = 500 ms con pistola cada 300 ms: dispara en el tick 1 y en el 7
  assert.equal(shooter.mag, 1); // arranca con 3 balas
});

test('al vaciar el cargador recarga sola', () => {
  const room = makeRoom();
  const shooter = addPlayer(room, 1, 0, 0);
  shooter.giveItem('kar98k');
  shooter.hand.mag = 1;
  act(room, shooter, { aim: 0, buttons: BUTTONS.FIRE });
  tick(room);
  assert.equal(shooter.hand.mag, 0);
  assert.ok(shooter.reloadUntil > 0);
  const reserve = shooter.reserve;
  tick(room, WEAPONS.kar98k.reloadMs / TICK_MS + 1);
  assert.equal(shooter.hand.mag, WEAPONS.kar98k.magazine);
  assert.equal(shooter.reserve, reserve - WEAPONS.kar98k.magazine);
});

test('las paredes bloquean las balas', () => {
  const room = makeRoom();
  const shooter = addPlayer(room, 1, -44 + DX, 44 + DY); // dentro de la casa
  const target = addPlayer(room, 2, -44 + DX, 48 + DY); // detrás de la pared norte
  act(room, shooter, { aim: Math.PI / 2, buttons: BUTTONS.FIRE });
  tick(room);
  assert.equal(target.hp, MAX_HP);
});

test('una muerte se anuncia en el killfeed con el arma', () => {
  const room = makeRoom();
  const shooter = addPlayer(room, 1, 0, 0);
  const target = addPlayer(room, 2, 8, 0);
  target.hp = 10;
  act(room, shooter, { aim: 0, buttons: BUTTONS.FIRE });
  tick(room);
  assert.equal(target.alive, false);
  assert.equal(target.killedBy, 1);
  assert.equal(shooter.kills, 1);
  const kill = room.broadcasts.find((b) => b.event === EVENTS.COMBAT_KILL);
  assert.deepEqual(kill.data, [1, 2, 0]);
});

test('en el campo de entrenamiento se reaparece; en partida no', () => {
  for (const phase of ['lobby', 'playing']) {
    const room = makeRoom(phase);
    const p = addPlayer(room, 1, 0, 0);
    p.alive = false;
    p.deathAt = 0;
    tick(room, RESPAWN_MS / TICK_MS + 1);
    assert.equal(p.alive, phase === 'lobby', phase);
  }
});

// --- Granadas ---

test('máximo 2 granadas y cada una explota con daño en área', () => {
  const room = makeRoom();
  const thrower = addPlayer(room, 1, 0, 0);
  const victim = addPlayer(room, 2, 6, 0);
  thrower.giveItem('grenade');
  thrower.throwables.frag = 2;

  for (let i = 0; i < 3; i++) {
    act(room, thrower, { aim: 0, buttons: BUTTONS.GRENADE, aimDist: 6 });
    tick(room, GRENADE.intervalMs / TICK_MS);
  }
  assert.equal(thrower.throwables.frag, 0);
  tick(room, GRENADE.fuseMs / TICK_MS + 1);
  assert.equal(room.game.grenades.length, 0);
  assert.ok(victim.hp < MAX_HP, `vida ${victim.hp}`);
});

// --- Auto apuntado y compensación de lag ---

test('el toque rápido apunta solo al enemigo visible más cercano', () => {
  const room = makeRoom();
  const shooter = addPlayer(room, 1, 0, 0);
  const target = addPlayer(room, 2, 0, 8); // al norte; el tirador mira al este
  act(room, shooter, { aim: 0, buttons: BUTTONS.FIRE | BUTTONS.AUTO });
  tick(room);
  assert.equal(target.hp, MAX_HP - WEAPONS.m1911.damage);
});

test('el auto apuntado ignora a quien está detrás de una pared', () => {
  // Desde dentro de la casa: el más cercano está tras la pared este, el visible sale por la puerta sur
  const hidden = { id: 1, x: -40 + DX, y: 62 + DY };
  const visible = { id: 2, x: -46 + DX, y: 55 + DY };
  assert.equal(findAutoTarget(-46 + DX, 62 + DY, 20, [hidden, visible]), visible);
});

test('la compensación de lag acierta donde el tirador veía al objetivo', () => {
  for (const [label, rewind, shouldHit] of [
    ['con lo que veía el tirador', true, true],
    ['con la posición actual', false, false],
  ]) {
    const room = makeRoom();
    const target = addPlayer(room, 2, -8, 0);
    for (let i = 0; i < 8; i++) {
      act(room, target, { mx: 1, aim: 0 });
      tick(room);
    }
    // El tirador vio al objetivo 4 ticks atrás y apunta justo ahí
    const seenTick = room.game.tick - 4;
    const seen = target.positionAt(seenTick);
    const shooter = addPlayer(room, 1, seen.x, -10);
    act(room, shooter, { aim: Math.PI / 2, buttons: BUTTONS.FIRE, viewTick: rewind ? seenTick : room.game.tick + 1 });
    tick(room);
    assert.equal(target.hp < MAX_HP, shouldHit, label);
  }
});

test('el armero que se toma es el más cercano', () => {
  const room = makeRoom('lobby');
  const p = addPlayer(room, 1, -6.5, 9); // entre la escopeta (-8, 10) y el rifle (-4, 10)
  room.game.interact(p);
  assert.equal(p.weapons[0].id, 'm870');
});
