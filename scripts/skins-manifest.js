// Manifiesto de skins externas: lee client/public/assets/skins/external/<id>/ y anota cada
// carpeta que tenga un modelo GLB (character.glb, o si no el único .glb de la carpeta).
// También anota qué retratos hay en client/public/assets/skins/portraits/ (<id>.png, de cualquier skin),
// así el selector no pide archivos que no existen.
// Escribe dos copias del manifiesto con el mismo contenido:
//   client/src/game/character/skins/external-manifest.json  (el cliente arma el registro)
//   shared/src/externalSkins.js                             (el servidor valida los skinId: en Render
//                                                            no corre el build del cliente)
// Corre antes de npm run dev y npm run build. Uso: node scripts/skins-manifest.js
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = join(ROOT, 'client/public/assets/skins/external');
const PORTRAITS = join(ROOT, 'client/public/assets/skins/portraits');

export function listPortraits(portraits = PORTRAITS) {
  if (!existsSync(portraits)) return [];
  return readdirSync(portraits).filter((f) => f.toLowerCase().endsWith('.png')).map((f) => f.slice(0, -4)).sort();
}

export function buildManifest(dir = DIR, portraits = PORTRAITS) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((id) => statSync(join(dir, id)).isDirectory())
    .sort()
    .flatMap((id) => {
      const glbs = readdirSync(join(dir, id)).filter((f) => f.toLowerCase().endsWith('.glb'));
      const file = glbs.includes('character.glb') ? 'character.glb' : glbs.length === 1 ? glbs[0] : null;
      if (!file) return [];
      return [{ id, source: `/assets/skins/external/${id}/${file}`, portrait: existsSync(join(portraits, `${id}.png`)) }];
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifest = buildManifest();
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(join(ROOT, 'client/src/game/character/skins/external-manifest.json'), text);
  writeFileSync(join(ROOT, 'shared/src/externalSkins.js'), `// Generado por scripts/skins-manifest.js: no editar a mano
export default ${text}`);
  writeFileSync(join(ROOT, 'client/src/game/character/skins/portraits.json'), `${JSON.stringify(listPortraits())}
`);
  console.log(`[skins] ${manifest.length} externas: ${manifest.map((m) => m.id).join(', ') || '(ninguna)'}`);
}
