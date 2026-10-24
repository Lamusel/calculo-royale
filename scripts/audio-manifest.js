// Manifiesto de audio propio (opcional): anota qué archivos hay en
//   client/public/assets/audio/sfx/<nombre>.mp3    (reemplaza al efecto sintetizado)
//   client/public/assets/audio/music/<momento>.mp3 (reemplaza a la música procedural)
// y escribe client/src/audio/audio-manifest.json. Así el juego solo pide los que existen.
// Corre antes de npm run dev y npm run build. Uso: node scripts/audio-manifest.js
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'client/public/assets/audio');
const AUDIO = /\.(mp3|ogg|wav|m4a)$/i;

// { sfx: { nombre: ruta }, music: { momento: ruta } }
export function buildAudioManifest(dir = DIR) {
  const list = (sub) => {
    const path = join(dir, sub);
    if (!existsSync(path)) return {};
    return Object.fromEntries(
      readdirSync(path)
        .filter((f) => AUDIO.test(f))
        .sort()
        .map((f) => [f.replace(AUDIO, ''), `/assets/audio/${sub}/${f}`]),
    );
  };
  return { sfx: list('sfx'), music: list('music') };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifest = buildAudioManifest();
  writeFileSync(join(ROOT, 'client/src/audio/audio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const n = Object.keys(manifest.sfx).length + Object.keys(manifest.music).length;
  console.log(`[audio] ${n} archivos propios${n ? `: ${[...Object.keys(manifest.sfx), ...Object.keys(manifest.music)].join(', ')}` : ' (todo sintetizado)'}`);
}
