import * as THREE from 'three';
import { WEAPON_IDS } from '@calculo-royale/shared/constants';
import { armGeometry, legGeometry, torsoGeometry } from '../models/soldier.js';
import { weaponGeometry } from '../models/weapons.js';
import { restWorldPosition } from './rig.js';

// Skins procedurales (fase 8) montadas sobre el Master Rig. Las geometrías se construyen en
// coordenadas del personaje (o del pivote de los hombros) y están en caché por skin, color y
// chaleco: aquí solo se cuelgan de su hueso con el desplazamiento que corresponde.

const GUNS = WEAPON_IDS.slice(0, 4); // pistola, escopeta, rifle, francotirador
const SHOULDERS_Y = restWorldPosition('shoulderR')[1];

// Desplazamiento de la pieza dentro de su hueso: (pivote de la geometría) − (hueso en reposo)
const offsetFor = (bone, pivot) => {
  const at = restWorldPosition(bone);
  return pivot.map((v, i) => v - at[i]);
};

const PARTS = [
  { key: 'legR', bone: 'upperLegR', geometry: (o) => legGeometry(o.skin), pivot: () => restWorldPosition('upperLegR') },
  { key: 'legL', bone: 'upperLegL', geometry: (o) => legGeometry(o.skin), pivot: () => restWorldPosition('upperLegL') },
  { key: 'torso', bone: 'spine', geometry: (o) => torsoGeometry(o.color, o.vest, o.skin), pivot: () => [0, 0, 0] },
  { key: 'armR', bone: 'upperArmR', geometry: (o) => armGeometry('R', o.color, o.skin), pivot: () => [0, SHOULDERS_Y, 0] },
  { key: 'armL', bone: 'upperArmL', geometry: (o) => armGeometry('L', o.color, o.skin), pivot: () => [0, SHOULDERS_Y, 0] },
];

const mesh = (geometry, material) => {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  return m;
};

// Monta la skin procedural; devuelve { meshes, update(opts), remove() }
export function mountProcedural(rig, options, material) {
  const opts = { ...options };
  const meshes = {};
  for (const part of PARTS) {
    const m = mesh(part.geometry(opts), material);
    m.name = `skin:${part.key}`;
    m.position.set(...offsetFor(part.bone, part.pivot()));
    rig.bones[part.bone].add(m);
    meshes[part.key] = m;
  }
  return {
    meshes,
    // Cambia chaleco, color o skin sin recrear las mallas (solo cambian las geometrías)
    update(next) {
      Object.assign(opts, next);
      for (const part of PARTS) meshes[part.key].geometry = part.geometry(opts);
    },
    remove() {
      for (const m of Object.values(meshes)) m.removeFromParent();
    },
  };
}

// Armas en el WeaponSocket_R: no dependen de la skin
export function attachWeapons(rig, material) {
  return GUNS.map((id) => {
    const m = mesh(weaponGeometry(id), material);
    m.name = `weapon:${id}`;
    m.visible = false;
    rig.sockets.WeaponSocket_R.add(m);
    return m;
  });
}
