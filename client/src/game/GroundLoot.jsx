import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LOOT_ITEMS, TIER_COLORS, WEAPONS } from '@calculo-royale/shared/constants';
import { modelMaterial } from './models/build.js';
import { weaponGeometry } from './models/weapons.js';
import { terrainHeight } from '@calculo-royale/shared/terrain';

// Botín en el suelo (fase 18): una malla instanciada por forma, con el color de cada objeto, y un
// anillo del color de la rareza debajo para verlo de lejos. Se reconstruye solo cuando cambia la
// lista (client.loot), no en cada cuadro.

const MAX = 800;
const SHAPES = {
  long: new THREE.BoxGeometry(0.95, 0.16, 0.3), // armas
  box: new THREE.BoxGeometry(0.45, 0.28, 0.4), // munición, curaciones, accesorios
  can: new THREE.CylinderGeometry(0.11, 0.11, 0.34, 8), // bebida
  ball: new THREE.SphereGeometry(0.17, 8, 6), // granada
  gear: new THREE.BoxGeometry(0.6, 0.35, 0.5), // chaleco, casco, mochila
  crate: new THREE.BoxGeometry(0.95, 0.6, 0.75), // caja de botín de un caído
};
const ring = new THREE.RingGeometry(0.45, 0.62, 20).rotateX(-Math.PI / 2);

const KIND_SHAPE = { weapon: 'long', ammo: 'box', heal: 'box', grenade: 'ball', throwable: 'ball', armor: 'gear', helmet: 'gear', backpack: 'gear', attachment: 'box' };
// Las armas se ven con su propio modelo (fase 6.4: que se distingan en el suelo)
const GUN_IDS = Object.keys(WEAPONS).filter((id) => id !== 'fists');
const MAX_GUN = 60;
const COLORS = {
  weapon: '#2f342c',
  ammo: '#c9a33a',
  bandage: '#e8e4da',
  medkit: '#d03b3b',
  drink: '#2fae6b',
  grenade: '#4f5b3a',
  armor: '#4b6a8a',
  helmet: '#5b6b4a',
  backpack: '#7a5a3a',
  attachment: '#262626',
  box: '#8a2f3f',
};

const shapeOf = (e) => (!e.item ? 'crate' : WEAPONS[e.item] ? `gun:${e.item}` : e.item === 'drink' ? 'can' : KIND_SHAPE[LOOT_ITEMS[e.item]?.kind] ?? 'box');
const colorOf = (e) => {
  if (!e.item) return COLORS.box;
  const def = LOOT_ITEMS[e.item];
  return COLORS[e.item] ?? COLORS[def?.kind] ?? '#888888';
};
const ringColor = (e) => TIER_COLORS[e.item ? LOOT_ITEMS[e.item]?.tier ?? 0 : e.tier ?? 0];

export default function GroundLoot({ client }) {
  const meshes = useRef({});
  const ringMesh = useRef(null);
  const material = useMemo(() => new THREE.MeshLambertMaterial(), []);
  const ringMaterial = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false }), []);
  const drawn = useRef(-1); // versión del botín ya dibujada

  useFrame(() => {
    // La lista cambia muy de vez en cuando: se redibuja solo si subió su versión
    if (drawn.current === client.lootVersion) return;
    drawn.current = client.lootVersion;
    const loot = client.loot;
    const o3 = new THREE.Object3D();
    const color = new THREE.Color();
    const counts = Object.fromEntries([...Object.keys(SHAPES), ...GUN_IDS.map((id) => `gun:${id}`)].map((k) => [k, 0]));
    let r = 0;
    for (const e of loot.values()) {
      const shape = shapeOf(e);
      const mesh = meshes.current[shape];
      const gun = shape.startsWith('gun:');
      if (!mesh || counts[shape] >= (gun ? MAX_GUN : MAX)) continue;
      const h = terrainHeight(e.x, e.y);
      const lift = shape === 'crate' ? 0.3 : shape === 'gear' ? 0.18 : gun ? 0.08 : 0.15;
      o3.position.set(e.x, h + lift, -e.y);
      // Las armas se acuestan de lado y se ven más grandes
      o3.rotation.set(gun ? Math.PI / 2 : 0, (e.id * 2.39) % (Math.PI * 2), 0);
      o3.scale.setScalar(gun ? 1.7 : 1);
      o3.updateMatrix();
      mesh.setMatrixAt(counts[shape], o3.matrix);
      if (!gun) mesh.setColorAt(counts[shape], color.set(colorOf(e)));
      o3.scale.setScalar(1);
      counts[shape]++;
      if (r < MAX) {
        o3.position.set(e.x, h + 0.04, -e.y);
        o3.rotation.set(0, 0, 0);
        o3.updateMatrix();
        ringMesh.current.setMatrixAt(r, o3.matrix);
        ringMesh.current.setColorAt(r, color.set(ringColor(e)));
        r++;
      }
    }
    for (const [shape, mesh] of Object.entries(meshes.current)) {
      mesh.count = counts[shape];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    ringMesh.current.count = r;
    ringMesh.current.instanceMatrix.needsUpdate = true;
    if (ringMesh.current.instanceColor) ringMesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <>
      {Object.entries(SHAPES).map(([shape, geometry]) => (
        <instancedMesh
          key={shape}
          ref={(m) => {
            if (m) meshes.current[shape] = m;
          }}
          args={[geometry, material, MAX]}
          castShadow
          frustumCulled={false}
        />
      ))}
      {GUN_IDS.map((id) => (
        <instancedMesh key={id} ref={(m) => { if (m) meshes.current[`gun:${id}`] = m; }} args={[weaponGeometry(id), modelMaterial, MAX_GUN]} castShadow frustumCulled={false} />
      ))}
      <instancedMesh ref={ringMesh} args={[ring, ringMaterial, MAX]} frustumCulled={false} renderOrder={1} />
    </>
  );
}
