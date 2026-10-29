import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import { teamName } from '@calculo-royale/shared/constants';
import { DEFAULT_SKIN } from '@calculo-royale/shared/skins';
import SoldierModel from '../game/SoldierModel.jsx';

// Podio de la victoria (7A): los 3 primeros con sus skins (1.º al centro y más alto), confeti y la frase
// de la victoria con la tarjeta del ganador. Escena chica y fija (sin sombras ni niebla).
const SPOTS = [
  { place: 1, x: 0, h: 1.1, color: '#c9a227' },
  { place: 2, x: -1.7, h: 0.75, color: '#9ca3af' },
  { place: 3, x: 1.7, h: 0.5, color: '#b0692f' },
];
const CONFETTI = Array.from({ length: 46 }, (_, i) => ({
  left: `${(i * 23) % 100}%`,
  delay: `${-((i * 0.37) % 4)}s`,
  duration: `${3 + (i % 5) * 0.6}s`,
  color: ['#f5d142', '#e8731a', '#4ade80', '#60a5fa', '#f472b6', '#ffffff'][i % 6],
  rot: (i * 47) % 360,
}));

export default function Podium({ ranking, winnerId }) {
  const top = useMemo(() => {
    const byPlace = [...ranking].sort((a, b) => a.place - b.place);
    const first = ranking.find((r) => r.id === winnerId) ?? byPlace[0];
    return [first, ...byPlace.filter((r) => r !== first)].slice(0, 3);
  }, [ranking, winnerId]);
  const winner = top[0];
  if (!winner) return null;
  return (
    <div className="relative h-[min(46vh,22rem)] overflow-hidden rounded-lg border border-khaki-dark bg-gradient-to-b from-olive-900 via-olive-950 to-black">
      <Canvas dpr={[1, 1.5]} camera={{ fov: 32, position: [0, 2.3, 7.2] }} onCreated={({ camera }) => camera.lookAt(0, 1.2, 0)}>
        <hemisphereLight args={['#fff7e0', '#2c3418', 1.4]} />
        <directionalLight position={[3, 6, 4]} intensity={2} />
        {SPOTS.map((s, i) => {
          const r = top[i];
          return (
            <group key={s.place} position={[s.x, 0, 0]}>
              <mesh position={[0, s.h / 2, 0]}>
                <boxGeometry args={[1.4, s.h, 1.2]} />
                <meshLambertMaterial color={s.color} />
              </mesh>
              {r && <SoldierModel skin={r.skin ?? DEFAULT_SKIN} color={r.color} vest={2} position={[0, s.h, 0]} rotation-y={-Math.PI / 2 + (s.x ? -s.x * 0.12 : 0)} />}
            </group>
          );
        })}
      </Canvas>
      {/* Confeti */}
      <div className="pointer-events-none absolute inset-0">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute top-0 block h-2.5 w-1.5 animate-[confetti_4s_linear_infinite]"
            style={{ left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.duration, transform: `rotate(${c.rot}deg)` }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
        <p className="animate-[popin_0.7s_ease-out] text-2xl font-black uppercase tracking-wider text-yellow-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-4xl">¡Victoria! Una integral para cenar</p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="animate-[popin_0.9s_ease-out] rounded-lg border border-yellow-400/60 bg-black/70 px-4 py-1.5 text-center">
          <p className="text-lg font-black text-khaki">🏆 {winner.name}</p>
          <p className="text-xs text-stone-300">
            {winner.team ? `${teamName(winner.team)} · ` : ''}
            {winner.kills} bajas · {winner.correct}/{winner.answered} aciertos · {winner.score} pts
          </p>
        </div>
      </div>
      {SPOTS.map((s, i) =>
        top[i] ? (
          <p key={s.place} className="pointer-events-none absolute bottom-16 -translate-x-1/2 font-mono text-[11px] font-bold text-stone-100 drop-shadow" style={{ left: `${50 + s.x * 13}%` }}>
            {s.place}° {top[i].name}
          </p>
        ) : null,
      )}
    </div>
  );
}
