import { createElement, Fragment, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAP_HALF } from '@calculo-royale/shared/constants';
import { modelMaterial } from './models/build.js';

// Mapa de 1 km en bloques (chunks) de CHUNK m: solo se dibujan los cercanos a la cámara. La niebla
// tapa lo lejano, así que no se nota; los bloques lejanos solo existen en el minimapa.

export const CHUNK = 125;
const HALF_DIAGONAL = CHUNK * 0.71;

// ¿Se ve un punto (o bloque de centro x, y) desde la cámara? Más alto, más lejos se ve.
export const viewReach = (camera) => 150 + Math.max(0, camera.position.y) * 1.1;
export const nearCamera = (camera, x, y, extra = 0) =>
  Math.hypot(x - camera.position.x, y + camera.position.z) < viewReach(camera) + extra;

// Agrupa objetos { x, y } por bloque: [{ key, x, y, items }]
export function groupByChunk(items) {
  const groups = new Map();
  for (const o of items) {
    const cx = Math.floor((o.x + MAP_HALF) / CHUNK);
    const cy = Math.floor((o.y + MAP_HALF) / CHUNK);
    const key = `${cx},${cy}`;
    if (!groups.has(key)) groups.set(key, { key, x: -MAP_HALF + (cx + 0.5) * CHUNK, y: -MAP_HALF + (cy + 0.5) * CHUNK, items: [] });
    groups.get(key).items.push(o);
  }
  return [...groups.values()];
}

// Muestra u oculta cada bloque según la distancia a la cámara (cada 250 ms)
export function Chunked({ items, render }) {
  const groups = useMemo(() => groupByChunk(items), [items]);
  const refs = useRef([]);
  const state = useRef({ at: 0 });
  useFrame(({ camera }) => {
    const now = performance.now();
    if (now - state.current.at < 250) return;
    state.current.at = now;
    groups.forEach((g, i) => {
      const group = refs.current[i];
      if (group) group.visible = nearCamera(camera, g.x, g.y, HALF_DIAGONAL);
    });
  });
  return groups.map((g, i) =>
    createElement('group', { key: g.key, ref: (o) => (refs.current[i] = o), visible: false }, createElement(Fragment, null, render(g.items, g.key))),
  );
}

// Un InstancedMesh con los objetos de un bloque. place(item, object3D, i) ubica cada uno.
const o3 = new THREE.Object3D();
const tint = new THREE.Color();
export function InstancedChunk({ items, geometry, place, castShadow = true }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    items.forEach((item, i) => {
      place(item, o3, i);
      o3.updateMatrix();
      ref.current.setMatrixAt(i, o3.matrix);
      ref.current.setColorAt(i, tint.setScalar(0.86 + ((Math.round(item.x * 7 + item.y * 3) & 15) / 60)));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, place]);
  return createElement('instancedMesh', { ref, args: [geometry, modelMaterial, items.length], castShadow, receiveShadow: true });
}

// Instancing por bloques en una sola llamada
export function ChunkedInstances({ items, geometry, place, castShadow }) {
  return createElement(Chunked, {
    items,
    render: (list) => createElement(InstancedChunk, { items: list, geometry, place, castShadow }),
  });
}
