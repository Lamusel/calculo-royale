import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ARMOR_ABSORB, MAX_HP, PLAYER_RADIUS, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { terrainGradient, terrainHeight } from '@calculo-royale/shared/terrain';
import { aimPreview, inputState } from '../input/inputState.js';
import { textTexture } from './labels.js';
import { modelMaterial } from './models/build.js';
import { armsGeometry, HAND, HIP, legGeometry, SHOULDER, torsoGeometry } from './models/soldier.js';
import { weaponGeometry } from './models/weapons.js';

const BAR_WIDTH = 1.3;
const BAR_Y = 3.1;
const GUNS = WEAPON_IDS.slice(0, 4); // pistola, escopeta, rifle, francotirador

const shadowGeometry = new THREE.CircleGeometry(PLAYER_RADIUS * 1.1, 20).rotateX(-Math.PI / 2);
const ringGeometry = new THREE.RingGeometry(PLAYER_RADIUS * 1.35, PLAYER_RADIUS * 1.55, 32).rotateX(-Math.PI / 2);
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false });
const ringMaterial = new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.85, depthWrite: false });
const ghostMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.35 });
// Silueta del jugador propio: solo se dibuja donde algo del escenario lo tapa
const silhouetteGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 3, 8).translate(0, 1.15, 0);
const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: '#fde047', depthFunc: THREE.GreaterDepth, depthWrite: false });

const UP = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();
const fallAxis = new THREE.Vector3();
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

function Bar({ barRef, color, y, height, order }) {
  return (
    <sprite ref={barRef} position={[-BAR_WIDTH / 2, y, 0]} scale={[BAR_WIDTH, height, 1]} center={[0, 0.5]} renderOrder={order}>
      <spriteMaterial color={color} depthWrite={false} />
    </sprite>
  );
}

function SoldierAvatar({ player, isMe, vestLevel, register, blobShadow }) {
  const refs = useRef({ weapons: [] }).current;
  const set = (key) => (node) => (refs[key] = node);
  const material = player.connected ? modelMaterial : ghostMaterial;
  // El jugador propio se dibuja después de su silueta (ver silhouetteMaterial)
  const order = isMe ? 2 : 0;

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
  const torso = torsoGeometry(player.color, vestLevel);
  const arms = armsGeometry(player.color);
  const leg = legGeometry();

  return (
    <group ref={set('group')} visible={false}>
      <group ref={set('ground')}>
        {blobShadow && <mesh geometry={shadowGeometry} material={shadowMaterial} position-y={0.04} />}
        {isMe && <mesh geometry={ringGeometry} material={ringMaterial} position-y={0.05} />}
      </group>
      {isMe && <mesh ref={set('silhouette')} geometry={silhouetteGeometry} material={silhouetteMaterial} renderOrder={1} />}
      <group ref={set('body')}>
        <group ref={set('lower')}>
          <mesh ref={set('legL')} geometry={leg} material={material} position={[0, HIP, 0.16]} castShadow renderOrder={order} />
          <mesh ref={set('legR')} geometry={leg} material={material} position={[0, HIP, -0.16]} castShadow renderOrder={order} />
        </group>
        <group ref={set('upper')}>
          <mesh geometry={torso} material={material} castShadow renderOrder={order} />
          <group ref={set('shoulders')} position-y={SHOULDER}>
            <mesh geometry={arms} material={material} castShadow renderOrder={order} />
            {GUNS.map((id, i) => (
              <mesh
                key={id}
                ref={(m) => (refs.weapons[i] = m)}
                geometry={weaponGeometry(id)}
                material={material}
                position={HAND}
                visible={false}
                castShadow
                renderOrder={order}
              />
            ))}
          </group>
        </group>
      </group>
      <sprite position-y={2.6} scale={[label.aspect * 0.6, 0.6, 1]}>
        <spriteMaterial map={label.texture} depthWrite={false} transparent />
      </sprite>
      <Bar barRef={set('bg')} color="#111827" y={BAR_Y} height={0.16} order={1} />
      <Bar barRef={set('hp')} color="#4ade80" y={BAR_Y} height={0.16} order={2} />
      <Bar barRef={set('armor')} color="#60a5fa" y={BAR_Y + 0.16} height={0.09} order={2} />
    </group>
  );
}

