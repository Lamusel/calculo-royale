// Manifiesto de audio propio (opcional): anota qué archivos hay en
//   client/public/assets/audio/<nombre>.mp3|ogg|wav       (efectos; también en sfx/, como antes)
//   client/public/assets/audio/music/<momento>.mp3|ogg|wav (música; radio-camion-1..3 incluidas)
//   client/public/assets/audio/voz/<frase>.mp3|ogg|wav     (voz grabada del Mando)
// Variantes: nombre-2, nombre-3… se agrupan con nombre y el juego elige una al azar en cada uso.
// Escribe client/src/audio/audio-manifest.json: así el juego solo pide los que existen.
// Corre antes de npm run dev y npm run build. Uso: node scripts/audio-manifest.js
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'client/public/assets/audio');
const AUDIO = /\.(mp3|ogg|wav|m4a)$/i;
const VARIANT = /-(\d+)$/;

const files = (dir, sub) => {
  const path = sub ? join(dir, sub) : dir;
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((f) => AUDIO.test(f) && statSync(join(path, f)).isFile())
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    .map((f) => ({ name: f.replace(AUDIO, ''), url: `/assets/audio/${sub ? `${sub}/` : ''}${f}` }));
};

// { nombre: [rutas] } agrupando las variantes (nombre, nombre-2, nombre-3…)
const grouped = (list) => {
  const out = {};
  for (const { name, url } of list) (out[name.replace(VARIANT, '')] ??= []).push(url);
  return out;
};

// { sfx: { nombre: [rutas] }, music: { momento: [rutas] }, voice: { frase: ruta } }
export function buildAudioManifest(dir = DIR) {
  return {
    sfx: grouped([...files(dir, 'sfx'), ...files(dir, '')]),
    music: grouped(files(dir, 'music')),
    voice: Object.fromEntries(files(dir, 'voz').map(({ name, url }) => [name, url])),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifest = buildAudioManifest();
  writeFileSync(join(ROOT, 'client/src/audio/audio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const names = [...Object.keys(manifest.sfx), ...Object.keys(manifest.music).map((m) => `música:${m}`), ...Object.keys(manifest.voice).map((v) => `voz:${v}`)];
  console.log(`[audio] ${names.length} archivos propios${names.length ? `: ${names.join(', ')}` : ' (todo sintetizado)'}`);
}
