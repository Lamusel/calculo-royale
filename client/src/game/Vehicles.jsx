import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { JEEP } from '@calculo-royale/shared/constants';
import { VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { VEHICLE_SPOTS } from '@calculo-royale/shared/mapLayout';
import { terrainGradient, terrainHeight } from '@calculo-royale/shared/terrain';
import { box, cylinder, limb, merge, modelMaterial, piece } from './models/build.js';

// Jeep militar procedural: carrocería en una sola geometría + 4 ruedas que giran.
// Mira hacia +x (su heading); en Three.js el eje y del mapa es −z.

const OLIVE = '#56602f';
const OLIVE_DARK = '#3e4622';
const METAL = '#2b2d2a';
const SEAT = '#4a3a26';
const WHEEL_R = 0.42;
const WHEELS = [
  [1.0, 0.82],
  [1.0, -0.82],
  [-1.0, 0.82],
  [-1.0, -0.82],
];

const bodyGeometry = merge([
  piece(box(3.0, 0.45, 1.5), OLIVE, { position: [0, 0.68, 0] }),
  // Capó y parrilla
  piece(box(1.05, 0.28, 1.46), OLIVE, { position: [1.0, 1.04, 0] }),
  piece(box(0.06, 0.5, 1.2), METAL, { position: [1.52, 0.86, 0] }),
  piece(box(0.07, 0.12, 0.2), '#fde68a', { position: [1.53, 1.0, 0.5] }),
  piece(box(0.07, 0.12, 0.2), '#fde68a', { position: [1.53, 1.0, -0.5] }),
  // Estrella blanca en el capó
  piece(cylinder(0.3, 0.3, 0.02, 5), '#e7e5d8', { position: [1.0, 1.19, 0] }),
  // Guardabarros
  ...WHEELS.map(([x, z]) => piece(box(0.95, 0.08, 0.36), OLIVE_DARK, { position: [x, 0.95, z * 1.02] })),
  // Laterales bajos de la cabina y puerta trasera
  piece(box(1.9, 0.32, 0.08), OLIVE, { position: [-0.5, 1.05, 0.72] }),
  piece(box(1.9, 0.32, 0.08), OLIVE, { position: [-0.5, 1.05, -0.72] }),
  piece(box(0.08, 0.32, 1.5), OLIVE, { position: [-1.46, 1.05, 0] }),
  // Asientos (conductor adelante a la izquierda: z −0.45; pasajero atrás a la derecha: z +0.35)
  piece(box(0.5, 0.18, 0.5), SEAT, { position: [0.1, 1.0, -0.45] }),
  piece(box(0.1, 0.5, 0.5), SEAT, { position: [-0.18, 1.2, -0.45] }),
  piece(box(0.5, 0.18, 0.5), SEAT, { position: [-0.8, 1.0, 0.35] }),
  piece(box(0.1, 0.5, 0.5), SEAT, { position: [-1.08, 1.2, 0.35] }),
  // Volante
  limb([0.55, 1.0, -0.45], [0.42, 1.35, -0.45], 0.05, METAL),
  piece(cylinder(0.17, 0.17, 0.04, 10, true), METAL, { position: [0.42, 1.37, -0.45], rotation: [0, 0, 1.1] }),
  // Marco del parabrisas y barra antivuelco
  limb([0.55, 1.18, 0.72], [0.5, 1.75, 0.72], 0.06, OLIVE_DARK),
  limb([0.55, 1.18, -0.72], [0.5, 1.75, -0.72], 0.06, OLIVE_DARK),
  limb([0.5, 1.75, 0.72], [0.5, 1.75, -0.72], 0.06, OLIVE_DARK),
  limb([-1.25, 1.2, 0.72], [-1.25, 1.85, 0.72], 0.07, METAL),
  limb([-1.25, 1.2, -0.72], [-1.25, 1.85, -0.72], 0.07, METAL),
  limb([-1.25, 1.85, 0.72], [-1.25, 1.85, -0.72], 0.07, METAL),
  // Llanta de repuesto y bidones
  piece(cylinder(0.36, 0.36, 0.2, 10), METAL, { position: [-1.6, 1.0, 0], rotation: [0, 0, Math.PI / 2] }),
  piece(box(0.3, 0.42, 0.2), OLIVE_DARK, { position: [-1.25, 1.05, 0.95] }),
]);

const wheelGeometry = merge([
  piece(cylinder(WHEEL_R, WHEEL_R, 0.32, 10), '#1c1c1a', { rotation: [Math.PI / 2, 0, 0] }),
  piece(cylinder(0.2, 0.2, 0.34, 6), '#6b6f5a', { rotation: [Math.PI / 2, 0, 0] }),
]);

// Quemado: el mismo modelo, oscurecido
const wreckMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#3a3430' });

const UP = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();
const tilt = new THREE.Quaternion();
const yaw = new THREE.Quaternion();
const BAR_WIDTH = 1.8;

function Jeep({ id, register }) {
  const refs = useRef({ wheels: [] }).current;
  const set = (key) => (node) => {
    refs[key] = node;
    register(id, refs);
  };
  return (
    <group ref={set('group')} visible={false}>
      <group ref={set('body')}>
        <mesh ref={set('mesh')} geometry={bodyGeometry} material={modelMaterial} castShadow receiveShadow />
        {WHEELS.map(([x, z], i) => (
          <mesh key={i} ref={(m) => (refs.wheels[i] = m)} geometry={wheelGeometry} material={modelMaterial} position={[x, WHEEL_R, z]} castShadow />
        ))}
      </group>
      <sprite ref={set('bg')} position={[-BAR_WIDTH / 2, 2.4, 0]} scale={[BAR_WIDTH, 0.14, 1]} center={[0, 0.5]} renderOrder={1}>
        <spriteMaterial color="#111827" depthWrite={false} />
      </sprite>
      <sprite ref={set('hp')} position={[-BAR_WIDTH / 2, 2.4, 0]} scale={[BAR_WIDTH, 0.14, 1]} center={[0, 0.5]} renderOrder={2}>
        <spriteMaterial color="#f59e0b" depthWrite={false} />
      </sprite>
    </group>
  );
}

export default function Vehicles({ client, frameRef, quality }) {
  const jeeps = useRef(new Map());
  const register = useMemo(() => (id, refs) => jeeps.current.set(id, refs), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const now = performance.now();
    const { vehicles, me, myVehicleId, mySeat } = frameRef.current;
    for (const [id, a] of jeeps.current) {
      if (!a.group || !a.hp) continue;
      // El jeep que manejo se dibuja con la predicción; el resto, interpolado
      const v = vehicles?.get(id);
      const pose = mySeat === 'driver' && myVehicleId === id && me?.jeep ? me.jeep : v;
      if (!v || !pose) {
        a.group.visible = false;
        continue;
      }
      a.group.visible = true;
      a.group.position.set(pose.x, terrainHeight(pose.x, pose.y), -pose.y);
      const [fx, fy] = terrainGradient(pose.x, pose.y);
      tilt.setFromUnitVectors(UP, normal.set(-fx, 1, fy).normalize());
      yaw.setFromAxisAngle(UP, pose.heading);
      a.body.quaternion.multiplyQuaternions(tilt, yaw);

      const destroyed = v.state === VEHICLE_STATE.DESTROYED;
      a.mesh.material = destroyed ? wreckMaterial : modelMaterial;
      a.st ??= { spin: 0, smokeAt: 0 };
      a.st.spin -= ((pose.speed ?? 0) * dt) / WHEEL_R;
      for (const w of a.wheels) {
        w.rotation.z = a.st.spin;
        w.material = a.mesh.material;
      }
      // Humo si está dañado o quemado
      if ((destroyed || v.hp < JEEP.hp * 0.35) && now - a.st.smokeAt > (destroyed ? 260 : 180) / quality.particles) {
        a.st.smokeAt = now;
        client.effects.push({ type: 'dust', x: pose.x + (Math.random() - 0.5), y: pose.y + (Math.random() - 0.5) });
      }
      const ratio = Math.max(0, v.hp / JEEP.hp);
      a.bg.visible = !destroyed && ratio < 1;
      a.hp.visible = a.bg.visible;
      a.hp.scale.x = Math.max(0.001, BAR_WIDTH * ratio);
    }
  });

  return VEHICLE_SPOTS.map((_, id) => <Jeep key={id} id={id} register={register} />);
}
