import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Zona segura en la escena: muro translúcido en el borde de la zona actual y un anillo
// blanco en el suelo con la zona siguiente. Ambos son elipses (cilindros escalados).

const wallGeometry = new THREE.CylinderGeometry(1, 1, 30, 96, 1, true);
// Las franjas bajas miden más que el desnivel del terreno (±2) para que siempre lo crucen
const baseGeometry = new THREE.CylinderGeometry(1, 1, 4.6, 96, 1, true);
const nextGeometry = new THREE.CylinderGeometry(1, 1, 4.4, 96, 1, true);

export default function ZoneMesh({ frameRef }) {
  const wall = useRef(null);
  const base = useRef(null);
  const next = useRef(null);

  useFrame(() => {
    const zone = frameRef.current.zone;
    const active = zone?.length > 0;
    wall.current.visible = base.current.visible = active;
    next.current.visible = active && (zone[4] !== zone[0] || zone[6] !== zone[2] || zone[5] !== zone[1]);
    if (!active) return;
    const [cx, cy, p, q, nx, ny, np, nq] = zone;
    wall.current.position.set(cx, 8, -cy);
    wall.current.scale.set(p, 1, q);
    base.current.position.set(cx, 0.1, -cy);
    base.current.scale.set(p, 1, q);
    // Más intenso mientras se cierra
    const closing = zone[10] === 1;
    wall.current.material.opacity = closing ? 0.22 + 0.06 * Math.sin(performance.now() / 200) : 0.16;
    next.current.position.set(nx, 0, -ny);
    next.current.scale.set(np, 1, nq);
  });

  return (
    <group>
      <mesh ref={wall} geometry={wallGeometry} visible={false} renderOrder={6}>
        <meshBasicMaterial color="#ff5a36" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={base} geometry={baseGeometry} visible={false} renderOrder={6}>
        <meshBasicMaterial color="#ff7a4a" transparent opacity={0.32} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={next} geometry={nextGeometry} visible={false} renderOrder={6}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
