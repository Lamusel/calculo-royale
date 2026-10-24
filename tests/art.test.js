// Lógica pura del arte (npm test): oclusión, caminos y calidad automática
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findOccluders, insideRect } from '../client/src/game/occlusion.js';
import { distanceToPaths } from '../client/src/game/paths.js';
import { createQualityController, initialQuality, MIN_DPR, qualitySteps } from '../client/src/game/quality.js';

const wall = (id, minX, maxX, minY, maxY, height = 3.2) => ({ id, minX, maxX, minY, maxY, height });

test('tapa lo que está entre el jugador y la cámara (al sur), no lo que está al norte', () => {
  const items = [
    wall('sur', -3, 3, -1.5, -1), // pared justo al sur
    wall('norte', -3, 3, 1, 1.5), // pared al norte
    wall('lejos', -3, 3, -12, -11), // pared muy al sur: no alcanza a tapar
    wall('lado', 5, 7, -2, -1), // fuera del corredor
  ];
  const out = findOccluders(0, 0, items, 50);
  assert.deepEqual([...out], ['sur']);
});

test('lo más alto tapa desde más lejos', () => {
  const low = wall('bajo', -1, 1, -4, -3.5, 1.2);
  const tall = wall('alto', -1, 1, -4, -3.5, 5.2);
  assert.deepEqual([...findOccluders(0, 0, [low, tall], 50)], ['alto']);
});

test('dentro de una casa se detecta para ocultar el techo', () => {
  const house = { minX: -5, maxX: 5, minY: -4, maxY: 4 };
  assert.equal(insideRect(0, 0, house), true);
  assert.equal(insideRect(6, 0, house), false);
});

test('distancia a los caminos', () => {
  const paths = [[[0, 0], [10, 0]]];
  assert.equal(distanceToPaths(5, 3, paths), 3);
  assert.equal(distanceToPaths(-4, 3, paths), 5);
});

test('calidad automática: recorta en orden, nunca baja de 0,75 de resolución', () => {
  const steps = qualitySteps('high');
  const cuts = steps.slice(1).map((p) => p.cut);
  const order = ['resolución', 'sombras', 'partículas y decoración', 'niebla y detalle lejano'];
  assert.deepEqual([...new Set(cuts)], order);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].dpr <= steps[i - 1].dpr);
  assert.equal(steps.at(-1).dpr, MIN_DPR);
  assert.equal(steps.at(-1).shadows, false);
  assert.equal(steps.at(-1).bushes, false);
  assert.equal(steps.at(-1).farLod, true);
  // Las sombras recién se tocan cuando la resolución ya llegó al mínimo
  const firstShadow = steps.findIndex((p) => p.cut === 'sombras');
  assert.equal(steps[firstShadow - 1].dpr, MIN_DPR);
});

test('histéresis: baja solo tras 5 s seguidos bajo 28 FPS y como mucho un cambio cada 10 s', () => {
  const q = createQualityController({ initial: 'medium' });
  let t = 0;
  const run = (fps, seconds) => {
    const changes = [];
    for (let i = 0; i < fps * seconds; i++) {
      t += 1000 / fps;
      const p = q.frame(t);
      if (p) changes.push(p);
    }
    return changes;
  };
  // Un bajón de 3 s no cambia nada
  assert.deepEqual(run(20, 3), []);
  assert.deepEqual(run(60, 2), []);
  // 12 s lentos: un solo paso (el siguiente tendría que esperar 10 s más 5 s lentos)
  const slow = run(20, 12);
  assert.equal(slow.length, 1);
  assert.equal(slow[0].cut, 'resolución');
  assert.equal(q.profile.step, 1);
  // 30 s lentos más: a lo sumo 3 cambios
  assert.ok(run(20, 30).length <= 3);
  const reached = q.profile.step;
  // Con 25 s fluidos devuelve un paso
  assert.equal(run(60, 25).length, 1);
  assert.equal(q.profile.step, reached - 1);
});

test('aviso único si ya no queda nada por recortar', () => {
  let warnings = 0;
  const q = createQualityController({ initial: 'low', onSlow: () => warnings++ });
  for (let t = 0; t < 300000; t += 50) q.frame(t);
  assert.equal(q.profile.step, qualitySteps('low').length - 1);
  assert.equal(warnings, 1);
});

test('?calidad=baja o la opción manual fijan el nivel y nunca cambia', () => {
  const { initial, forced } = initialQuality('?calidad=baja', true);
  assert.equal(initial, 'medium');
  const q = createQualityController({ initial, forced });
  assert.equal(q.profile.name, 'baja');
  for (let t = 0; t < 20000; t += 50) assert.equal(q.frame(t), null);
  assert.equal(initialQuality('', false, 'medium').forced, 'medium');
  assert.equal(initialQuality('', true, 'auto').forced, null);
  assert.equal(initialQuality('?calidad=alta', true, 'low').forced, 'high', 'la URL manda sobre la opción');
});
