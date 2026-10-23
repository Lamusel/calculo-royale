import { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { inputState } from '../input/inputState.js';
import { mousePointer } from '../input/KeyboardMouse.js';
import MapMesh from './MapMesh.jsx';
import Players from './Players.jsx';

// Cámara fija inclinada (≈56°) que sigue al jugador, estilo Brawl Stars
const CAMERA_OFFSET = new THREE.Vector3(0, 15, 10);
const BACKGROUND = '#0b1220';

// Calcula una vez por cuadro dónde dibujar a cada jugador (antes que el resto de useFrame)
function FrameDriver({ client, frameRef }) {
  useFrame(() => client.frame(performance.now(), frameRef.current), -2);
  return null;
}

function CameraRig({ frameRef }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, delta) => {
    const me = frameRef.current.me;
    if (me) goal.set(me.x, terrainHeight(me.x, me.y), -me.y);
    target.lerp(goal, 1 - Math.exp(-12 * delta));
    camera.position.copy(target).add(CAMERA_OFFSET);
    camera.lookAt(target);
  }, -1);
  return null;
}

// Convierte la posición del mouse en un ángulo de apuntado sobre el plano del jugador
function MouseAim({ frameRef }) {
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, raycaster }) => {
    const me = frameRef.current.me;
    if (!me || !mousePointer.active) return;
    plane.constant = -(terrainHeight(me.x, me.y) + 1);
    raycaster.setFromCamera(ndc.set(mousePointer.x, mousePointer.y), camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      inputState.mouseAim = Math.atan2(-hit.z - me.y, hit.x - me.x);
    }
  }, -1);
  return null;
}

export default function Scene({ client, roster, myId, frameRef }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 50, near: 0.5, far: 250, position: CAMERA_OFFSET.toArray() }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[BACKGROUND]} />
      <hemisphereLight args={['#e0f2fe', '#1e293b', 1.4]} />
      <directionalLight position={[20, 40, 15]} intensity={1.6} />
      <FrameDriver client={client} frameRef={frameRef} />
      <CameraRig frameRef={frameRef} />
      <MouseAim frameRef={frameRef} />
      <MapMesh />
      <Players roster={roster} myId={myId} frameRef={frameRef} />
    </Canvas>
  );
}
