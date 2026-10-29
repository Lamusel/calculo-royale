import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { HOUSES, WALL_HEIGHT } from '@calculo-royale/shared/mapLayout';
import { AREAS, waterAt } from '@calculo-royale/shared/mapPlan';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { CHRISTMAS_AREAS, HALLOWEEN_AREAS, seeded } from './holidays.js';
import { cylinder, merge, modelMaterial, piece } from './models/build.js';

// Decoración de Halloween y Navidad (7A), procedural y liviana: todo instanciado y, con calidad baja,
// la mitad. Halloween: calabazas con luz, lápidas, telarañas, velas, murciélagos y cuervos y niebla
// anaranjada. Navidad: luces de colores en casas y calles, árboles navideños y nieve (la escarcha de
// los techos la pone Buildings.jsx tiñendo su material).

// --- Modelos ---
const pumpkin = merge([
  piece(new THREE.IcosahedronGeometry(0.45, 1), '#e8731a', { position: [0, 0.38, 0], scale: [1.2, 0.85, 1.2] }),
  piece(cylinder(0.05, 0.07, 0.22, 6), '#4b5a2a', { position: [0, 0.8, 0] }),
]);
// La cara tallada brilla (material sin sombras)
const pumpkinFace = merge([
  piece(new THREE.BoxGeometry(0.03, 0.1, 0.1), '#ffd36b', { position: [0.53, 0.45, 0.14], rotation: [0, 0, 0] }),
  piece(new THREE.BoxGeometry(0.03, 0.1, 0.1), '#ffd36b', { position: [0.53, 0.45, -0.14] }),
  piece(new THREE.BoxGeometry(0.03, 0.07, 0.34), '#ffd36b', { position: [0.53, 0.26, 0] }),
]);
const tomb = merge([
  piece(new THREE.BoxGeometry(0.18, 0.75, 0.6), '#8a8d8f', { position: [0, 0.37, 0] }),
  piece(cylinder(0.3, 0.3, 0.18, 10), '#8a8d8f', { position: [0, 0.75, 0], rotation: [0, 0, Math.PI / 2] }),
]);
const candle = merge([piece(cylinder(0.05, 0.05, 0.22, 6), '#efe6cf', { position: [0, 0.11, 0] })]);
const flame = new THREE.ConeGeometry(0.035, 0.09, 5).translate(0, 0.27, 0);
const web = new THREE.CircleGeometry(0.9, 6);
const bat = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.5, 0.15, 0.3), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.12), new THREE.Vector3(0.5, 0.15, 0.3)]);
const xmasTree = merge([
  piece(cylinder(0.15, 0.2, 0.6, 6), '#5a3d22', { position: [0, 0.3, 0] }),
  piece(new THREE.ConeGeometry(1.4, 1.8, 8), '#1f6b32', { position: [0, 1.4, 0] }),
  piece(new THREE.ConeGeometry(1.05, 1.5, 8), '#24803a', { position: [0, 2.3, 0] }),
  piece(new THREE.ConeGeometry(0.7, 1.2, 8), '#2a9444', { position: [0, 3.05, 0] }),
  piece(new THREE.OctahedronGeometry(0.22, 0), '#f5d142', { position: [0, 3.8, 0] }),
  ...[[0.9, 1.1, 0.4, '#d62828'], [-0.7, 1.5, -0.5, '#2563eb'], [0.5, 2.2, -0.6, '#f5d142'], [-0.45, 2.6, 0.5, '#d62828'], [0.3, 3.0, 0.35, '#2563eb']].map(([x, y, z, c]) => piece(new THREE.IcosahedronGeometry(0.11, 0), c, { position: [x, y, z] })),
]);
const bulb = new THREE.IcosahedronGeometry(0.09, 0);
const BULB_COLORS = ['#ff3b3b', '#3bff6b', '#3b8bff', '#ffd83b', '#ff3bd8'];

const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

// Puntos libres dentro de una zona (sin agua ni obstáculos)
function scatter(ids, perArea, seed, margin = 0.42) {
  const rand = seeded(seed);
  const out = [];
  for (const id of ids) {
    const a = AREAS[id];
    let tries = 0;
    let n = 0;
    while (n < perArea && tries++ < perArea * 12) {
      const x = a.x + (rand() * 2 - 1) * a.w * margin;
      const y = a.y + (rand() * 2 - 1) * a.h * margin;
      if (waterAt(x, y) || overlapsObstacle(x, y, 0.9)) continue;
      out.push({ x, y, r: rand() * Math.PI * 2, area: id });
      n++;
    }
  }
  return out;
}
const housesIn = (ids) => HOUSES.filter((h) => ids.some((id) => Math.abs(h.x - AREAS[id].x) < AREAS[id].w / 2 + 10 && Math.abs(h.y - AREAS[id].y) < AREAS[id].h / 2 + 10));

