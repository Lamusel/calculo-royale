import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sectorBounds } from '@calculo-royale/shared/zone';

// Aviso de bombardeo: el sector votado se marca con una columna roja intermitente
const columnGeometry = new THREE.BoxGeometry(1, 1, 1);

export default function BombingMesh({ frameRef }) {
  const column = useRef(null);
  useFrame(() => {
    const bombing = frameRef.current.bombing;
    const active = bombing?.length > 0;
    column.current.visible = active;
    if (!active) return;
    const b = sectorBounds(bombing[0]);
    column.current.position.set(b.cx, 4, -b.cy);
    column.current.scale.set(b.maxX - b.minX, 12, b.maxY - b.minY);
    // Parpadea más rápido a medida que se acerca el impacto
    const speed = 80 + bombing[1] / 25;
    column.current.material.opacity = 0.12 + 0.12 * (Math.sin(performance.now() / speed) + 1);
  });
  return (
    <mesh ref={column} geometry={columnGeometry} visible={false} renderOrder={7}>
      <meshBasicMaterial color="#ff1f1f" transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}
