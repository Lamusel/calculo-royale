import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Utilidades para construir modelos low-poly por código: cada pieza es una geometría
// con color por vértice; las piezas de un modelo se fusionan en una sola geometría
// (una llamada de dibujo) que usa el material compartido.

export const modelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

const tmpColor = new THREE.Color();
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cylinder = (rTop, rBottom, h, segments = 8, open = false) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open);

// Pieza coloreada y ubicada: { position, rotation (euler), scale }
export function piece(geometry, color, { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  }
  quaternion.setFromEuler(euler.set(...rotation));
  matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
  g.applyMatrix4(matrix);
  tmpColor.set(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) tmpColor.toArray(colors, i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

// Caja entre dos puntos (brazos, piernas, rieles)
export function limb(from, to, thickness, color) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const length = a.distanceTo(b);
  const g = piece(box(length, thickness, thickness), color);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

// Fusiona piezas en una sola geometría con normales planas (aspecto low-poly)
export function merge(pieces) {
  const g = mergeGeometries(pieces.flat());
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Variación de color determinista (para que el mismo objeto siempre se vea igual)
export function shade(color, amount) {
  return new THREE.Color(color).multiplyScalar(1 + amount).getStyle();
}
