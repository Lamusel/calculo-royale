// Reproductor de la repetición en el cliente (npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPLAY, TICK_MS } from '@calculo-royale/shared/constants';
import { ReplayClient, replayDuration, replaySpeed } from '../client/src/net/ReplayClient.js';

// Clip de 6 s a 10 Hz: un jugador que camina en x y dispara en el momento clave
function makeReplay() {
  const frames = [];
  for (let tick = 100; tick <= 220; tick += REPLAY.sendEvery) {
    const shots = tick === 190 ? [[7, 3, 19, 0, 0, 12]] : []; // [tirador, arma, x, y, ángulo, distancia]
    frames.push([tick, [[7, tick / 10, 0, 0, 0, 100, 0, 0, 0]], [], [], shots, [], [], [], [], [], [], []]);
  }
  return { kind: 'sniper', title: 'Francotirador', focusId: 7, keyTick: 190, frames };
}

const newFrame = () => ({ others: new Map(), grenades: new Map(), vehicles: new Map() });

test('cámara lenta solo alrededor del momento clave; la duración real crece', () => {
  const key = 10_000;
  assert.equal(replaySpeed(key - 5000, key), 1);
  assert.equal(replaySpeed(key, key), REPLAY.slowSpeed);
  assert.equal(replaySpeed(key + REPLAY.slowAfterMs + 1, key), 1);
  const slow = REPLAY.slowBeforeMs + REPLAY.slowAfterMs;
  assert.equal(replayDuration(0, 20_000, key), 20_000 - slow + slow / REPLAY.slowSpeed);
});

test('el reproductor avanza, sigue al protagonista, dibuja los disparos y termina', () => {
  const replay = makeReplay();
  const client = new ReplayClient(replay);
  const frame = newFrame();
  const total = replayDuration(100 * TICK_MS, 220 * TICK_MS, 190 * TICK_MS);
  let now = 0;
  let sawSlow = false;
  let lastX = -Infinity;
  let moved = true;
  while (!client.done && now < total * 2) {
    client.frame(now, frame);
    if (client.slow) sawSlow = true;
    if (frame.follow) {
      if (frame.follow.x < lastX) moved = false;
      lastX = frame.follow.x;
    }
    now += 50;
  }
  assert.ok(client.done, 'termina');
  assert.ok(Math.abs(now - total) < 300, `dura lo previsto (${now} vs ${total})`);
  assert.ok(sawSlow, 'pasó por la cámara lenta');
  assert.ok(moved && lastX > 10, 'el protagonista avanza en orden');
  const effects = client.drainEffects(Symbol('vista'));
  assert.ok(effects.some((e) => e.type === 'tracer' && e.dist === 12 && e.weapon === 3), 'el disparo del clip se dibuja');
  assert.ok(client.lastShot.has(7));
});
