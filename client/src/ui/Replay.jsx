import { useEffect, useMemo, useRef, useState } from 'react';
import Scene from '../game/Scene.jsx';
import { ReplayClient } from '../net/ReplayClient.js';
import { Letterbox } from './Cinema.jsx';
import WeaponIcon from './WeaponIcon.jsx';

const KIND_LABELS = {
  runover: 'Atropello',
  sniper: 'Tiro lejano',
  multikill: 'Multi-baja',
  final: 'Baja final',
  kill: 'Mejor jugada',
  killcam: 'Kill cam',
};

// Repetición de la mejor jugada antes de los resultados: escena propia, cámara lenta y botón Saltar
export default function Replay({ replay, room, quality, onDone }) {
  const client = useMemo(() => new ReplayClient(replay), [replay]);
  const frameRef = useRef({
    me: null, meInfo: null, others: new Map(), grenades: new Map(), vehicles: new Map(), dummies: [], crates: [], alarms: [], zone: [], airdrop: [],
  });
  const finished = useRef(false);
  const [, tick] = useState(0);
  const finish = useRef(onDone);
  finish.current = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    let endTimer;
    const id = setInterval(() => {
      tick((n) => n + 1);
      if (client.done && !endTimer) endTimer = setTimeout(() => finish.current(), 900);
    }, 120);
    return () => {
      clearInterval(id);
      clearTimeout(endTimer);
    };
  }, [client]);

  return (
    <div className="absolute inset-0 z-40 bg-black">
      <Scene
        client={client}
        roster={room.players}
        myId={null}
        phase="playing"
        frameRef={frameRef}
        quality={quality}
        onFrame={() => {}}
        weather={room.weather}
        windAngle={room.windAngle}
      />
      <Letterbox />
      <div className="pointer-events-none absolute left-4 top-[2.5vh] z-50 flex items-center gap-3 text-stone-100">
        <span className="flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-black uppercase tracking-widest">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Repetición
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-khaki-light">{KIND_LABELS[replay.kind] ?? KIND_LABELS.kill}</span>
        {replay.kind === 'killcam' && (
          <span className="flex items-center gap-2 rounded bg-black/60 px-2 py-0.5 text-sm">
            <b>{replay.killer}</b>
            <WeaponIcon weapon={replay.weapon} className="h-4 w-12 text-khaki-light" />
            <span className="font-mono text-red-300">❤ {replay.hp}</span>
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[3vh] z-50 flex flex-col items-center gap-1.5 px-4 text-center">
        <p className="text-xl font-black uppercase tracking-wide text-white drop-shadow sm:text-2xl">{replay.title}</p>
        <div className="h-1 w-56 overflow-hidden rounded bg-white/20">
          <div className="h-full bg-khaki" style={{ width: `${client.progress * 100}%` }} />
        </div>
      </div>
      {client.slow && (
        <p className="pointer-events-none absolute right-4 top-[14vh] z-50 font-mono text-xs uppercase tracking-[0.3em] text-khaki-light">
          ◀◀ Cámara lenta
        </p>
      )}
      <button
        onPointerUp={() => finish.current()}
        className="absolute right-4 top-[2vh] z-50 rounded bg-white/15 px-3 py-1 text-sm font-bold text-white backdrop-blur"
      >
        Saltar ▶▶
      </button>
    </div>
  );
}
