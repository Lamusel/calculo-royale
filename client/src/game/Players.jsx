import { surfaceAt } from '../audio/mix.js';
import { VEHICLE_TYPES, vehicleType, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ARMOR_ABSORB, MAX_HP, PLAYER_RADIUS } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { terrainGradient, terrainHeight } from '@calculo-royale/shared/terrain';
import { aimPreview, inputState } from '../input/inputState.js';
import { Character } from './character/Character.js';
import { characterStats, CharacterDebug, debugSkinsEnabled } from './character/debug.js';
import { textTexture } from './labels.js';
import { decodeGear } from '@calculo-royale/shared/gear';
import { modelMaterial } from './models/build.js';
import { sound } from '../audio/sound.js';
import { parachuteGeometry } from './models/parachute.js';

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

// Paracaídas del despliegue y la reanimación (el mismo modelo del lanzamiento aéreo)
const chuteGeometry = parachuteGeometry({ radius: 1.9, height: 4.6, hook: 1.9, colors: ['#e9d77a', '#2f7d4a'] });

// Icono de "expuesto" sobre quien está abriendo una caja
const exposedLabel = textTexture('⚠ ABRIENDO', { color: '#fb923c', size: 44 });
// Casco y mochila como iconos junto a la barra cuando la skin externa no los puede llevar puestos
const gearIconLabel = (g) => {
  const text = `${g.helmet ? `⛑${g.helmet}` : ''}${g.helmet && g.backpack ? ' ' : ''}${g.backpack ? `🎒${g.backpack}` : ''}`;
  return text ? textTexture(text, { color: '#fde68a', size: 40 }) : null;
};

// Nivel del chaleco junto a la barra
const vestLabels = [null, 1, 2, 3].map((n) => n && textTexture(`Ch${n}`, { color: '#93c5fd', size: 40 }));

// LOD de las skins externas por distancia al foco de la cámara (ajustables)
export const LOD_DISTANCES = [12, 30];

const UP = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();

function Bar({ barRef, color, y, height, order }) {
  return (
    <sprite ref={barRef} position={[-BAR_WIDTH / 2, y, 0]} scale={[BAR_WIDTH, height, 1]} center={[0, 0.5]} renderOrder={order}>
      <spriteMaterial color={color} depthWrite={false} />
    </sprite>
  );
}

function SoldierAvatar({ player, isMe, mate = false, register, blobShadow }) {
  const refs = useRef({}).current;
  const set = (key) => (node) => (refs[key] = node);
  const character = useMemo(() => new Character({ skin: player.skin, color: player.color }), [player.id]); // eslint-disable-line react-hooks/exhaustive-deps
  refs.character = character;

  useEffect(() => character.setSkin(player.skin), [character, player.skin]);
  useEffect(() => character.setHat(player.hat ?? null), [character, player.hat]);
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
      textTexture(player.connected ? `${mate ? '◆ ' : ''}${player.name}` : `${player.name} 💤`, {
        color: isMe ? '#fde047' : player.team != null ? player.color : '#ffffff',
        size: 40,
      }),
    [player.name, player.connected, isMe, mate, player.team, player.color],
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
      <mesh ref={set('chute')} geometry={chuteGeometry} material={modelMaterial} visible={false} />
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
      <sprite ref={set('gearIcons')} position={[-BAR_WIDTH / 2 - 0.45, BAR_Y + 0.05, 0]} scale={[0.6, 0.27, 1]} visible={false} renderOrder={2}>
        <spriteMaterial ref={set('gearMaterial')} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}

const TRUCK_BED = 1.05; // altura del piso del platón (Vehicles.jsx)
// Asiento y rumbo del jeep en el que va (para sentarlo mirando al frente del jeep)
function seatOf(id, frame) {
  for (const v of frame.vehicles?.values() ?? []) {
    const index = v.driver === id ? 0 : (v.passengers ?? [v.passenger]).indexOf(id) + 1;
    if (index >= 0 && (index > 0 || v.driver === id)) {
      const own = frame.mySeat === 'driver' && frame.myVehicleId === v.id && frame.me?.jeep;
      // En el platón del camión (puestos 2 en adelante) van de pie sobre el piso
      if (v.type === 'truck' && index >= 2) return { seat: 'stand', heading: own ? own.heading : v.heading, lift: TRUCK_BED };
      return { seat: index === 0 ? 'driver' : 'passenger', heading: own ? own.heading : v.heading, lift: vehicleType(v).seatLift - VEHICLE_TYPES.jeep.seatLift };
    }
  }
  return null;
}

// Nivel de detalle: con el detalle lejano recortado (calidad baja) y de noche (linternas), siempre el más bajo y sin sombras
export function lodFor(distance, quality, night) {
  if (quality.farLod || night) return 2;
  return distance > LOD_DISTANCES[1] ? 2 : distance > LOD_DISTANCES[0] ? 1 : 0;
}

