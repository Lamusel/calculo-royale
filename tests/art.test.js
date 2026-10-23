// Lógica pura del arte (npm test): oclusión, caminos y calidad automática
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findOccluders, insideRect } from '../client/src/game/occlusion.js';
import { distanceToPaths } from '../client/src/game/paths.js';
import { createQualityController, initialQuality } from '../client/src/game/quality.js';

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

test('la calidad baja si los FPS caen y vuelve a subir hasta el nivel inicial', () => {
  const q = createQualityController({ initial: 'medium' });
  let t = 0;
  const run = (fps, seconds) => {
    let changed = null;
    for (let i = 0; i < fps * seconds; i++) {
      t += 1000 / fps;
      changed = q.frame(t) ?? changed;
    }
    return changed;
  };
  assert.equal(run(25, 5), 'low');
  assert.equal(q.level, 'low');
  assert.equal(run(60, 14), 'medium');
  run(60, 30);
  assert.equal(q.level, 'medium', 'no sube por encima del nivel inicial');
});

test('?calidad=baja fuerza el nivel y nunca cambia', () => {
  const { initial, forced } = initialQuality('?calidad=baja', true);
  assert.equal(initial, 'medium');
  const q = createQualityController({ initial, forced });
  assert.equal(q.level, 'low');
  for (let t = 0; t < 20000; t += 16) assert.equal(q.frame(t), null);
});
