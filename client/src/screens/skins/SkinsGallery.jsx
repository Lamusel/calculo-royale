import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SKIN_RARITIES } from '@calculo-royale/shared/skins';
import { Character, loadSkinSystem } from '../../game/character/Character.js';
import { ANIM_STATES } from '../../game/character/animation/pose.js';
import { boneNames, characterStats, CharacterDebug } from '../../game/character/debug.js';
import { getSkinEntry, listSkins } from '../../game/character/skins/index.js';
import { QUALITY } from '../../game/quality.js';
import { JeepModel } from '../../game/Vehicles.jsx';
import { modelMaterial } from '../../game/models/build.js';
import { parachuteGeometry } from '../../game/models/parachute.js';

const chuteGeometry = parachuteGeometry({ radius: 1.9, height: 4.6, hook: 1.9, colors: ['#e9d77a', '#2f7d4a'] });

// Dónde queda el jeep respecto al jugador sentado (shared/vehicle.js: seatPosition con rumbo 0)
const JEEP_AT = { drive: [-0.15, 0, 0.45], passenger: [0.75, 0, -0.35] };

// Galería de skins (/skins): cada skin con sus animaciones, LOD, calidad, estadísticas y
// depuración. Se carga con import() dinámico: no pesa en el juego.

const ANIM_LABELS = { idle: 'Idle', walk: 'Walk', run: 'Run', aim: 'Aim', shoot: 'Shoot', reload: 'Reload', death: 'Death', victory: 'Victory', drive: 'Drive', passenger: 'Pasajero', fall: 'Caída', chute: 'Paracaídas' };
const TYPE_LABELS = { procedural: 'Procedural', external: 'Externa (GLB)' };
const MODE_LABELS = { A: 'A · estático', B: 'B · esqueleto propio', C: 'C · Master Rig (alias)' };

// Entrada de animación para cada botón (el personaje no se desplaza: solo cuenta la velocidad)
function animInput(anim, t, state) {
  const speed = anim === 'run' ? 8 : anim === 'walk' ? 3 : 0;
  state.x += speed * state.dt;
  const loop = (ms) => t % ms;
  return {
    x: state.x,
    y: 0,
    aim: 0,
    dead: anim === 'death' && loop(2600) < 2000,
    reloading: anim === 'reload',
    aiming: anim === 'aim' || anim === 'shoot',
    shotAgo: anim === 'shoot' ? loop(320) : 1e9,
    weapon: 2,
    seat: anim === 'drive' ? 'driver' : anim === 'passenger' ? 'passenger' : null,
    seatYaw: 0,
    victory: anim === 'victory',
    air: anim === 'fall' || anim === 'chute' ? anim : null,
  };
}

function Viewer({ character, anim, debug, info, autoRotate }) {
  const { camera, gl, scene } = useThree();
  const controls = useMemo(() => new OrbitControls(camera, gl.domElement), [camera, gl]);
  const helper = useRef(null);
  const state = useRef({ x: 0, dt: 0 }).current;
  useEffect(() => {
    controls.target.set(0, 1.0, 0);
    controls.minDistance = 1.5;
    controls.maxDistance = 14;
    return () => controls.dispose();
  }, [controls]);
  useEffect(() => {
    if (!debug.skeleton && !debug.box && !debug.sockets) return undefined;
    const d = new CharacterDebug(character, scene);
    d.boxHelper.visible = debug.box;
    d.lines.visible = debug.skeleton;
    d.axes.forEach((a) => (a.visible = debug.sockets));
    helper.current = d;
    return () => {
      d.dispose();
      helper.current = null;
    };
  }, [character, scene, debug, info.current.status]);
  useFrame((_, delta) => {
    state.dt = Math.min(delta, 0.1);
    const t = performance.now();
    character.update(animInput(anim, t, state), t, state.dt);
    controls.autoRotate = autoRotate;
    controls.update();
    helper.current?.update();
    info.current.calls = gl.info.render.calls;
  });
  return <primitive object={character.visualRoot} />;
}

