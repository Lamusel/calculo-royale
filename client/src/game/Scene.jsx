import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AIM_CANCEL_ZONE, DEPLOY, SCOPES, SNIPER_LOOK_AHEAD } from '@calculo-royale/shared/constants';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { aimPreview, currentAim, inputState } from '../input/inputState.js';
import { isTouchDevice } from '../input/TouchControls.jsx';
import { exposureFor, onSettings, settings } from '../settings.js';
import { mousePointer } from '../input/KeyboardMouse.js';
import AimPreview from './AimPreview.jsx';
import BombingMesh from './BombingMesh.jsx';
import Buildings from './Buildings.jsx';
import Bus from './Bus.jsx';
import MapProps from './MapProps.jsx';
import GroundLoot from './GroundLoot.jsx';
import OuterRing from './OuterRing.jsx';
import Boss from './Boss.jsx';
import Crates from './Crates.jsx';
import Effects from './Effects.jsx';
import Grenades from './Grenades.jsx';
import MapMesh from './MapMesh.jsx';
import Players from './Players.jsx';
import Scenery from './Scenery.jsx';
import Training from './Training.jsx';
import Vehicles from './Vehicles.jsx';
import Weather, { weatherLook } from './Weather.jsx';
import ZoneMesh from './ZoneMesh.jsx';

// Cámara 3/4: inclinación (grados sobre el horizonte) y distancia al jugador. Fácil de ajustar.
export const CAMERA_PITCH_DEG = 50;
// Campo de visión angosto y cámara más lejos (misma área visible): menos deformación de
// perspectiva en los bordes, donde los soldados parecían acostados
const CAMERA_DISTANCE = 30.5;
const CAMERA_FOV = 40;
// La cámara se adelanta un poco hacia donde apunta el jugador
const LOOK_AHEAD = 2.5;
// Al apuntar con el francotirador la cámara se aleja un poco y se desplaza hacia la mira
const SNIPER_ZOOM = 1.15;
// Vista del proyector sin nadie a quien seguir: todo el mapa desde arriba
const OVERVIEW_DISTANCE = 176;
const OVERVIEW_PITCH = (62 * Math.PI) / 180;

const pitch = (CAMERA_PITCH_DEG * Math.PI) / 180;
const CAMERA_OFFSET = new THREE.Vector3(0, Math.sin(pitch) * CAMERA_DISTANCE, Math.cos(pitch) * CAMERA_DISTANCE);

// Dirección del sol (desde el suroeste, alto): sombras hacia el noreste
const SUN_OFFSET = new THREE.Vector3(-22, 40, 18);
const SHADOW_SIZE = 26;

// Calcula una vez por cuadro dónde dibujar todo (antes que el resto de useFrame).
// Con followId la cámara sigue siempre a ese jugador (pantalla partida del proyector).
function FrameDriver({ client, frameRef, followId }) {
  useFrame(() => {
    const frame = frameRef.current;
    client.frame(performance.now(), frame);
    if (followId !== null && followId !== undefined) frame.follow = frame.others.get(followId) ?? null;
  }, -3);
  return null;
}

// Cuánto se desplaza la cámara al apuntar: el francotirador trae su mira; las demás armas, la que
// lleve el jugador (punto rojo, 2x, 4x). Con el mouse, completo; con el joystick, según cuánto se arrastra.
function sniperLook() {
  const sniper = aimPreview() === 'sniper';
  const aiming = inputState.adsHeld || inputState.stickAim !== null;
  if (!sniper && (!aiming || inputState.grenadeMode)) return 0;
  const reach = Math.max(sniper ? SNIPER_LOOK_AHEAD : 0, SCOPES[inputState.scope ?? 'none'] ?? 0);
  if (inputState.adsHeld) return reach;
  return reach * Math.max(0, (inputState.stickForce - AIM_CANCEL_ZONE) / (1 - AIM_CANCEL_ZONE));
}

