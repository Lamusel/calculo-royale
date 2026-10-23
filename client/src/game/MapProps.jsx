import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FURNITURE, FURNITURE_SIZES, HOUSES, OBSTACLES, TOWERS } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { box, cylinder, limb, merge, modelMaterial, piece } from './models/build.js';

// Piezas del mapa grande con instancing: árboles del bosque, torres de vigilancia, sacos de
// arena y muebles. Los muebles solo se dibujan en las casas cercanas al foco de la cámara.

// Los muebles se dibujan si la casa está a menos de esto del foco (y se revisa cada 300 ms)
export const FURNITURE_DISTANCE = 42;

const o3 = new THREE.Object3D();
const tint = new THREE.Color();

function useInstances(ref, items, place) {
  useLayoutEffect(() => {
    items.forEach((item, i) => {
      place(item, o3, i);
      o3.updateMatrix();
      ref.current.setMatrixAt(i, o3.matrix);
      ref.current.setColorAt(i, tint.setScalar(0.86 + ((i * 37) % 13) / 45));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items, place, ref]);
}

// --- Árboles: pino (0) y frondoso (1) ---
const pineModel = () =>
  merge([
    piece(cylinder(0.28, 0.4, 2.4, 6), '#5b4027', { position: [0, 1.2, 0] }),
    piece(new THREE.ConeGeometry(2.1, 3.2, 7), '#2f5a2c', { position: [0, 3.4, 0] }),
    piece(new THREE.ConeGeometry(1.6, 2.6, 7), '#386833', { position: [0, 4.9, 0] }),
    piece(new THREE.ConeGeometry(1.0, 2.0, 7), '#41763a', { position: [0, 6.2, 0] }),
  ]);
const leafyModel = () =>
  merge([
    piece(cylinder(0.3, 0.42, 3.0, 6), '#644830', { position: [0, 1.5, 0] }),
    piece(new THREE.IcosahedronGeometry(2.2, 0), '#4f7a32', { position: [0, 4.4, 0], scale: [1, 0.85, 1] }),
    piece(new THREE.IcosahedronGeometry(1.5, 0), '#5d8a3a', { position: [0.9, 5.2, 0.4], scale: [1, 0.8, 1] }),
    piece(new THREE.IcosahedronGeometry(1.3, 0), '#476f2d', { position: [-0.8, 5.0, -0.6] }),
  ]);

function Trees() {
  const pines = useMemo(() => OBSTACLES.filter((o) => o.kind === 'tree' && o.variant === 0), []);
  const leafy = useMemo(() => OBSTACLES.filter((o) => o.kind === 'tree' && o.variant !== 0), []);
  const models = useMemo(() => ({ pine: pineModel(), leafy: leafyModel() }), []);
  const a = useRef(null);
  const b = useRef(null);
  const place = useMemo(
    () => (t, o, i) => {
      o.position.set(t.x, terrainHeight(t.x, t.y) - 0.1, -t.y);
      o.rotation.set(0, i * 2.39, 0);
      o.scale.setScalar(0.85 + ((i * 53) % 17) / 40);
    },
    [],
  );
  useInstances(a, pines, place);
  useInstances(b, leafy, place);
  return (
    <>
      <instancedMesh ref={a} args={[models.pine, modelMaterial, pines.length]} castShadow receiveShadow />
      <instancedMesh ref={b} args={[models.leafy, modelMaterial, leafy.length]} castShadow receiveShadow />
    </>
  );
}

// --- Torres de vigilancia: cuatro patas, plataforma con baranda, escalera y techo ---
const towerModel = () => {
  const W = '#6b5636';
  const D = '#4e3d26';
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => limb([sx * 1.4, 0, sz * 1.4], [sx * 1.15, 5.2, sz * 1.15], 0.22, D)));
  const braces = [-1, 1].flatMap((s) => [limb([s * 1.35, 0.6, -1.35], [s * 1.2, 4.6, 1.2], 0.1, W), limb([-1.35, 0.6, s * 1.35], [1.2, 4.6, s * 1.2], 0.1, W)]);
  const rails = [-1, 1].flatMap((s) => [piece(box(3.2, 0.9, 0.12), W, { position: [0, 5.85, s * 1.55] }), piece(box(0.12, 0.9, 3.2), W, { position: [s * 1.55, 5.85, 0] })]);
  const roofPosts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => limb([sx * 1.45, 5.4, sz * 1.45], [sx * 1.45, 7.4, sz * 1.45], 0.1, D)));
  return merge([
    ...legs,
    ...braces,
    piece(box(3.4, 0.25, 3.4), W, { position: [0, 5.3, 0] }),
    ...rails,
    ...roofPosts,
    piece(new THREE.ConeGeometry(2.6, 1.2, 4), '#3f4a2c', { position: [0, 8.0, 0], rotation: [0, Math.PI / 4, 0] }),
    // Escalera
    limb([1.6, 0, 0.45], [1.25, 5.3, 0.45], 0.08, D),
    limb([1.6, 0, -0.45], [1.25, 5.3, -0.45], 0.08, D),
    ...Array.from({ length: 9 }, (_, i) => limb([1.58 - i * 0.034, 0.5 + i * 0.55, 0.45], [1.58 - i * 0.034, 0.5 + i * 0.55, -0.45], 0.06, W)),
  ]);
};

