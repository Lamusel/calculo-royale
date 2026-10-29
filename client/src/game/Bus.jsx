import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEPLOY } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { box, cylinder, limb, merge, modelMaterial, piece } from './models/build.js';

// Bus de despliegue: intermunicipal colombiano amarillo y verde, colgado de un globo, con una
// hélice atrás. Mira hacia +x (su rumbo). Si existe /assets/bus/costado.png se pega en los
// costados; si no, quedan sus colores.

const YELLOW = '#f2c230';
const GREEN = '#1f8a4c';
const WHITE = '#f1ede2';
const GLASS = '#2a3d52';
const DARK = '#22252a';
const L = 7.2; // largo
const W = 2.4;
const BODY_Y = 1.6; // centro de la carrocería

const busGeometry = merge([
  // Carrocería: amarillo arriba, franja verde abajo, techo blanco
  piece(box(L, 1.7, W), YELLOW, { position: [0, BODY_Y + 0.25, 0] }),
  piece(box(L + 0.02, 0.6, W + 0.02), GREEN, { position: [0, BODY_Y - 0.75, 0] }),
  piece(box(L - 0.2, 0.14, W - 0.1), WHITE, { position: [0, BODY_Y + 1.16, 0] }),
  // Franja decorativa roja y azul (detalle colombiano)
  piece(box(L + 0.03, 0.08, W + 0.03), '#c8102e', { position: [0, BODY_Y - 0.4, 0] }),
  piece(box(L + 0.03, 0.06, W + 0.03), '#003893', { position: [0, BODY_Y - 0.32, 0] }),
  // Ventanas a los lados y parabrisas
  ...[-1, 1].flatMap((side) =>
    [-2.6, -1.5, -0.4, 0.7, 1.8].map((x) => piece(box(0.9, 0.6, 0.04), GLASS, { position: [x, BODY_Y + 0.45, side * (W / 2 + 0.01)] })),
  ),
  piece(box(0.05, 0.8, W - 0.3), GLASS, { position: [L / 2 + 0.01, BODY_Y + 0.4, 0] }),
  // Parrilla del techo con equipaje (bultos de colores)
  ...[-1, 1].map((side) => limb([-L / 2 + 0.4, BODY_Y + 1.45, side * 1.0], [L / 2 - 0.6, BODY_Y + 1.45, side * 1.0], 0.06, DARK)),
  piece(box(1.1, 0.5, 0.9), '#8a5a2b', { position: [-1.6, BODY_Y + 1.5, 0.3] }),
  piece(box(0.9, 0.45, 0.7), '#3c6e9e', { position: [-0.4, BODY_Y + 1.48, -0.4] }),
  piece(box(0.7, 0.6, 0.7), '#b0412e', { position: [0.8, BODY_Y + 1.53, 0.35] }),
  // Frente: parrilla, faroles y parachoques
  piece(box(0.06, 0.5, 1.6), DARK, { position: [L / 2 + 0.02, BODY_Y - 0.55, 0] }),
  ...[-1, 1].map((side) => piece(box(0.08, 0.22, 0.32), '#fff4c2', { position: [L / 2 + 0.03, BODY_Y - 0.35, side * 0.85] })),
  piece(box(0.25, 0.18, W + 0.1), DARK, { position: [L / 2 + 0.1, BODY_Y - 0.95, 0] }),
  // Ruedas
  ...[-1, 1].flatMap((side) =>
    [-2.3, 2.2].map((x) => piece(cylinder(0.5, 0.5, 0.35, 10), DARK, { position: [x, BODY_Y - 1.05, side * (W / 2 - 0.05)], rotation: [Math.PI / 2, 0, 0] })),
  ),
  // Globo con franjas y barquilla de cuerdas
  piece(new THREE.SphereGeometry(4.2, 16, 10), WHITE, { position: [0, 9.2, 0], scale: [1.9, 0.9, 0.9] }),
  ...[-0.55, 0, 0.55].map((z, i) => piece(cylinder(3.9, 3.9, 0.5, 16, true), [YELLOW, GREEN, YELLOW][i], { position: [z * 6, 9.2, 0], rotation: [0, 0, Math.PI / 2], scale: [0.9, 1, 0.9] })),
  ...[
    [-2.8, 1],
    [-2.8, -1],
    [2.6, 1],
    [2.6, -1],
  ].map(([x, s]) => limb([x, BODY_Y + 1.2, s * 1.0], [x * 1.4, 6.1, s * 1.6], 0.05, '#d8d2c0')),
  // Soporte de la hélice
  piece(cylinder(0.12, 0.12, 1.0, 6), DARK, { position: [-L / 2 - 0.45, BODY_Y + 0.3, 0], rotation: [0, 0, Math.PI / 2] }),
]);

