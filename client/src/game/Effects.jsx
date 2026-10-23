import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRENADE, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { raycastObstacles } from '@calculo-royale/shared/collision';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { textTexture } from './labels.js';

// Efectos: trazadoras, fogonazo, casquillos, chispas en paredes, sangre, polvo al caminar,
// explosión con humo, hit marker y números de daño. Consume la cola client.effects cada cuadro.
// Todo con piezas reutilizables (instancing y pools), sin crear mallas al vuelo.

const CHEST = 1.25;
const TRACER_SPEED = 140; // unidades por segundo
const MAX_TRACERS = 160;
const MAX_FLASHES = 24;
const MAX_EXPLOSIONS = 6;
const MAX_NUMBERS = 24;
const MAX_MARKERS = 8;
const SHOTGUN = WEAPON_IDS.indexOf('shotgun');

const basic = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
const lambert = (color) => new THREE.MeshLambertMaterial({ color });

// Partículas: cada tipo es un InstancedMesh con su propio límite
const PARTICLES = {
  casing: { max: 80, geometry: new THREE.BoxGeometry(0.04, 0.04, 0.11), material: lambert('#c9a34a') },
  shell: { max: 30, geometry: new THREE.BoxGeometry(0.06, 0.06, 0.13), material: lambert('#9b2c2c') },
  spark: { max: 60, geometry: new THREE.BoxGeometry(0.05, 0.05, 0.05), material: basic('#ffe9a8') },
  blood: { max: 40, geometry: new THREE.BoxGeometry(0.08, 0.08, 0.08), material: lambert('#7f1d1d') },
  dust: { max: 60, geometry: new THREE.IcosahedronGeometry(0.25, 0), material: lambert('#a08a63') },
  smoke: { max: 40, geometry: new THREE.IcosahedronGeometry(0.5, 0), material: lambert('#5d5c55') },
};

const tracerGeometry = new THREE.BoxGeometry(0.06, 0.06, 1);
const tracerMaterial = basic('#ffe08a');
const flashGeometry = new THREE.OctahedronGeometry(0.28, 0);
const flashMaterial = basic('#fff3c4');
const explosionGeometry = new THREE.IcosahedronGeometry(1, 1);

const point = (x, y, lift = CHEST) => new THREE.Vector3(x, terrainHeight(x, y) + lift, -y);
const rand = (a, b) => a + Math.random() * (b - a);

function spawner(state, density) {
  return (kind, count, make) => {
    const n = Math.max(kind === 'casing' || kind === 'shell' ? 1 : 0, Math.round(count * density));
    for (let i = 0; i < n; i++) {
      const list = state.particles[kind];
      if (list.length >= PARTICLES[kind].max) list.shift();
      list.push(make());
    }
  };
}

// Actualiza la física simple de una partícula; devuelve false cuando expira
function stepParticle(p, kind, now, dt) {
  const t = (now - p.born) / p.life;
  if (t >= 1) return false;
  p.v.y += (p.gravity ?? 0) * dt;
  p.pos.addScaledVector(p.v, dt);
  if (kind === 'casing' || kind === 'shell') {
    const ground = terrainHeight(p.pos.x, -p.pos.z) + 0.03;
    if (p.pos.y < ground) {
      p.pos.y = ground;
      p.v.y = Math.abs(p.v.y) * 0.3;
      p.v.x *= 0.5;
      p.v.z *= 0.5;
      p.spin *= 0.5;
    }
  }
  p.t = t;
  return true;
}

