// Imágenes de la pantalla de carga (7A): todas las .png, .jpg o .webp de client/public/assets/loading/
// (cualquier nombre). Escribe client/src/ui/loading-manifest.json; si no hay, el fondo se genera.
// Corre antes de npm run dev y npm run build. Uso: node scripts/loading-manifest.js
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'client/public/assets/loading');
const IMAGE = /\.(png|jpe?g|webp)$/i;

export function buildLoadingManifest(dir = DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => IMAGE.test(f))
    .sort()
    // Con la huella del contenido: una imagen reemplazada con el mismo nombre se ve nueva para todos
    .map((f) => `/assets/loading/${encodeURIComponent(f)}?v=${createHash('sha1').update(readFileSync(join(dir, f))).digest('hex').slice(0, 8)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = buildLoadingManifest();
  writeFileSync(join(ROOT, 'client/src/ui/loading-manifest.json'), `${JSON.stringify(list, null, 2)}\n`);
  console.log(`[carga] ${list.length} imágenes${list.length ? '' : ' (fondo generado)'}`);
}
