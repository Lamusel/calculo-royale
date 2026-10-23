import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { Character } from '../../game/character/Character.js';
import { listSkins } from '../../game/character/skins/index.js';
import MapMesh from '../../game/MapMesh.jsx';
import { lodFor } from '../../game/Players.jsx';
import { initialQuality, QUALITY } from '../../game/quality.js';
import Weather, { weatherLook } from '../../game/Weather.jsx';

// Stress test de skins (/skins/stress): N personajes (40 por defecto) mezclando externas y
// procedurales, caminando en círculos sobre el terreno, con clima y calidad por parámetro:
//   ?n=40&clima=noche|lluvia|despejado|niebla|arena&calidad=alta|media|baja
// Reporta FPS y renderer.info (también en window.__stress para las pruebas automáticas).

const params = new URLSearchParams(location.search);
const COUNT = Math.min(80, Number(params.get('n')) || 40);
const WEATHER = params.get('clima') ?? 'despejado';
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];

// Una de cada tres es externa (las que no tengan archivo se ven como el soldado gris)
function pickSkins() {
  const all = listSkins();
  const externals = all.filter((s) => s.type === 'external');
  const procedural = all.filter((s) => s.type !== 'external');
  return Array.from({ length: COUNT }, (_, i) => (i % 3 === 0 ? externals[(i / 3) % externals.length] : procedural[i % procedural.length]).id);
}

function Crowd({ characters, quality, night, frameRef }) {
  const { gl, camera } = useThree();
  const fps = useRef({ frames: [], value: 0 });
  useEffect(() => {
    camera.position.set(0, 34, 30);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  useFrame((_, delta) => {
    const now = performance.now();
    const dt = Math.min(delta, 0.1);
    const t = now / 1000;
    characters.forEach((c, i) => {
      // Círculos de radio y velocidad distintos alrededor de su punto de la grilla
      const cx = ((i % 8) - 3.5) * 5;
      const cy = (Math.floor(i / 8) - 2) * 5;
      const a = t * (0.6 + (i % 5) * 0.15) + i;
      const x = cx + Math.cos(a) * 1.6;
      const y = cy + Math.sin(a) * 1.6;
      c.root.position.set(x, terrainHeight(x, y), -y);
      const aim = a + Math.PI / 2;
      c.character.update({ x, y, aim, dead: false, reloading: false, aiming: i % 4 === 0, shotAgo: i % 4 === 0 ? (now + i * 97) % 600 : 1e9, weapon: i % 4, seat: null }, now, dt);
      const lod = lodFor(Math.hypot(x, y), quality, night);
      if (c.character.lod !== lod) c.character.setLod(lod);
      const shadows = quality.shadows && !(c.character.external && (night || lod === 2));
      if (c.character.shadows !== shadows) c.character.setShadows(shadows);
      frameRef.current.others.set(i, { x, y, aim, flags: 0 });
    });
    const f = fps.current;
    f.frames.push(now);
    while (f.frames.length && now - f.frames[0] > 1000) f.frames.shift();
    globalThis.__stress = {
      fps: f.frames.length,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      externals: characters.filter((c) => c.character.external).length,
      fallback: characters.filter((c) => c.character.status === 'fallback').length,
      count: characters.length,
      quality: quality.name,
      weather: WEATHER,
    };
  });
  return characters.map((c, i) => (
    <group key={i} ref={(g) => g && (c.root = g)}>
      <primitive object={c.character.visualRoot} />
    </group>
  ));
}

export default function StressTest() {
  const [, tick] = useState(0);
  const { initial, forced } = initialQuality(location.search, false);
  const quality = QUALITY[forced ?? initial];
  const night = WEATHER === 'noche';
  const look = weatherLook(WEATHER);
  const characters = useMemo(
    () => pickSkins().map((skin, i) => ({ skin, root: null, character: new Character({ skin, color: COLORS[i % COLORS.length], vest: i % 4 }) })),
    [],
  );
  // Lo que el clima necesita del "cliente" y del cuadro (linternas, centro de las partículas)
  const client = useMemo(() => ({ myId: null, lastShot: new Map(), effects: [] }), []);
  const frameRef = useRef({ me: { x: 0, y: 0, aim: 0 }, follow: null, others: new Map() });
  // Montar y liberar las skins (StrictMode monta dos veces en desarrollo)
  useEffect(() => {
    characters.forEach((c) => c.character.setSkin(c.skin));
    return () => characters.forEach((c) => c.character.dispose());
  }, [characters]);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const s = globalThis.__stress;

  return (
    <div className="relative h-full w-full bg-black">
      <Canvas shadows dpr={quality.dpr} camera={{ fov: 48, near: 0.5, far: 300 }}>
        <color attach="background" args={[look.sky]} />
        <fog attach="fog" args={[look.sky, ...(look.fog ? [look.fog[0] + 20, look.fog[1] + 30] : [60, 140])]} />
        <hemisphereLight args={['#dfe9f0', '#4a4632', look.hemi]} />
        <directionalLight position={[-22, 40, 18]} intensity={look.sun} color={look.sunColor} castShadow={quality.shadows} shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
        <MapMesh />
        <Crowd characters={characters} quality={quality} night={night} frameRef={frameRef} />
        <Weather weather={WEATHER} client={client} frameRef={frameRef} quality={quality} />
      </Canvas>
      <div className="absolute left-3 top-3 rounded bg-black/70 px-3 py-2 font-mono text-xs text-lime-300">
        <p className="font-bold text-white">Stress test de skins</p>
        {s ? (
          <>
            <p>{s.fps} fps · calidad {s.quality} · clima {s.weather}</p>
            <p>
              {s.count} personajes · {s.externals} externas cargadas · {s.fallback} con soldado gris
            </p>
            <p>
              {s.calls} llamadas · {(s.triangles / 1000).toFixed(0)}k triángulos · {s.geometries} geometrías · {s.textures} texturas
            </p>
          </>
        ) : (
          <p>Midiendo…</p>
        )}
      </div>
    </div>
  );
}
