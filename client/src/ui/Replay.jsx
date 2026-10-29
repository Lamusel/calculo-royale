import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSkinSystem } from '../game/character/Character.js';
import { isExternalSkin } from '../game/character/skins/index.js';
import Scene from '../game/Scene.jsx';
import { ReplayClient } from '../net/ReplayClient.js';
import { Letterbox } from './Cinema.jsx';
import WeaponIcon from './WeaponIcon.jsx';

const KIND_LABELS = {
  runover: 'Atropello',
  sniper: 'Tiro lejano',
  multikill: 'Multi-baja',
  final: 'Baja final',
  rocket: 'Lanzacohetes',
  zipline: 'Desde la tirolina',
  melee: 'Arma blanca',
  kill: 'Mejor jugada',
  killcam: 'Kill cam',
};

// Precarga los GLB de las skins de quienes salen en las repeticiones; listo cuando cargaron (máx. 3 s)
function usePreloadedSkins(clips, players) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const ids = new Set(clips.flatMap((c) => c.frames.flatMap((f) => f[1].map((e) => e[0]))));
    const skins = players.filter((p) => ids.has(p.id)).map((p) => p.skin);
    if (!skins.some(isExternalSkin)) {
      setReady(true);
      return undefined;
    }
    let alive = true;
    const go = () => alive && setReady(true);
    const timer = setTimeout(go, 3000);
    loadSkinSystem()
      .then((m) => m.preloadMatchSkins(skins))
      .finally(() => {
        clearTimeout(timer);
        go();
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);
  return ready;
}

// Repeticiones (las 3 mejores jugadas antes de los resultados, o la kill cam): escena propia, cámara
// lenta en el momento clave y Saltar (salta todas). Empiezan cuando cargaron las skins de quienes salen.
export default function Replay({ replay, room, quality, onDone }) {
  const clips = useMemo(() => replay.clips ?? [replay], [replay]);
  const [index, setIndex] = useState(0);
  const ready = usePreloadedSkins(clips, room.players);
  const clip = clips[Math.min(index, clips.length - 1)];
  const client = useMemo(() => new ReplayClient(clip), [clip]);
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
      // Al terminar una jugada pasa a la siguiente; después de la última, los resultados
      if (client.done && !endTimer) endTimer = setTimeout(() => (index + 1 < clips.length ? setIndex(index + 1) : finish.current()), 900);
    }, 120);
    return () => {
      clearInterval(id);
      clearTimeout(endTimer);
    };
  }, [client, index, clips.length]);

  return (
    <div className="absolute inset-0 z-40 bg-black">
      {!ready && <p className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-stone-400">Cargando la repetición…</p>}
      {ready && <Scene
        client={client}
        roster={room.players}
        myId={null}
        phase="playing"
        frameRef={frameRef}
        quality={quality}
        onFrame={() => {}}
        weather={room.weather}
        windAngle={room.windAngle}
      />}
      <Letterbox />
      <div className="pointer-events-none absolute left-4 top-[2.5vh] z-50 flex items-center gap-3 text-stone-100">
        <span className="flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-black uppercase tracking-widest">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Repetición
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-khaki-light">
          {KIND_LABELS[clip.kind] ?? KIND_LABELS.kill}
          {clips.length > 1 && ` · jugada ${index + 1}/${clips.length}`}
        </span>
        {replay.kind === 'killcam' && (
          <span className="flex items-center gap-2 rounded bg-black/60 px-2 py-0.5 text-sm">
            <b>{replay.killer}</b>
            <WeaponIcon weapon={replay.weapon} className="h-4 w-12 text-khaki-light" />
            <span className="font-mono text-red-300">❤ {replay.hp}</span>
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[3vh] z-50 flex flex-col items-center gap-1.5 px-4 text-center">
        <p className="text-xl font-black uppercase tracking-wide text-white drop-shadow sm:text-2xl">{clip.title}</p>
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