// Cámara que sigue al jugador, se adelanta hacia la mira y tiembla al recibir daño.
// El sol (y su caja de sombras) sigue al mismo punto.
function CameraRig({ client, frameRef, sun, overview }) {
  const s = useMemo(
    () => ({ target: new THREE.Vector3(), goal: new THREE.Vector3(), look: new THREE.Vector3(), lookGoal: new THREE.Vector3(), zoom: 1 }),
    [],
  );
  useFrame(({ camera, scene }, delta) => {
    const dt = Math.min(delta, 0.1);
    const { me, follow, deploying, altitude = 0 } = frameRef.current;
    // Cine (presentación del duelo, repetición): la cámara gira alrededor de alguien
    const cine = client.cinematic?.(performance.now(), frameRef.current);
    if (cine) {
      const h = terrainHeight(cine.x, cine.y);
      camera.position.set(cine.x + Math.cos(cine.angle) * cine.distance, h + cine.height, -cine.y + Math.sin(cine.angle) * cine.distance);
      camera.lookAt(cine.x, h + 1.2, -cine.y);
      s.target.set(cine.x, h, -cine.y);
      s.goal.copy(s.target);
      if (sun.current) {
        sun.current.position.copy(s.target).add(SUN_OFFSET);
        sun.current.target.position.copy(s.target);
        sun.current.target.updateMatrixWorld();
      }
      return;
    }
    // Proyector sin seguir a nadie: plano general fijo
    if (overview && !follow) {
      camera.position.set(0, Math.sin(OVERVIEW_PITCH) * OVERVIEW_DISTANCE, Math.cos(OVERVIEW_PITCH) * OVERVIEW_DISTANCE);
      camera.lookAt(0, 0, 4);
      s.target.set(0, 0, 0);
      if (sun.current) {
        sun.current.position.copy(SUN_OFFSET);
        sun.current.target.position.set(0, 0, 0);
        sun.current.target.updateMatrixWorld();
      }
      return;
    }
    // Caído: la cámara sigue al jugador observado
    const focusOn = follow ?? me;
    // Despliegue: en el bus, el bus y el mapa desde arriba; cayendo, más lejos cuanto más alto
    const air = follow ? null : deploying;
    const lift = air === 'bus' ? DEPLOY.busAltitude : air ? altitude : 0;
    const deployZoom = air === 'bus' ? 3 : air ? 1 + altitude / 28 : 1;
    if (focusOn) s.goal.set(focusOn.x, terrainHeight(focusOn.x, focusOn.y) + lift * 0.6, -focusOn.y);
    s.target.lerp(s.goal, 1 - Math.exp(-12 * dt));

    const aim = follow ? follow.aim : currentAim();
    const extra = follow ? 0 : sniperLook();
    const amount = LOOK_AHEAD + extra;
    s.lookGoal.set(Math.cos(aim) * amount, 0, -Math.sin(aim) * amount);
    s.look.lerp(s.lookGoal, 1 - Math.exp(-5 * dt));
    s.zoom += ((extra > 0 ? SNIPER_ZOOM : 1) * deployZoom - s.zoom) * (1 - Math.exp(-3 * dt));
    // La niebla se aleja con la cámara (desde el bus se ve el mapa)
    if (scene.fog) {
      // THREE.Fog no tiene userData: la distancia base se guarda aquí (y se renueva si cambia la niebla)
      if (s.fog?.fog !== scene.fog) s.fog = { fog: scene.fog, near: scene.fog.near, far: scene.fog.far };
      scene.fog.near = s.fog.near * Math.max(1, s.zoom);
      scene.fog.far = s.fog.far * Math.max(1, s.zoom);
    }

    const focus = s.target.clone().add(s.look);
    camera.position.copy(focus).addScaledVector(CAMERA_OFFSET, s.zoom);
    // Sacudida proporcional al trauma (cuadrático: los golpes fuertes se notan mucho más)
    const shake = client.trauma ** 2 * 0.7;
    if (shake > 0.001) {
      camera.position.x += (Math.random() * 2 - 1) * shake;
      camera.position.y += (Math.random() * 2 - 1) * shake;
      focus.x += (Math.random() * 2 - 1) * shake * 0.3;
    }
    client.trauma = Math.max(0, client.trauma - dt * 1.6);
    camera.lookAt(focus);

    if (sun.current) {
      sun.current.position.copy(s.target).add(SUN_OFFSET);
      sun.current.target.position.copy(s.target);
      sun.current.target.updateMatrixWorld();
    }
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

// Mide FPS para la calidad automática y llena las estadísticas de ?debug=1
function PerfMonitor({ onFrame, stats }) {
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    const now = performance.now();
    onFrame(now);
    if (stats) {
      stats.frames.push(now);
      while (stats.frames.length && now - stats.frames[0] > 1000) stats.frames.shift();
      stats.fps = stats.frames.length;
      stats.calls = gl.info.render.calls;
      stats.triangles = gl.info.render.triangles;
    }
  });
  return null;
}

// Exposición del tone mapping: base según el dispositivo por el Brillo del menú Opciones
function Exposure() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const touch = isTouchDevice();
    const apply = () => (gl.toneMappingExposure = exposureFor(touch, settings.brightness));
    apply();
    return onSettings(apply);
  }, [gl]);
  return null;
}