function Towers() {
  const geometry = useMemo(() => {
    const g = towerModel();
    const parts = TOWERS.map((t) => g.clone().translate(t.x, terrainHeight(t.x, t.y), -t.y));
    return merge(parts);
  }, []);
  return <mesh geometry={geometry} material={modelMaterial} castShadow receiveShadow />;
}

// --- Sacos de arena: un muro de 1 m que se estira a lo largo ---
const sandbagModel = () =>
  merge(
    [0, 1, 2].flatMap((row) =>
      [-0.33, 0, 0.33].map((x, i) =>
        piece(new THREE.CapsuleGeometry(0.17, 0.2, 2, 6), row % 2 ? '#b19a6b' : '#a28b5d', {
          position: [x + (row % 2 ? 0.16 : 0) - (i === 2 && row % 2 ? 0.33 : 0), 0.2 + row * 0.33, 0],
          rotation: [0, 0, Math.PI / 2],
          scale: [1, 1, 2.1],
        }),
      ),
    ),
  );

function Sandbags() {
  const walls = useMemo(() => OBSTACLES.filter((o) => o.kind === 'sandbag'), []);
  const geometry = useMemo(sandbagModel, []);
  const ref = useRef(null);
  const place = useMemo(
    () => (s, o) => {
      const alongX = s.w >= s.h;
      o.position.set(s.x, terrainHeight(s.x, s.y) - 0.05, -s.y);
      o.rotation.set(0, alongX ? 0 : Math.PI / 2, 0);
      o.scale.set(alongX ? s.w : s.h, 1, (alongX ? s.h : s.w) / 0.9);
    },
    [],
  );
  useInstances(ref, walls, place);
  return <instancedMesh ref={ref} args={[geometry, modelMaterial, walls.length]} castShadow receiveShadow />;
}

