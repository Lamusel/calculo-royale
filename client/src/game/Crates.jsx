import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AIRDROP, RARITIES } from '@calculo-royale/shared/constants';
import { CRATE_STATE } from '@calculo-royale/shared/protocol';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { CRATES, cratePosition } from './crateList.js';
import { box, merge, modelMaterial, piece } from './models/build.js';
import { parachuteGeometry } from './models/parachute.js';

// Cajas de suministro militares: franja del color de la rareza y candado al frente.
// Abierta: tapa levantada. Bloqueada: luz roja intermitente. Alguien respondiendo: luz amarilla.
// Las alarmas (fallos recientes) se ven como una columna roja visible desde lejos.

const W = 1.3;
const H = 0.85;
const D = 0.85;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const MAX_ALARMS = 6;

const bodyGeometry = (rarity) => {
  const stripe = RARITIES[rarity].color;
  const trim = rarity === 3 ? '#b8912a' : '#33401f';
  return merge([
    piece(box(W, H, D), '#4b5a2e', { position: [0, H / 2, 0] }),
    piece(box(W + 0.04, 0.16, D + 0.04), stripe, { position: [0, H * 0.55, 0] }),
    ...[-1, 1].flatMap((s) => [
      piece(box(0.08, H + 0.02, D + 0.04), trim, { position: [(s * W) / 2, H / 2, 0] }),
      piece(box(W + 0.04, 0.06, 0.08), trim, { position: [0, 0.03, (s * D) / 2] }),
    ]),
    // Candado al frente (hacia la cámara)
    piece(box(0.2, 0.22, 0.08), '#2b2d30', { position: [0, H * 0.55, D / 2 + 0.06] }),
    piece(box(0.12, 0.12, 0.04), '#5b5f63', { position: [0, H * 0.55 + 0.15, D / 2 + 0.06] }),
  ]);
};
const lidGeometry = merge([
  piece(box(W + 0.06, 0.12, D + 0.06), '#43512a', { position: [0, 0.06, D / 2 + 0.03] }),
  piece(box(W * 0.6, 0.04, 0.3), '#33401f', { position: [0, 0.13, D / 2] }),
]);
const lightGeometry = new THREE.SphereGeometry(0.12, 8, 6);
const lightMaterial = new THREE.MeshBasicMaterial({ toneMapped: false });
const beamGeometry = new THREE.CylinderGeometry(0.5, 0.7, 14, 12, 1, true);
const ringGeometry = new THREE.RingGeometry(1.1, 1.5, 32).rotateX(-Math.PI / 2);
const FALL_HEIGHT = 40;

// Paracaídas del lanzamiento aéreo (el mismo modelo del despliegue y la reanimación)
const cratechute = parachuteGeometry({ hook: H });

const glowGeometry = new THREE.RingGeometry(0.7, 1.15, 24).rotateX(-Math.PI / 2);

