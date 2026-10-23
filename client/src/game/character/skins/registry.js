import { SKINS } from '@calculo-royale/shared/skins';

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

export function registerSkin(entry) {
  REGISTRY.set(entry.id, { ...DEFAULTS, ...entry });
}

export function registerExternalSkin(entry) {
  registerSkin({ type: 'external', rarity: 'legendario', renderer: 'pbr', collection: 'Skins externas', ...entry });
}

// Procedurales de la fase 8 (catálogo compartido)
for (const s of SKINS) if (s.type !== 'external') registerSkin({ ...s });
// Soldado gris: mientras carga una externa o si su archivo falla (no se puede elegir)
registerSkin({ id: 'fallback', name: 'Soldado gris', hidden: true });

// --- Skins externas: una línea por espacio. Archivo en client/public/assets/skins/external/<id>/character.glb ---
registerExternalSkin({ id: 'externa_01', name: 'Skin externa 1', source: '/assets/skins/external/externa_01/character.glb', scale: 1, offset: [0, 0, 0], rotation: [0, 0, 0] });
registerExternalSkin({ id: 'externa_02', name: 'Skin externa 2', source: '/assets/skins/external/externa_02/character.glb', scale: 1, offset: [0, 0, 0], rotation: [0, 0, 0] });
registerExternalSkin({ id: 'externa_03', name: 'Skin externa 3', source: '/assets/skins/external/externa_03/character.glb', scale: 1, offset: [0, 0, 0], rotation: [0, 0, 0] });
registerExternalSkin({ id: 'externa_04', name: 'Skin externa 4', source: '/assets/skins/external/externa_04/character.glb', scale: 1, offset: [0, 0, 0], rotation: [0, 0, 0] });
registerExternalSkin({ id: 'externa_05', name: 'Skin externa 5', source: '/assets/skins/external/externa_05/character.glb', scale: 1, offset: [0, 0, 0], rotation: [0, 0, 0] });
