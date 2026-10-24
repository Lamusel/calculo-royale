import * as THREE from 'three';

// Reparación de esqueletos mal exportados (fase 26). Algunos generadores (por ejemplo Tripo) dejan
// todos los huesos en el origen y guardan dónde está cada articulación solo en su matriz de enlace
// inversa (inverseBindMatrices). Así el esqueleto no sirve para animar: todo gira alrededor de los
// pies. Aquí se reconstruye cada hueso desde su matriz para que la pose de reposo coincida con la
// malla. Si una matriz es inválida (singular o con la articulación lejísimos), ese hueso queda sobre su
// padre con una matriz nueva que no deforma. Si aun así la malla no queda en su lugar, se le quita la
// piel y el personaje anima entero (modo A). Ver fixSkeleton.

// Una matriz de enlace sirve si es invertible y pone la articulación cerca del modelo (no a kilómetros)
const tmpPos = new THREE.Vector3();
function validInverse(ibm) {
  const d = ibm.determinant();
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return false;
  const inv = ibm.clone().invert();
  if (!inv.elements.every(Number.isFinite)) return false;
  return tmpPos.setFromMatrixPosition(inv).length() < 50;
}
const depth = (o) => {
  let d = 0;
  for (let p = o.parent; p; p = p.parent) d++;
  return d;
};

// ¿Todos los huesos están en el origen, sin rotación? (el síntoma)
export function degenerateSkeleton(skeleton) {
  return skeleton.bones.length > 1 && skeleton.bones.every((b) => b.position.lengthSq() < 1e-10 && Math.abs(b.quaternion.w) > 1 - 1e-9);
}

// Las 24 rotaciones que llevan ejes a ejes (giros de 90° del cubo)
const CUBE_ROTATIONS = (() => {
  const out = [];
  const seen = new Set();
  const e = new THREE.Euler();
  for (const x of [0, 1, 2, 3]) for (const y of [0, 1, 2, 3]) for (const z of [0, 1, 2, 3]) {
    const m = new THREE.Matrix4().makeRotationFromEuler(e.set((x * Math.PI) / 2, (y * Math.PI) / 2, (z * Math.PI) / 2));
    const key = m.elements.map((v) => Math.round(v)).join(',');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }
  return out;
})();

// Algunos exportadores guardan las matrices en un marco girado respecto de la malla: el reposo
// coincide, pero las articulaciones quedan de lado. Se elige la rotación (de las 24 de ejes) que pone
// cada articulación más cerca del centro de los vértices que mueve.
function frameRotation(mesh, joints) {
  const pos = mesh.geometry.attributes.position;
  const idx = mesh.geometry.attributes.skinIndex;
  const wgt = mesh.geometry.attributes.skinWeight;
  const sums = joints.map(() => ({ c: new THREE.Vector3(), n: 0 }));
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (wgt.getComponent(i, k) > wgt.getComponent(i, best)) best = k;
    const j = idx.getComponent(i, best);
    if (!sums[j]) continue;
    sums[j].c.add(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix));
    sums[j].n++;
  }
  let bestRot = CUBE_ROTATIONS[0];
  let bestErr = Infinity;
  const p = new THREE.Vector3();
  for (const rot of CUBE_ROTATIONS) {
    let err = 0;
    joints.forEach((world, j) => {
      if (!world || sums[j].n < 5) return;
      p.setFromMatrixPosition(world).applyMatrix4(rot);
      err += p.distanceTo(v.copy(sums[j].c).divideScalar(sums[j].n));
    });
    if (err < bestErr) {
      bestErr = err;
      bestRot = rot;
    }
  }
  return bestRot;
}

