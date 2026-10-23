import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLAYER_RADIUS } from '@calculo-royale/shared/constants';
import { terrainGradient, terrainHeight } from '@calculo-royale/shared/terrain';
import { textTexture } from './labels.js';

const BODY_HEIGHT = 2;

// Geometrías y materiales compartidos: pocos objetos en GPU aunque haya 40 jugadores
const bodyGeometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, BODY_HEIGHT - PLAYER_RADIUS * 2, 4, 12);
const visorGeometry = new THREE.BoxGeometry(0.3, 0.24, 0.75);
const shadowGeometry = new THREE.CircleGeometry(PLAYER_RADIUS * 1.1, 20).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.RingGeometry(PLAYER_RADIUS * 1.35, PLAYER_RADIUS * 1.6, 32).rotateX(-Math.PI / 2);
const visorMaterial = new THREE.MeshLambertMaterial({ color: '#f8fafc' });
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false });
const ringMaterial = new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9, depthWrite: false });

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

function PlayerAvatar({ player, isMe, register }) {
  const group = useRef(null);
  const body = useRef(null);
  const ground = useRef(null);

  useEffect(() => {
    register(player.id, { group: group.current, body: body.current, ground: ground.current });
    return () => register(player.id, null);
  }, [player.id, register]);

  const label = useMemo(
    () =>
      textTexture(player.connected ? player.name : `${player.name} 💤`, {
        color: isMe ? '#fde047' : '#ffffff',
        size: 40,
      }),
    [player.name, player.connected, isMe],
  );

  return (
    <group ref={group} visible={false}>
      {/* Sombra y anillo se inclinan con la pendiente del terreno */}
      <group ref={ground}>
        <mesh geometry={shadowGeometry} material={shadowMaterial} position-y={0.04} />
        {isMe && <mesh geometry={ringGeometry} material={ringMaterial} position-y={0.05} />}
      </group>
      <group ref={body}>
        <mesh geometry={bodyGeometry} material={bodyMaterial(player.color, !player.connected)} position-y={BODY_HEIGHT / 2} />
        <mesh geometry={visorGeometry} material={visorMaterial} position={[PLAYER_RADIUS * 0.8, BODY_HEIGHT * 0.68, 0]} />
      </group>
      <sprite position-y={BODY_HEIGHT + 0.7} scale={[label.aspect * 0.75, 0.75, 1]}>
        <spriteMaterial map={label.texture} depthWrite={false} transparent />
      </sprite>
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
    const { me, others } = frameRef.current;
    for (const [id, { group, body, ground }] of avatars.current) {
      const s = id === myId ? me : others.get(id);
      if (!s) {
        group.visible = false;
        continue;
      }
      group.visible = true;
      group.position.set(s.x, terrainHeight(s.x, s.y), -s.y);
      body.rotation.y = s.aim;
      // Normal de z = f(x, y) en coordenadas de Three.js: (−fx, 1, fy)
      const [fx, fy] = terrainGradient(s.x, s.y);
      ground.quaternion.setFromUnitVectors(UP, normal.set(-fx, 1, fy).normalize());
    }
  });

  return roster.map((p) => <PlayerAvatar key={p.id} player={p} isMe={p.id === myId} register={register} />);
}