// --- Muebles: un modelo por tipo, construido mirando a +x (su frente) con sus medidas ---
function furnitureModel(kind) {
  const [len, dep, h] = FURNITURE_SIZES[kind];
  // En el modelo: x = fondo (de la pared hacia el frente), z = largo a lo largo de la pared
  const at = (x, y, z) => [x - dep / 2, y, z];
  const B = (w, hh, d, c, p) => piece(box(w, hh, d), c, { position: p });
  switch (kind) {
    case 'sofa':
      return merge([B(dep, 0.42, len, '#6a4b3b', at(dep / 2, 0.21, 0)), B(0.22, h, len, '#5c3f31', at(0.11, h / 2, 0)), ...[-1, 1].map((s) => B(dep, 0.62, 0.2, '#5c3f31', at(dep / 2, 0.31, s * (len / 2 - 0.1)))), B(dep - 0.3, 0.12, len - 0.5, '#7d5a46', at(dep / 2 + 0.1, 0.48, 0))]);
    case 'shelf':
    case 'wardrobe':
    case 'locker': {
      const c = kind === 'locker' ? '#5e6b5a' : kind === 'wardrobe' ? '#6e4c2e' : '#7a5634';
      const parts = [B(dep, h, len, c, at(dep / 2, h / 2, 0))];
      if (kind === 'shelf') for (let i = 1; i < 4; i++) parts.push(B(dep + 0.02, 0.05, len - 0.08, '#4c3520', at(dep / 2, (h / 4) * i, 0)), B(dep * 0.6, 0.22, len * 0.3, ['#a23b2c', '#2e5a8a', '#c9a33a'][i % 3], at(dep * 0.35, (h / 4) * i + 0.14, (i - 2) * 0.3)));
      else parts.push(B(0.03, h * 0.9, 0.04, '#2b2b2b', at(dep + 0.01, h / 2, 0)));
      return merge(parts);
    }
    case 'coffeeTable':
    case 'table': {
      const c = kind === 'table' ? '#8a6640' : '#704f31';
      return merge([B(dep, 0.07, len, c, at(dep / 2, h - 0.035, 0)), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => B(0.07, h - 0.07, 0.07, '#4c3520', at(dep / 2 + sx * (dep / 2 - 0.08), (h - 0.07) / 2, sz * (len / 2 - 0.08)))))]);
    }
    case 'chair':
      return merge([B(0.42, 0.06, 0.42, '#7a5634', at(0.21, 0.45, 0)), B(0.06, 0.45, 0.42, '#7a5634', at(0.03, 0.7, 0)), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => B(0.05, 0.45, 0.05, '#4c3520', at(0.21 + sx * 0.17, 0.22, sz * 0.17))))]);
    case 'bed':
    case 'bunk': {
      const frame = kind === 'bunk' ? '#4f5848' : '#5c3f28';
      const parts = [B(dep, 0.3, len, frame, at(dep / 2, 0.25, 0)), B(dep - 0.1, 0.16, len - 0.08, '#d8d2c2', at(dep / 2, 0.47, 0)), B(0.4, 0.12, len - 0.3, '#f0ece2', at(0.3, 0.6, 0)), B(dep * 0.55, 0.06, len - 0.06, kind === 'bunk' ? '#6b7a4a' : '#8b3a3a', at(dep * 0.68, 0.56, 0)), B(0.1, 0.9, len, frame, at(0.05, 0.45, 0))];
      if (kind === 'bunk') {
        parts.push(B(dep, 0.25, len, frame, at(dep / 2, 1.35, 0)), B(dep - 0.1, 0.14, len - 0.08, '#d8d2c2', at(dep / 2, 1.53, 0)));
        for (const sx of [0.05, dep - 0.05]) for (const sz of [-1, 1]) parts.push(B(0.07, 1.7, 0.07, frame, at(sx, 0.85, sz * (len / 2 - 0.04))));
      }
      return merge(parts);
    }
    case 'nightstand':
      return merge([B(dep, h, len, '#6e4c2e', at(dep / 2, h / 2, 0)), B(0.12, 0.25, 0.12, '#f3d98b', at(dep / 2, h + 0.12, 0))]);
    case 'counter':
      return merge([B(dep, h, len, '#c9c2b3', at(dep / 2, h / 2, 0)), B(dep + 0.04, 0.06, len + 0.04, '#5b5650', at(dep / 2, h + 0.03, 0)), B(0.45, 0.04, 0.5, '#2b2b2b', at(dep / 2, h + 0.08, -len / 2 + 0.4)), ...[0.25, 0.65].map((z) => B(0.1, 0.03, 0.1, '#1f1f1f', at(dep / 2 - 0.08, h + 0.11, -len / 2 + z)))]);
    case 'fridge':
      return merge([B(dep, h, len, '#e6e4dc', at(dep / 2, h / 2, 0)), B(0.03, 0.02, len - 0.06, '#9a978e', at(dep + 0.01, h * 0.62, 0)), B(0.04, 0.35, 0.04, '#7c7a74', at(dep + 0.02, h * 0.8, len / 2 - 0.1))]);
    case 'rug':
      return merge([B(dep, 0.02, len, '#8c3b3b', at(dep / 2, 0.02, 0)), B(dep * 0.7, 0.025, len * 0.7, '#c9a35a', at(dep / 2, 0.025, 0))]);
    case 'painting':
      return merge([B(0.05, h, len, '#5c3f28', at(0.025, 1.7, 0)), B(0.06, h - 0.12, len - 0.12, '#4b7aa8', at(0.03, 1.7, 0)), B(0.07, (h - 0.12) * 0.4, len - 0.12, '#6c9a4a', at(0.035, 1.7 - h * 0.22, 0))]);
    case 'plant':
      return merge([piece(cylinder(0.16, 0.12, 0.35, 8), '#9a5a3a', { position: at(dep / 2, 0.17, 0) }), piece(new THREE.IcosahedronGeometry(0.32, 0), '#4f7a32', { position: at(dep / 2, 0.7, 0) })]);
    case 'rack': {
      const parts = [];
      for (const z of [-len / 2 + 0.05, len / 2 - 0.05]) for (const x of [0.05, dep - 0.05]) parts.push(B(0.08, h, 0.08, '#4d5a63', at(x, h / 2, z)));
      for (let i = 0; i < 3; i++) {
        parts.push(B(dep, 0.06, len, '#5b6a73', at(dep / 2, 0.3 + i * 0.95, 0)));
        parts.push(B(dep * 0.7, 0.5, len * 0.28, ['#6b5a3a', '#4e5a3a', '#6b5a3a'][i], at(dep / 2, 0.58 + i * 0.95, (i - 1) * len * 0.3)));
      }
      return merge(parts);
    }
    default:
      return merge([B(dep, h, len, '#7a5634', at(dep / 2, h / 2, 0))]);
  }
}

