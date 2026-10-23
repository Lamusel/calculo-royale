import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARMOR_ABSORB, MAX_HP, PLAYER_RADIUS } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { terrainGradient, terrainHeight } from '@calculo-royale/shared/terrain';
import { aimPreview, inputState } from '../input/inputState.js';
import { Character } from './character/Character.js';
import { textTexture } from './labels.js';
import { modelMaterial } from './models/build.js';

// Cada jugador: raíz de juego (posición, anillo, nombre, vida, chaleco, corona: siempre
// visibles) + parte visual (Character: Master Rig y skin). La skin nunca tapa la información.

const BAR_WIDTH = 1.3;
const BAR_Y = 3.1;

const shadowGeometry = new THREE.CircleGeometry(PLAYER_RADIUS * 1.1, 20).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.RingGeometry(PLAYER_RADIUS * 1.35, PLAYER_RADIUS * 1.55, 32).rotateX(-Math.PI / 2);
// Anillo del color del jugador (todos): identifica a cada uno con cualquier skin
const colorRingGeometry = new THREE.RingGeometry(PLAYER_RADIUS * 1.0, PLAYER_RADIUS * 1.18, 28).rotateX(-Math.PI / 2);
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false });
const ringMaterial = new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.85, depthWrite: false });
const ghostMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.35 });
// Silueta del jugador propio: solo se dibuja donde algo del escenario lo tapa
const silhouetteGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 3, 8).translate(0, 1.15, 0);
const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: '#fde047', depthFunc: THREE.GreaterDepth, depthWrite: false });

// Corona del líder: aro dorado con cinco puntas (gira sobre la cabeza)
const crownGeometry = new THREE.CylinderGeometry(0.3, 0.26, 0.16, 10, 1, true);
const crownTips = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 5) * Math.PI * 2;
  return new THREE.ConeGeometry(0.08, 0.22, 4).translate(Math.cos(a) * 0.28, 0.18, Math.sin(a) * 0.28);
});
const crownMaterial = new THREE.MeshLambertMaterial({ color: '#facc15', emissive: '#a16207', side: THREE.DoubleSide });

// Icono de "expuesto" sobre quien está abriendo una caja
const exposedLabel = textTexture('⚠ ABRIENDO', { color: '#fb923c', size: 44 });
// Nivel del chaleco junto a la barra
const vestLabels = [null, 1, 2, 3].map((n) => n && textTexture(`Ch${n}`, { color: '#93c5fd', size: 40 }));

const UP = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();

function Bar({ barRef, color, y, height, order }) {
  return (
    <sprite ref={barRef} position={[-BAR_WIDTH / 2, y, 0]} scale={[BAR_WIDTH, height, 1]} center={[0, 0.5]} renderOrder={order}>
      <spriteMaterial color={color} depthWrite={false} />
    </sprite>
  );
}

