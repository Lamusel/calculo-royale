import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOSS } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { Character } from './character/Character.js';

// Profe Jefe Final (fase 21): el mismo Master Rig de los jugadores con la skin de Newton, en
// gigante. Escudo translúcido que cambia de color por fase y anillo rojo cuando viene la onda.

const SCALE = 3.2;
const PHASE_COLORS = ['#38bdf8', '#a855f7', '#f43f5e'];

export default function Boss({ frameRef }) {
  const group = useRef(null);
  const shield = useRef(null);
  const wave = useRef(null);
  const character = useMemo(() => new Character({ skin: 'newton', color: '#b91c1c', vest: 3 }), []);
  const shieldMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: PHASE_COLORS[0], transparent: true, opacity: 0.22, depthWrite: false, wireframe: false }), []);
  const waveMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }), []);
  useEffect(() => {
    character.setWeapon(2);
    return () => character.dispose();
  }, [character]);

  useFrame((_, delta) => {
    const b = frameRef.current.boss;
    group.current.visible = Boolean(b);
    if (!b) return;
    const now = performance.now();
    const h = terrainHeight(b.x, b.y);
    group.current.position.set(b.x, h, -b.y);
    character.update({ x: b.x, y: b.y, aim: b.aim, dead: false, aiming: true, shotAgo: 1e9, weapon: 2, seat: null }, now, Math.min(delta, 0.1));
    // Escudo: late suave; sin escudo, solo un brillo tenue en el suelo
    shield.current.visible = b.shieldUp;
    shieldMaterial.color.set(PHASE_COLORS[b.phase] ?? PHASE_COLORS[0]);
    shieldMaterial.opacity = 0.18 + Math.sin(now / 300) * 0.05;
    shield.current.scale.setScalar(BOSS.shieldRadius);
    // Aviso de la onda: el anillo crece hasta el radio de daño
    wave.current.visible = b.waveIn >= 0;
    if (b.waveIn >= 0) {
      const t = 1 - b.waveIn / BOSS.waveWarnMs;
      wave.current.scale.setScalar(Math.max(0.1, t) * BOSS.waveRadius);
      waveMaterial.opacity = 0.25 + 0.3 * Math.abs(Math.sin(now / 90));
    }
  });

  return (
    <group ref={group} visible={false}>
      <group scale={SCALE}>
        <primitive object={character.visualRoot} />
      </group>
      <mesh ref={shield} position={[0, 2.6, 0]} material={shieldMaterial}>
        <icosahedronGeometry args={[1, 2]} />
      </mesh>
      <mesh ref={wave} rotation-x={-Math.PI / 2} position={[0, 0.15, 0]} material={waveMaterial}>
        <ringGeometry args={[0.85, 1, 48]} />
      </mesh>
    </group>
  );
}
