import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MAP_HALF } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { currentAim } from '../input/inputState.js';

// Clima de la partida. Cielo, niebla y luces por clima; partículas según la calidad.
// La niebla cuenta desde la cámara, que va a ~30 m del jugador: el "cerca" nunca baja de ahí.
export const WEATHER_LOOK = {
  despejado: { sky: '#a9bfcc', hemi: 1.2, sun: 2.1, sunColor: '#fff4dc', fog: null },
  lluvia: { sky: '#6d7a86', hemi: 0.85, sun: 0.85, sunColor: '#d6e0e8', fog: [35, 77] },
  niebla: { sky: '#c2c7c5', hemi: 1.05, sun: 0.7, sunColor: '#eef0f2', fog: [24, 41] },
  arena: { sky: '#c49c62', hemi: 0.95, sun: 1.1, sunColor: '#ffc978', fog: [24, 45] },
  noche: { sky: '#0b1322', hemi: 0.16, sun: 0.3, sunColor: '#9db4ff', fog: [37, 85] },
};

export const weatherLook = (weather) => WEATHER_LOOK[weather] ?? WEATHER_LOOK.despejado;

const AREA = 46; // lado del cuadro de partículas alrededor del jugador
const TOP = 20;

// Generador determinista: los charcos salen siempre en el mismo lugar
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const wrap = (v, center) => center + ((((v - center + AREA / 2) % AREA) + AREA) % AREA) - AREA / 2;