// Un InstancedMesh fijo a partir de una lista de matrices
function Fixed({ geometry, material, items, place, castShadow = false }) {
  const ref = useRef(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    items.forEach((it, i) => {
      place(it, o);
      o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
      if (it.color) ref.current.setColorAt(i, new THREE.Color(it.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, place, o]);
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, items.length)]} castShadow={castShadow} />;
}

const onGround = (lift = 0, scale = 1) => (it, o) => {
  o.position.set(it.x, terrainHeight(it.x, it.y) + lift, -it.y);
  o.rotation.set(0, it.r ?? 0, 0);
  o.scale.setScalar(it.s ?? scale);
};

export default function Holidays({ quality }) {
  const k = quality.particles >= 0.7 ? 1 : 0.5; // calidad baja: la mitad
  const deco = useMemo(() => {
    const pumpkins = scatter(HALLOWEEN_AREAS, Math.round(12 * k), 11);
    const tombs = [...scatter(['cemetery'], Math.round(18 * k), 23), ...scatter(['forest', 'farm'], Math.round(4 * k), 29)];
    const candles = scatter(HALLOWEEN_AREAS, Math.round(10 * k), 31).map((c) => ({ ...c, s: 1 }));
    const hHouses = housesIn(HALLOWEEN_AREAS);
    const webs = hHouses.flatMap((h) => [{ x: h.x + h.w / 2 - 0.05, y: h.y + h.h / 2 - 0.6, z: WALL_HEIGHT - 0.9, r: Math.PI / 2 }, { x: h.x - h.w / 2 + 0.6, y: h.y - h.h / 2 + 0.05, z: WALL_HEIGHT - 0.9, r: 0 }]);
    const fog = HALLOWEEN_AREAS.flatMap((id) => scatter([id], Math.round(5 * k), 41 + id.length, 0.5));
    const trees = scatter(CHRISTMAS_AREAS, Math.round(4 * k), 53);
    const cHouses = housesIn(CHRISTMAS_AREAS);
    // Luces de colores sobre el borde del techo de cada casa
    const bulbs = cHouses.flatMap((h, hi) => {
      const top = WALL_HEIGHT * (h.floors ?? 1) + 0.05;
      const step = k === 1 ? 1.2 : 2.4;
      const out = [];
      for (let t = 0; t < h.w; t += step) out.push({ x: h.x - h.w / 2 + t, y: h.y - h.h / 2, z: top, color: BULB_COLORS[(out.length + hi) % 5] });
      for (let t = 0; t < h.w; t += step) out.push({ x: h.x - h.w / 2 + t, y: h.y + h.h / 2, z: top, color: BULB_COLORS[(out.length + hi) % 5] });
      return out;
    });
    // Guirnaldas en las calles: postes de luces repartidos por la zona
    const street = scatter(CHRISTMAS_AREAS, Math.round(10 * k), 61).flatMap((p, i) => [0, 1, 2, 3].map((j) => ({ x: p.x + Math.cos(p.r) * j * 0.6, y: p.y + Math.sin(p.r) * j * 0.6, z: 3 + Math.sin(j) * 0.2, color: BULB_COLORS[(i + j) % 5] })));
    return { pumpkins, tombs, candles, webs, fog, trees, bulbs: [...bulbs, ...street] };
  }, [k]);

  const mats = useMemo(
    () => ({
      face: basic('#ffc24a'),
      flame: basic('#ffd36b'),
      web: basic('#f5f5f5', { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
      bat: basic('#111111', { side: THREE.DoubleSide }),
      bulb: new THREE.MeshBasicMaterial({ toneMapped: false }),
      fog: new THREE.SpriteMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.1, depthWrite: false }),
      snow: new THREE.PointsMaterial({ color: '#ffffff', size: 0.18, transparent: true, opacity: 0.9, depthWrite: false }),
    }),
    [],
  );

  // Murciélagos y cuervos volando en círculos sobre las zonas de Halloween
  const flyers = useMemo(() => HALLOWEEN_AREAS.flatMap((id, i) => Array.from({ length: Math.round(4 * k) }, (_, j) => ({ id, phase: i * 1.7 + j * 2.1, radius: 12 + j * 5, h: 9 + (j % 3) * 3, crow: j % 2 === 1 }))), [k]);
  const flyRef = useRef(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  // Nieve: puntos que caen solo sobre las zonas de Navidad
  const snow = useMemo(() => {
    const per = Math.round(500 * k);
    const pos = new Float32Array(CHRISTMAS_AREAS.length * per * 3);
    const rand = seeded(77);
    CHRISTMAS_AREAS.forEach((id, ai) => {
      const a = AREAS[id];
      for (let i = 0; i < per; i++) {
        const j = (ai * per + i) * 3;
        pos[j] = a.x + (rand() - 0.5) * a.w;
        pos[j + 1] = rand() * 22;
        pos[j + 2] = -(a.y + (rand() - 0.5) * a.h);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [k]);
  const blinkAt = useRef(0);
  const bulbRef = useRef(null);

  useFrame(({ camera }, delta) => {
    const now = performance.now();
    flyers.forEach((f, i) => {
      const a = AREAS[f.id];
      const t = now / 3000 + f.phase;
      o.position.set(a.x + Math.cos(t) * f.radius, terrainHeight(a.x, a.y) + f.h + Math.sin(t * 3) * 0.6, -(a.y + Math.sin(t) * f.radius));
      o.rotation.set(0, -t, 0);
      o.scale.set(f.crow ? 1.2 : 0.8, 1 + Math.sin(now / (f.crow ? 160 : 70) + i) * 0.8, f.crow ? 1.2 : 0.8);
      o.updateMatrix();
      flyRef.current.setMatrixAt(i, o.matrix);
    });
    flyRef.current.instanceMatrix.needsUpdate = true;
    // Nieve que cae (y vuelve arriba); solo se mueve si la cámara está cerca de alguna zona
    const near = CHRISTMAS_AREAS.some((id) => Math.hypot(AREAS[id].x - camera.position.x, AREAS[id].y + camera.position.z) < 260);
    if (near) {
      const p = snow.attributes.position.array;
      for (let i = 1; i < p.length; i += 3) {
        p[i] -= delta * 1.6;
        if (p[i] < 0) p[i] += 22;
      }
      snow.attributes.position.needsUpdate = true;
    }
    // Las luces parpadean cambiando de color cada medio segundo
    if (now - blinkAt.current > 500 && bulbRef.current?.instanceColor) {
      blinkAt.current = now;
      const c = new THREE.Color();
      const shift = Math.floor(now / 500);
      deco.bulbs.forEach((_, i) => bulbRef.current.setColorAt(i, c.set(BULB_COLORS[(i + shift) % 5])));
      bulbRef.current.instanceColor.needsUpdate = true;
    }
  });

  const atZ = (it, ob) => {
    ob.position.set(it.x, terrainHeight(it.x, it.y) + it.z, -it.y);
    ob.rotation.set(0, it.r ?? 0, 0);
    ob.scale.setScalar(1);
  };
  return (
    <group>
      {/* Halloween */}
      <Fixed geometry={pumpkin} material={modelMaterial} items={deco.pumpkins} place={onGround()} castShadow />
      <Fixed geometry={pumpkinFace} material={mats.face} items={deco.pumpkins} place={onGround()} />
      <Fixed geometry={tomb} material={modelMaterial} items={deco.tombs} place={onGround(-0.05)} castShadow />
      <Fixed geometry={candle} material={modelMaterial} items={deco.candles} place={onGround()} />
      <Fixed geometry={flame} material={mats.flame} items={deco.candles} place={onGround()} />
      <Fixed geometry={web} material={mats.web} items={deco.webs} place={(it, ob) => {
        atZ(it, ob);
        ob.rotation.set(0, it.r, 0);
      }} />
      <instancedMesh ref={flyRef} args={[bat, mats.bat, Math.max(1, flyers.length)]} frustumCulled={false} />
      {deco.fog.map((f, i) => (
        <sprite key={i} material={mats.fog} position={[f.x, terrainHeight(f.x, f.y) + 1.6, -f.y]} scale={[16, 5, 1]} />
      ))}
      {/* Navidad */}
      <Fixed geometry={xmasTree} material={modelMaterial} items={deco.trees} place={onGround()} castShadow />
      <instancedMesh
        ref={(m) => {
          bulbRef.current = m;
          if (m && !m.userData.placed) {
            m.userData.placed = true;
            deco.bulbs.forEach((b, i) => {
              atZ(b, o);
              o.updateMatrix();
              m.setMatrixAt(i, o.matrix);
              m.setColorAt(i, new THREE.Color(b.color));
            });
            m.instanceMatrix.needsUpdate = true;
            m.computeBoundingSphere();
          }
        }}
        args={[bulb, mats.bulb, Math.max(1, deco.bulbs.length)]}
      />
      <points geometry={snow} material={mats.snow} frustumCulled={false} />
    </group>
  );
}
