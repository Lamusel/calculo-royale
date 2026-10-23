import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OBSTACLES } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';

// Obstáculos del mapa con instancing (una llamada de dibujo por forma).
// Versión simple de la fase 2; en la fase 3 se reemplazan por modelos procedurales.

const COLORS = {
  wall: ['#b9aa8b', '#a8987a', '#c2b597'],
  container: ['#8c3b2b', '#2f5a7a', '#3f6b3a', '#a8742c', '#5b5f63'],
  crate: ['#8a6a3d', '#7b5d34'],
  fence: ['#6b5a45'],
  rock: ['#8a8a80', '#7a7a70', '#96968b'],
  barrel: ['#4a5a32', '#5a4632'],
};

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
const barrelGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);

const rects = OBSTACLES.filter((o) => o.shape === 'rect');
const rocks = OBSTACLES.filter((o) => o.kind === 'rock');
const barrels = OBSTACLES.filter((o) => o.kind === 'barrel');

// Hunde la base bajo el terreno para que no flote en las pendientes
function baseHeight(o) {
  const hw = o.shape === 'rect' ? o.w / 2 : o.r;
  const hh = o.shape === 'rect' ? o.h / 2 : o.r;
  const corners = [
    [o.x - hw, o.y - hh], [o.x + hw, o.y - hh], [o.x - hw, o.y + hh], [o.x + hw, o.y + hh], [o.x, o.y],
  ];
  return Math.min(...corners.map(([x, y]) => terrainHeight(x, y))) - 0.2;
}

function Instanced({ items, geometry, place }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    const matrix = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach((o, i) => {
      place(o, matrix);
      matrix.updateMatrix();
      mesh.setMatrixAt(i, matrix.matrix);
      const palette = COLORS[o.kind];
      mesh.setColorAt(i, color.set(palette[i % palette.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }, [items, place]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]}>
      <meshLambertMaterial />
    </instancedMesh>
  );
}

export default function Obstacles() {
  const places = useMemo(
    () => ({
      rect: (o, m) => {
        const base = baseHeight(o);
        const top = terrainHeight(o.x, o.y) + o.height;
        m.position.set(o.x, (base + top) / 2, -o.y);
        m.scale.set(o.w, top - base, o.h);
      },
      rock: (o, m) => {
        m.position.set(o.x, terrainHeight(o.x, o.y) + o.r * 0.3, -o.y);
        m.scale.set(o.r, o.r * 0.8, o.r);
        m.rotation.set(0, o.x * 7.1 + o.y * 3.3, 0);
      },
      barrel: (o, m) => {
        const base = baseHeight(o);
        const top = terrainHeight(o.x, o.y) + o.height;
        m.position.set(o.x, (base + top) / 2, -o.y);
        m.scale.set(o.r, top - base, o.r);
      },
    }),
    [],
  );

  return (
    <group>
      <Instanced items={rects} geometry={boxGeometry} place={places.rect} />
      <Instanced items={rocks} geometry={rockGeometry} place={places.rock} />
      <Instanced items={barrels} geometry={barrelGeometry} place={places.barrel} />
    </group>
  );
}
