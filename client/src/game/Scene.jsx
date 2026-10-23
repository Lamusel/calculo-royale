import { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AIM_CANCEL_ZONE, SNIPER_LOOK_AHEAD } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { aimPreview, currentAim, inputState } from '../input/inputState.js';
import { mousePointer } from '../input/KeyboardMouse.js';
import AimPreview from './AimPreview.jsx';
import Effects from './Effects.jsx';
import Grenades from './Grenades.jsx';
import MapMesh from './MapMesh.jsx';
import Obstacles from './Obstacles.jsx';
import Players from './Players.jsx';
import Training from './Training.jsx';

// Cámara inclinada (≈56°) que sigue al jugador. La cámara 3/4 final llega en la fase 3.
// Lo bastante alta para ver a quien te dispara con el celular en horizontal.
const CAMERA_OFFSET = new THREE.Vector3(0, 20, 13.5);
// Al apuntar con el francotirador la cámara se aleja un poco y se desplaza hacia la mira
const SNIPER_ZOOM = 1.2;
const SKY = '#b8c8d2';

// Calcula una vez por cuadro dónde dibujar todo (antes que el resto de useFrame)
function FrameDriver({ client, frameRef }) {
  useFrame(() => client.frame(performance.now(), frameRef.current), -2);
  return null;
}

// Cuánto se desplaza la cámara: con el mouse, completo; con el joystick, según cuánto se arrastra
function sniperLook() {
  if (aimPreview() !== 'sniper') return 0;
  if (inputState.adsHeld) return SNIPER_LOOK_AHEAD;
  return SNIPER_LOOK_AHEAD * Math.max(0, (inputState.stickForce - AIM_CANCEL_ZONE) / (1 - AIM_CANCEL_ZONE));
}

function CameraRig({ frameRef }) {
  const target = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const lookGoal = useMemo(() => new THREE.Vector3(), []);
  const zoom = useMemo(() => ({ value: 1 }), []);
  useFrame(({ camera }, delta) => {
    const { me } = frameRef.current;
    if (me) goal.set(me.x, terrainHeight(me.x, me.y), -me.y);
    target.lerp(goal, 1 - Math.exp(-12 * delta));

    const amount = sniperLook();
    const aim = currentAim();
    lookGoal.set(Math.cos(aim) * amount, 0, -Math.sin(aim) * amount);
    look.lerp(lookGoal, 1 - Math.exp(-5 * delta));
    target.add(look);
    const wanted = amount > 0 ? SNIPER_ZOOM : 1;
    zoom.value += (wanted - zoom.value) * (1 - Math.exp(-4 * delta));
    camera.position.copy(target).addScaledVector(CAMERA_OFFSET, zoom.value);
    camera.lookAt(target);
    target.sub(look);
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
      <AimPreview frameRef={frameRef} />
      <Effects client={client} />
    </Canvas>
  );
}