export function repairBindPose(scene) {
  scene.updateMatrixWorld(true);
  let repaired = 0;
  const done = new Set();
  scene.traverse((mesh) => {
    if (!mesh.isSkinnedMesh || done.has(mesh.skeleton) || !degenerateSkeleton(mesh.skeleton)) return;
    const skeleton = mesh.skeleton;
    done.add(skeleton);
    // Cada articulación va donde dice su matriz, en el espacio de la malla tal como se ve (la malla
    // puede venir girada dentro del archivo): hueso.matrixWorld = bindMatrix × inversa(IBM)
    const base = mesh.bindMatrix.clone();
    const valid = skeleton.boneInverses.map(validInverse);
    const worlds = skeleton.boneInverses.map((ibm, i) => (valid[i] ? base.clone().multiply(ibm.clone().invert()) : null));
    // Girar todo el esqueleto al marco de la malla (centrado en el origen de la malla)
    const rot = frameRotation(mesh, worlds);
    const order = skeleton.bones.map((bone, i) => ({ bone, i })).sort((a, b) => depth(a.bone) - depth(b.bone));
    const local = new THREE.Matrix4();
    for (const { bone, i } of order) {
      if (valid[i]) {
        const world = rot.clone().multiply(worlds[i]);
        local.copy(bone.parent.matrixWorld).invert().multiply(world);
        local.decompose(bone.position, bone.quaternion, bone.scale);
      } else {
        bone.position.set(0, 0, 0);
        bone.quaternion.identity();
        bone.scale.set(1, 1, 1);
      }
      bone.updateMatrixWorld(true);
      repaired++;
    }
    // Matrices nuevas coherentes con los huesos: en reposo la malla queda igual
    skeleton.calculateInverses();
  });
  return repaired;
}

// ¿La malla con piel queda en su lugar en reposo? (muestra algunos vértices)
export function restMatches(scene, tolerance = 1e-3) {
  scene.updateMatrixWorld(true);
  let ok = true;
  const raw = new THREE.Vector3();
  const skinned = new THREE.Vector3();
  scene.traverse((mesh) => {
    if (!ok || !mesh.isSkinnedMesh) return;
    mesh.skeleton.update();
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 53) {
      raw.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
      mesh.getVertexPosition(i, skinned);
      skinned.applyMatrix4(mesh.bindMatrix);
      if (!Number.isFinite(skinned.x) || raw.distanceTo(skinned) > tolerance) {
        ok = false;
        return;
      }
    }
  });
  return ok;
}

// Último recurso: el esqueleto no tiene arreglo, así que la malla con piel se convierte en una malla
// fija con su forma de reposo (el personaje anima entero, en modo A, sin deformarse)
export function deskin(scene) {
  const meshes = [];
  scene.traverse((o) => o.isSkinnedMesh && meshes.push(o));
  for (const sm of meshes) {
    const geometry = sm.geometry.clone();
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    const mesh = new THREE.Mesh(geometry, sm.material);
    mesh.name = sm.name;
    mesh.position.copy(sm.position);
    mesh.quaternion.copy(sm.quaternion);
    mesh.scale.copy(sm.scale);
    mesh.castShadow = sm.castShadow;
    sm.parent.add(mesh);
    sm.removeFromParent();
  }
  // Sin piel, los huesos ya no hacen nada: se quitan para que no cuente como esqueleto
  const bones = [];
  scene.traverse((o) => o.isBone && bones.push(o));
  for (const b of bones) if (!b.parent?.isBone) b.removeFromParent();
  return meshes.length;
}

// Fracción de vértices cuyo hueso principal es el más usado (1 = todo pegado a un solo hueso)
export function weightConcentration(scene) {
  let total = 0;
  let top = 0;
  scene.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const idx = mesh.geometry.attributes.skinIndex;
    const wgt = mesh.geometry.attributes.skinWeight;
    const count = new Map();
    for (let i = 0; i < idx.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (wgt.getComponent(i, k) > wgt.getComponent(i, best)) best = k;
      const j = idx.getComponent(i, best);
      count.set(j, (count.get(j) ?? 0) + 1);
    }
    total += idx.count;
    top += Math.max(0, ...count.values());
  });
  return total ? top / total : 0;
}
export const MAX_WEIGHT_CONCENTRATION = 0.9;

// Repara el esqueleto si viene en el origen; si no queda bien, o si casi todos los vértices cuelgan
// de un solo hueso (el auto-riggeo no repartió los pesos: brazos y piernas no se doblarían), se le
// quita la piel y anima entero. Devuelve qué pasó.
export function fixSkeleton(scene) {
  let skinned = false;
  let hasDegenerate = false;
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    skinned = true;
    if (degenerateSkeleton(o.skeleton)) hasDegenerate = true;
  });
  if (!skinned) return 'ok';
  if (hasDegenerate) {
    repairBindPose(scene);
    if (!restMatches(scene)) {
      deskin(scene);
      return 'sin esqueleto';
    }
  }
  if (weightConcentration(scene) > MAX_WEIGHT_CONCENTRATION) {
    deskin(scene);
    return 'sin pesos';
  }
  return hasDegenerate ? 'reparado' : 'ok';
}
