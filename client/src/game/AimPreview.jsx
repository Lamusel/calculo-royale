import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GRENADE, PLAYER_RADIUS, WEAPONS } from '@calculo-royale/shared/constants';
import { raycastObstacles } from '@calculo-royale/shared/collision';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { aimPreview, currentAim, grenadeDistance, inputState } from '../input/inputState.js';

// Ayudas de puntería del jugador propio:
//  - Flecha de dirección en el suelo bajo el soldado (siempre, con cualquier arma)
//  - Francotirador: línea roja hasta el alcance real (se corta en la primera pared)
//  - Granada: arco de lanzamiento y círculo con el radio de explosión donde cae
//  - Mira (fase 25): al apuntar, la retícula de esa mira donde se apunta (punto rojo, 2x o 4x)

const CHEST = 1.25;
const ARC_DOTS = 18;
const ARC_HEIGHT = 2.2;

const lineGeometry = new THREE.BoxGeometry(0.05, 0.05, 1);
const sniperMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.75, depthTest: false, toneMapped: false });
const dotGeometry = new THREE.SphereGeometry(0.09, 6, 4);
const dotMaterial = new THREE.MeshBasicMaterial({ color: '#ffd27a', depthTest: false, toneMapped: false });
const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide });
const fillMaterial = new THREE.MeshBasicMaterial({ color: '#ff8a3c', transparent: true, opacity: 0.18, depthTest: false, side: THREE.DoubleSide });
const ringGeometry = new THREE.RingGeometry(GRENADE.radius - 0.12, GRENADE.radius, 48).rotateX(-Math.PI / 2);
const fillGeometry = new THREE.CircleGeometry(GRENADE.radius, 48).rotateX(-Math.PI / 2);

// Flecha plana (apunta a +x local), justo fuera del círculo del soldado
function arrowGeometry() {
  const shape = new THREE.Shape();
  const r = PLAYER_RADIUS * 1.75;
  shape.moveTo(r + 0.45, 0);
  shape.lineTo(r, 0.28);
  shape.lineTo(r + 0.1, 0);
  shape.lineTo(r, -0.28);
  shape.closePath();
  // ShapeGeometry vive en el plano XY: se acuesta para que el ángulo coincida con el del soldado
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}
// Retícula de cada mira dibujada en un canvas
function reticleTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.lineWidth = 4;
  if (kind === 'reddot') {
    g.strokeStyle = 'rgba(239,68,68,0.9)';
    g.beginPath();
    g.arc(0, 0, 26, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.arc(0, 0, 8, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = kind === 'scope4x' ? 'rgba(34,211,238,0.95)' : 'rgba(250,250,250,0.95)';
    g.beginPath();
    g.arc(0, 0, 54, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(-54, 0);
    g.lineTo(-10, 0);
    g.moveTo(10, 0);
    g.lineTo(54, 0);
    g.moveTo(0, -54);
    g.lineTo(0, -10);
    g.moveTo(0, 10);
    g.lineTo(0, 54);
    g.stroke();
    // 4x: marcas de distancia en las cruces
    if (kind === 'scope4x') for (const d of [20, 32, 44]) for (const [x, y] of [[d, 0], [-d, 0], [0, d], [0, -d]]) g.fillRect(x - 3, y - 3, 6, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const reticleMaterials = {};
const reticleMaterial = (kind) =>
  (reticleMaterials[kind] ??= new THREE.SpriteMaterial({ map: reticleTexture(kind), depthTest: false, transparent: true, toneMapped: false }));

const arrowMaterial = new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide });

export default function AimPreview({ frameRef }) {
  const arrow = useRef(null);
  const line = useRef(null);
  const dots = useRef(null);
  const ring = useRef(null);
  const fill = useRef(null);
  const reticle = useRef(null);
  const geometry = useMemo(arrowGeometry, []);
  const tmp = useMemo(() => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), o: new THREE.Object3D() }), []);

  useFrame(() => {
    const me = frameRef.current.me;
    const alive = me && !(frameRef.current.meInfo?.flags & PLAYER_FLAGS.DEAD);
    const mode = alive ? aimPreview() : null;
    arrow.current.visible = Boolean(alive);
    line.current.visible = mode === 'sniper';
    dots.current.visible = ring.current.visible = fill.current.visible = mode === 'grenade';
    // Retícula de la mira: apuntando (mouse derecho o joystick) con una mira puesta
    const scope = inputState.scope;
    const aiming = (inputState.adsHeld || inputState.stickAim !== null) && mode !== 'grenade' && !inputState.grenadeMode;
    reticle.current.visible = Boolean(alive && scope && aiming);
    if (!alive) return;

    const aim = currentAim();
    const dx = Math.cos(aim);
    const dy = Math.sin(aim);
    const h = terrainHeight(me.x, me.y);
    arrow.current.position.set(me.x, h + 0.12, -me.y);
    arrow.current.rotation.y = aim;
    if (reticle.current.visible) {
      const range = WEAPONS[inputState.weapon]?.range ?? 24;
      const want = Math.min(range, inputState.adsHeld && inputState.mouseDist ? inputState.mouseDist : range * 0.6);
      const d = Math.min(want, raycastObstacles(me.x, me.y, dx, dy, want));
      const rx = me.x + dx * d;
      const ry = me.y + dy * d;
      reticle.current.material = reticleMaterial(scope);
      reticle.current.position.set(rx, terrainHeight(rx, ry) + CHEST, -ry);
      const size = scope === 'reddot' ? 0.9 : scope === 'scope2x' ? 1.6 : 2.2;
      reticle.current.scale.set(size, size, 1);
    }

    if (mode === 'sniper') {
      const dist = raycastObstacles(me.x, me.y, dx, dy, WEAPONS.sniper.range);
      const ex = me.x + dx * dist;
      const ey = me.y + dy * dist;
      tmp.from.set(me.x, h + CHEST, -me.y);
      tmp.to.set(ex, terrainHeight(ex, ey) + CHEST, -ey);
      line.current.position.copy(tmp.from).lerp(tmp.to, 0.5);
      line.current.lookAt(tmp.to);
      line.current.scale.set(1, 1, tmp.from.distanceTo(tmp.to));
    } else if (mode === 'grenade') {
      // Aterriza a la distancia elegida o antes, si hay una pared en el camino
      const dist = Math.min(grenadeDistance(), raycastObstacles(me.x, me.y, dx, dy, GRENADE.maxRange));
      const lx = me.x + dx * dist;
      const ly = me.y + dy * dist;
      const lh = terrainHeight(lx, ly);
      for (let i = 0; i < ARC_DOTS; i++) {
        const t = (i + 1) / (ARC_DOTS + 1);
        const base = h + CHEST + (lh - h - CHEST) * t;
        tmp.o.position.set(me.x + dx * dist * t, base + 4 * ARC_HEIGHT * t * (1 - t), -(me.y + dy * dist * t));
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
      <mesh ref={arrow} geometry={geometry} material={arrowMaterial} visible={false} renderOrder={5} />
      <mesh ref={line} geometry={lineGeometry} material={sniperMaterial} visible={false} renderOrder={5} />
      <instancedMesh ref={dots} args={[dotGeometry, dotMaterial, ARC_DOTS]} visible={false} frustumCulled={false} renderOrder={5} />
      <mesh ref={ring} geometry={ringGeometry} material={ringMaterial} visible={false} renderOrder={5} />
      <mesh ref={fill} geometry={fillGeometry} material={fillMaterial} visible={false} renderOrder={4} />
      <sprite ref={reticle} visible={false} renderOrder={6} />
    </group>
  );
}
