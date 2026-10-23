import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { GRENADE } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { modelMaterial } from './models/build.js';
import { weaponGeometry } from './models/weapons.js';

const MAX_GRENADES = 16;
const ARC_HEIGHT = 2.2;

// Granadas en vuelo. El servidor las mueve en 2D; aquí se les agrega un arco de altura
// durante el tiempo de vuelo (solo visual).
export default function Grenades({ frameRef }) {
  const meshes = useRef([]);
  const firstSeen = useRef(new Map());

  useFrame(() => {
    const now = performance.now();
    const { grenades } = frameRef.current;
    for (const id of firstSeen.current.keys()) if (!grenades.has(id)) firstSeen.current.delete(id);

    let i = 0;
    for (const [id, g] of grenades) {
      const mesh = meshes.current[i++];
      if (!mesh) break;
      if (!firstSeen.current.has(id)) firstSeen.current.set(id, now);
      const t = Math.min((now - firstSeen.current.get(id)) / GRENADE.flightMs, 1);
      mesh.visible = true;
      mesh.position.set(g.x, terrainHeight(g.x, g.y) + 0.2 + 4 * ARC_HEIGHT * t * (1 - t), -g.y);
      mesh.rotation.set(now * 0.01, 0, now * 0.007);
    }
    for (; i < MAX_GRENADES; i++) if (meshes.current[i]) meshes.current[i].visible = false;
  });

  return Array.from({ length: MAX_GRENADES }, (_, i) => (
    <mesh key={i} ref={(m) => (meshes.current[i] = m)} geometry={weaponGeometry('grenade')} material={modelMaterial} scale={1.6} visible={false} castShadow />
  ));
}
