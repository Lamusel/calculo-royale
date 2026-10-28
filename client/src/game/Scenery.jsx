import { useMemo } from 'react';
import * as THREE from 'three';
import { MAP_HALF } from '@calculo-royale/shared/constants';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { AREAS } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { box, merge, modelMaterial, piece } from './models/build.js';
import { distanceToPaths } from './paths.js';
import { waterAt } from '@calculo-royale/shared/mapPlan';
import { ChunkedInstances } from './chunks.js';

// Decoración sin colisión: matorrales y la cerca baja del borde del mapa.

const BUSH_COLORS = ['#4d6a2c', '#5b7533', '#43602a'];
const POST_SPACING = 4;

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bushModel = () =>
  merge([
    piece(new THREE.IcosahedronGeometry(0.7, 0), BUSH_COLORS[0], { position: [0, 0.45, 0], scale: [1, 0.75, 1] }),
    piece(new THREE.IcosahedronGeometry(0.5, 0), BUSH_COLORS[1], { position: [0.45, 0.35, 0.2], scale: [1, 0.8, 1] }),
    piece(new THREE.IcosahedronGeometry(0.45, 0), BUSH_COLORS[2], { position: [-0.35, 0.3, -0.3], scale: [1, 0.8, 1] }),
  ]);

// Posiciones de matorrales: lejos de caminos, obstáculos y el campo de entrenamiento
function bushSpots() {
  const rand = seeded(7331);
  const spots = [];
  for (let i = 0; i < 9000 && spots.length < 2200; i++) {
    const x = (rand() * 2 - 1) * (MAP_HALF - 2);
    const y = (rand() * 2 - 1) * (MAP_HALF - 2);
    if (Math.hypot(x, y) < AREAS.training.r + 2) continue;
    if (waterAt(x, y) || waterAt(x, y + 4) || waterAt(x, y - 4) || distanceToPaths(x, y) < 5 || overlapsObstacle(x, y, 2.2)) continue;
    spots.push({ x, y, s: 0.7 + rand() * 0.7, r: rand() * Math.PI * 2 });
  }
  return spots;
}

const placeBush = (b, o) => {
  o.position.set(b.x, terrainHeight(b.x, b.y) - 0.1, -b.y);
  o.rotation.set(0, b.r, 0);
  o.scale.setScalar(b.s);
};

function Bushes() {
  const geometry = useMemo(bushModel, []);
  const spots = useMemo(bushSpots, []);
  return <ChunkedInstances items={spots} geometry={geometry} place={placeBush} castShadow={false} />;
}

// Cerca baja alrededor del área jugable: postes y dos rieles que siguen el terreno
function BorderFence() {
  const geometry = useMemo(() => {
    const edge = MAP_HALF + 0.4;
    const pieces = [];
    const corners = [[-edge, -edge], [edge, -edge], [edge, edge], [-edge, edge], [-edge, -edge]];
    for (let c = 0; c < 4; c++) {
      const [ax, ay] = corners[c];
      const [bx, by] = corners[c + 1];
      const steps = Math.round(Math.hypot(bx - ax, by - ay) / POST_SPACING);
      for (let i = 0; i < steps; i++) {
        const x = ax + ((bx - ax) * i) / steps;
        const y = ay + ((by - ay) * i) / steps;
        const nx = ax + ((bx - ax) * (i + 1)) / steps;
        const ny = ay + ((by - ay) * (i + 1)) / steps;
        const h = terrainHeight(x, y);
        const nh = terrainHeight(nx, ny);
        pieces.push(piece(box(0.16, 1.3, 0.16), '#5a4630', { position: [x, h + 0.5, -y] }));
        for (const lift of [0.45, 0.95]) {
          const len = Math.hypot(nx - x, ny - y, nh - h);
          const rail = piece(box(len, 0.08, 0.08), '#6b5a45');
          const dir = new THREE.Vector3(nx - x, nh - h, -(ny - y)).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
          rail.applyMatrix4(
            new THREE.Matrix4().compose(new THREE.Vector3((x + nx) / 2, (h + nh) / 2 + lift, -(y + ny) / 2), q, new THREE.Vector3(1, 1, 1)),
          );
          pieces.push(rail);
        }
      }
    }
    return merge(pieces);
  }, []);
  return <mesh geometry={geometry} material={modelMaterial} />;
}

export default function Scenery({ quality }) {
  return (
    <>
      {quality.bushes && <Bushes />}
      <BorderFence />
    </>
  );
}