function Sun({ sunRef, quality, intensity, color }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const light = sunRef.current;
    scene.add(light.target);
    return () => scene.remove(light.target);
  }, [scene, sunRef]);
  useEffect(() => {
    // El mapa de sombras se recrea con el nuevo tamaño
    const light = sunRef.current;
    light.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }, [quality.shadowMapSize, sunRef]);
  return (
    <directionalLight
      ref={sunRef}
      intensity={intensity}
      color={color}
      castShadow={quality.shadows}
      shadow-bias={-0.0005}
      shadow-normalBias={0.04}
      shadow-camera-left={-SHADOW_SIZE}
      shadow-camera-right={SHADOW_SIZE}
      shadow-camera-top={SHADOW_SIZE}
      shadow-camera-bottom={-SHADOW_SIZE}
      shadow-camera-near={1}
      shadow-camera-far={120}
    />
  );
}

export default function Scene({
  client, roster, myId, phase, frameRef, quality, onFrame, stats, overview = false, weather = 'despejado', windAngle = 0, followId = null,
}) {
  const sun = useRef(null);
  // El clima solo rige durante la partida; el entrenamiento siempre es de día
  const active = phase === 'lobby' ? 'despejado' : weather;
  const look = weatherLook(active);
  // En el proyector (plano general) no se aplica la niebla del clima
  const fog = !overview && look.fog ? look.fog : quality.fog;
  return (
    <Canvas
      dpr={quality.dpr}
      shadows
      camera={{ fov: CAMERA_FOV, near: 0.5, far: 420, position: CAMERA_OFFSET.toArray() }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, ...fog]} />
      <Exposure />
      {/* Luz ambiental algo más alta: sin sombras (calidad baja) no debe verse más oscuro */}
      <hemisphereLight args={['#e6eef4', '#5a5540', look.hemi * 1.25]} />
      <Sun sunRef={sun} quality={quality} intensity={look.sun} color={look.sunColor} />
      <FrameDriver client={client} frameRef={frameRef} followId={followId} />
      <CameraRig client={client} frameRef={frameRef} sun={sun} overview={overview} />
      <MouseAim frameRef={frameRef} />
      <PerfMonitor onFrame={onFrame} stats={stats} />
      <MapMesh />
      <Scenery quality={quality} />
      <Buildings frameRef={frameRef} pitchDeg={CAMERA_PITCH_DEG} />
      <MapProps frameRef={frameRef} />
      <OuterRing />
      {phase === 'playing' && <Boss frameRef={frameRef} />}
      {phase !== 'lobby' && client.loot && <GroundLoot client={client} />}
      {phase === 'lobby' && <Training frameRef={frameRef} />}
      <Crates frameRef={frameRef} />
      <ZoneMesh frameRef={frameRef} />
      <BombingMesh frameRef={frameRef} />
      <Vehicles client={client} frameRef={frameRef} quality={quality} />
      <Bus frameRef={frameRef} />
      <Weather weather={active} windAngle={windAngle} client={client} frameRef={frameRef} quality={quality} />
      <Players client={client} roster={roster} myId={myId} frameRef={frameRef} quality={quality} night={active === 'noche'} />
      <Grenades frameRef={frameRef} />
      <AimPreview frameRef={frameRef} />
      <Effects client={client} quality={quality} />
    </Canvas>
  );
}
