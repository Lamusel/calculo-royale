import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PLAYER_COLORS } from '@calculo-royale/shared/constants';
import { SKIN_RARITIES, SKINS } from '@calculo-royale/shared/skins';
import { textTexture } from '../game/labels.js';
import SoldierModel from '../game/SoldierModel.jsx';

// Solo las procedurales (las externas tienen su galería en /skins)
const PROCEDURAL = SKINS.filter((s) => s.type !== 'external');

const COLS = 6;
const GAP_X = 2.2;
const GAP_Z = 3.6;

function Label({ text, color, position }) {
  const label = useMemo(() => textTexture(text, { color, size: 40 }), [text, color]);
  return (
    <sprite position={position} scale={[label.aspect * 0.32, 0.32, 1]}>
      <spriteMaterial map={label.texture} depthWrite={false} transparent />
    </sprite>
  );
}

// Galería de todas las skins (/galeria): para revisarlas de un vistazo desde la cámara 3/4
export default function Gallery() {
  const rows = Math.ceil(PROCEDURAL.length / COLS);
  return (
    <div className="h-full w-full bg-olive-950">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 40, position: [0, 13, 13] }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
        <color attach="background" args={['#2a3220']} />
        <hemisphereLight args={['#e8eef2', '#3a3628', 1.5]} />
        <directionalLight position={[-6, 12, 8]} intensity={1.9} />
        {PROCEDURAL.map((s, i) => {
          const x = ((i % COLS) - (COLS - 1) / 2) * GAP_X;
          const z = (Math.floor(i / COLS) - (rows - 1) / 2) * GAP_Z;
          return (
            <group key={s.id} position={[x, 0, z]}>
              <SoldierModel skin={s.id} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} vest={i % 4} rotation-y={-0.6} />
              <Label text={s.name} color={SKIN_RARITIES[s.rarity].color} position={[0, 2.95, 0]} />
            </group>
          );
        })}
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[COLS * GAP_X + 2, rows * GAP_Z + 2]} />
          <meshLambertMaterial color="#4f6430" />
        </mesh>
      </Canvas>
    </div>
  );
}