export default function Effects({ client, quality }) {
  const tracerMesh = useRef(null);
  const flashMesh = useRef(null);
  const particleMeshes = useRef({});
  const explosionRefs = useRef([]);
  const numberRefs = useRef([]);
  const markerRefs = useRef([]);
  const state = useMemo(
    () => ({
      tracers: [],
      flashes: [],
      explosions: [],
      numbers: [],
      markers: [],
      particles: Object.fromEntries(Object.keys(PARTICLES).map((k) => [k, []])),
      o: new THREE.Object3D(),
    }),
    [],
  );

  useFrame((_, delta) => {
    const now = performance.now();
    const dt = Math.min(delta, 0.05);
    const spawn = spawner(state, quality.particles);

    for (const e of client.effects.splice(0)) {
      if (e.type === 'tracer') {
        if (state.tracers.length >= MAX_TRACERS) state.tracers.shift();
        const from = point(e.x, e.y);
        const ex = e.x + Math.cos(e.angle) * e.dist;
        const ey = e.y + Math.sin(e.angle) * e.dist;
        const to = point(ex, ey);
        const length = from.distanceTo(to);
        const dir = to.clone().sub(from).normalize();
        state.tracers.push({ from, dir, length, at: now, streak: e.weapon === SHOTGUN ? 1.2 : 2.6 });

        // Impacto: chispas si pegó en una pared, sangre si pegó en alguien
        const range = WEAPONS[WEAPON_IDS[e.weapon]]?.range ?? 30;
        if (e.dist < range - 0.05) {
          const wall = raycastObstacles(e.x, e.y, Math.cos(e.angle), Math.sin(e.angle), range) <= e.dist + 0.05;
          const kind = wall ? 'spark' : 'blood';
          spawn(kind, wall ? 5 : 4, () => ({
            pos: to.clone(),
            v: new THREE.Vector3(rand(-2, 2), rand(1, 3.5), rand(-2, 2)).addScaledVector(dir, wall ? -2 : 1.5),
            gravity: -9,
            born: now,
            life: wall ? 200 : 380,
          }));
        }
      } else if (e.type === 'muzzle') {
        if (state.flashes.length >= MAX_FLASHES) state.flashes.shift();
        state.flashes.push({ pos: point(e.x + Math.cos(e.angle) * 1.1, e.y + Math.sin(e.angle) * 1.1, 1.3), at: now });
        // Casquillo expulsado hacia la derecha del soldado
        if (quality.particles >= 0.5 && e.weapon !== undefined) {
          const right = new THREE.Vector3(Math.sin(e.angle), 0, Math.cos(e.angle));
          spawn(e.weapon === SHOTGUN ? 'shell' : 'casing', 1, () => ({
            pos: point(e.x + Math.cos(e.angle) * 0.4, e.y + Math.sin(e.angle) * 0.4, 1.35),
            v: right.clone().multiplyScalar(rand(2, 3)).add(new THREE.Vector3(0, rand(2, 3), 0)),
            gravity: -14,
            spin: rand(10, 20),
            born: now,
            life: 1500,
          }));
        }
      } else if (e.type === 'explosion') {
        if (state.explosions.length >= MAX_EXPLOSIONS) state.explosions.shift();
        state.explosions.push({ pos: point(e.x, e.y, 0.4), at: now });
        spawn('smoke', 8, () => ({
          pos: point(e.x + rand(-1.5, 1.5), e.y + rand(-1.5, 1.5), rand(0.3, 1)),
          v: new THREE.Vector3(rand(-0.4, 0.4), rand(0.8, 1.6), rand(-0.4, 0.4)),
          born: now,
          life: rand(1600, 2400),
        }));
        client.trauma = Math.min(1, client.trauma + 0.25);
      } else if (e.type === 'dust') {
        spawn('dust', 1, () => ({
          pos: point(e.x + rand(-0.2, 0.2), e.y + rand(-0.2, 0.2), 0.1),
          v: new THREE.Vector3(rand(-0.3, 0.3), 0.4, rand(-0.3, 0.3)),
          born: now,
          life: 600,
        }));
      } else if (e.type === 'damage') {
        if (state.numbers.length >= MAX_NUMBERS) state.numbers.shift();
        state.numbers.push({ pos: point(e.x, e.y, 2.4), at: now, text: String(e.amount), killed: e.killed });
        if (state.markers.length >= MAX_MARKERS) state.markers.shift();
        state.markers.push({ pos: point(e.x, e.y, 1.3), at: now, killed: e.killed });
      }
    }

    // Trazadoras: un trazo que viaja del cañón al impacto
    const { o } = state;
    state.tracers = state.tracers.filter((t) => ((now - t.at) / 1000) * TRACER_SPEED - t.streak < t.length);
    state.tracers.forEach((t, i) => {
      const head = Math.min(((now - t.at) / 1000) * TRACER_SPEED, t.length);
      const tail = Math.max(0, head - t.streak);
      o.position.copy(t.from).addScaledVector(t.dir, (head + tail) / 2);
      o.lookAt(o.position.clone().add(t.dir));
      o.scale.set(1, 1, Math.max(head - tail, 0.001));
      o.updateMatrix();
      tracerMesh.current.setMatrixAt(i, o.matrix);
    });
    tracerMesh.current.count = state.tracers.length;
    tracerMesh.current.instanceMatrix.needsUpdate = true;

    state.flashes = state.flashes.filter((f) => now - f.at < 70);
    state.flashes.forEach((f, i) => {
      o.position.copy(f.pos);
      o.rotation.set(0, (now - f.at) * 0.05, 0);
      o.scale.setScalar(1 + (now - f.at) / 70);
      o.updateMatrix();
      flashMesh.current.setMatrixAt(i, o.matrix);
    });
    flashMesh.current.count = state.flashes.length;
    flashMesh.current.instanceMatrix.needsUpdate = true;

    // Partículas
    for (const kind of Object.keys(PARTICLES)) {
      const mesh = particleMeshes.current[kind];
      const list = (state.particles[kind] = state.particles[kind].filter((p) => stepParticle(p, kind, now, dt)));
      list.forEach((p, i) => {
        o.position.copy(p.pos);
        if (kind === 'dust' || kind === 'smoke') {
          o.rotation.set(0, p.born, 0);
          o.scale.setScalar((0.6 + p.t * (kind === 'smoke' ? 2.4 : 1.2)) * (1 - p.t ** 3));
        } else {
          o.rotation.set(p.spin ? now * 0.001 * p.spin : 0, p.spin ? now * 0.0007 * p.spin : 0, 0);
          o.scale.setScalar(kind === 'spark' ? 1 - p.t : kind === 'blood' ? 1 - p.t * 0.6 : 1);
        }
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    }

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

    // Hit marker: una ✕ breve sobre el objetivo
    state.markers = state.markers.filter((m) => now - m.at < 220);
    markerRefs.current.forEach((sprite, i) => {
      const m = state.markers[i];
      sprite.visible = Boolean(m);
      if (!m) return;
      const t = (now - m.at) / 220;
      sprite.position.copy(m.pos);
      sprite.material.color.set(m.killed ? '#f87171' : '#ffffff');
      sprite.scale.setScalar(0.7 + t * 0.3);
      sprite.material.opacity = 1 - t;
    });
  });

  const marker = useMemo(() => textTexture('✕', { color: '#ffffff', size: 64 }), []);

  return (
    <group>
      <instancedMesh ref={tracerMesh} args={[tracerGeometry, tracerMaterial, MAX_TRACERS]} frustumCulled={false} />
      <instancedMesh ref={flashMesh} args={[flashGeometry, flashMaterial, MAX_FLASHES]} frustumCulled={false} />
      {Object.entries(PARTICLES).map(([kind, def]) => (
        <instancedMesh
          key={kind}
          ref={(m) => (particleMeshes.current[kind] = m)}
          args={[def.geometry, def.material, def.max]}
          frustumCulled={false}
        />
      ))}
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
      {Array.from({ length: MAX_MARKERS }, (_, i) => (
        <sprite key={i} ref={(s) => (markerRefs.current[i] = s)} visible={false} renderOrder={11}>
          <spriteMaterial map={marker.texture} transparent depthTest={false} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
