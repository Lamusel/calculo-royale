import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAP_HALF } from '@calculo-royale/shared/constants';
import { BRIDGES, DAM, DOCKS, JUMP_PADS, RAILWAY, RESERVOIR, RIVER, riverY, ZIPLINE_LINES } from '@calculo-royale/shared/mapLayout';
import { ZIPLINE } from '@calculo-royale/shared/constants';
import { BRIDGE_DECK, BRIDGE_SPAN, terrainHeight, WATER_LEVEL } from '@calculo-royale/shared/terrain';
import { box, cylinder, limb, merge, modelMaterial, piece } from './models/build.js';
import { Chunked } from './chunks.js';

// Agua (azul verdoso, más clara y transparente cerca de la orilla, con brillo del sol; en calidad
// baja un azul sólido), puentes, paso de la represa, muelles y la vía del tren.

const SHORE = new THREE.Color('#5fc2c4');
const MID = new THREE.Color('#2a8bb5');
const DEEP = new THREE.Color('#1d6f9f');

// Colores con transparencia por vértice: [r, g, b, a]
const rgba = (c, a) => [c.r, c.g, c.b, a];

// Cinta del río de la represa al borde este: tres filas (orilla, centro, orilla), mirando hacia arriba
function riverGeometry() {
  const pos = [];
  const col = [];
  const half = RIVER.halfWidth + 1.5;
  for (let x = DAM.x; x <= MAP_HALF + 30; x += 4) {
    const y = riverY(x);
    for (const [dy, c, a] of [[half, SHORE, 0.55], [0, DEEP, 0.9], [-half, SHORE, 0.55]]) {
      pos.push(x, WATER_LEVEL, -(y + dy));
      col.push(...rgba(c, a));
    }
  }
  const index = [];
  for (let i = 0; i < pos.length / 9 - 1; i++) {
    const a = i * 3;
    const b = a + 3;
    // Orden antihorario visto desde arriba (+y): la cara mira al cielo
    index.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Embalse: elipse con el centro hondo y el borde claro
function reservoirGeometry() {
  const g = new THREE.CircleGeometry(1, 40);
  g.rotateX(-Math.PI / 2);
  const col = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const rim = Math.hypot(p.getX(i), p.getZ(i));
    const c = DEEP.clone().lerp(SHORE, rim);
    col.push(...rgba(c, 0.92 - rim * 0.35));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.scale(RESERVOIR.rx + 2, 1, RESERVOIR.ry + 2);
  g.translate(RESERVOIR.x, WATER_LEVEL, -RESERVOIR.y);
  return g;
}

// Tableros de los puentes, el paso sobre la represa y los muelles
function structuresGeometry() {
  const parts = [];
  for (const b of BRIDGES) {
    // Losa bajo el tramo elevado (la carretera va encima: Roads.jsx sigue la misma altura)
    parts.push(piece(box(b.w + 0.8, 0.7, BRIDGE_SPAN * 2), '#9d9a90', { position: [b.x, BRIDGE_DECK - 0.4, -b.y] }));
    // Pilares hasta el fondo del cauce
    for (const dy of [-(RIVER.halfWidth - 3), 0, RIVER.halfWidth - 3]) {
      for (const dx of [-b.w / 2 + 1, b.w / 2 - 1]) parts.push(piece(box(1, 5, 1), '#8a877d', { position: [b.x + dx, BRIDGE_DECK - 3.2, -(b.y + dy)] }));
    }
    // Barandas de concreto por tramos de 2 m que siguen el perfil (tablero y rampas)
    for (const s of [-1, 1]) {
      const x = b.x + s * (b.w / 2 + 0.2);
      for (let y = b.y - b.h / 2; y < b.y + b.h / 2; y += 2) {
        const y1 = Math.min(y + 2, b.y + b.h / 2);
        const h0 = terrainHeight(b.x, y);
        const h1 = terrainHeight(b.x, y1);
        parts.push(limb([x, h0 + 0.5, -y], [x, h1 + 0.5, -y1], 0.4, '#b5b2a8'));
        parts.push(limb([x, h0 + 1.02, -y], [x, h1 + 1.02, -y1], 0.48, '#cfccc2'));
      }
    }
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
  // Plataformas de salto (fase 35): disco amarillo y negro con una flecha hacia arriba
  for (const j of JUMP_PADS) {
    const h = terrainHeight(j.x, j.y);
    parts.push(piece(cylinder(1.6, 1.8, 0.3, 12), '#1f2937', { position: [j.x, h + 0.15, -j.y] }));
    parts.push(piece(cylinder(1.2, 1.2, 0.05, 12), '#facc15', { position: [j.x, h + 0.32, -j.y] }));
    parts.push(piece(cylinder(0, 0.5, 0.6, 4), '#facc15', { position: [j.x, h + 0.7, -j.y] }));
  }
  // Tirolinas: dos postes y el cable entre ellos
  for (const z of ZIPLINE_LINES) {
    const top = (pt) => [pt[0], terrainHeight(pt[0], pt[1]) + ZIPLINE.height, -pt[1]];
    for (const pt of [z.from, z.to]) {
      const h = terrainHeight(pt[0], pt[1]);
      parts.push(piece(box(0.3, ZIPLINE.height + 0.6, 0.3), '#6b4a2b', { position: [pt[0], h + (ZIPLINE.height + 0.6) / 2, -pt[1]] }));
      parts.push(piece(box(0.9, 0.12, 0.9), '#38bdf8', { position: [pt[0], h + 0.06, -pt[1]] }));
    }
    parts.push(limb(top(z.from), top(z.to), 0.05, '#1f2937'));
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

export default function Waterworks({ quality }) {
  const river = useMemo(riverGeometry, []);
  const reservoir = useMemo(reservoirGeometry, []);
  const structures = useMemo(structuresGeometry, []);
  const simple = quality?.name === 'baja';
  // Calidad baja: azul sólido (sin transparencia ni brillo). Si no, brillo del sol que respira.
  const water = useMemo(
    () =>
      simple
        ? new THREE.MeshLambertMaterial({ color: '#2a7fb0' })
        : new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, depthWrite: false, shininess: 90, specular: '#d8f4ff', side: THREE.DoubleSide }),
    [simple],
  );
  useFrame(({ clock }) => {
    if (simple) return;
    const t = clock.elapsedTime;
    water.emissive.setRGB(0.02, 0.06 + Math.sin(t * 0.9) * 0.025, 0.08 + Math.sin(t * 0.6 + 1) * 0.03);
    water.shininess = 80 + Math.sin(t * 1.3) * 25;
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
