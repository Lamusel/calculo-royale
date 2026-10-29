// Manifiesto de audio propio (opcional): anota qué archivos hay en
//   client/public/assets/audio/<nombre>.mp3|ogg|wav       (efectos; también en sfx/, como antes)
//   client/public/assets/audio/music/<momento>.mp3|ogg|wav (música; radio-camion-1, -2, -3… sin límite)
//   client/public/assets/audio/voz/<frase>.mp3|ogg|wav     (voz grabada del Mando)
// Variantes: nombre-2, nombre-3… se agrupan con nombre y el juego elige una al azar en cada uso.
// 7B: cada ruta lleva la huella del contenido (?v=hash): si reemplazas un archivo por otro con el mismo
// nombre, todos reciben el nuevo aunque la caché tenga el viejo. Con el mismo nombre en dos formatos,
// queda solo el más liviano.
// Escribe client/src/audio/audio-manifest.json: así el juego solo pide los que existen.
// Corre antes de npm run dev y npm run build. Uso: node scripts/audio-manifest.js
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'client/public/assets/audio');
const AUDIO = /\.(mp3|ogg|wav|m4a)$/i;
const VARIANT = /-(\d+)$/;
const hashOf = (file) => createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);

const files = (dir, sub) => {
  const path = sub ? join(dir, sub) : dir;
  if (!existsSync(path)) return [];
  // El más liviano de cada nombre (si hay .wav y .mp3 del mismo, gana el que pese menos)
  const best = new Map();
  for (const f of readdirSync(path)) {
    const full = join(path, f);
    if (!AUDIO.test(f) || !statSync(full).isFile()) continue;
    const name = f.replace(AUDIO, '');
    const size = statSync(full).size;
    if (!best.has(name) || size < best.get(name).size) best.set(name, { f, full, size });
  }
  return [...best.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
    .map(([name, { f, full }]) => ({ name, url: `/assets/audio/${sub ? `${sub}/` : ''}${encodeURIComponent(f)}?v=${hashOf(full)}` }));
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
