import { useMemo } from 'react';
import * as THREE from 'three';
import { MAP_HALF, MAP_SIZE } from '@calculo-royale/shared/constants';
import { AREAS } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';

// Convención: el plano matemático (x, y) se dibuja en Three.js como (x, altura, −y).
// Terreno low-poly: cada triángulo tiene un solo color (pasto, tierra o grava).

const MARGIN = 30; // terreno extra fuera del área jugable
const SEGMENT = 2; // tamaño de cada celda de la malla

const GRASS_DARK = new THREE.Color('#566f31');
const GRASS_LIGHT = new THREE.Color('#748f42');
const DIRT = new THREE.Color('#8b7349');
const GRAVEL = new THREE.Color('#857f70');

function hash(ix, iy) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Ruido de valor suave en [0, 1]
function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const smooth = (edge0, edge1, v) => {
  const t = Math.max(0, Math.min(1, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// Qué tan dentro de un área rectangular está el punto (1 dentro, 0 lejos)
function rectWeight(area, x, y, fade) {
  const dx = Math.abs(x - area.x) - area.w / 2;
  const dy = Math.abs(y - area.y) - area.h / 2;
  return 1 - smooth(0, fade, Math.max(dx, dy));
}

function groundColor(x, y, out) {
  const n = noise(x / 9, y / 9) + (hash(Math.round(x * 3), Math.round(y * 3)) - 0.5) * 0.15;
  out.copy(GRASS_DARK).lerp(GRASS_LIGHT, Math.max(0, Math.min(1, n)));

  const patches = smooth(0.62, 0.78, noise(x / 14 + 50, y / 14 - 20));
  const town = rectWeight(AREAS.town, x, y, 6) * smooth(0.25, 0.6, noise(x / 5, y / 5));
  const training = 1 - smooth(AREAS.training.r - 6, AREAS.training.r, Math.hypot(x, y));
  out.lerp(DIRT, Math.max(patches * 0.8, town, training * 0.85));
  out.lerp(GRAVEL, rectWeight(AREAS.containers, x, y, 4) * 0.85);

  // Fuera del área jugable: más oscuro
  const outside = smooth(0, 4, Math.max(Math.abs(x), Math.abs(y)) - MAP_HALF);
  out.multiplyScalar(1 - outside * 0.35);
  return out;
}

function buildTerrain() {
  const size = MAP_SIZE + MARGIN * 2;
  const segments = size / SEGMENT;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments).toNonIndexed();
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), -pos.getZ(i)));
  }
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const y = -(pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    groundColor(x, y, color);
    for (let k = 0; k < 3; k++) color.toArray(colors, (i + k) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export default function MapMesh() {
  const geometry = useMemo(buildTerrain, []);
  return (
    <mesh geometry={geometry}>
      <meshLambertMaterial vertexColors flatShading />
    </mesh>
  );
}
