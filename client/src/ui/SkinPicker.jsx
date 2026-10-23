import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ACHIEVEMENTS, SKIN_RARITIES } from '@calculo-royale/shared/skins';
import { loadSkinSystem } from '../game/character/Character.js';
import { externalSkins, getSkinEntry, listSkins } from '../game/character/skins/index.js';
import { loadProgress, loadSkin, saveSkin, unlockedSkins } from '../achievements.js';
import SoldierModel from '../game/SoldierModel.jsx';

// Vista 3D girando de una skin (con chaleco 2 para ver cómo luce en partida)
function Turntable({ skin, color }) {
  const group = useRef(null);
  useFrame((_, delta) => (group.current.rotation.y += delta * 0.8));
  return (
    <group ref={group}>
      <SoldierModel skin={skin} color={color} vest={2} />
    </group>
  );
}

export function SkinPreview({ skin, color, className }) {
  return (
    <Canvas className={className} dpr={[1, 1.5]} camera={{ fov: 32, position: [3.4, 2.1, 3.4] }} onCreated={({ camera }) => camera.lookAt(0, 1.1, 0)}>
      <hemisphereLight args={['#e8eef2', '#3a3628', 1.6]} />
      <directionalLight position={[3, 5, 2]} intensity={1.8} />
      <Turntable skin={skin} color={color} />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.1, 32]} />
        <meshLambertMaterial color="#2f3a1e" />
      </mesh>
    </Canvas>
  );
}

const SKINS = listSkins();
const COLLECTIONS = [...new Set(SKINS.map((s) => s.collection))];

// Qué skins externas tienen su archivo (las demás dicen "Asset pendiente")
function useExternalStatus() {
  const [status, setStatus] = useState({});
  useEffect(() => {
    let alive = true;
    loadSkinSystem().then(async (m) => {
      const entries = await Promise.all(externalSkins().map(async (e) => [e.id, await m.assetStatus(e)]));
      if (alive) setStatus(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

// Selector del lobby: colecciones, rareza, candado de las de honor con su logro
export default function SkinPicker({ color, onChoose, onClose }) {
  const progress = loadProgress();
  const unlocked = new Set(unlockedSkins(progress));
  const [current] = useState(loadSkin);
  const [selected, setSelected] = useState(current);
  const external = useExternalStatus();
  const skin = getSkinEntry(selected);
  const pending = skin.type === 'external' && external[skin.id] === 'missing';
  const rarity = SKIN_RARITIES[skin.rarity];
  const locked = skin.rarity === 'honor' && !unlocked.has(skin.id);
  const achievement = skin.achievement && ACHIEVEMENTS[skin.achievement];

  return (
    <div className="absolute inset-0 z-50 flex bg-black/80 p-2 text-stone-100 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-5xl gap-3 overflow-hidden rounded-lg border border-khaki-dark bg-olive-950/95 p-3">
        <div className="flex w-[42%] shrink-0 flex-col gap-2">
          <SkinPreview skin={skin.id} color={color} className="min-h-0 flex-1 rounded bg-gradient-to-b from-olive-800 to-olive-950" />
          <div>
            <p className="text-lg font-black uppercase tracking-wide">{skin.name}</p>
            <p className="text-xs text-stone-400">
              {skin.collection} · <b style={{ color: rarity.color }}>{rarity.name}</b>
            </p>
            {pending && <p className="mt-1 text-xs text-orange-300">Asset pendiente: se verá el soldado gris hasta que pongas su archivo</p>}
            {achievement && (
              <p className={`mt-1 text-xs ${locked ? 'text-orange-300' : 'text-green-300'}`}>
                {locked ? '🔒 ' : '✓ '}
                {achievement.description} ({Math.min(progress[skin.achievement], achievement.goal)}/{achievement.goal})
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              disabled={locked}
              onClick={() => {
                saveSkin(skin.id);
                onChoose(skin.id);
                onClose();
              }}
              className="flex-1 rounded bg-khaki py-2 font-bold text-olive-950 disabled:opacity-40"
            >
              {selected === current ? 'Usando esta' : 'Usar esta skin'}
            </button>
            <button onClick={onClose} className="rounded bg-black/40 px-3 py-2 text-sm">
              Cerrar
            </button>
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto pr-1">
          {COLLECTIONS.map((collection) => (
            <div key={collection} className="mb-3">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-khaki-light">{collection}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {SKINS.filter((s) => s.collection === collection).map((s) => {
                  const isLocked = s.rarity === 'honor' && !unlocked.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      className={`flex items-center gap-2 rounded border px-2 py-1.5 text-left text-sm ${
                        selected === s.id ? 'border-khaki bg-khaki/15' : 'border-white/10 bg-black/30'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SKIN_RARITIES[s.rarity].color }} />
                      <span className={`truncate ${isLocked ? 'text-stone-500' : ''}`}>{s.name}</span>
                      {isLocked && <span className="ml-auto text-xs">🔒</span>}
                      {s.type === 'external' && external[s.id] === 'missing' && <span className="ml-auto text-[10px] text-orange-300">pendiente</span>}
                      {s.id === current && <span className="ml-auto text-[10px] text-khaki-light">en uso</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
