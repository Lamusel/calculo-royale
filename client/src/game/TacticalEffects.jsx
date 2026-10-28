import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THROWABLES } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { wallPieces } from '@calculo-royale/shared/throwables';
import { modelMaterial } from './models/build.js';
import { weaponGeometry } from './models/weapons.js';

// Efectos de los lanzables (fase 29), desde el snapshot: [tipo, id, x, y, extra]
//   0 humo (cortina de bolas grises), 1 fuego del molotov (charco que titila), 2 sensor (con un
//   pulso que se expande), 3 granada muro (arco de espuma celeste, diseño propio).
const MAX = { smoke: 6 * 14, fire: 6, sensor: 6, wall: 6 * THROWABLES.wall.pieces };
const smokeMat = new THREE.MeshLambertMaterial({ color: '#c9cdd2', transparent: true, opacity: 0.82, depthWrite: false });
const fireMat = new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.75, depthWrite: false });
const pulseMat = new THREE.MeshBasicMaterial({ color: '#f87171', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
const wallMat = new THREE.MeshLambertMaterial({ color: '#7dd3fc', emissive: '#0c4a6e', emissiveIntensity: 0.35 });
const o3 = new THREE.Object3D();

export default function TacticalEffects({ frameRef }) {
  const smoke = useRef(null);
  const fire = useRef(null);
  const sensors = useRef(null);
  const pulses = useRef(null);
  const walls = useRef(null);
  const geo = useMemo(
    () => ({
      puff: new THREE.IcosahedronGeometry(1, 1),
      pool: new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2),
      ring: new THREE.RingGeometry(0.92, 1, 32).rotateX(-Math.PI / 2),
      foam: new THREE.CapsuleGeometry(0.62, 1.6, 3, 8),
    }),
    [],
  );

  useFrame(() => {
    const now = performance.now();
    const list = frameRef.current.effects ?? [];
    let s = 0;
    let f = 0;
    let n = 0;
    let w = 0;
    for (const [kind, id, x, y, extra] of list) {
      const ground = terrainHeight(x, y);
      if (kind === 0) {
        // 14 bolas por nube, que respiran un poco
        for (let k = 0; k < 14 && s < MAX.smoke; k++, s++) {
          const a = (k / 14) * Math.PI * 2 + id;
          const d = k % 3 === 0 ? 0.6 : (extra ?? 5) * 0.62;
          o3.position.set(x + Math.cos(a) * d, ground + 1.2 + (k % 4) * 0.5, -(y + Math.sin(a) * d));
          o3.scale.setScalar(1.8 + Math.sin(now / 900 + k) * 0.25);
          o3.rotation.set(0, 0, 0);
          o3.updateMatrix();
          smoke.current.setMatrixAt(s, o3.matrix);
        }
      } else if (kind === 1 && f < MAX.fire) {
        o3.position.set(x, ground + 0.08, -y);
        o3.scale.set(extra, 1, extra);
        o3.rotation.set(0, 0, 0);
        o3.updateMatrix();
        fire.current.setMatrixAt(f++, o3.matrix);
      } else if (kind === 2 && n < MAX.sensor) {
        o3.position.set(x, ground, -y);
        o3.scale.setScalar(1.4);
        o3.rotation.set(0, 0, 0);
        o3.updateMatrix();
        sensors.current.setMatrixAt(n, o3.matrix);
        // El pulso se abre hasta el radio del sensor cada segundo
        const t = (now % THROWABLES.sensor.pulseMs) / THROWABLES.sensor.pulseMs;
        o3.position.set(x, ground + 0.15, -y);
        o3.scale.setScalar(Math.max(0.1, t * THROWABLES.sensor.radius));
        o3.updateMatrix();
        pulses.current.setMatrixAt(n++, o3.matrix);
      } else if (kind === 3) {
        for (const c of wallPieces(x, y, extra)) {
          if (w >= MAX.wall) break;
          o3.position.set(c.x, terrainHeight(c.x, c.y) + 1.4, -c.y);
          o3.scale.set(1, 1, 1);
          o3.rotation.set(0, 0, 0);
          o3.updateMatrix();
          walls.current.setMatrixAt(w++, o3.matrix);
        }
      }
    }
    const finish = (ref, count) => {
      ref.current.count = count;
      ref.current.instanceMatrix.needsUpdate = true;
    };
    finish(smoke, s);
    finish(fire, f);
    finish(sensors, n);
    finish(pulses, n);
    finish(walls, w);
    fireMat.opacity = 0.6 + Math.sin(now / 80) * 0.15;
    pulseMat.opacity = 0.5 * (1 - (now % THROWABLES.sensor.pulseMs) / THROWABLES.sensor.pulseMs);
  });

  return (
    <>
      <instancedMesh ref={smoke} args={[geo.puff, smokeMat, MAX.smoke]} frustumCulled={false} />
      <instancedMesh ref={fire} args={[geo.pool, fireMat, MAX.fire]} frustumCulled={false} />
      <instancedMesh ref={sensors} args={[weaponGeometry('sensor'), modelMaterial, MAX.sensor]} frustumCulled={false} />
      <instancedMesh ref={pulses} args={[geo.ring, pulseMat, MAX.sensor]} frustumCulled={false} />
      <instancedMesh ref={walls} args={[geo.foam, wallMat, MAX.wall]} castShadow frustumCulled={false} />
    </>
  );
}
