// Mapa de 1 km y ritmo de partida (fases 34 y 31): agua, zona que se desplaza y caída repartida (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOY, MAP_HALF, TICK_MS, ZONE_PHASES, ZONE_START } from '@calculo-royale/shared/constants';
import { BRIDGES, FORD, onDam, riverY, waterAt } from '@calculo-royale/shared/mapPlan';
import { applyInput } from '@calculo-royale/shared/movement';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { sectorOf } from '@calculo-royale/shared/zone';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';
import { headingName, nextZone, zoneContains } from '../server/src/game/Zone.js';

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

test('agua: el río es hondo, el vado poco profundo y los puentes secos; nadando se va lento', () => {
  assert.equal(waterAt(0, riverY(0)), 2);
  assert.equal(waterAt(FORD.x, FORD.y), 1);
  for (const b of BRIDGES) assert.equal(waterAt(b.x, b.y), 0, `puente en x = ${b.x}`);
  assert.equal(waterAt(0, 300), 0);
  const swim = { x: 0, y: riverY(0), aim: 0 };
  const walk = { x: 0, y: 300, aim: 0 };
  applyInput(swim, { mx: 1, my: 0, aim: 0, buttons: 0 }, 0.5);
  applyInput(walk, { mx: 1, my: 0, aim: 0, buttons: 0 }, 0.5);
  assert.ok(swim.x < walk.x * 0.6, `nado ${swim.x} vs a pie ${walk.x}`);
});

test('zona que se desplaza: el centro se mueve lejos, nunca sale del mapa ni cae en el agua y queda dentro de la anterior', () => {
  const moving = ZONE_PHASES.map((d, i) => (d.moving ? i : -1)).filter((i) => i >= 0);
  assert.equal(moving.length, 2);
  for (let run = 0; run < 60; run++) {
    let cur = { ...ZONE_START };
    for (const def of ZONE_PHASES) {
      const next = nextZone(cur, def, rand);
      assert.ok(zoneContains(cur, next), 'dentro de la anterior');
      assert.ok(Math.abs(next.cx) + next.p <= MAP_HALF && Math.abs(next.cy) + next.q <= MAP_HALF, 'el radio no sale del mapa');
      if (def.moving) {
        assert.ok(Math.hypot(next.cx - cur.cx, next.cy - cur.cy) > (cur.p - next.p) * 0.6, 'se desplaza de verdad');
        assert.ok(!waterAt(next.cx, next.cy) && !onDam(next.cx, next.cy), 'sin caer en el río ni en la represa');
      }
      cur = next;
    }
  }
  assert.equal(headingName(1, 1), 'noreste');
  assert.equal(headingName(0, -1), 'sur');
});

test('8 bots saltando al azar del bus no caen todos en la misma zona', () => {
  const room = {
    phase: 'playing', players: new Map(), topics: ['integrales_dobles'], broadcasts: [], duration: 'normal',
    emitTo() {}, broadcast() {}, broadcastState() {}, respawnInLobby() {}, finishMatch() {}, sendClassStats() {},
  };
  room.game = new Game(room);
  for (let i = 1; i <= 8; i++) {
    const p = new Player({ id: i, name: `B${i}`, color: '#fff', token: `t${i}` });
    p.connected = true;
    room.players.set(i, p);
  }
  room.game.startMatch();
  room.game.startDeploy('bus');
  const players = [...room.players.values()];
  // Cada uno salta en otro momento y se inclina hacia un lado distinto
  const plan = players.map(() => ({ jumpAt: DEPLOY.busWaitMs + rand() * 70_000, angle: rand() * Math.PI * 2 }));
  let seq = 0;
  for (let t = 0; t < 200_000 && players.some((p) => p.deploy); t += TICK_MS) {
    players.forEach((p, i) => {
      const { jumpAt, angle } = plan[i];
      const jump = t >= jumpAt && p.deploy?.phase === 'bus';
      p.queueInput({ seq: ++seq, mx: Math.cos(angle), my: Math.sin(angle), aim: 0, buttons: jump ? BUTTONS.JUMP : 0, viewTick: 0, aimDist: 0 });
    });
    room.game.update();
  }
  assert.ok(players.every((p) => !p.deploy), 'todos aterrizaron');
  const sectors = new Set(players.map((p) => sectorOf(p.x, p.y)));
  assert.ok(sectors.size >= 4, `sectores: ${[...sectors]}`);
  // Repartidos: los dos más lejanos a más de 250 m
  let spread = 0;
  for (const a of players) for (const b of players) spread = Math.max(spread, Math.hypot(a.x - b.x, a.y - b.y));
  assert.ok(spread > 250, `separación máxima ${spread.toFixed(0)} m`);
});

test('puentes: el jeep cruza cada uno de ida y vuelta sin chocar, sin saltos de altura y sobre el tablero', async () => {
  const { applyVehicleInput } = await import('@calculo-royale/shared/vehicle');
  const { terrainHeight } = await import('@calculo-royale/shared/terrain');
  for (const b of BRIDGES) {
    for (const dir of [-1, 1]) {
      const v = { x: b.x, y: b.y - dir * (b.h / 2 + 8), heading: dir * Math.PI / 2, speed: 12 };
      let h = terrainHeight(v.x, v.y);
      for (let i = 0; i < 400 && dir * (v.y - b.y) < b.h / 2 + 8; i++) {
        applyVehicleInput(v, { mx: 0, my: dir }, 0.05);
        assert.equal(v.crashed, false, `choque en el puente x = ${b.x}`);
        const nh = terrainHeight(v.x, v.y);
        assert.ok(Math.abs(nh - h) < 0.4, `salto de altura ${(nh - h).toFixed(2)} en x = ${b.x}`);
        h = nh;
        if (Math.abs(v.y - b.y) < b.h / 2) assert.ok(Math.abs(v.x - b.x) < b.w / 2, 'sobre el tablero');
      }
      assert.ok(dir * (v.y - b.y) >= b.h / 2 + 8, `cruzó el puente x = ${b.x}`);
    }
  }
  // Rozar la baranda de costado no cuenta como choque
  const b = BRIDGES[0];
  const v = { x: b.x + b.w / 2 - 1, y: b.y, heading: 0.4, speed: 10 };
  for (let i = 0; i < 20; i++) {
    applyVehicleInput(v, { mx: Math.cos(0.4), my: Math.sin(0.4) }, 0.05);
    assert.equal(v.crashed, false);
  }
});
