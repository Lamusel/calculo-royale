import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GULAG_ARENAS, GULAG_HALF } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';

// Patios del Gulag (fuera del mapa): piso de concreto con juntas que sigue el terreno (los muros y la
// cobertura salen de mapLayout) y, en la muerte súbita, el círculo rojo que se cierra.

const CELL = 2;

function floorGeometry() {
  const size = GULAG_HALF * 2 + 4;
  const n = size / CELL;
  const parts = GULAG_ARENAS.map(({ x, y }) => {
    const g = new THREE.PlaneGeometry(size, size, n, n).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0, -y);
    const pos = g.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), -pos.getZ(i)) + 0.03);
    for (let i = 0; i < pos.count; i += 3) {
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      // Losas alternadas y una línea amarilla en el centro
      const tile = (Math.floor(cx / 4) + Math.floor(cz / 4)) % 2 ? 0.55 : 0.6;
      const mid = Math.abs(cx - x) < 0.4 || Math.abs(-cz - y) < 0.4;
      const c = mid ? [0.75, 0.62, 0.2] : [tile, tile * 0.98, tile * 0.93];
      for (let k = 0; k < 3; k++) colors.push(...c);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return g;
  });
  const merged = new THREE.BufferGeometry();
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.computeVertexNormals();
  return merged;
}

export default function GulagArenas({ frameRef }) {
  const floor = useMemo(floorGeometry, []);
  const ring = useMemo(() => new THREE.RingGeometry(0.96, 1, 48).rotateX(-Math.PI / 2), []);
  const rings = useRef([]);
  useFrame(() => {
    const fights = frameRef.current.gulag?.[1] ?? [];
    GULAG_ARENAS.forEach((a, i) => {
      const mesh = rings.current[i];
      if (!mesh) return;
      const f = fights.find((x) => x[1] === a.index && x[2] === 3);
      mesh.visible = Boolean(f);
      if (f) {
        mesh.scale.setScalar(f[4]);
        mesh.position.set(a.x, terrainHeight(a.x, a.y) + 0.4, -a.y);
      }
    });
  });
  return (
    <>
      <mesh geometry={floor} receiveShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      {GULAG_ARENAS.map((a, i) => (
        <mesh key={a.index} ref={(m) => (rings.current[i] = m)} geometry={ring} visible={false}>
          <meshBasicMaterial color="#ef4444" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}