// Lluvia: segmentos que caen inclinados alrededor del jugador
function Rain({ frameRef, quality }) {
  const count = Math.round(1100 * quality.particles);
  const { geometry, drops } = useMemo(() => {
    const rand = Math.random;
    const drops = Array.from({ length: count }, () => [rand() * AREA - AREA / 2, rand() * TOP, rand() * AREA - AREA / 2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    return { geometry: g, drops };
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const focus = frameRef.current.me ?? frameRef.current.follow ?? { x: 0, y: 0 };
    const cx = focus.x;
    const cz = -focus.y;
    const arr = geometry.attributes.position.array;
    drops.forEach((d, i) => {
      d[1] -= 24 * dt;
      d[0] += 3 * dt;
      if (d[1] < 0) d[1] += TOP;
      const x = wrap(d[0], cx);
      const z = wrap(d[2], cz);
      arr.set([x, d[1], z, x - 0.12, d[1] + 0.9, z], i * 6);
    });
    geometry.attributes.position.needsUpdate = true;
  });
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#c9d6e2" transparent opacity={0.45} />
    </lineSegments>
  );
}

// Charcos que reflejan el cielo y el brillo del sol (una sola llamada de dibujo)
function Puddles() {
  const ref = useRef(null);
  const spots = useMemo(() => {
    const rand = seeded(7);
    const list = [];
    while (list.length < 110) {
      const x = (rand() * 2 - 1) * (MAP_HALF - 6);
      const y = (rand() * 2 - 1) * (MAP_HALF - 6);
      if (!overlapsObstacle(x, y, 2)) list.push({ x, y, s: 0.9 + rand() * 1.6, r: rand() * Math.PI });
    }
    return list;
  }, []);
  useEffect(() => {
    const o = new THREE.Object3D();
    spots.forEach((p, i) => {
      o.position.set(p.x, terrainHeight(p.x, p.y) + 0.04, -p.y);
      o.rotation.set(-Math.PI / 2, 0, p.r);
      o.scale.set(p.s * 1.5, p.s, 1);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} receiveShadow>
      <circleGeometry args={[1, 14]} />
      <meshPhongMaterial color="#3b4651" specular="#dce8f2" shininess={120} transparent opacity={0.8} polygonOffset polygonOffsetFactor={-2} />
    </instancedMesh>
  );
}

// Tormenta de arena: polvo que vuela con el viento
function Sand({ frameRef, quality, windAngle }) {
  const count = Math.round(1500 * quality.particles);
  const { geometry, grains } = useMemo(() => {
    const grains = Array.from({ length: count }, () => [Math.random() * AREA - AREA / 2, Math.random() * 6, Math.random() * AREA - AREA / 2, Math.random() * 6]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return { geometry: g, grains };
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = performance.now() / 1000;
    const focus = frameRef.current.me ?? frameRef.current.follow ?? { x: 0, y: 0 };
    const wx = Math.cos(windAngle) * 14;
    const wz = -Math.sin(windAngle) * 14;
    const arr = geometry.attributes.position.array;
    grains.forEach((g, i) => {
      g[0] += wx * dt;
      g[2] += wz * dt;
      const x = wrap(g[0], focus.x);
      const z = wrap(g[2], -focus.y);
      arr[i * 3] = x;
      arr[i * 3 + 1] = terrainHeight(x, -z) + g[1] + Math.sin(t * 2 + g[3]) * 0.4;
      arr[i * 3 + 2] = z;
    });
    geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#e2c08a" size={0.38} transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}

// Noche: linterna propia (luz real) y conos de linterna de todos (mallas aditivas).
// El fogonazo de cada disparo ilumina un instante: disparar te delata.
const coneGeometry = new THREE.ConeGeometry(2.6, 10, 16, 1, true).translate(0, -5, 0).rotateZ(Math.PI / 2);
const coneMaterial = new THREE.MeshBasicMaterial({
  color: '#fff3c4',
  transparent: true,
  opacity: 0.09,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});
const MAX_CONES = 40;

function Night({ client, frameRef, quality }) {
  const scene = useThree((s) => s.scene);
  const spot = useRef(null);
  const flash = useRef(null);
  const cones = useRef(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    const light = spot.current;
    scene.add(light.target);
    return () => scene.remove(light.target);
  }, [scene]);
  useFrame(() => {
    const now = performance.now();
    const { me, others, follow } = frameRef.current;
    const holder = follow ?? me;
    if (holder) {
      const aim = follow ? follow.aim : currentAim();
      const h = terrainHeight(holder.x, holder.y);
      spot.current.position.set(holder.x, h + 1.6, -holder.y);
      const tx = holder.x + Math.cos(aim) * 9;
      const ty = holder.y + Math.sin(aim) * 9;
      spot.current.target.position.set(tx, terrainHeight(tx, ty), -ty);
      spot.current.target.updateMatrixWorld();
    }
    spot.current.visible = Boolean(holder);

    // Conos de linterna de todos los vivos
    let n = 0;
    let lastShot = null;
    for (const [id, p] of others) {
      if (p.flags & PLAYER_FLAGS.DEAD || n >= MAX_CONES) continue;
      const pos = id === client.myId && me ? me : p;
      const aim = id === client.myId && me ? currentAim() : p.aim;
      o.position.set(pos.x + Math.cos(aim) * 0.4, terrainHeight(pos.x, pos.y) + 1.4, -pos.y - Math.sin(aim) * 0.4);
      o.rotation.set(0, aim, -0.12);
      o.updateMatrix();
      cones.current.setMatrixAt(n++, o.matrix);
      const shotAt = client.lastShot.get(id);
      if (shotAt && now - shotAt < 110 && (!lastShot || shotAt > lastShot.at)) lastShot = { at: shotAt, pos, aim };
    }
    cones.current.count = n;
    cones.current.instanceMatrix.needsUpdate = true;

    // Fogonazo: una sola luz puntual que salta al último disparo
    if (lastShot) {
      const { pos, aim } = lastShot;
      flash.current.position.set(pos.x + Math.cos(aim), terrainHeight(pos.x, pos.y) + 1.5, -pos.y - Math.sin(aim));
      flash.current.intensity = 60 * (1 - (now - lastShot.at) / 110);
    } else {
      flash.current.intensity = 0;
    }
  });
  return (
    <>
      <spotLight ref={spot} color="#fff1c9" intensity={quality.shadows ? 90 : 70} distance={30} decay={1.3} angle={0.42} penumbra={0.55} />
      <pointLight ref={flash} color="#ffd27a" intensity={0} distance={16} decay={1.4} />
      <instancedMesh ref={cones} args={[coneGeometry, coneMaterial, MAX_CONES]} frustumCulled={false} />
    </>
  );
}

export default function Weather({ weather, windAngle = 0, client, frameRef, quality }) {
  if (weather === 'lluvia') {
    return (
      <>
        <Rain frameRef={frameRef} quality={quality} />
        <Puddles />
      </>
    );
  }
  if (weather === 'arena') return <Sand frameRef={frameRef} quality={quality} windAngle={windAngle} />;
  if (weather === 'noche') return <Night client={client} frameRef={frameRef} quality={quality} />;
  return null;
}
