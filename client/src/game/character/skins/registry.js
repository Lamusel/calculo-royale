import { SKINS, externalName } from '@calculo-royale/shared/skins';
import MANIFEST from './external-manifest.json' with { type: 'json' };
import PORTRAITS from './portraits.json' with { type: 'json' };

// Registro central de skins: procedurales (fase 8) y externas (GLB).
//   rarity: 'comun' | 'raro' | 'epico' | 'legendario' | 'honor' (las de shared/skins.js)
//   renderer: 'pbr' (materiales del archivo) | 'toon'
//   scale: multiplica la altura normalizada (1,8 m)
//   rotation: grados extra sobre la orientación estándar de glTF (el modelo mira a +Z)
//   offset: metros [x, y, z] tras normalizar (pies en el suelo)
//   weaponOffset: ajuste del arma en WeaponSocket_R (posición en metros, rotación en grados)
//   cameraVisualOffsetY: solo visual (no mueve la cámara de juego)
//   victoryAnimation: nombre del clip de victoria del archivo (si no, se busca uno por nombre)
//   lod: usar LOD0/LOD1/LOD2 del archivo o esconder piezas secundarias por distancia
//   portrait: retrato 2D del selector (client/public/assets/skins/portraits/<id>.png); null = tarjeta con iniciales

export const DEFAULTS = {
  type: 'procedural',
  rarity: 'comun',
  renderer: 'toon',
  source: null,
  scale: 1,
  rotation: [0, 0, 0],
  offset: [0, 0, 0],
  weaponOffset: { position: [0, 0, 0], rotation: [0, 0, 0] },
  cameraVisualOffsetY: 0,
  victoryAnimation: null,
  lod: true,
};

export const REGISTRY = new Map();

const portraitOf = (id) => (PORTRAITS.includes(id) ? `/assets/skins/portraits/${id}.png` : null);

export function registerSkin(entry) {
  REGISTRY.set(entry.id, { ...DEFAULTS, portrait: portraitOf(entry.id), ...entry });
}

export function registerExternalSkin(entry) {
  registerSkin({ type: 'external', rarity: 'legendario', renderer: 'pbr', collection: 'Personajes especiales', ...entry });
}

// Procedurales de la fase 8 (catálogo compartido)
for (const s of SKINS) if (s.type !== 'external') registerSkin({ ...s });
// --- Personajes especiales: una línea editable por carpeta de client/public/assets/skins/external/ ---
// Sin línea, la carpeta igual aparece con el id con mayúscula inicial y los ajustes por defecto.
// weaponOffset: son modelos más delgados que el rig, el arma se acerca al cuerpo (revisado en /skins)
export const EXTERNAL_OVERRIDES = {
  '2b': { name: '2B', scale: 1, rotation: [0, 0, 0], offset: [0, 0, 0], weaponOffset: { position: [-0.16, -0.08, -0.07], rotation: [0, 0, 0] } },
  furina: { name: 'Furina', scale: 1, rotation: [0, 0, 0], offset: [0, 0, 0], weaponOffset: { position: [-0.16, -0.1, -0.08], rotation: [0, 0, 0] } },
  ghost: { name: 'Ghost', scale: 1, rotation: [0, 0, 0], offset: [0, 0, 0], weaponOffset: { position: [-0.12, -0.06, -0.04], rotation: [0, 0, 0] } },
  luffy: { name: 'Luffy', scale: 1, rotation: [0, 0, 0], offset: [0, 0, 0], weaponOffset: { position: [-0.16, -0.1, -0.07], rotation: [0, 0, 0] } },
};

export function registerFromManifest(manifest) {
  for (const { id, source, portrait } of manifest) {
    registerExternalSkin({
      id,
      name: externalName(id),
      source,
      portrait: portrait ? `/assets/skins/portraits/${id}.png` : null,
      ...EXTERNAL_OVERRIDES[id],
    });
  }
}
registerFromManifest(MANIFEST);
