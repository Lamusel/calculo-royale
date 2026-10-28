import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAP_HALF } from '@calculo-royale/shared/constants';
import { BRIDGES, DAM, DOCKS, RAILWAY, RESERVOIR, RIVER, riverY } from '@calculo-royale/shared/mapLayout';
import { terrainHeight, WATER_LEVEL } from '@calculo-royale/shared/terrain';
import { box, limb, merge, modelMaterial, piece } from './models/build.js';
import { Chunked } from './chunks.js';

// Agua sencilla (un plano con color que respira, sin reflejos), puentes, paso de la represa,
// muelles y la vía del tren. Todo construido por código desde el plano del mapa.

const water = new THREE.MeshLambertMaterial({ color: '#3f7fb0', transparent: true, opacity: 0.86, depthWrite: false });
const DEEP = new THREE.Color('#3f7fb0');
const LIGHT = new THREE.Color('#4f93c2');

// Cinta del río: de la represa al borde este, un poco más ancha que el cauce
function riverGeometry() {
  const pts = [];
  const half = RIVER.halfWidth + 1.5;
  for (let x = DAM.x; x <= MAP_HALF + 30; x += 4) {
    const y = riverY(x);
    pts.push(x, WATER_LEVEL, -(y + half), x, WATER_LEVEL, -(y - half));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const index = [];
  for (let i = 0; i < pts.length / 6 - 1; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function reservoirGeometry() {
  const g = new THREE.CircleGeometry(1, 40);
  g.rotateX(-Math.PI / 2);
  g.scale(RESERVOIR.rx + 2, 1, RESERVOIR.ry + 2);
  g.translate(RESERVOIR.x, WATER_LEVEL, -RESERVOIR.y);
  return g;
}

// Tableros de los puentes, el paso sobre la represa y los muelles
function structuresGeometry() {
  const parts = [];
  for (const b of BRIDGES) {
    parts.push(piece(box(b.w + 0.6, 0.6, b.h), '#9d9a90', { position: [b.x, 0.3 + 0.12, -b.y] }));
    parts.push(piece(box(b.w - 1.2, 0.05, b.h - 0.4), '#55564f', { position: [b.x, 0.75, -b.y] }));
    // Pilares en el agua
    for (const k of [-1, 1]) parts.push(piece(box(b.w, 3, 1.2), '#8a877d', { position: [b.x, -1.2, -(riverY(b.x) + k * (RIVER.halfWidth - 3))] }));
  }
  parts.push(piece(box(DAM.w - 4, 0.4, DAM.h), '#b4b1a7', { position: [DAM.x, 0.6, -DAM.y] }));
  // Cara del vertedero: cae hacia el río
  parts.push(piece(box(3, 3.2, RIVER.halfWidth * 2), '#c9c6bc', { position: [DAM.x + DAM.w / 2 + 1, -0.9, -DAM.y], rotation: [0, 0, 0.5] }));
  for (const d of DOCKS) {
    const toShore = d.y > riverY(d.x) ? 1 : -1;
    const y = d.y + toShore * 3;
    parts.push(piece(box(4, 0.25, 9), '#7a5634', { position: [d.x, 0.15, -y] }));
    for (const sx of [-1.7, 1.7]) for (const sy of [-3.5, 0, 3.5]) parts.push(piece(box(0.25, 2.4, 0.25), '#5b4027', { position: [d.x + sx, -0.9, -(y + sy)] }));
  }
  return merge(parts);
}

// Vía del tren por tramos: durmientes y dos rieles que siguen el terreno
const RAIL_POINTS = [];
for (let x = RAILWAY.x0; x < RAILWAY.x1; x += 10) RAIL_POINTS.push({ x: x + 5, y: RAILWAY.y });
function RailChunk({ items }) {
  const geometry = useMemo(() => {
    const parts = [];
    for (const p of items) {
      const x0 = p.x - 5;
      const x1 = p.x + 5;
      for (const side of [-0.75, 0.75]) {
        const y = RAILWAY.y + side;
        parts.push(limb([x0, terrainHeight(x0, y) + 0.22, -y], [x1, terrainHeight(x1, y) + 0.22, -y], 0.07, '#5d5f60'));
      }
      for (let x = x0; x < x1; x += 2.5) parts.push(piece(box(0.4, 0.14, 2.4), '#4a3a2a', { position: [x, terrainHeight(x, RAILWAY.y) + 0.08, -RAILWAY.y] }));
    }
    return merge(parts);
  }, [items]);
  return <mesh geometry={geometry} material={modelMaterial} receiveShadow />;
}

export default function Waterworks() {
  const river = useMemo(riverGeometry, []);
  const reservoir = useMemo(reservoirGeometry, []);
  const structures = useMemo(structuresGeometry, []);
  useFrame(({ clock }) => {
    water.color.copy(DEEP).lerp(LIGHT, (Math.sin(clock.elapsedTime * 0.8) + 1) * 0.25);
  });
  return (
    <>
      <mesh geometry={river} material={water} />
      <mesh geometry={reservoir} material={water} />
      <mesh geometry={structures} material={modelMaterial} castShadow receiveShadow />
      <Chunked items={RAIL_POINTS} render={(list) => <RailChunk items={list} />} />
    </>
  );
}
