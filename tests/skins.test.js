// Skins (npm test): catálogo, validación en el servidor, logros y modelos de cada skin
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ACHIEVEMENTS, canUseSkin, DEFAULT_SKIN, SKINS } from '@calculo-royale/shared/skins';
import { loadProgress, recordEvent, unlockedSkins } from '../client/src/achievements.js';
import { SKIN_STYLES } from '../client/src/game/models/skins.js';
import { armGeometry, legGeometry, torsoGeometry } from '../client/src/game/models/soldier.js';

// Almacenamiento falso (como localStorage)
const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};

const hasColor = (geometry, hex) => {
  const target = new THREE.Color(hex);
  const colors = geometry.attributes.color.array;
  for (let i = 0; i < colors.length; i += 3) {
    if (Math.abs(colors[i] - target.r) < 1e-4 && Math.abs(colors[i + 1] - target.g) < 1e-4 && Math.abs(colors[i + 2] - target.b) < 1e-4) return true;
  }
  return false;
};

test('catálogo: 24 skins en 5 colecciones más la básica, ids únicos, de honor con su logro', () => {
  assert.equal(new Set(SKINS.map((s) => s.id)).size, SKINS.length);
  assert.ok(SKINS.length >= 24);
  for (const s of SKINS.filter((x) => x.rarity === 'honor')) assert.ok(ACHIEVEMENTS[s.achievement], s.id);
  assert.equal(SKINS[0].id, DEFAULT_SKIN);
});

test('cada skin construye su modelo y muestra el color del jugador', () => {
  const accent = '#ec4899';
  for (const s of SKINS.filter((x) => x.type !== 'external')) {
    assert.ok(SKIN_STYLES[s.id], `falta el estilo de ${s.id}`);
    for (const vest of [0, 3]) {
      const torso = torsoGeometry(accent, vest, s.id);
      assert.ok(torso.attributes.position.count > 0, s.id);
    }
    assert.ok(hasColor(armGeometry('R', accent, s.id), accent), `${s.id}: brazalete`);
    assert.ok(armGeometry('L', accent, s.id).attributes.position.count > 0, s.id);
    assert.ok(legGeometry(s.id).attributes.position.count > 0);
    // Además del brazalete, cada skin muestra el acento en su torso o accesorios
    assert.ok(hasColor(torsoGeometry(accent, 0, s.id), accent), `${s.id}: acento en el torso o accesorios`);
  }
});

test('las geometrías se reutilizan (caché por skin y color)', () => {
  assert.equal(torsoGeometry('#3b82f6', 1, 'newton'), torsoGeometry('#3b82f6', 1, 'newton'));
  assert.notEqual(torsoGeometry('#3b82f6', 1, 'newton'), torsoGeometry('#3b82f6', 1, 'gauss'));
});

test('el servidor solo acepta skins del catálogo, y las de honor si están desbloqueadas', () => {
  assert.equal(canUseSkin('newton'), true);
  assert.equal(canUseSkin('pikachu'), false);
  assert.equal(canUseSkin('general'), false);
  assert.equal(canUseSkin('general', ['general']), true);
});

test('logros: 10 doradas, invicto, racha de operador y 50 aciertos desbloquean las de honor', () => {
  const storage = memory();
  for (let i = 0; i < 9; i++) assert.deepEqual(recordEvent('legendary', 1, storage), []);
  assert.deepEqual(recordEvent('legendary', 1, storage), ['general']);
  assert.deepEqual(recordEvent('operatorStreak', 4, storage), []);
  assert.deepEqual(recordEvent('operatorStreak', 5, storage), ['operador']);
  assert.deepEqual(recordEvent('flawlessWin', 1, storage), ['invicto']);
  for (let i = 0; i < 49; i++) recordEvent('correct', 1, storage);
  assert.deepEqual(recordEvent('correct', 1, storage), ['centurion']);
  assert.deepEqual(unlockedSkins(loadProgress(storage)).sort(), ['centurion', 'general', 'invicto', 'operador']);
});

test('sin almacenamiento disponible el progreso no rompe el juego', () => {
  const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  assert.deepEqual(recordEvent('correct', 1, broken), []);
  assert.equal(loadProgress(broken).aciertos, 0);
});
