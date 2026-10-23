import { useEffect, useState } from 'react';
import { getSkinEntry } from '../game/character/skins/index.js';

// Barras de cine arriba y abajo (entran deslizándose)
export function Letterbox({ visible = true }) {
  const bar = `pointer-events-none absolute inset-x-0 z-40 h-[11vh] bg-black transition-transform duration-500`;
  return (
    <>
      <div className={`${bar} top-0 ${visible ? 'translate-y-0' : '-translate-y-full'}`} />
      <div className={`${bar} bottom-0 ${visible ? 'translate-y-0' : 'translate-y-full'}`} />
    </>
  );
}

// Presentación del duelo final: barras de cine, "DUELO FINAL" y el finalista que muestra la cámara
export function DuelIntro({ client, roster }) {
  const [now, setNow] = useState(performance.now());
  const active = client.duelIntro(now);
  useEffect(() => {
    if (!client.duel) return undefined;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [client, client.duel]);
  if (!client.duel) return null;
  const elapsed = now - client.duel.at;
  // Un momento después de la presentación todavía queda el aviso pequeño
  if (!active) {
    return elapsed < client.duel.introMs + 2500 ? (
      <p className="pointer-events-none absolute left-1/2 top-[22%] z-30 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-sm font-black uppercase tracking-[0.3em] text-red-400">
        ¡A muerte!
      </p>
    ) : null;
  }
  const id = client.duel.ids[elapsed < client.duel.introMs / 2 ? 0 : 1];
  const player = roster.find((p) => p.id === id);
  const skin = getSkinEntry(player?.skin);
  return (
    <>
      <Letterbox />
      <div className="pointer-events-none absolute inset-x-0 top-[13vh] z-40 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.5em] text-khaki-light">Quedan dos</p>
        <p className="text-5xl font-black uppercase tracking-[0.15em] text-red-500 drop-shadow-lg sm:text-6xl">Duelo final</p>
      </div>
      {player && (
        <div key={id} className="pointer-events-none absolute bottom-[14vh] left-6 z-40 animate-[slidein_400ms_ease-out]">
          <p className="text-3xl font-black uppercase drop-shadow" style={{ color: player.color }}>
            {player.name}
          </p>
          <p className="text-sm text-stone-300">{skin.name}</p>
        </div>
      )}
    </>
  );
}
