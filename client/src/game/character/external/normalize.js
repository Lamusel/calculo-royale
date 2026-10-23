import * as THREE from 'three';
import { RIG_HEIGHT } from '../rig.js';

const DEG = Math.PI / 180;
// En glTF los personajes miran a +Z; el rig mira a +X
export const GLTF_FACING = Math.PI / 2;

const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();

// Mide el modelo como se ve en reposo (las mallas con esqueleto usan sus huesos)
function measure(object) {
  object.updateMatrixWorld(true);
  object.traverse((o) => {
    if (o.isSkinnedMesh) o.computeBoundingBox();
  });
  return box.setFromObject(object);
}

// Monta el modelo en  holder > pivot > modelo:  orientado a +X (más la rotación del registro),
// escalado a 1,8 m (por la escala del registro), centrado en X/Z y con los pies en y = 0.
// Actualiza las cajas y esferas de cada malla para que el frustum culling sea correcto.
export function normalizeExternalSkin(model, entry = {}) {
  const holder = new THREE.Group();
  holder.name = 'ExternalSkin';
  const pivot = new THREE.Group();
  pivot.name = 'ExternalPivot';
  pivot.add(model);
  holder.add(pivot);

  const [rx, ry, rz] = entry.rotation ?? [0, 0, 0];
  pivot.rotation.set(rx * DEG, GLTF_FACING + ry * DEG, rz * DEG);
  // Sin mallas (caja vacía) no hay nada que medir: queda como viene
  if (measure(holder).isEmpty()) return { holder, pivot, height: 0, scale: 1 };
  const height = box.getSize(size).y || 1;
  const scale = (RIG_HEIGHT / height) * (entry.scale ?? 1);
  pivot.scale.setScalar(scale);

  measure(holder);
  box.getCenter(center);
  const [ox, oy, oz] = entry.offset ?? [0, 0, 0];
  pivot.position.set(-center.x + ox, -box.min.y + oy, -center.z + oz);
  holder.updateMatrixWorld(true);

  model.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      o.computeBoundingSphere();
    } else if (o.isMesh && !o.geometry.boundingSphere) {
      o.geometry.computeBoundingSphere();
    }
  });
  return { holder, pivot, height, scale };
}