export default function SkinsGallery() {
  const skins = useMemo(() => listSkins(), []);
  const [selected, setSelected] = useState(skins[0].id);
  const [anim, setAnim] = useState('idle');
  const [lod, setLod] = useState(0);
  const [quality, setQuality] = useState('high');
  const [autoRotate, setAutoRotate] = useState(true);
  // Equipo completo puesto (casco 3, mochila 3 y todos los accesorios): para ver cómo luce cada skin
  const [gear, setGear] = useState(false);
  const [debug, setDebug] = useState({ skeleton: false, box: false, sockets: false, names: false });
  const [status, setStatus] = useState({});
  const [, tick] = useState(0);
  const info = useRef({ calls: 0, status: 'idle' });
  const character = useMemo(() => {
    const c = new Character({ skin: selected, color: '#f97316', vest: 2 });
    c.setWeapon(2); // con el arma en la mano, para ajustar weaponOffset
    return c;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const entry = getSkinEntry(selected);
  const q = QUALITY[quality];

  useEffect(() => character.setSkin(selected), [character, selected]);
  useEffect(() => {
    character.setLod(lod);
    character.setShadows(q.shadows && lod < 2);
  }, [character, lod, q, info.current.status]);
  useEffect(() => () => character.dispose(), [character]);
  // ¿Qué externas tienen su archivo?
  useEffect(() => {
    loadSkinSystem().then(async (m) => {
      const entries = await Promise.all(skins.filter((s) => s.type === 'external').map(async (s) => [s.id, await m.assetStatus(s)]));
      setStatus(Object.fromEntries(entries));
    });
  }, [skins]);
  // El panel se refresca 4 veces por segundo
  useEffect(() => {
    const id = setInterval(() => {
      info.current.status = character.status;
      tick((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, [character]);

  const stats = characterStats(character);
  const ext = character.external;
  const file = ext?.stats();
  const pending = entry.type === 'external' && status[entry.id] === 'missing';
  const rarity = SKIN_RARITIES[entry.rarity] ?? SKIN_RARITIES.comun;
  const toggle = (key) => setDebug((d) => ({ ...d, [key]: !d[key] }));
  const chip = (active) => `rounded px-2 py-1 text-xs ${active ? 'bg-khaki font-bold text-olive-950' : 'bg-black/40 text-stone-200'}`;

  return (
    <div className="flex h-full w-full flex-col bg-olive-950 text-stone-100 md:flex-row">
      <div className="relative h-[55%] min-h-0 flex-1 md:h-full">
        <Canvas shadows dpr={q.dpr} camera={{ fov: 35, position: [4.2, 2.4, 4.2] }}>
          <color attach="background" args={['#2a3220']} />
          <hemisphereLight args={['#e8eef2', '#3a3628', 1.4]} />
          <directionalLight position={[3, 6, 2]} intensity={2} castShadow={q.shadows} shadow-mapSize={[1024, 1024]} />
          <Viewer character={character} anim={anim} debug={debug} info={info} autoRotate={autoRotate} />
          {JEEP_AT[anim] && <JeepModel position={JEEP_AT[anim]} />}
          {anim === 'chute' && <mesh geometry={chuteGeometry} material={modelMaterial} />}
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <circleGeometry args={[2.2, 48]} />
            <meshLambertMaterial color="#3f4f26" />
          </mesh>
        </Canvas>
        <div className="absolute left-3 top-3 rounded bg-black/60 px-3 py-2">
          <p className="text-lg font-black uppercase">{entry.name}</p>
          <p className="text-xs text-stone-300">
            <b style={{ color: rarity.color }}>{rarity.name}</b> · {TYPE_LABELS[entry.type]}
            {ext && ` · modo ${MODE_LABELS[ext.mode]}`}
          </p>
          {pending && <p className="text-xs font-bold text-orange-300">{entry.name} · Asset pendiente</p>}
          {character.status === 'loading' && <p className="text-xs text-sky-300">Cargando…</p>}
          {character.status === 'fallback' && !pending && <p className="text-xs text-red-300">No se pudo cargar: se ve el soldado base</p>}
        </div>
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1">
          {ANIM_STATES.map((a) => (
            <button key={a} onClick={() => setAnim(a)} className={chip(anim === a)}>
              {ANIM_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
      <aside className="flex max-h-[45%] w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-khaki-dark/40 p-3 text-sm md:max-h-none md:w-96 md:border-l md:border-t-0">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-stone-400">LOD</span>
          {[0, 1, 2].map((l) => (
            <button key={l} onClick={() => setLod(l)} className={chip(lod === l)}>
              LOD{l}
            </button>
          ))}
          <span className="ml-2 mr-1 text-xs text-stone-400">Calidad</span>
          {['high', 'medium', 'low'].map((k) => (
            <button key={k} onClick={() => setQuality(k)} className={chip(quality === k)}>
              {QUALITY[k].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button onClick={() => setAutoRotate((v) => !v)} className={chip(autoRotate)}>
            Girar
          </button>
          <button
            onClick={() => {
              character.setGear(gear ? null : { helmet: 3, backpack: 3, scope: 'scope4x', mag: true, stock: true, muzzle: true });
              setGear(!gear);
            }}
            className={chip(gear)}
          >
            Equipo
          </button>
          {[['skeleton', 'Esqueleto'], ['box', 'Caja'], ['sockets', 'Sockets'], ['names', 'Huesos']].map(([k, label]) => (
            <button key={k} onClick={() => toggle(k)} className={chip(debug[k])}>
              {label}
            </button>
          ))}
          <span className="text-[10px] text-stone-500">Rueda o pellizco: zoom</span>
        </div>
        <table className="font-mono text-xs">
          <tbody>
            {[
              ['Triángulos', stats.triangles],
              ['Mallas', stats.meshes],
              ['Materiales', stats.materials],
              ['Texturas', stats.textures],
              ['Llamadas de dibujo (escena)', info.current.calls],
              ...(file
                ? [
                    ['Archivo', `${(file.bytes / 1048576).toFixed(2)} MB`],
                    ['Triángulos del archivo', file.triangles],
                    ['Textura más grande', file.maxTexture ? `${file.maxTexture} px` : '—'],
                    ['Clips', file.animations.join(', ') || '—'],
                  ]
                : []),
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="pr-3 text-stone-400">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {file?.warnings.length > 0 && (
          <div className="rounded border border-orange-400/60 bg-orange-950/50 p-2 text-xs text-orange-200">
            <p className="font-bold">Pesado para celular:</p>
            {file.warnings.map((w) => (
              <p key={w}>· {w}</p>
            ))}
          </div>
        )}
        {debug.names && <p className="font-mono text-[10px] leading-relaxed text-cyan-200">{boneNames(character).join(' · ')}</p>}
        <div className="flex flex-col gap-1">
          {skins.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`flex items-center gap-2 rounded px-2 py-1 text-left ${selected === s.id ? 'bg-khaki/20 ring-1 ring-khaki' : 'bg-black/25'}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: (SKIN_RARITIES[s.rarity] ?? SKIN_RARITIES.comun).color }} />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto text-[10px] text-stone-400">
                {s.type === 'external' ? (status[s.id] === 'missing' ? 'Asset pendiente' : 'GLB') : s.collection}
              </span>
            </button>
          ))}
        </div>
        <a href="/skins/stress" className="text-xs text-khaki-light underline">
          Stress test con 40 personajes →
        </a>
      </aside>
    </div>
  );
}
