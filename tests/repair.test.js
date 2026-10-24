// Esqueletos mal exportados (npm test): huesos en el origen con la articulación solo en la matriz de
// enlace, marco girado, matrices inválidas y pesos pegados a un solo hueso (fase 26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { degenerateSkeleton, fixSkeleton, restMatches, weightConcentration } from '../client/src/game/character/external/repair.js';

// Cuerpo de 3 huesos (cadera → pecho → cabeza) con 3 bloques de vértices, cada uno pegado a su hueso.
// Como lo deja un exportador roto: huesos en el origen y la posición de cada uno solo en su IBM
// (opcionalmente en un marco girado 90° y con una matriz inválida).
function brokenModel({ rotate = false, invalid = false, oneBone = false } = {}) {
  const joints = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.7, 0)];
  const positions = [];
  const skinIndex = [];
  const skinWeight = [];
  joints.forEach((j, b) => {
    for (let k = 0; k < 20; k++) {
      positions.push(j.x + Math.cos(k) * 0.2, j.y + (k % 5) * 0.03, j.z + Math.sin(k) * 0.1);
      skinIndex.push(oneBone ? 0 : b, 0, 0, 0);
      skinWeight.push(1, 0, 0, 0);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  const bones = joints.map((_, i) => Object.assign(new THREE.Bone(), { name: ['Hips', 'Chest', 'Head'][i] }));
  bones[0].add(bones[1]);
  bones[1].add(bones[2]);
  const frame = rotate ? new THREE.Matrix4().makeRotationY(Math.PI / 2) : new THREE.Matrix4();
  const inverses = joints.map((j) => new THREE.Matrix4().makeTranslation(j.x, j.y, j.z).premultiply(frame).invert().multiply(frame));
  if (invalid) inverses[2] = new THREE.Matrix4().makeScale(0, 0, 0);
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
  const scene = new THREE.Group();
  scene.add(bones[0], mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, inverses), mesh.matrixWorld);
  return { scene, mesh, bones, joints };
}

test('esqueleto en el origen: se detecta y se reconstruye desde las matrices de enlace', () => {
  const { scene, mesh, bones, joints } = brokenModel();
  assert.equal(degenerateSkeleton(mesh.skeleton), true);
  assert.equal(fixSkeleton(scene), 'reparado');
  assert.equal(restMatches(scene), true, 'en reposo la malla queda igual');
  const v = new THREE.Vector3();
  bones.forEach((b, i) => assert.ok(b.getWorldPosition(v).distanceTo(joints[i]) < 1e-6, b.name));
});

test('matrices en un marco girado: el esqueleto se gira al de la malla', () => {
  const { scene, bones, joints } = brokenModel({ rotate: true });
  assert.equal(fixSkeleton(scene), 'reparado');
  assert.equal(restMatches(scene), true);
  const v = new THREE.Vector3();
  bones.forEach((b, i) => assert.ok(b.getWorldPosition(v).distanceTo(joints[i]) < 1e-6, `${b.name} en su lugar`));
});

test('una matriz inválida no rompe la malla', () => {
  const { scene } = brokenModel({ invalid: true });
  const result = fixSkeleton(scene);
  assert.ok(['reparado', 'sin esqueleto'].includes(result));
  let skinned = false;
  scene.traverse((o) => o.isSkinnedMesh && (skinned = true));
  if (skinned) assert.equal(restMatches(scene), true);
});

test('todo pegado a un solo hueso: se quita la piel y anima entero', () => {
  const { scene } = brokenModel({ oneBone: true });
  assert.equal(weightConcentration(scene), 1);
  assert.equal(fixSkeleton(scene), 'sin pesos');
  let skinned = 0;
  let meshes = 0;
  let bones = 0;
  scene.traverse((o) => {
    if (o.isSkinnedMesh) skinned++;
    if (o.isMesh) meshes++;
    if (o.isBone) bones++;
  });
  assert.equal(skinned, 0);
  assert.equal(meshes, 1, 'la malla sigue ahí, fija');
  assert.equal(bones, 0);
});

test('un esqueleto bien hecho no se toca', () => {
  const { scene, mesh, bones } = brokenModel();
  bones[1].position.set(0, 0.4, 0);
  bones[2].position.set(0, 0.3, 0);
  bones[0].position.set(0, 1, 0);
  scene.updateMatrixWorld(true);
  mesh.skeleton.calculateInverses();
  assert.equal(fixSkeleton(scene), 'ok');
});