export default function Crates({ frameRef }) {
  const bodies = useRef([]);
  const lids = useRef(null);
  const lights = useRef(null);
  const beams = useRef([]);
  const glows = useRef(null);
  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }), []);
  const geometries = useMemo(() => RARITIES.map((_, i) => bodyGeometry(i)), []);
  const byRarity = useMemo(() => RARITIES.map((_, r) => CRATES.map((c, i) => ({ c, i })).filter(({ c }) => c.rarity === r)), []);
  const falling = useRef(null);
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), color: new THREE.Color(), lid: new Map() }), []);

  // El color por instancia de las luces debe existir antes del primer dibujo
  useLayoutEffect(() => {
    for (let i = 0; i < CRATES.length; i++) {
      lights.current.setColorAt(i, tmp.color.set('#000000'));
      glows.current.setColorAt(i, tmp.color.set(RARITIES[CRATES[i].rarity].color));
    }
  }, [tmp]);

  useFrame(({ camera }, delta) => {
    const now = performance.now();
    const states = frameRef.current.crates ?? [];
    // Mapa de 1 km: las cajas lejos de la cámara no se dibujan (la niebla igual las taparía)
    const reach = 170 + camera.position.y;
    const far = (c) => Math.abs(c.x - camera.position.x) > reach || Math.abs(c.y + camera.position.z) > reach;
    const airdrop = frameRef.current.airdrop;
    const { o, color } = tmp;

    // Caja aérea cayendo: baja desde FALL_HEIGHT con el paracaídas abierto
    const inAir = airdrop?.length && airdrop[2] > 0;
    falling.current.visible = Boolean(inAir);
    if (inAir) {
      const t = Math.min(1, airdrop[2] / AIRDROP.fallMs);
      falling.current.position.set(airdrop[0], terrainHeight(airdrop[0], airdrop[1]) + FALL_HEIGHT * t, -airdrop[1]);
      falling.current.rotation.set(Math.sin(now / 700) * 0.06, now / 4000, Math.cos(now / 900) * 0.06);
    }

    byRarity.forEach((list, r) => {
      list.forEach(({ i }, k) => {
        const state = states[i] === undefined ? CRATE_STATE.HIDDEN : +states[i];
        const c = cratePosition(i, airdrop);
        if (state === CRATE_STATE.HIDDEN || !c || far(c)) {
          bodies.current[r].setMatrixAt(k, HIDDEN);
          return;
        }
        o.position.set(c.x, terrainHeight(c.x, c.y) - 0.05, -c.y);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        bodies.current[r].setMatrixAt(k, o.matrix);
      });
      bodies.current[r].instanceMatrix.needsUpdate = true;
    });

    CRATES.forEach((_, i) => {
      const state = states[i] === undefined ? CRATE_STATE.HIDDEN : +states[i];
      const c = cratePosition(i, airdrop);
      if (state === CRATE_STATE.HIDDEN || !c || far(c)) {
        lids.current.setMatrixAt(i, HIDDEN);
        lights.current.setMatrixAt(i, HIDDEN);
        glows.current.setMatrixAt(i, HIDDEN);
        return;
      }
      const h = terrainHeight(c.x, c.y) - 0.05;
      // La tapa gira sobre la bisagra trasera
      const goal = state === CRATE_STATE.OPEN ? -1.9 : 0;
      const angle = (tmp.lid.get(i) ?? 0) + (goal - (tmp.lid.get(i) ?? 0)) * (1 - Math.exp(-6 * delta));
      tmp.lid.set(i, angle);
      o.position.set(c.x, h + H, -c.y - D / 2 - 0.03);
      o.rotation.set(angle, 0, 0);
      o.scale.setScalar(1);
      o.updateMatrix();
      lids.current.setMatrixAt(i, o.matrix);
      // Brillo por rareza: un halo en el suelo mientras la caja siga cerrada
      o.position.set(c.x, h + 0.08, -c.y);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(state === CRATE_STATE.OPEN ? 0 : 1 + 0.15 * CRATES[i].rarity);
      o.updateMatrix();
      glows.current.setMatrixAt(i, o.matrix);
      o.scale.setScalar(1);

      const blinking = state === CRATE_STATE.LOCKED || state === CRATE_STATE.BUSY;
      const on = blinking && Math.floor(now / 300) % 2 === 0;
      if (blinking) {
        o.position.set(c.x + W / 2 - 0.15, h + H + 0.2, -c.y);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(on ? 1.2 : 0.8);
        o.updateMatrix();
        lights.current.setMatrixAt(i, o.matrix);
        lights.current.setColorAt(i, color.set(state === CRATE_STATE.LOCKED ? (on ? '#ff2a2a' : '#5a1010') : on ? '#ffd23a' : '#5a4a10'));
      } else {
        lights.current.setMatrixAt(i, HIDDEN);
      }
    });
    lids.current.instanceMatrix.needsUpdate = true;
    glows.current.instanceMatrix.needsUpdate = true;
    glowMaterial.opacity = 0.45 + 0.3 * Math.sin(now / 300);
    lights.current.instanceMatrix.needsUpdate = true;
    if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true;

    // Alarmas: columna roja pulsante sobre la caja que alguien acaba de fallar
    const alarms = frameRef.current.alarms ?? [];
    beams.current.forEach((group, i) => {
      const a = alarms[i];
      group.visible = Boolean(a);
      if (!a) return;
      group.position.set(a[0], terrainHeight(a[0], a[1]), -a[1]);
      const pulse = 0.35 + 0.25 * Math.sin(now / 90);
      group.children[0].material.opacity = pulse;
      group.children[1].material.opacity = pulse + 0.2;
    });
  });

  return (
    <group>
      {byRarity.map((list, r) => (
        <instancedMesh
          key={r}
          ref={(m) => (bodies.current[r] = m)}
          args={[geometries[r], modelMaterial, Math.max(1, list.length)]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
      <group ref={falling} visible={false}>
        <mesh geometry={geometries[AIRDROP.rarity]} material={modelMaterial} castShadow />
        <mesh geometry={lidGeometry} material={modelMaterial} position={[0, H, -D / 2 - 0.03]} />
        <mesh geometry={cratechute} material={modelMaterial} />
      </group>
      <instancedMesh ref={lids} args={[lidGeometry, modelMaterial, CRATES.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={lights} args={[lightGeometry, lightMaterial, CRATES.length]} frustumCulled={false} />
      <instancedMesh ref={glows} args={[glowGeometry, glowMaterial, CRATES.length]} frustumCulled={false} renderOrder={1} />
      {Array.from({ length: MAX_ALARMS }, (_, i) => (
        <group key={i} ref={(g) => (beams.current[i] = g)} visible={false}>
          <mesh geometry={beamGeometry} position-y={7}>
            <meshBasicMaterial color="#ff2a2a" transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          <mesh geometry={ringGeometry} position-y={0.15}>
            <meshBasicMaterial color="#ff2a2a" transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