function SoldierAvatar({ player, isMe, register, blobShadow }) {
  const refs = useRef({}).current;
  const set = (key) => (node) => (refs[key] = node);
  const character = useMemo(() => new Character({ skin: player.skin, color: player.color }), [player.id]); // eslint-disable-line react-hooks/exhaustive-deps
  refs.character = character;

  useEffect(() => character.setSkin(player.skin), [character, player.skin]);
  useEffect(() => character.setColor(player.color), [character, player.color]);
  useEffect(() => character.setMaterial(player.connected ? modelMaterial : ghostMaterial), [character, player.connected]);
  // El jugador propio se dibuja después de su silueta (ver silhouetteMaterial)
  useEffect(() => character.setRenderOrder(isMe ? 2 : 0), [character, isMe]);
  useEffect(() => () => character.dispose(), [character]);

  useEffect(() => {
    register(player.id, refs);
    return () => register(player.id, null);
  }, [player.id, register, refs]);

  const label = useMemo(
    () =>
      textTexture(player.connected ? player.name : `${player.name} 💤`, {
        color: isMe ? '#fde047' : '#ffffff',
        size: 40,
      }),
    [player.name, player.connected, isMe],
  );

  return (
    <group ref={set('group')} visible={false}>
      <group ref={set('ground')}>
        {blobShadow && <mesh geometry={shadowGeometry} material={shadowMaterial} position-y={0.04} />}
        <mesh geometry={colorRingGeometry} position-y={0.045}>
          <meshBasicMaterial color={player.color} transparent opacity={0.9} depthWrite={false} />
        </mesh>
        {isMe && <mesh geometry={ringGeometry} material={ringMaterial} position-y={0.05} />}
      </group>
      {isMe && <mesh ref={set('silhouette')} geometry={silhouetteGeometry} material={silhouetteMaterial} renderOrder={1} />}
      <primitive object={character.visualRoot} />
      <sprite position-y={2.6} scale={[label.aspect * 0.6, 0.6, 1]}>
        <spriteMaterial map={label.texture} depthWrite={false} transparent />
      </sprite>
      <group ref={set('crown')} position-y={3.65} visible={false}>
        <mesh geometry={crownGeometry} material={crownMaterial} />
        {crownTips.map((g, i) => (
          <mesh key={i} geometry={g} material={crownMaterial} />
        ))}
      </group>
      <sprite ref={set('exposed')} position-y={BAR_Y + 0.55} scale={[exposedLabel.aspect * 0.5, 0.5, 1]} visible={false} renderOrder={3}>
        <spriteMaterial map={exposedLabel.texture} depthWrite={false} depthTest={false} transparent />
      </sprite>
      <Bar barRef={set('bg')} color="#111827" y={BAR_Y} height={0.16} order={1} />
      <Bar barRef={set('hp')} color="#4ade80" y={BAR_Y} height={0.16} order={2} />
      <Bar barRef={set('armor')} color="#60a5fa" y={BAR_Y + 0.16} height={0.09} order={2} />
      <sprite ref={set('vest')} position={[BAR_WIDTH / 2 + 0.32, BAR_Y + 0.05, 0]} scale={[0.6, 0.27, 1]} visible={false} renderOrder={2}>
        <spriteMaterial ref={set('vestMaterial')} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}

// Asiento y rumbo del jeep en el que va (para sentarlo mirando al frente del jeep)
function seatOf(id, frame) {
  for (const v of frame.vehicles?.values() ?? []) {
    if (v.driver === id || v.passenger === id) {
      const own = frame.mySeat === 'driver' && frame.myVehicleId === v.id && frame.me?.jeep;
      return { seat: v.driver === id ? 'driver' : 'passenger', heading: own ? own.heading : v.heading };
    }
  }
  return null;
}

export default function Players({ client, roster, myId, frameRef, quality }) {
  const avatars = useRef(new Map());
  const register = useMemo(
    () => (id, parts) => (parts ? avatars.current.set(id, parts) : avatars.current.delete(id)),
    [],
  );

  useFrame((_, delta) => {
    const now = performance.now();
    const dt = Math.min(delta, 0.1);
    const frame = frameRef.current;
    const { me, meInfo, others } = frame;
    const duelists = client.duelIntro?.(now) ? client.duel.ids : null;
    const winnerId = client.phase === 'results' ? client.results?.winnerId : null;
    for (const [id, a] of avatars.current) {
      const info = id === myId ? meInfo : others.get(id);
      const pos = id === myId ? me : info;
      if (!pos || !info) {
        a.group.visible = false;
        continue;
      }
      a.group.visible = true;
      a.group.position.set(pos.x, terrainHeight(pos.x, pos.y), -pos.y);

      // Normal de z = f(x, y) en coordenadas de Three.js: (−fx, 1, fy)
      const [fx, fy] = terrainGradient(pos.x, pos.y);
      a.ground.quaternion.setFromUnitVectors(UP, normal.set(-fx, 1, fy).normalize());

      const dead = Boolean(info.flags & PLAYER_FLAGS.DEAD);
      const ride = info.flags & PLAYER_FLAGS.IN_VEHICLE ? seatOf(id, frame) : null;
      const isMe = id === myId;
      const ch = a.character;
      ch.setVest(info.armorLevel);
      ch.setWeapon(info.weapon < 4 ? info.weapon : -1);
      ch.setShadows(quality.shadows);
      const shotAt = client.lastShot.get(id);
      ch.update(
        {
          x: pos.x,
          y: pos.y,
          aim: pos.aim,
          dead,
          reloading: Boolean(info.flags & PLAYER_FLAGS.RELOADING),
          aiming: isMe && (inputState.stickAim !== null || inputState.adsHeld || Boolean(aimPreview())),
          shotAgo: now - (shotAt ?? -1e9),
          weapon: info.weapon,
          seat: ride?.seat ?? null,
          seatYaw: ride?.heading,
          victory: (duelists?.includes(id) ?? false) || winnerId === id,
        },
        now,
        dt,
        (x, y) => {
          if (quality.particles > 0.5) client.effects.push({ type: 'dust', x, y });
        },
      );

      // Información de juego (nunca la tapa la skin)
      a.ground.visible = !ride;
      if (a.silhouette) a.silhouette.visible = !dead;
      a.crown.visible = Boolean(info.flags & PLAYER_FLAGS.LEADER) && !dead;
      if (a.crown.visible) {
        a.crown.rotation.y = now / 600;
        a.crown.position.y = 3.65 + Math.sin(now / 300) * 0.06;
      }
      a.exposed.visible = Boolean(info.flags & PLAYER_FLAGS.ANSWERING);
      if (a.exposed.visible) a.exposed.material.opacity = 0.65 + 0.35 * Math.sin(now / 120);
      const hpRatio = Math.max(0, info.hp / MAX_HP);
      a.bg.visible = !dead;
      a.hp.visible = !dead;
      a.hp.scale.x = Math.max(0.001, BAR_WIDTH * hpRatio);
      a.hp.material.color.set(hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444');
      a.armor.visible = !dead && info.armorLevel > 0;
      a.armor.scale.x = (BAR_WIDTH * ARMOR_ABSORB[info.armorLevel]) / ARMOR_ABSORB[3];
      a.vest.visible = a.armor.visible;
      const vestLabel = vestLabels[info.armorLevel];
      if (vestLabel && a.vestMaterial.map !== vestLabel.texture) {
        a.vestMaterial.map = vestLabel.texture;
        a.vestMaterial.needsUpdate = true;
        a.vest.scale.set(vestLabel.aspect * 0.27, 0.27, 1);
      }
    }
  });

  return roster.map((p) => (
    <SoldierAvatar key={p.id} player={p} isMe={p.id === myId} register={register} blobShadow={!quality.shadows} />
  ));
}
