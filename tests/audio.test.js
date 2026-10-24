// Audio total (npm test): voz del Mando en palabras, elección de voz, manifiesto de archivos
// propios, prioridad de voces, canales con ducking, momento musical y armonía de la música.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latexToSpeech, numberToWords, pickVoice, radioToSpeech } from '../client/src/audio/speech.js';
import { allowVoice, channelLevel, duckLevel, MAX_VOICES, musicMoment } from '../client/src/audio/mix.js';
import { chordOf, degreeNote, MOMENTS } from '../client/src/audio/music.js';
import { buildAudioManifest } from '../scripts/audio-manifest.js';

test('números en palabras', () => {
  const cases = {
    0: 'cero', 7: 'siete', 16: 'dieciséis', 21: 'veintiuno', 39: 'treinta y nueve', 100: 'cien', 101: 'ciento uno',
    500: 'quinientos', 1000: 'mil', 1225: 'mil doscientos veinticinco', 8464: 'ocho mil cuatrocientos sesenta y cuatro',
    21000: 'veintiún mil', 31000: 'treinta y un mil', 1000000: 'un millón', '-12': 'menos doce', 0.5: 'cero coma cinco',
  };
  for (const [n, words] of Object.entries(cases)) assert.equal(numberToWords(n), words, n);
});

test('desigualdades de la zona en palabras', () => {
  assert.equal(
    latexToSpeech(String.raw`(x - 39)^2 + (y - 14)^2 \le 8464`),
    'equis menos treinta y nueve al cuadrado más ye menos catorce al cuadrado menor o igual que ocho mil cuatrocientos sesenta y cuatro',
  );
  assert.equal(
    latexToSpeech(String.raw`\frac{x^2}{1225} + \frac{(y - 3)^2}{400} \le 1`),
    'equis al cuadrado sobre mil doscientos veinticinco más ye menos tres al cuadrado sobre cuatrocientos menor o igual que uno',
  );
  const said = radioToSpeech(String.raw`Nueva zona segura: $(x + 12)^2 + y^2 \le 400$. Tienen 75 s.`);
  assert.equal(said, 'Nueva zona segura: equis más doce al cuadrado más ye al cuadrado menor o igual que cuatrocientos. Tienen setenta y cinco segundos.');
  assert.ok(!/[\$^{}]/.test(said), 'sin restos de LaTeX');
});

test('voz: es-CO, si no es-MX, si no es-ES, si no cualquier español', () => {
  const v = (lang) => ({ lang, name: lang });
  assert.equal(pickVoice([v('en-US'), v('es-ES'), v('es-MX'), v('es-CO')]).lang, 'es-CO');
  assert.equal(pickVoice([v('es-ES'), v('es_MX')]).lang, 'es_MX');
  assert.equal(pickVoice([v('en-GB'), v('es-ES')]).lang, 'es-ES');
  assert.equal(pickVoice([v('es-AR')]).lang, 'es-AR');
  assert.equal(pickVoice([v('en-US')]), null);
});

test('manifiesto de audio: solo los archivos que existen', () => {
  const root = mkdtempSync(join(tmpdir(), 'audio-'));
  mkdirSync(join(root, 'sfx'), { recursive: true });
  mkdirSync(join(root, 'music'), { recursive: true });
  writeFileSync(join(root, 'sfx', 'explosion.mp3'), '');
  writeFileSync(join(root, 'sfx', 'notas.txt'), '');
  writeFileSync(join(root, 'music', 'duelo.ogg'), '');
  assert.deepEqual(buildAudioManifest(root), { sfx: { explosion: '/assets/audio/sfx/explosion.mp3' }, music: { duelo: '/assets/audio/music/duelo.ogg' } });
  assert.deepEqual(buildAudioManifest(join(root, 'nada')), { sfx: {}, music: {} });
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