const KINDS = Object.keys(FURNITURE_SIZES);

function Furniture({ frameRef }) {
  const byKind = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, FURNITURE.filter((f) => f.kind === k)])), []);
  const models = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, furnitureModel(k)])), []);
  const refs = useRef({});
  const state = useMemo(() => ({ at: 0, near: '' }), []);
  useFrame(() => {
    const now = performance.now();
    if (now - state.at < 300) return;
    state.at = now;
    const focus = frameRef.current.follow ?? frameRef.current.me;
    const near = new Set();
    if (focus) HOUSES.forEach((h, i) => Math.hypot(h.x - focus.x, h.y - focus.y) < FURNITURE_DISTANCE && near.add(i));
    const key = [...near].join(',');
    if (key === state.near) return;
    state.near = key;
    for (const kind of KINDS) {
      const mesh = refs.current[kind];
      if (!mesh) continue;
      let n = 0;
      for (const f of byKind[kind]) {
        if (!near.has(f.house)) continue;
        o3.position.set(f.x, terrainHeight(f.x, f.y) + (kind === 'rug' ? 0.02 : 0), -f.y);
        o3.rotation.set(0, f.rot, 0);
        o3.scale.set(1, 1, 1);
        o3.updateMatrix();
        mesh.setMatrixAt(n++, o3.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });
  return KINDS.filter((k) => byKind[k].length).map((k) => (
    <instancedMesh key={k} ref={(m) => (refs.current[k] = m)} args={[models[k], modelMaterial, byKind[k].length]} castShadow={k !== 'rug'} receiveShadow frustumCulled={false} />
  ));
}

export default function MapProps({ frameRef }) {
  return (
    <>
      <Trees />
      <Towers />
      <Sandbags />
      <Furniture frameRef={frameRef} />
    </>
  );
}
