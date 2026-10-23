import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DUMMY_HP, ITEM_NAMES, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { TRAINING } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { textTexture } from './labels.js';
import {
  armorGeometry, armorMaterial, grenadeGeometry, grenadeMaterial, weaponGeometries, weaponMaterial,
} from './weaponModels.js';

// Campo de entrenamiento (solo en el lobby): armeros para tomar armas y blancos de práctica

const tableGeometry = new THREE.BoxGeometry(1.6, 0.9, 0.9);
const tableMaterial = new THREE.MeshLambertMaterial({ color: '#6b4f2c' });
const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6);
const postMaterial = new THREE.MeshLambertMaterial({ color: '#5a4630' });
const targetGeometry = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 20).rotateX(Math.PI / 2);
const ringGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20).rotateX(Math.PI / 2);
const centerGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12).rotateX(Math.PI / 2);
const redMaterial = new THREE.MeshLambertMaterial({ color: '#b91c1c' });
const whiteMaterial = new THREE.MeshLambertMaterial({ color: '#f1f5f9' });

function RackItem({ item }) {
  const index = WEAPON_IDS.indexOf(item);
  if (item === 'grenade') {
    return (
      <>
        <mesh geometry={grenadeGeometry} material={grenadeMaterial} position={[-0.2, 0, 0]} />
        <mesh geometry={grenadeGeometry} material={grenadeMaterial} position={[0.2, 0, 0]} />
      </>
    );
  }
  if (item === 'armor') return <mesh geometry={armorGeometry} material={armorMaterial} position-y={0.3} />;
  return <mesh geometry={weaponGeometries[index]} material={weaponMaterial} />;
}

function Rack({ rack }) {
  const h = terrainHeight(rack.x, rack.y);
  const label = textTexture(ITEM_NAMES[rack.item], { color: '#f5e6b8', size: 40 });
  return (
    <group position={[rack.x, h, -rack.y]}>
      <mesh geometry={tableGeometry} material={tableMaterial} position-y={0.45} />
      <group position-y={1.05}>
        <RackItem item={rack.item} />
      </group>
      <sprite position-y={2.1} scale={[label.aspect * 0.55, 0.55, 1]}>
        <spriteMaterial map={label.texture} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}

function Dummy({ dummy, index, frameRef }) {
  const bar = useRef(null);
  useFrame(() => {
    const hp = frameRef.current.dummies[index] ?? DUMMY_HP;
    const ratio = Math.max(0.001, hp / DUMMY_HP);
    bar.current.scale.x = 1.4 * ratio;
    bar.current.material.color.set(ratio > 0.5 ? '#4ade80' : ratio > 0.2 ? '#facc15' : '#ef4444');
  });
  const h = terrainHeight(dummy.x, dummy.y);
  return (
    <group position={[dummy.x, h, -dummy.y]}>
      <mesh geometry={postGeometry} material={postMaterial} position-y={0.8} />
      <group position-y={1.5}>
        <mesh geometry={targetGeometry} material={redMaterial} />
        <mesh geometry={ringGeometry} material={whiteMaterial} />
        <mesh geometry={centerGeometry} material={redMaterial} />
      </group>
      <sprite position={[-0.7, 2.6, 0]} scale={[1.4, 0.14, 1]} center={[0, 0.5]}>
        <spriteMaterial color="#111827" depthWrite={false} />
      </sprite>
      <sprite ref={bar} position={[-0.7, 2.6, 0.01]} scale={[1.4, 0.14, 1]} center={[0, 0.5]} renderOrder={1}>
        <spriteMaterial color="#4ade80" depthWrite={false} />
      </sprite>
    </group>
  );
}

export default function Training({ frameRef }) {
  return (
    <group>
      {TRAINING.racks.map((r) => (
        <Rack key={r.item} rack={r} />
      ))}
      {TRAINING.dummies.map((d, i) => (
        <Dummy key={i} dummy={d} index={i} frameRef={frameRef} />
      ))}
    </group>
  );
}