export default function Players({ client, roster, myId, frameRef, quality, night = false }) {
  const avatars = useRef(new Map());
  const register = useMemo(
    () => (id, parts) => {
      if (parts) avatars.current.set(id, parts);
      else {
        avatars.current.get(id)?.debug?.dispose();
        avatars.current.delete(id);
      }
    },
    [],
  );
  // ?debugSkins=1: esqueleto, caja y sockets de cada personaje, y datos para el panel
  const { scene, gl } = useThree();
  const debug = useMemo(() => (debugSkinsEnabled() ? { at: 0 } : null), []);

  useFrame((_, delta) => {
    const now = performance.now();
    const dt = Math.min(delta, 0.1);
    const frame = frameRef.current;
    const { me, meInfo, others } = frame;
    const duelists = client.duelIntro?.(now) ? client.duel.ids : null;
    const winnerId = client.phase === 'results' ? client.results?.winnerId : null;
    const focus = frame.follow ?? me;
    for (const [id, a] of avatars.current) {
      const info = id === myId ? meInfo : others.get(id);
      const pos = id === myId ? me : info;
      if (!pos || !info) {
        a.group.visible = false;
        continue;
      }
      // En el bus (o eligiendo punto) no se dibuja; en el aire, a su altura
      if (info.flags & PLAYER_FLAGS.IN_BUS) {
        a.group.visible = false;
        continue;
      }
      const z = info.z ?? 0;
      const air = info.flags & PLAYER_FLAGS.FALLING ? 'fall' : info.flags & PLAYER_FLAGS.PARACHUTE ? 'chute' : null;
      a.group.visible = true;
      const rideLift = info.flags & PLAYER_FLAGS.IN_VEHICLE ? seatOf(id, frame)?.lift ?? 0 : 0;
      a.group.position.set(pos.x, terrainHeight(pos.x, pos.y) + z + rideLift, -pos.y);
      a.chute.visible = air === 'chute';
      if (a.chute.visible) a.chute.rotation.z = Math.sin(now / 700 + id) * 0.08;

      // Normal de z = f(x, y) en coordenadas de Three.js: (−fx, 1, fy)
      const [fx, fy] = terrainGradient(pos.x, pos.y);
      a.ground.quaternion.setFromUnitVectors(UP, normal.set(-fx, 1, fy).normalize());

      const dead = Boolean(info.flags & PLAYER_FLAGS.DEAD);
      const ride = info.flags & PLAYER_FLAGS.IN_VEHICLE ? seatOf(id, frame) : null;
      const isMe = id === myId;
      const ch = a.character;
      ch.setVest(info.armorLevel);
      const gear = decodeGear(info.gear);
      ch.setGear(gear);
      // Cualquier arma del arsenal en la mano (los puños y los lanzables no tienen modelo)
      ch.setWeapon(WEAPON_IDS[info.weapon] === 'fists' ? -1 : info.weapon);
      const external = Boolean(ch.external);
      const lod = lodFor(focus ? Math.hypot(pos.x - focus.x, pos.y - focus.y) : 0, quality, night);
      if (ch.lod !== lod) ch.setLod(lod);
      const shadows = quality.shadows && !(external && (night || lod === 2));
      if (ch.shadows !== shadows) ch.setShadows(shadows);
      const shotAt = client.lastShot.get(id);
      ch.update(
        {
          x: pos.x,
          y: pos.y,
          aim: pos.aim,
          // Derribado (dúos y escuadras): tirado en el suelo, con su barra de vida visible
          dead: dead || Boolean(info.flags & PLAYER_FLAGS.DOWNED),
          reloading: Boolean(info.flags & PLAYER_FLAGS.RELOADING),
          aiming: isMe && (inputState.stickAim !== null || inputState.adsHeld || Boolean(aimPreview())),
          shotAgo: now - (shotAt ?? -1e9),
          weapon: info.weapon,
          seat: ride?.seat ?? null,
          seatYaw: ride?.heading,
          victory: (duelists?.includes(id) ?? false) || winnerId === id,
          air,
        },
        now,
        dt,
        (x, y) => {
          if (quality.particles > 0.5) client.effects.push({ type: 'dust', x, y });
          if (!client.spectator) sound.footstep(x, y, surfaceAt(x, y));
        },
      );

      // Información de juego (nunca la tapa la skin)
      a.ground.visible = !ride && !air;
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
      // Skin externa sin los huesos del rig: casco y mochila como iconos junto a la barra
      const icons = !dead && !ch.gearOnModel ? gearIconLabel(gear) : null;
      a.gearIcons.visible = Boolean(icons);
      if (icons && a.gearMaterial.map !== icons.texture) {
        a.gearMaterial.map = icons.texture;
        a.gearMaterial.needsUpdate = true;
        a.gearIcons.scale.set(icons.aspect * 0.27, 0.27, 1);
      }
      if (debug) {
        a.debug ??= new CharacterDebug(ch, scene);
        a.debug.update();
      }
      const vestLabel = vestLabels[info.armorLevel];
      if (vestLabel && a.vestMaterial.map !== vestLabel.texture) {
        a.vestMaterial.map = vestLabel.texture;
        a.vestMaterial.needsUpdate = true;
        a.vest.scale.set(vestLabel.aspect * 0.27, 0.27, 1);
      }
    }
    if (debug && now - debug.at > 500) {
      debug.at = now;
      globalThis.__skinDebug = {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        players: [...avatars.current].map(([id, a]) => ({
          id,
          skin: a.character.skinId,
          status: a.character.status,
          mode: a.character.external?.mode ?? 'procedural',
          lod: a.character.lod,
          ...characterStats(a.character),
        })),
      };
    }
  });

  const myTeam = roster.find((p) => p.id === myId)?.team;
  return roster.map((p) => (
    <SoldierAvatar key={p.id} player={p} isMe={p.id === myId} mate={p.id !== myId && p.team != null && p.team === myTeam} register={register} blobShadow={!quality.shadows} />
  ));
}
