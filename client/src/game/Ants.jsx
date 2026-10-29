import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { limb, merge, modelMaterial, piece } from './models/build.js';
import { sound } from '../audio/sound.js';

// Hormigas culonas (7A): modelo procedural (abdomen grande y rojizo, tórax, cabeza, patas y antenas),
// brillan un poco y suenan al acercarse. Las posiciones las manda el servidor (client.ants).
const MAX = 20;
const RED = '#8a1f12';
const DARK = '#3b0d08';
const antGeometry = merge([
  piece(new THREE.IcosahedronGeometry(0.17, 1), RED, { position: [-0.18, 0.16, 0], scale: [1.25, 1, 1.05] }), // culo
  piece(new THREE.IcosahedronGeometry(0.07, 0), DARK, { position: [0, 0.13, 0] }),
  piece(new THREE.IcosahedronGeometry(0.075, 0), DARK, { position: [0.1, 0.15, 0] }),
  ...[-0.05, 0.02, 0.08].flatMap((x) => [-1, 1].map((s) => limb([x, 0.12, 0.03 * s], [x + 0.04, 0.02, 0.15 * s], 0.012, DARK))),
  ...[-1, 1].map((s) => limb([0.15, 0.18, 0.02 * s], [0.25, 0.27, 0.07 * s], 0.008, DARK)),
]);
const glowGeometry = new THREE.RingGeometry(0.25, 0.5, 18).rotateX(-Math.PI / 2);
const HEARD_MS = 20_000;

export default function Ants({ client }) {
  const ants = useRef(null);
  const glows = useRef(null);
  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const o = useMemo(() => new THREE.Object3D(), []);
  const heard = useMemo(() => new Map(), []);

  useFrame(({ camera }) => {
    const now = performance.now();
    const list = client.ants ?? [];
    const me = client.predictor?.state;
    glowMaterial.opacity = 0.35 + 0.25 * Math.sin(now / 350);
    let n = 0;
    for (const [id, x, y, z] of list) {
      if (n >= MAX) break;
      // Lejos de la cámara no se dibujan
      if (Math.abs(x - camera.position.x) > 160 || Math.abs(-y - camera.position.z) > 160) continue;
      const h = terrainHeight(x, y) + z;
      o.position.set(x, h + Math.abs(Math.sin(now / 400 + id)) * 0.04, -y);
      o.rotation.set(0, id * 1.7 + Math.sin(now / 900 + id) * 0.4, 0);
      o.scale.setScalar(1.6);
      o.updateMatrix();
      ants.current.setMatrixAt(n, o.matrix);
      o.position.y = h + 0.03;
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(1);
      o.updateMatrix();
      glows.current.setMatrixAt(n, o.matrix);
      n++;
      // Suena al acercarse (una vez cada 20 s por hormiga)
      if (me && Math.hypot(me.x - x, me.y - y) < 10 && now - (heard.get(id) ?? -1e9) > HEARD_MS) {
        heard.set(id, now);
        sound.ant(x, y);
      }
    }
    ants.current.count = n;
    glows.current.count = n;
    ants.current.instanceMatrix.needsUpdate = true;
    glows.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={ants} args={[antGeometry, modelMaterial, MAX]} castShadow frustumCulled={false} />
      <instancedMesh ref={glows} args={[glowGeometry, glowMaterial, MAX]} frustumCulled={false} renderOrder={1} />
    </>
  );
}
