import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARMOR_ABSORB, MAX_HP, PLAYER_RADIUS } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { terrainGradient, terrainHeight } from '@calculo-royale/shared/terrain';
import { textTexture } from './labels.js';
import { weaponGeometries, weaponMaterial } from './weaponModels.js';

const BODY_HEIGHT = 2;
const BAR_WIDTH = 1.3;
const BAR_Y = BODY_HEIGHT + 1.15;

// Geometrías y materiales compartidos: pocos objetos en GPU aunque haya 40 jugadores
const bodyGeometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, BODY_HEIGHT - PLAYER_RADIUS * 2, 4, 12);
const shadowGeometry = new THREE.CircleGeometry(PLAYER_RADIUS * 1.1, 20).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.RingGeometry(PLAYER_RADIUS * 1.35, PLAYER_RADIUS * 1.6, 32).rotateX(-Math.PI / 2);
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false });
const ringMaterial = new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9, depthWrite: false });
const deadMaterial = new THREE.MeshLambertMaterial({ color: '#4b4b45' });

const bodyMaterials = new Map();
function bodyMaterial(color, ghost) {
  const key = `${color}|${ghost}`;
  if (!bodyMaterials.has(key)) {
    bodyMaterials.set(
      key,
      new THREE.MeshLambertMaterial({ color, transparent: ghost, opacity: ghost ? 0.35 : 1 }),
    );
  }
  return bodyMaterials.get(key);
}

const UP = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();

function Bar({ barRef, color, y, height, order }) {
  return (
    <sprite ref={barRef} position={[-BAR_WIDTH / 2, y, 0]} scale={[BAR_WIDTH, height, 1]} center={[0, 0.5]} renderOrder={order}>
      <spriteMaterial color={color} depthWrite={false} />
    </sprite>
  );
}

function PlayerAvatar({ player, isMe, register }) {
  const refs = {
    group: useRef(null),
    body: useRef(null),
    torso: useRef(null),
    ground: useRef(null),
    bg: useRef(null),
    hp: useRef(null),
    armor: useRef(null),
    weapons: useRef([]),
  };

  useEffect(() => {
    register(player.id, {
      group: refs.group.current,
      body: refs.body.current,
      torso: refs.torso.current,
      ground: refs.ground.current,
      bg: refs.bg.current,
      hp: refs.hp.current,
      armor: refs.armor.current,
      weapons: refs.weapons.current,
      material: bodyMaterial(player.color, !player.connected),
    });
    return () => register(player.id, null);
  });

  const label = useMemo(
    () =>
      textTexture(player.connected ? player.name : `${player.name} 💤`, {
        color: isMe ? '#fde047' : '#ffffff',
        size: 40,
      }),
    [player.name, player.connected, isMe],
  );

  return (
    <group ref={refs.group} visible={false}>
      {/* Sombra y anillo se inclinan con la pendiente del terreno */}
      <group ref={refs.ground}>
        <mesh geometry={shadowGeometry} material={shadowMaterial} position-y={0.04} />
        {isMe && <mesh geometry={ringGeometry} material={ringMaterial} position-y={0.05} />}
      </group>
      <group ref={refs.body}>
        <mesh ref={refs.torso} geometry={bodyGeometry} position-y={BODY_HEIGHT / 2} />
        {weaponGeometries.map((geometry, i) => (
          <mesh
            key={i}
            ref={(m) => (refs.weapons.current[i] = m)}
            geometry={geometry}
            material={weaponMaterial}
            position={[PLAYER_RADIUS + geometry.parameters.width / 2 - 0.15, BODY_HEIGHT * 0.62, 0.3]}
            visible={false}
          />
        ))}
      </group>
      <sprite position-y={BODY_HEIGHT + 0.7} scale={[label.aspect * 0.6, 0.6, 1]}>
        <spriteMaterial map={label.texture} depthWrite={false} transparent />
      </sprite>
      <Bar barRef={refs.bg} color="#111827" y={BAR_Y} height={0.16} order={1} />
      <Bar barRef={refs.hp} color="#4ade80" y={BAR_Y} height={0.16} order={2} />
      <Bar barRef={refs.armor} color="#60a5fa" y={BAR_Y + 0.16} height={0.09} order={2} />
    </group>
  );
}

export default function Players({ roster, myId, frameRef }) {
  const avatars = useRef(new Map());
  const register = useMemo(
    () => (id, parts) => (parts ? avatars.current.set(id, parts) : avatars.current.delete(id)),
    [],
  );

  useFrame(() => {
    const { me, meInfo, others } = frameRef.current;
    for (const [id, a] of avatars.current) {
      const info = id === myId ? meInfo : others.get(id);
      const pos = id === myId ? me : info;
      if (!pos || !info) {
        a.group.visible = false;
        continue;
      }
      a.group.visible = true;
      a.group.position.set(pos.x, terrainHeight(pos.x, pos.y), -pos.y);
      a.body.rotation.y = pos.aim;

      // Normal de z = f(x, y) en coordenadas de Three.js: (−fx, 1, fy)
      const [fx, fy] = terrainGradient(pos.x, pos.y);
      a.ground.quaternion.setFromUnitVectors(UP, normal.set(-fx, 1, fy).normalize());

      // Caído: acostado y gris, sin arma ni barras
      const dead = Boolean(info.flags & PLAYER_FLAGS.DEAD);
      a.torso.rotation.z = dead ? Math.PI / 2 : 0;
      a.torso.position.y = dead ? PLAYER_RADIUS : BODY_HEIGHT / 2;
      a.torso.material = dead ? deadMaterial : a.material;
      a.weapons.forEach((w, i) => (w.visible = !dead && i === info.weapon));

      const hpRatio = Math.max(0, info.hp / MAX_HP);
      a.bg.visible = !dead;
      a.hp.visible = !dead;
      a.hp.scale.x = Math.max(0.001, BAR_WIDTH * hpRatio);
      a.hp.material.color.set(hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444');
      a.armor.visible = !dead && info.armorLevel > 0;
      a.armor.scale.x = (BAR_WIDTH * ARMOR_ABSORB[info.armorLevel]) / ARMOR_ABSORB[3];
    }
  });

  return roster.map((p) => <PlayerAvatar key={p.id} player={p} isMe={p.id === myId} register={register} />);
}
