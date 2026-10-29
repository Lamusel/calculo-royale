// Audio total (npm test): voz del Mando en palabras, elección de voz, manifiesto de archivos
// propios, prioridad de voces, canales con ducking, momento musical y armonía de la música.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allowVoice, channelLevel, duckLevel, MAX_VOICES, musicMoment } from '../client/src/audio/mix.js';
import { chordOf, degreeNote, MOMENTS } from '../client/src/audio/music.js';
import { buildAudioManifest } from '../scripts/audio-manifest.js';

test('manifiesto de audio: solo los que existen, mp3/ogg/wav, variantes agrupadas y voz', () => {
  const root = mkdtempSync(join(tmpdir(), 'audio-'));
  for (const d of ['sfx', 'music', 'voz']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'sfx', 'explosion.mp3'), '');
  writeFileSync(join(root, 'sfx', 'notas.txt'), '');
  writeFileSync(join(root, 'golpe.wav'), 'x'.repeat(50));
  writeFileSync(join(root, 'golpe.mp3'), 'x'.repeat(10)); // mismo nombre en dos formatos: gana el más liviano
  writeFileSync(join(root, 'golpe-2.ogg'), '');
  writeFileSync(join(root, 'music', 'duelo.ogg'), '');
  for (const n of [1, 2, 7]) writeFileSync(join(root, 'music', `radio-camion-${n}.mp3`), `${n}`);
  writeFileSync(join(root, 'voz', 'zona-nueva.mp3'), '');
  const m = buildAudioManifest(root);
  // 7B: cada ruta lleva la huella del contenido (?v=…)
  const strip = (list) => list.map((u) => u.replace(/\?v=[0-9a-f]{8}$/, '')).sort();
  assert.deepEqual(strip(m.sfx.explosion), ['/assets/audio/sfx/explosion.mp3']);
  assert.deepEqual(strip(m.sfx.golpe), ['/assets/audio/golpe-2.ogg', '/assets/audio/golpe.mp3']);
  assert.deepEqual(strip(m.music['radio-camion']), [1, 2, 7].map((n) => `/assets/audio/music/radio-camion-${n}.mp3`), 'radios sin límite');
  assert.deepEqual(Object.keys(m.music).sort(), ['duelo', 'radio-camion']);
  assert.match(m.voice['zona-nueva'], /^\/assets\/audio\/voz\/zona-nueva\.mp3\?v=[0-9a-f]{8}$/);
  // Al reemplazar un archivo (mismo nombre) cambia la huella
  const before = m.sfx.golpe.find((u) => u.includes('golpe.mp3'));
  writeFileSync(join(root, 'golpe.mp3'), 'y'.repeat(10));
  assert.notEqual(buildAudioManifest(root).sfx.golpe.find((u) => u.includes('golpe.mp3')), before);
  assert.deepEqual(buildAudioManifest(join(root, 'nada')), { sfx: {}, music: {}, voice: {} });
  rmSync(root, { recursive: true, force: true });
});

test('límite de voces: con el cupo casi lleno solo entran las importantes', () => {
  assert.equal(allowVoice(0, 0), true);
  assert.equal(allowVoice(MAX_VOICES - 10, 0), false, 'los pasos se descartan primero');
  assert.equal(allowVoice(MAX_VOICES - 10, 1), true);
  assert.equal(allowVoice(MAX_VOICES - 4, 1), false);
  assert.equal(allowVoice(MAX_VOICES - 1, 2), true, 'disparos y explosiones siempre que quede lugar');
  assert.equal(allowVoice(MAX_VOICES, 2), false);
});

test('canales: general × canal, silencio y ducking mientras habla el Mando', () => {
  const s = { volume: 1, musicVolume: 0.5, sfxVolume: 1, voiceVolume: 1, muted: false };
  assert.equal(channelLevel(s, 'music'), 0.25, 'curva perceptual');
  assert.equal(channelLevel(s, 'sfx'), 1);
  assert.equal(channelLevel({ ...s, muted: true }, 'sfx'), 0);
  assert.equal(channelLevel({ ...s, volume: 0 }, 'voice'), 0);
  assert.ok(duckLevel('music', true) < duckLevel('sfx', true));
  assert.ok(duckLevel('sfx', true) < 1);
  assert.equal(duckLevel('music', false), 1);
});

test('momento musical según la sala', () => {
  assert.equal(musicMoment({ phase: 'lobby' }), 'lobby');
  assert.equal(musicMoment({ phase: 'playing', deploying: true }), 'bus');
  assert.equal(musicMoment({ phase: 'playing' }), 'partida');
  assert.equal(musicMoment({ phase: 'playing', closing: true }), 'zona');
  assert.equal(musicMoment({ phase: 'playing', duel: true, closing: true }), 'duelo');
  assert.equal(musicMoment({ phase: 'results', winner: true }), 'victoria');
  assert.equal(musicMoment({ phase: 'results' }), 'resultados');
  for (const m of ['lobby', 'bus', 'partida', 'zona', 'duelo', 'victoria', 'resultados']) assert.ok(MOMENTS[m], m);
});

test('música: acordes de la escala del momento', () => {
  const m = MOMENTS.victoria; // do mayor
  assert.deepEqual(chordOf(m, 0), [48, 52, 55], 'do - mi - sol');
  assert.equal(degreeNote(m, 7), 60, 'una octava arriba');
  for (const moment of Object.values(MOMENTS)) {
    for (let bar = 0; bar < 4; bar++) {
      const [a, b, c] = chordOf(moment, bar);
      assert.ok(a < b && b < c && c - a <= 12, 'tríada dentro de una octava');
    }
  }
});
