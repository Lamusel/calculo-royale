import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { vehicleType } from '@calculo-royale/shared/constants';
import { VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { VEHICLE_SPOTS } from '@calculo-royale/shared/mapLayout';
import { terrainGradient, terrainHeight, WATER_LEVEL } from '@calculo-royale/shared/terrain';
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

// --- Moto, camión con platón y lancha (fase 35): mismas piezas simples ---
const MOTO_WHEELS = [[0.75, 0], [-0.75, 0]];
const motoGeometry = merge([
  piece(box(1.3, 0.3, 0.32), '#7f1d1d', { position: [0, 0.75, 0] }),
  piece(box(0.55, 0.22, 0.3), '#1c1c1a', { position: [-0.25, 0.98, 0] }), // asiento largo (parrillero)
  piece(box(0.35, 0.3, 0.3), '#991b1b', { position: [0.45, 0.95, 0] }), // tanque
  limb([0.7, 0.6, 0], [0.55, 1.2, 0], 0.06, METAL),
  piece(box(0.06, 0.06, 0.7), METAL, { position: [0.55, 1.22, 0] }), // manubrio
  piece(box(0.1, 0.12, 0.16), '#fde68a', { position: [0.78, 1.08, 0] }),
]);
const TRUCK_WHEELS = [[1.6, 1.05], [1.6, -1.05], [-0.6, 1.05], [-0.6, -1.05], [-1.7, 1.05], [-1.7, -1.05]];
const truckGeometry = merge([
  piece(box(5.2, 0.4, 2.2), '#4b5320', { position: [0, 0.75, 0] }),
  piece(box(1.5, 1.4, 2.1), '#5b6530', { position: [1.75, 1.6, 0] }), // cabina
  piece(box(0.06, 0.6, 1.7), '#93c5fd', { position: [2.51, 1.9, 0] }), // parabrisas
  // Platón con barandas (los pasajeros van parados aquí)
  piece(box(3.4, 0.1, 2.2), '#3f4520', { position: [-0.9, 1.0, 0] }),
  piece(box(3.4, 0.5, 0.08), '#5b6530', { position: [-0.9, 1.3, 1.08] }),
  piece(box(3.4, 0.5, 0.08), '#5b6530', { position: [-0.9, 1.3, -1.08] }),
  piece(box(0.08, 0.5, 2.2), '#5b6530', { position: [-2.6, 1.3, 0] }),
  // Parlantes en el techo (la música lo delata)
  piece(box(0.4, 0.3, 0.5), '#111827', { position: [1.6, 2.45, 0.5] }),
  piece(box(0.4, 0.3, 0.5), '#111827', { position: [1.6, 2.45, -0.5] }),
]);
const boatGeometry = merge([
  piece(box(3.4, 0.5, 1.6), '#e5e7eb', { position: [0, 0.25, 0] }),
  piece(box(1.0, 0.45, 1.2), '#e5e7eb', { position: [1.9, 0.2, 0], rotation: [0, 0, 0.25] }), // proa
  piece(box(3.2, 0.12, 1.65), '#1d4ed8', { position: [0, 0.48, 0] }), // franja
  piece(box(0.6, 0.5, 0.9), '#374151', { position: [-0.4, 0.75, 0] }), // consola
  piece(box(0.4, 0.6, 0.4), '#111827', { position: [-1.85, 0.25, 0] }), // motor fuera de borda
]);
const MODELS = { jeep: { body: bodyGeometry, wheels: WHEELS }, moto: { body: motoGeometry, wheels: MOTO_WHEELS }, truck: { body: truckGeometry, wheels: TRUCK_WHEELS }, boat: { body: boatGeometry, wheels: [] } };

// Quemado: el mismo modelo, oscurecido
const wreckMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#3a3430' });

const UP = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();
const tilt = new THREE.Quaternion();
const yaw = new THREE.Quaternion();
const BAR_WIDTH = 1.8;

// Jeep quieto, sin barra de vida (referencia para ajustar skins sentadas en /skins)
export function JeepModel(props) {
  return (
    <group {...props}>
      <mesh geometry={bodyGeometry} material={modelMaterial} castShadow receiveShadow />
      {WHEELS.map(([x, z], i) => (
        <mesh key={i} geometry={wheelGeometry} material={modelMaterial} position={[x, WHEEL_R, z]} castShadow />
      ))}
    </group>
  );
}

function Jeep({ id, type, register }) {
  const model = MODELS[type] ?? MODELS.jeep;
  const refs = useRef({ wheels: [] }).current;
  const set = (key) => (node) => {
    refs[key] = node;
    register(id, refs);
  };
  return (
    <group ref={set('group')} visible={false}>
      <group ref={set('body')}>
        <mesh ref={set('mesh')} geometry={model.body} material={modelMaterial} castShadow receiveShadow />
        {model.wheels.map(([x, z], i) => (
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
      const T = vehicleType(v);
      // La lancha flota sobre el agua y no se inclina con el fondo
      a.group.position.set(pose.x, T.water ? WATER_LEVEL - 0.15 + Math.sin(now / 600 + id) * 0.05 : terrainHeight(pose.x, pose.y), -pose.y);
      const [fx, fy] = T.water ? [0, 0] : terrainGradient(pose.x, pose.y);
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
      if ((destroyed || v.hp < T.hp * 0.35) && now - a.st.smokeAt > (destroyed ? 260 : 180) / quality.particles) {
        a.st.smokeAt = now;
        client.effects.push({ type: 'dust', x: pose.x + (Math.random() - 0.5), y: pose.y + (Math.random() - 0.5) });
      }
      const ratio = Math.max(0, v.hp / T.hp);
      a.bg.visible = !destroyed && ratio < 1;
      a.hp.visible = a.bg.visible;
      a.hp.scale.x = Math.max(0.001, BAR_WIDTH * ratio);
    }
  });

  return VEHICLE_SPOTS.map((spot, id) => <Jeep key={id} id={id} type={spot.type} register={register} />);
}
