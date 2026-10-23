import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRENADE, WEAPONS } from '@calculo-royale/shared/constants';
import { raycastObstacles } from '@calculo-royale/shared/collision';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { aimPreview, currentAim, grenadeDistance, inputState } from '../input/inputState.js';

// Vista previa de la mira mientras se apunta:
//  - line:    línea hasta el alcance real del arma (se corta en la primera pared)
//  - sniper:  igual pero roja y larga
//  - cone:    abanico de dispersión de la escopeta
//  - grenade: arco de lanzamiento y círculo con el radio de explosión donde cae

const CHEST = 1.25;
const ARC_DOTS = 18;
const ARC_HEIGHT = 2.2;

const lineGeometry = new THREE.BoxGeometry(0.07, 0.07, 1);
const lineMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthTest: false, toneMapped: false });
const sniperMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.75, depthTest: false, toneMapped: false });
const coneMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthTest: false, side: THREE.DoubleSide });
const dotGeometry = new THREE.SphereGeometry(0.09, 6, 4);
const dotMaterial = new THREE.MeshBasicMaterial({ color: '#ffd27a', depthTest: false, toneMapped: false });
const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide });
const fillMaterial = new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: 0.18, depthTest: false, side: THREE.DoubleSide });
const ringGeometry = new THREE.RingGeometry(GRENADE.radius - 0.12, GRENADE.radius, 48).rotateX(-Math.PI / 2);
const fillGeometry = new THREE.CircleGeometry(GRENADE.radius, 48).rotateX(-Math.PI / 2);

const shotgun = WEAPONS.shotgun;
// Abanico en el plano: el ángulo 0 apunta a +x, igual que el soldado
const coneGeometry = new THREE.CircleGeometry(shotgun.range, 20, -shotgun.spread / 2, shotgun.spread).rotateX(-Math.PI / 2);

export default function AimPreview({ frameRef }) {
  const line = useRef(null);
  const cone = useRef(null);
  const dots = useRef(null);
  const ring = useRef(null);
  const fill = useRef(null);
  const tmp = useMemo(() => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), o: new THREE.Object3D() }), []);

  useFrame(() => {
    const me = frameRef.current.me;
    const alive = !(frameRef.current.meInfo?.flags & PLAYER_FLAGS.DEAD);
    const mode = me && alive ? aimPreview() : null;
    line.current.visible = mode === 'line' || mode === 'sniper';
    cone.current.visible = mode === 'cone';
    dots.current.visible = ring.current.visible = fill.current.visible = mode === 'grenade';
    if (!mode) return;

    const aim = currentAim();
    const dx = Math.cos(aim);
    const dy = Math.sin(aim);
    const h = terrainHeight(me.x, me.y);

    if (mode === 'line' || mode === 'sniper') {
      const weapon = WEAPONS[inputState.weapon] ?? WEAPONS.pistol;
      const dist = raycastObstacles(me.x, me.y, dx, dy, weapon.range);
      const ex = me.x + dx * dist;
      const ey = me.y + dy * dist;
      tmp.from.set(me.x, h + CHEST, -me.y);
      tmp.to.set(ex, terrainHeight(ex, ey) + CHEST, -ey);
      line.current.material = mode === 'sniper' ? sniperMaterial : lineMaterial;
      line.current.position.copy(tmp.from).lerp(tmp.to, 0.5);
      line.current.lookAt(tmp.to);
      line.current.scale.set(mode === 'sniper' ? 0.6 : 1, mode === 'sniper' ? 0.6 : 1, tmp.from.distanceTo(tmp.to));
    } else if (mode === 'cone') {
      cone.current.position.set(me.x, h + 0.25, -me.y);
      cone.current.rotation.y = aim;
    } else {
      // Granada: aterriza a la distancia elegida o antes, si hay una pared en el camino
      const dist = Math.min(grenadeDistance(), raycastObstacles(me.x, me.y, dx, dy, GRENADE.maxRange));
      const lx = me.x + dx * dist;
      const ly = me.y + dy * dist;
      const lh = terrainHeight(lx, ly);
      for (let i = 0; i < ARC_DOTS; i++) {
        const t = (i + 1) / (ARC_DOTS + 1);
        const x = me.x + dx * dist * t;
        const y = me.y + dy * dist * t;
        const base = h + CHEST + (lh - h - CHEST) * t;
        tmp.o.position.set(x, base + 4 * ARC_HEIGHT * t * (1 - t), -y);
        tmp.o.updateMatrix();
        dots.current.setMatrixAt(i, tmp.o.matrix);
      }
      dots.current.instanceMatrix.needsUpdate = true;
      ring.current.position.set(lx, lh + 0.15, -ly);
      fill.current.position.set(lx, lh + 0.14, -ly);
    }
  });

  return (
    <group>
      <mesh ref={line} geometry={lineGeometry} material={lineMaterial} visible={false} renderOrder={5} />
      <mesh ref={cone} geometry={coneGeometry} material={coneMaterial} visible={false} renderOrder={5} />
      <instancedMesh ref={dots} args={[dotGeometry, dotMaterial, ARC_DOTS]} visible={false} frustumCulled={false} renderOrder={5} />
      <mesh ref={ring} geometry={ringGeometry} material={ringMaterial} visible={false} renderOrder={5} />
      <mesh ref={fill} geometry={fillGeometry} material={fillMaterial} visible={false} renderOrder={4} />
    </group>
  );
}
