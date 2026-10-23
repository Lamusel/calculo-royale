import { modelMaterial } from './models/build.js';
import { armsGeometry, HAND, HIP, legGeometry, SHOULDER, torsoGeometry } from './models/soldier.js';
import { weaponGeometry } from './models/weapons.js';

// Soldado quieto (para el selector de skins y la galería): mismas piezas que en la partida
export default function SoldierModel({ skin, color, vest = 0, weapon = 'rifle', ...props }) {
  const leg = legGeometry(skin);
  return (
    <group {...props}>
      <mesh geometry={leg} material={modelMaterial} position={[0, HIP, 0.16]} />
      <mesh geometry={leg} material={modelMaterial} position={[0, HIP, -0.16]} />
      <mesh geometry={torsoGeometry(color, vest, skin)} material={modelMaterial} />
      <group position-y={SHOULDER} rotation-z={-0.25}>
        <mesh geometry={armsGeometry(color, skin)} material={modelMaterial} />
        <mesh geometry={weaponGeometry(weapon)} material={modelMaterial} position={HAND} />
      </group>
    </group>
  );
}
