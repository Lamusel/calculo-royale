// Cámara (npm test): más cercana, dinámica y con la opción de distancia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA } from '@calculo-royale/shared/constants';
import { baseDistance, dynamicFactor, goalDistance, sizeVsOld } from '../client/src/game/cameraMath.js';

test('cámara normal: el soldado se ve ~2 veces más grande que con la de 30,5 m', () => {
  const ratio = sizeVsOld(baseDistance('normal'));
  assert.ok(ratio >= 1.8 && ratio <= 2.2, `${ratio}`);
  assert.ok(CAMERA.pitchDeg >= 50 && CAMERA.pitchDeg <= 55);
  assert.ok(baseDistance('normal') >= 16 && baseDistance('normal') <= 20);
  // Opciones: Cerca < Normal < Lejos; algo desconocido vuelve a Normal
  assert.ok(baseDistance('near') < baseDistance('normal') && baseDistance('normal') < baseDistance('far'));
  assert.equal(baseDistance('rara'), baseDistance('normal'));
});

test('cámara dinámica: más cerca adentro, más lejos corriendo afuera y en jeep; despliegue igual que antes', () => {
  assert.ok(dynamicFactor({ inside: true, speed: 0 }) < 1);
  assert.equal(dynamicFactor({ inside: false, speed: 1 }), 1, 'caminando despacio afuera, normal');
  assert.ok(dynamicFactor({ inside: false, speed: 8 }) > 1);
  assert.ok(dynamicFactor({ inside: true, speed: 8 }) < 1, 'adentro manda aunque corra');
  assert.ok(dynamicFactor({ inJeep: true, speed: 15 }) > dynamicFactor({ speed: 15 }));
  assert.equal(goalDistance({ choice: 'normal', air: true }), CAMERA.deployDistance);
  assert.equal(goalDistance({ choice: 'near', projector: true }), CAMERA.projectorDistance);
  assert.equal(goalDistance({ choice: 'far', inside: true }), CAMERA.distances.far * CAMERA.insideFactor);
});