// Temáticas (7A): calabaza en el techo y luces de colores que se encienden por turnos
const pumpkinGeometry = merge([
  piece(new THREE.IcosahedronGeometry(0.42, 1), '#e8731a', { position: [1.8, BODY_Y + 1.6, -0.3], scale: [1.2, 0.85, 1.2] }),
  piece(cylinder(0.05, 0.07, 0.2, 6), '#4b5a2a', { position: [1.8, BODY_Y + 2.0, -0.3] }),
]);
const BULB_COLORS = ['#ff3b3b', '#3bff6b', '#3b8bff', '#ffd83b', '#ff3bd8'];
const bulbGeometry = new THREE.IcosahedronGeometry(0.1, 0);
const BULBS = [-1, 1].flatMap((side) => Array.from({ length: 14 }, (_, i) => [-L / 2 + 0.3 + (i * (L - 0.6)) / 13, BODY_Y + 1.12, side * (W / 2 + 0.05)]));

const propellerGeometry = merge([0, 1, 2].map((i) => piece(box(0.12, 2.2, 0.35), DARK, { rotation: [(i / 3) * Math.PI * 2, 0, 0], position: [0, 0, 0] })));

// ¿Hay una imagen propia para los costados? Vite lo decide al compilar: si el archivo no existe no se
// pide nada (antes la consulta daba un 404 en la consola). Sin imagen, el bus queda con sus colores.
const SIDE_IMAGE = Object.keys(import.meta.glob('/public/assets/bus/costado.png')).length ? '/assets/bus/costado.png' : null;

function useSideTexture() {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    let alive = true;
    if (SIDE_IMAGE) {
      new THREE.TextureLoader().load(SIDE_IMAGE, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        if (alive) setTexture(t);
      });
    }
    return () => {
      alive = false;
    };
  }, []);
  return texture;
}

export default function Bus({ frameRef }) {
  const group = useRef(null);
  const propeller = useRef(null);
  const texture = useSideTexture();
  const sideMaterial = useMemo(() => texture && new THREE.MeshLambertMaterial({ map: texture, transparent: true }), [texture]);
  useFrame((_, delta) => {
    const bus = frameRef.current.bus;
    group.current.visible = Boolean(bus);
    if (!bus) return;
    const t = performance.now() / 1000;
    group.current.position.set(bus.x, terrainHeight(bus.x, bus.y) + DEPLOY.busAltitude - 2 + Math.sin(t * 0.9) * 0.3, -bus.y);
    group.current.rotation.set(Math.sin(t * 0.7) * 0.03, bus.heading, 0);
    propeller.current.rotation.x += Math.min(delta, 0.1) * (bus.waitMs > 0 ? 4 : 18);
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={busGeometry} material={modelMaterial} castShadow />
      <mesh geometry={pumpkinGeometry} material={modelMaterial} castShadow />
      <BusLights />
      <mesh ref={propeller} geometry={propellerGeometry} material={modelMaterial} position={[-L / 2 - 1.0, BODY_Y + 0.3, 0]} />
      {sideMaterial &&
        [-1, 1].map((side) => (
          <mesh key={side} material={sideMaterial} position={[0, BODY_Y + 0.1, side * (W / 2 + 0.03)]} rotation-y={side > 0 ? 0 : Math.PI}>
            <planeGeometry args={[L - 0.6, 1.2]} />
          </mesh>
        ))}
    </group>
  );
}

// Luces del bus: cambian de color por turnos (instanciadas)
function BusLights() {
  const ref = useRef(null);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const at = useRef(-1);
  useFrame(() => {
    const step = Math.floor(performance.now() / 400);
    if (step === at.current || !ref.current) return;
    const first = at.current < 0;
    at.current = step;
    const c = new THREE.Color();
    BULBS.forEach((p, i) => {
      if (first) {
        o.position.set(...p);
        o.updateMatrix();
        ref.current.setMatrixAt(i, o.matrix);
      }
      ref.current.setColorAt(i, c.set(BULB_COLORS[(i + step) % BULB_COLORS.length]));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[bulbGeometry, material, BULBS.length]} frustumCulled={false} />;
}
