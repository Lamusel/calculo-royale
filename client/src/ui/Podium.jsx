import { useMemo } from 'react';
import { teamColor, teamName } from '@calculo-royale/shared/constants';
import { DEFAULT_SKIN } from '@calculo-royale/shared/skins';
import { getSkinEntry } from '../game/character/skins/index.js';
import { SkinPortrait } from './SkinPicker.jsx';

// Podio de la victoria: los 3 primeros con el retrato de su skin (el mismo del selector; las
// procedurales con su retrato generado) en una tarjeta sobre cada escalón, con nombre y puesto, confeti
// y la frase de la victoria con la tarjeta del ganador. Sin modelos 3D (de cerca se veían mal).
const STEPS = [
  { place: 2, h: '34%', color: '#9ca3af' },
  { place: 1, h: '48%', color: '#c9a227' },
  { place: 3, h: '24%', color: '#b0692f' },
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
    <div className="relative h-[min(52vh,24rem)] overflow-hidden rounded-lg border border-khaki-dark bg-gradient-to-b from-olive-900 via-olive-950 to-black">
      <p className="relative z-10 mt-3 animate-[popin_0.7s_ease-out] text-center text-2xl font-black uppercase tracking-wider text-yellow-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-4xl">
        ¡Victoria! Una integral para cenar
      </p>
      {/* Escalones con la tarjeta de cada uno encima */}
      <div className="absolute inset-x-0 bottom-0 flex h-[78%] items-end justify-center gap-2 px-3 sm:gap-4">
        {STEPS.map((s, i) => {
          const r = top[s.place - 1];
          return (
            <div key={s.place} className="flex h-full w-[min(30%,10rem)] flex-col items-center justify-end">
              {r && (
                <div
                  className="mb-1.5 flex w-full animate-[popin_0.6s_ease-out_both] flex-col items-center rounded-lg border bg-black/60 p-1.5 text-center shadow-lg"
                  style={{ borderColor: s.color, animationDelay: `${0.3 + i * 0.25}s` }}
                >
                  <SkinPortrait skin={getSkinEntry(r.skin ?? DEFAULT_SKIN)} className={`aspect-[3/4] w-full rounded ${s.place === 1 ? 'max-h-[9rem]' : 'max-h-[7rem]'}`} />
                  <p className="mt-1 w-full truncate text-xs font-bold sm:text-sm" style={{ color: r.color }}>
                    {r.name}
                  </p>
                  {r.team && (
                    <p className="w-full truncate text-[10px]" style={{ color: teamColor(r.team) }}>
                      {teamName(r.team)}
                    </p>
                  )}
                </div>
              )}
              <div className="flex w-full items-start justify-center rounded-t-md pt-1 font-black text-black/70" style={{ height: s.h, background: `linear-gradient(${s.color}, ${s.color}99)` }}>
                {s.place}°
              </div>
            </div>
          );
        })}
      </div>
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
      {/* Tarjeta del ganador */}
      <div className="pointer-events-none absolute left-3 top-14 z-10 hidden animate-[popin_0.9s_ease-out] rounded-lg border border-yellow-400/60 bg-black/70 px-3 py-1.5 sm:block">
        <p className="text-base font-black text-khaki">🏆 {winner.name}</p>
        <p className="text-xs text-stone-300">
          {winner.kills} bajas · {winner.correct}/{winner.answered} aciertos · {winner.score} pts
        </p>
      </div>
    </div>
  );
}
