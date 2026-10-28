// Sonidos (npm test): reglas de mezcla y que nada falle sin Web Audio
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEARING, masterLevel, SHOT_VOICES, spatial } from '../client/src/audio/mix.js';
import { sound, updateEngine } from '../client/src/audio/sound.js';
import { WEAPON_IDS } from '@calculo-royale/shared/constants';

test('más lejos suena más bajo; fuera del alcance no suena; el este suena a la derecha', () => {
  let last = Infinity;
  for (const d of [0, 5, 12, 25, 40, 55]) {
    const { gain } = spatial(d, 0);
    assert.ok(gain < last || d === 0, `${d} m`);
    last = gain;
  }
  assert.equal(spatial(0, 0).gain, 1);
  assert.ok(Math.abs(spatial(12, 0).gain - 0.5) < 1e-9, 'a 12 m, la mitad');
  assert.equal(spatial(HEARING + 1, 0).gain, 0);
  assert.ok(spatial(10, 0).pan > 0 && spatial(-10, 0).pan < 0);
  assert.equal(spatial(0, 30).pan, 0);
});

test('volumen maestro con curva perceptual y recortado', () => {
  assert.equal(masterLevel(0), 0);
  assert.equal(masterLevel(1), 1);
  assert.equal(masterLevel(0.5), 0.25);
  assert.equal(masterLevel(2), 1);
});

test('cada arma de fuego tiene su timbre; el francotirador es el más fuerte', () => {
  const voices = SHOT_VOICES.filter(Boolean);
  assert.ok(voices.length >= 20, 'una por arma');
  assert.equal(new Set(voices.map((v) => `${Math.round(v.filter)}-${v.decay.toFixed(3)}`)).size, voices.length, 'cada una suena distinto');
  assert.equal(Math.max(...voices.map((v) => v.level)), SHOT_VOICES[WEAPON_IDS.indexOf('awm')].level);
});

test('sin Web Audio (o antes del primer toque) los sonidos no hacen nada ni fallan', () => {
  for (const [name, fn] of Object.entries(sound)) assert.doesNotThrow(() => fn(0, 0, 0), name);
  assert.doesNotThrow(() => updateEngine({ x: 0, y: 0, speed: 10 }));
});
