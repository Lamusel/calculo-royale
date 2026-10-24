import { useCallback, useEffect, useRef, useState } from 'react';
import { ROOM_CODE_LENGTH } from '@calculo-royale/shared/constants';
import { EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { QUALITY } from '../game/quality.js';
import Scene from '../game/Scene.jsx';
import { GameClient } from '../net/GameClient.js';
import { socket } from '../net/socket.js';
import { ClassTopics } from '../ui/HostPanel.jsx';
import Killfeed from '../ui/Killfeed.jsx';
import { RadioFeed } from '../ui/Radio.jsx';
import Results from '../ui/Results.jsx';
import Replay from '../ui/Replay.jsx';
import { DuelIntro } from '../ui/Cinema.jsx';
import { direct } from '../game/director.js';

// En el proyector se ve todo el mapa: sin sombras (la caja de sombras sigue a un jugador)
// y sin niebla
const PROJECTOR_QUALITY = { ...QUALITY.high, shadows: false, fog: [400, 600] };

// Vista para proyector: /espectador?code=ABCD. Mira la sala sin ser jugador.
export default function Spectator() {
  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get('code') ?? '').toUpperCase());
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [client, setClient] = useState(null);
  const [, tick] = useState(0);
  const frameRef = useRef({ me: null, meInfo: null, others: new Map(), grenades: new Map(), dummies: [], crates: [], alarms: [], zone: [], airdrop: [] });
  // Segunda vista para la pantalla partida del duelo final
  const frameRef2 = useRef({ me: null, meInfo: null, others: new Map(), grenades: new Map(), dummies: [], crates: [], alarms: [], zone: [], airdrop: [] });
  const [replayDone, setReplayDone] = useState(false);
  const onReplayDone = useCallback(() => setReplayDone(true), []);
  // Director automático: elige la toma (los botones manuales lo apagan)
  const [director, setDirector] = useState(true);
  const shot = useRef(null);

  useEffect(() => {
    const onInfo = (info) => setRoom(info);
    socket.on(EVENTS.ROOM_INFO, onInfo);
    return () => socket.off(EVENTS.ROOM_INFO, onInfo);
  }, []);

  // Conectarse como espectador (y otra vez si el socket se reconecta)
  useEffect(() => {
    if (code.length !== ROOM_CODE_LENGTH) return;
    const join = () =>
      socket.emit(EVENTS.ROOM_SPECTATE, { code }, (res) => {
        if (!res?.ok) setError(res?.error ?? 'No se pudo conectar');
        else setError('');
      });
    if (socket.connected) join();
    socket.on('connect', join);
    return () => socket.off('connect', join);
  }, [code]);

  useEffect(() => {
    if (!room) return;
    const c = new GameClient(socket, null, room.phase);
    setClient(c);
    return () => c.dispose();
    // El cliente se crea una sola vez por sala
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code]);

  useEffect(() => {
    client?.setPhase(room?.phase);
    if (room?.phase !== 'results') setReplayDone(false);
  }, [client, room?.phase]);

  // La interfaz lateral se refresca 2 veces por segundo (y el director decide la toma)
  useEffect(() => {
    const id = setInterval(() => {
      tick((n) => n + 1);
      if (!director || !client) return;
      const now = performance.now();
      shot.current = direct({ phase: room?.phase, players: frameRef.current.others, killfeed: client.killfeed, lastShot: client.lastShot }, shot.current, now);
      client.followId = shot.current?.id ?? null;
    }, 500);
    return () => clearInterval(id);
  }, [director, client, room?.phase]);

  const alive = [...frameRef.current.others.values()].filter((p) => !(p.flags & PLAYER_FLAGS.DEAD)).length;

  if (!room) {
    return (
      <main className="flex h-full items-center justify-center bg-olive-950 p-4 text-stone-100">
        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-khaki-light">Vista para proyector</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH))}
            placeholder="CÓDIGO"
            className="rounded bg-black/40 px-4 py-3 text-center font-mono text-3xl tracking-[0.4em] outline-none"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </main>
    );
  }

  const following = room.players.find((p) => p.id === client?.followId);
  const replaying = room.phase === 'results' && Boolean(client?.replay) && !replayDone;
  // Duelo final (después de la presentación): pantalla partida, una cámara por finalista
  const split = Boolean(client && room.phase === 'playing' && client.duel && !client.duelIntro());

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-stone-900 text-stone-100">
      <div className="relative min-w-0 flex-1">
        {replaying && <Replay replay={client.replay} room={room} quality={PROJECTOR_QUALITY} onDone={onReplayDone} />}
        {client && !replaying && !split && (
          <Scene client={client} roster={room.players} myId={null} phase={room.phase} frameRef={frameRef} quality={PROJECTOR_QUALITY} onFrame={() => {}} overview weather={room.weather} windAngle={room.windAngle} />
        )}
        {split && (
          <div className="flex h-full w-full gap-1 bg-black">
            {client.duel.ids.map((id, i) => {
              const finalist = room.players.find((p) => p.id === id);
              return (
                <div key={id} className="relative h-full min-w-0 flex-1">
                  <Scene
                    client={client}
                    roster={room.players}
                    myId={null}
                    phase={room.phase}
                    frameRef={i === 0 ? frameRef : frameRef2}
                    quality={PROJECTOR_QUALITY}
                    onFrame={() => {}}
                    weather={room.weather}
                    windAngle={room.windAngle}
                    followId={id}
                  />
                  <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-2xl font-black uppercase" style={{ color: finalist?.color }}>
                    {finalist?.name}
                  </p>
                </div>
              );
            })}
            <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/70 px-3 py-1 text-3xl font-black text-red-500">
              VS
            </p>
          </div>
        )}
        {client && room.phase === 'playing' && <DuelIntro client={client} roster={room.players} />}
        {client && <Killfeed killfeed={client.killfeed} roster={room.players} myId={null} />}
        {client && <RadioFeed radio={client.radio} />}
        {client && room.phase === 'results' && !replaying && <Results results={client.results} mine={null} myId={null} isHost={false} onReset={() => {}} classStats={client.classStats} csv={client.csv} />}
      </div>
      <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-khaki-dark/50 bg-olive-950/95 p-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-khaki-light">Sala</p>
          <p className="font-mono text-5xl font-black tracking-[0.15em] text-khaki">{room.code}</p>
        </div>
        <p className="text-lg">
          {room.phase === 'lobby' ? 'En el campo de entrenamiento' : room.phase === 'results' ? 'Partida terminada' : `Vivos: ${alive} de ${room.players.length}`}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setDirector((d) => !d)} className={`rounded px-2 py-1 ${director ? 'bg-khaki font-bold text-olive-950' : 'bg-black/40'}`} title="La cámara elige sola a quién seguir">
            🎬 Director
          </button>
          <button onClick={() => { setDirector(false); if (client) client.followId = null; }} className="rounded bg-black/40 px-2 py-1">
            Mapa
          </button>
          <button onClick={() => { setDirector(false); client?.cycleFollow(-1); }} className="rounded bg-black/40 px-2 py-1">
            ◀
          </button>
          <button onClick={() => { setDirector(false); client?.cycleFollow(1); }} className="rounded bg-black/40 px-2 py-1">
            ▶
          </button>
          <span className="truncate text-stone-300">{following ? following.name : 'plano general'}</span>
        </div>
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Acierto de la clase por tema</p>
          <ClassTopics stats={client?.classStats} />
        </div>
      </aside>
    </div>
  );
}
