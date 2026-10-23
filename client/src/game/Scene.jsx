import { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WEAPON_IDS } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { inputState } from '../input/inputState.js';
import { mousePointer } from '../input/KeyboardMouse.js';
import Effects from './Effects.jsx';
import Grenades from './Grenades.jsx';
import MapMesh from './MapMesh.jsx';
import Obstacles from './Obstacles.jsx';
import Players from './Players.jsx';
import Training from './Training.jsx';

// Cámara inclinada (≈56°) que sigue al jugador. La cámara 3/4 final llega en la fase 3.
// Lo bastante alta para ver a quien te dispara con el celular en horizontal.
const CAMERA_OFFSET = new THREE.Vector3(0, 20, 13.5);
// Con el francotirador la cámara se aleja para ver más lejos
const SNIPER_ZOOM = 1.5;
const SNIPER = WEAPON_IDS.indexOf('sniper');
const SKY = '#b8c8d2';

// Calcula una vez por cuadro dónde dibujar todo (antes que el resto de useFrame)
function FrameDriver({ client, frameRef }) {
  useFrame(() => client.frame(performance.now(), frameRef.current), -2);
  return null;
}

function CameraRig({ frameRef }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const zoom = useMemo(() => ({ value: 1 }), []);
  useFrame(({ camera }, delta) => {
    const { me, meInfo } = frameRef.current;
    if (me) goal.set(me.x, terrainHeight(me.x, me.y), -me.y);
    target.lerp(goal, 1 - Math.exp(-12 * delta));
    const wanted = meInfo?.weapon === SNIPER ? SNIPER_ZOOM : 1;
    zoom.value += (wanted - zoom.value) * (1 - Math.exp(-4 * delta));
    camera.position.copy(target).addScaledVector(CAMERA_OFFSET, zoom.value);
    camera.lookAt(target);
  }, -1);
  return null;
}

// Convierte la posición del mouse en ángulo y distancia de apuntado sobre el plano del jugador
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
      inputState.mouseDist = Math.hypot(-hit.z - me.y, hit.x - me.x);
    }
  }, -1);
  return null;
}

export default function Scene({ client, roster, myId, phase, frameRef }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 50, near: 0.5, far: 300, position: CAMERA_OFFSET.toArray() }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[SKY]} />
      <hemisphereLight args={['#e3ecf2', '#4d4a38', 1.5]} />
      <directionalLight position={[20, 40, 15]} intensity={1.7} />
      <FrameDriver client={client} frameRef={frameRef} />
      <CameraRig frameRef={frameRef} />
      <MouseAim frameRef={frameRef} />
      <MapMesh />
      <Obstacles />
      {phase === 'lobby' && <Training frameRef={frameRef} />}
      <Players roster={roster} myId={myId} frameRef={frameRef} />
      <Grenades frameRef={frameRef} />
      <Effects client={client} />
    </Canvas>
  );
}