// Anima a un soldado: piernas hacia donde camina, torso hacia la mira, brazos y caída
function animate(a, pos, info, isMe, lastShot, now, dt, onStep) {
  const st = a.anim ?? (a.anim = { x: pos.x, y: pos.y, speed: 0, phase: 0, legsYaw: pos.aim, pitch: -0.45, deadSince: 0 });
  const dx = pos.x - st.x;
  const dy = pos.y - st.y;
  const moved = Math.hypot(dx, dy);
  st.x = pos.x;
  st.y = pos.y;
  st.speed = approach(st.speed, dt > 0 ? Math.min(moved / dt, 12) : 0, 10, dt);

  const dead = Boolean(info.flags & PLAYER_FLAGS.DEAD);
  if (!dead) {
    // Las piernas giran hacia donde camina; si la mira se aleja demasiado, los pies la siguen
    let legsGoal = st.speed > 0.5 ? Math.atan2(dy, dx) : st.legsYaw;
    if (st.speed <= 0.5 && Math.abs(angleDiff(pos.aim, st.legsYaw)) > 1.6) legsGoal = pos.aim;
    if (moved > 1e-4 || st.speed <= 0.5) st.legsYaw += angleDiff(legsGoal, st.legsYaw) * (1 - Math.exp(-12 * dt));
  }
  a.lower.rotation.y = dead ? st.deathYaw : st.legsYaw;
  a.upper.rotation.y = dead ? st.deathYaw : pos.aim;

  // Caminar: zancada y balanceo según la velocidad real
  const stride = Math.min(st.speed / 6, 1);
  const before = Math.sin(st.phase);
  st.phase += st.speed * dt * 1.7;
  const swing = Math.sin(st.phase) * 0.6 * stride;
  if (Math.sign(before) !== Math.sign(Math.sin(st.phase)) && st.speed > 3) onStep(pos.x, pos.y);
  a.legL.rotation.z = dead ? 0 : swing;
  a.legR.rotation.z = dead ? 0 : -swing;
  a.upper.position.y = dead ? 0 : Math.abs(Math.sin(st.phase)) * 0.05 * stride;

  // Brazos: arriba al apuntar o disparar, abajo en reposo, más abajo al recargar; retroceso al disparar
  const shotAgo = now - (lastShot ?? -1e9);
  const aiming = shotAgo < 1200 || (isMe && (inputState.stickAim !== null || inputState.adsHeld || aimPreview()));
  const goal = info.flags & PLAYER_FLAGS.RELOADING ? -0.8 : aiming ? 0 : -0.45;
  st.pitch = approach(st.pitch, goal, 10, dt);
  const recoil = shotAgo < 160 ? 1 - shotAgo / 160 : 0;
  const kick = info.weapon === 3 ? 0.35 : info.weapon === 1 ? 0.25 : 0.14;
  a.shoulders.rotation.z = st.pitch + recoil * kick;
  a.shoulders.position.x = -recoil * 0.1;
  a.weapons.forEach((w, i) => (w.visible = i === info.weapon));

  // Caída al morir: se va de espaldas en ~0.45 s
  if (dead && !st.deadSince) {
    st.deadSince = now;
    st.deathYaw = pos.aim;
  }
  if (!dead) st.deadSince = 0;
  const fall = dead ? 1 - (1 - Math.min(1, (now - st.deadSince) / 450)) ** 3 : 0;
  const yaw = st.deathYaw ?? 0;
  fallAxis.set(Math.sin(yaw), 0, Math.cos(yaw));
  a.body.quaternion.setFromAxisAngle(fallAxis, fall * Math.PI * 0.48);
  a.body.position.y = fall * 0.22;
}

export default function Players({ client, roster, myId, frameRef, quality }) {
  const avatars = useRef(new Map());
  const register = useMemo(
    () => (id, parts) => (parts ? avatars.current.set(id, parts) : avatars.current.delete(id)),
    [],
  );
  const vests = useRef(new Map());
  const [, force] = useState(0);

  useFrame((_, delta) => {
    const now = performance.now();
    const dt = Math.min(delta, 0.1);
    const { me, meInfo, others } = frameRef.current;
    let vestChanged = false;
    for (const [id, a] of avatars.current) {
      const info = id === myId ? meInfo : others.get(id);
      const pos = id === myId ? me : info;
      if (!pos || !info) {
        a.group.visible = false;
        continue;
      }
      if ((vests.current.get(id) ?? 0) !== info.armorLevel) {
        vests.current.set(id, info.armorLevel);
        vestChanged = true;
      }
      a.group.visible = true;
      a.group.position.set(pos.x, terrainHeight(pos.x, pos.y), -pos.y);

      // Normal de z = f(x, y) en coordenadas de Three.js: (−fx, 1, fy)
      const [fx, fy] = terrainGradient(pos.x, pos.y);
      a.ground.quaternion.setFromUnitVectors(UP, normal.set(-fx, 1, fy).normalize());

      animate(a, pos, info, id === myId, client.lastShot.get(id), now, dt, (x, y) => {
        if (quality.particles > 0.5) client.effects.push({ type: 'dust', x, y });
      });

      const dead = Boolean(info.flags & PLAYER_FLAGS.DEAD);
      if (a.silhouette) a.silhouette.visible = !dead;
      const hpRatio = Math.max(0, info.hp / MAX_HP);
      a.bg.visible = !dead;
      a.hp.visible = !dead;
      a.hp.scale.x = Math.max(0.001, BAR_WIDTH * hpRatio);
      a.hp.material.color.set(hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444');
      a.armor.visible = !dead && info.armorLevel > 0;
      a.armor.scale.x = (BAR_WIDTH * ARMOR_ABSORB[info.armorLevel]) / ARMOR_ABSORB[3];
    }
    // El chaleco cambia la geometría del torso: se vuelve a renderizar solo cuando cambia
    if (vestChanged) force((n) => n + 1);
  });

  return roster.map((p) => (
    <SoldierAvatar
      key={p.id}
      player={p}
      isMe={p.id === myId}
      vestLevel={vests.current.get(p.id) ?? 0}
      register={register}
      blobShadow={!quality.shadows}
    />
  ));
}
