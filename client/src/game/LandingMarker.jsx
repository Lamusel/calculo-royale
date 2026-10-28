import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEPLOY } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';

// Punto estimado de aterrizaje mientras se cae: supone que se sigue inclinado igual que ahora.
// Deja el punto en frameRef.current.landing (el altímetro lo muestra) y dibuja un aro en el suelo.

export function estimateLanding(x, y, vx, vy, state, z) {
  const speed = Math.hypot(vx, vy);
  const ux = speed > 0.1 ? vx / speed : 0;
  const uy = speed > 0.1 ? vy / speed : 0;
  if (state === 'chute') {
    const t = Math.max(0, z) / DEPLOY.chuteSpeed;
    return { x: x + vx * t, y: y + vy * t };
  }
  const lean = Math.min(1, speed / DEPLOY.airSpeed);
  const fall = Math.max(0, z - DEPLOY.chuteAltitude) / (DEPLOY.fallSpeed + DEPLOY.fallLeanSpeed * lean);
  const chute = Math.min(z, DEPLOY.chuteAltitude) / DEPLOY.chuteSpeed;
  const glide = DEPLOY.chuteAirSpeed * lean * chute;
  return { x: x + vx * fall + ux * glide, y: y + vy * fall + uy * glide };
}

export default function LandingMarker({ frameRef }) {
  const ref = useRef(null);
  const geometry = useMemo(() => new THREE.RingGeometry(2.6, 3.4, 24).rotateX(-Math.PI / 2), []);
  const s = useMemo(() => ({ last: null, vx: 0, vy: 0 }), []);
  useFrame((_, delta) => {
    const f = frameRef.current;
    const state = f.follow ? null : f.deploying;
    const me = f.me;
    const air = me && (state === 'fall' || state === 'chute');
    ref.current.visible = Boolean(air);
    if (!air) {
      s.last = null;
      f.landing = null;
      return;
    }
    const dt = Math.min(delta, 0.1);
    if (s.last && dt > 0) {
      const k = 1 - Math.exp(-4 * dt);
      s.vx += ((me.x - s.last.x) / dt - s.vx) * k;
      s.vy += ((me.y - s.last.y) / dt - s.vy) * k;
    }
    s.last = { x: me.x, y: me.y };
    const p = estimateLanding(me.x, me.y, s.vx, s.vy, state, f.altitude ?? 0);
    f.landing = p;
    ref.current.position.set(p.x, terrainHeight(p.x, p.y) + 0.25, -p.y);
    ref.current.scale.setScalar(1 + (f.altitude ?? 0) / 40);
  });
  return (
    <mesh ref={ref} geometry={geometry} visible={false} renderOrder={5}>
      <meshBasicMaterial color="#fde047" transparent opacity={0.85} depthTest={false} />
    </mesh>
  );
}
