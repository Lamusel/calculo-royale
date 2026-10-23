import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRENADE, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { textTexture } from './labels.js';

// Efectos básicos de la fase 2: trazadoras, fogonazo, explosiones, hit markers y números de daño.
// Consume la cola client.effects cada cuadro. Todo con piezas reutilizables (sin crear mallas al vuelo).

const CHEST = 1.25; // altura del arma sobre el terreno
const TRACER_SPEED = 140; // unidades por segundo
const MAX_TRACERS = 160;
const MAX_FLASHES = 24;
const MAX_EXPLOSIONS = 6;
const MAX_NUMBERS = 24;
const SHOTGUN = WEAPON_IDS.indexOf('shotgun');

const tracerGeometry = new THREE.BoxGeometry(0.06, 0.06, 1);
const tracerMaterial = new THREE.MeshBasicMaterial({ color: '#ffe08a', toneMapped: false });
const flashGeometry = new THREE.OctahedronGeometry(0.28, 0);
const flashMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false });
const explosionGeometry = new THREE.IcosahedronGeometry(1, 1);

const point = (x, y, lift = CHEST) => new THREE.Vector3(x, terrainHeight(x, y) + lift, -y);

export default function Effects({ client }) {
  const tracerMesh = useRef(null);
  const flashMesh = useRef(null);
  const explosionRefs = useRef([]);
  const numberRefs = useRef([]);
  const state = useMemo(
    () => ({ tracers: [], flashes: [], explosions: [], numbers: [], dummy: new THREE.Object3D() }),
    [],
  );

  useFrame(() => {
    const now = performance.now();
    for (const e of client.effects.splice(0)) {
      if (e.type === 'tracer') {
        if (state.tracers.length >= MAX_TRACERS) state.tracers.shift();
        const from = point(e.x, e.y);
        const ex = e.x + Math.cos(e.angle) * e.dist;
        const ey = e.y + Math.sin(e.angle) * e.dist;
        const to = point(ex, ey);
        const length = from.distanceTo(to);
        state.tracers.push({ from, dir: to.sub(from).normalize(), length, at: now, streak: e.weapon === SHOTGUN ? 1.2 : 2.6 });
      } else if (e.type === 'muzzle') {
        if (state.flashes.length >= MAX_FLASHES) state.flashes.shift();
        state.flashes.push({ pos: point(e.x + Math.cos(e.angle) * 0.9, e.y + Math.sin(e.angle) * 0.9), at: now });
      } else if (e.type === 'explosion') {
        if (state.explosions.length >= MAX_EXPLOSIONS) state.explosions.shift();
        state.explosions.push({ pos: point(e.x, e.y, 0.4), at: now });
      } else if (e.type === 'damage') {
        if (state.numbers.length >= MAX_NUMBERS) state.numbers.shift();
        state.numbers.push({ pos: point(e.x, e.y, 2.4), at: now, text: String(e.amount), killed: e.killed });
      }
    }

    // Trazadoras: un trazo que viaja del cañón al impacto
    const { dummy } = state;
    state.tracers = state.tracers.filter((t) => ((now - t.at) / 1000) * TRACER_SPEED - t.streak < t.length);
    state.tracers.forEach((t, i) => {
      const head = Math.min(((now - t.at) / 1000) * TRACER_SPEED, t.length);
      const tail = Math.max(0, head - t.streak);
      dummy.position.copy(t.from).addScaledVector(t.dir, (head + tail) / 2);
      dummy.lookAt(dummy.position.clone().add(t.dir));
      dummy.scale.set(1, 1, Math.max(head - tail, 0.001));
      dummy.updateMatrix();
      tracerMesh.current.setMatrixAt(i, dummy.matrix);
    });
    tracerMesh.current.count = state.tracers.length;
    tracerMesh.current.instanceMatrix.needsUpdate = true;

    state.flashes = state.flashes.filter((f) => now - f.at < 70);
    state.flashes.forEach((f, i) => {
      dummy.position.copy(f.pos);
      dummy.rotation.set(0, (now - f.at) * 0.05, 0);
      dummy.scale.setScalar(1 + (now - f.at) / 70);
      dummy.updateMatrix();
      flashMesh.current.setMatrixAt(i, dummy.matrix);
    });
    flashMesh.current.count = state.flashes.length;
    flashMesh.current.instanceMatrix.needsUpdate = true;

    state.explosions = state.explosions.filter((e) => now - e.at < 450);
    explosionRefs.current.forEach((mesh, i) => {
      const e = state.explosions[i];
      mesh.visible = Boolean(e);
      if (!e) return;
      const t = (now - e.at) / 450;
      mesh.position.copy(e.pos);
      mesh.scale.setScalar(GRENADE.radius * (0.3 + 0.7 * Math.sqrt(t)));
      mesh.material.opacity = 0.85 * (1 - t);
      mesh.material.color.setHSL(0.08 - t * 0.06, 1, 0.6 - t * 0.3);
    });

    state.numbers = state.numbers.filter((n) => now - n.at < 800);
    numberRefs.current.forEach((sprite, i) => {
      const n = state.numbers[i];
      sprite.visible = Boolean(n);
      if (!n) return;
      const t = (now - n.at) / 800;
      if (sprite.userData.text !== n.text + n.killed) {
        const { texture, aspect } = textTexture(n.text, { color: n.killed ? '#f87171' : '#fde047', size: 56 });
        sprite.material.map = texture;
        sprite.material.needsUpdate = true;
        sprite.userData = { text: n.text + n.killed, aspect };
      }
      const size = n.killed ? 0.95 : 0.7;
      sprite.position.copy(n.pos).add({ x: 0, y: t * 1.4, z: 0 });
      sprite.scale.set(sprite.userData.aspect * size, size, 1);
      sprite.material.opacity = 1 - t * t;
    });
  });

  return (
    <group>
      <instancedMesh ref={tracerMesh} args={[tracerGeometry, tracerMaterial, MAX_TRACERS]} frustumCulled={false} />
      <instancedMesh ref={flashMesh} args={[flashGeometry, flashMaterial, MAX_FLASHES]} frustumCulled={false} />
      {Array.from({ length: MAX_EXPLOSIONS }, (_, i) => (
        <mesh key={i} ref={(m) => (explosionRefs.current[i] = m)} geometry={explosionGeometry} visible={false}>
          <meshBasicMaterial color="#ff9a3c" transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: MAX_NUMBERS }, (_, i) => (
        <sprite key={i} ref={(s) => (numberRefs.current[i] = s)} visible={false} renderOrder={10}>
          <spriteMaterial transparent depthTest={false} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
