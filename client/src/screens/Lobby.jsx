import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MAX_PLAYERS, TOPICS, WEATHERS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { SERVER_URL, socket } from '../net/socket.js';
import { startGame } from '../net/session.js';
import SkinPicker from '../ui/SkinPicker.jsx';

const isLocalhost = () => ['localhost', '127.0.0.1'].includes(location.hostname);

// Link para el QR, en orden de preferencia: túnel público (npm run tunnel),
// IP de la red local si el host abrió localhost, o el origen actual.
function useJoinUrl(code) {
  const [url, setUrl] = useState(`${location.origin}/?code=${code}`);
  useEffect(() => {
    fetch(`${SERVER_URL}/net-info`)
      .then((r) => r.json())
      .then(({ addresses, publicUrl }) => {
        if (publicUrl) setUrl(`${publicUrl}/?code=${code}`);
        else if (isLocalhost() && addresses[0]) {
          setUrl(`${location.protocol}//${addresses[0]}:${location.port}/?code=${code}`);
        }
      })
      .catch(() => {});
  }, [code]);
  return url;
}

function BigInvite({ room, url, onClose }) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-stone-950/90 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div className="flex max-h-full flex-col items-center gap-6 overflow-y-auto sm:flex-row sm:gap-12">
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={url} size={260} className="h-auto max-h-[60vh] w-auto" />
        </div>
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <p className="text-lg text-stone-400">Código de la sala</p>
          <p className="font-mono text-7xl font-black tracking-[0.2em] text-khaki sm:text-8xl">{room.code}</p>
          <p className="break-all font-mono text-sm text-stone-400">{url}</p>
          <p className="text-stone-300">
            {room.players.length} / {MAX_PLAYERS} jugadores
          </p>
          <p className="text-sm text-stone-500">Toca para cerrar</p>
        </div>
      </div>
    </div>
  );
}

// El host elige qué temas entran en las preguntas de la sala (al menos uno)
function TopicPicker({ room, isHost, onClose }) {
  const selected = new Set(room.topics ?? Object.keys(TOPICS));
  const toggle = (slug) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    if (next.size > 0) socket.emit(EVENTS.ROOM_TOPICS, [...next]);
  };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3" onPointerUp={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-lg border border-khaki-dark bg-olive-900 p-4 text-stone-100">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Temas de la sala</p>
        <div className="flex flex-col gap-1.5">
          {Object.entries(TOPICS).map(([slug, name]) => (
            <label key={slug} className={`flex items-center gap-3 rounded px-2 py-1.5 ${isHost ? 'cursor-pointer bg-black/25' : 'bg-black/15'}`}>
              <input type="checkbox" className="h-5 w-5 accent-khaki" checked={selected.has(slug)} disabled={!isHost} onChange={() => toggle(slug)} />
              <span className="text-sm">{name}</span>
            </label>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full rounded bg-khaki py-2 font-bold text-olive-950">
          Listo
        </button>
      </div>
    </div>
  );
}

const WEATHER_ICONS = { aleatorio: '🎲', despejado: '☀️', lluvia: '🌧️', niebla: '🌫️', arena: '🌪️', noche: '🌙' };

// Clima de la próxima partida: el host lo elige, los demás lo ven
function WeatherPicker({ room, isHost }) {
  const choice = room.weatherChoice ?? 'aleatorio';
  const options = { aleatorio: 'Clima al azar', ...WEATHERS };
  if (!isHost) {
    return (
      <span className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200" title="Clima de la partida">
        {WEATHER_ICONS[choice]} {options[choice]}
      </span>
    );
  }
  return (
    <select
      value={choice}
      onChange={(e) => socket.emit(EVENTS.ROOM_WEATHER, e.target.value)}
      className="rounded bg-white/10 px-1.5 py-1 text-xs text-stone-100"
      title="Clima de la partida"
    >
      {Object.entries(options).map(([id, name]) => (
        <option key={id} value={id} className="bg-olive-900">
          {WEATHER_ICONS[id]} {name}
        </option>
      ))}
    </select>
  );
}

// Panel del lobby jugable: la escena sigue viva detrás, todos pueden moverse mientras esperan
export default function Lobby({ room, myId, isTouch, onSkin }) {
  const [showInvite, setShowInvite] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showSkins, setShowSkins] = useState(false);
  const me = room.players.find((p) => p.id === myId);
  const topicCount = room.topics?.length ?? Object.keys(TOPICS).length;
  const [error, setError] = useState('');
  const url = useJoinUrl(room.code);
  const isHost = room.hostId === myId;

  async function onStart() {
    setError('');
    const res = await startGame();
    if (!res.ok) setError(res.error);
  }

  return (
    <>
      <div className="absolute left-1/2 top-3 z-20 flex max-w-[60vw] -translate-x-1/2 flex-col items-center gap-2">
        <div className="flex items-center gap-3 rounded-lg bg-black/60 px-4 py-2 text-stone-100 backdrop-blur">
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-3" title="Mostrar código y QR">
            <span className="font-mono text-2xl font-black tracking-[0.2em] text-khaki">{room.code}</span>
            <span className="rounded-lg bg-white/10 px-2 py-1 text-xs">QR</span>
          </button>
          <span className="text-sm text-stone-300">
            {room.players.length}/{MAX_PLAYERS}
          </span>
          <button onClick={() => setShowSkins(true)} className="rounded bg-white/10 px-2 py-1 text-xs text-khaki-light">
            Skin
          </button>
          <button onClick={() => setShowTopics(true)} className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200">
            Temas {topicCount}/{Object.keys(TOPICS).length}
          </button>
          <WeatherPicker room={room} isHost={isHost} />
          {isHost && (
            <button onClick={onStart} className="rounded bg-khaki px-4 py-1.5 font-bold text-olive-950">
              Iniciar
            </button>
          )}
        </div>
        <p className="rounded bg-black/45 px-3 py-1 text-center text-[11px] text-stone-200">
          {isHost ? 'Campo de entrenamiento · prueba la caja de práctica' : 'Esperando a que el anfitrión inicie…'}
        </p>
        {error && <p className="rounded-lg bg-red-950/80 px-3 py-1 text-xs text-red-300">{error}</p>}
      </div>

      {/* Ayuda de controles abajo a la izquierda, lejos del killfeed y de la barra de armas */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[28vw] rounded bg-black/45 px-2.5 py-1.5 text-[10px] leading-snug text-stone-200 sm:text-[11px]">
        {isTouch ? (
          <>
            <b className="text-khaki-light">Toca</b> el joystick derecho: dispara al más cercano
            <br />
            <b className="text-khaki-light">Arrastra</b>: apuntar y disparar
          </>
        ) : (
          <>
            WASD moverse · clic disparar
            <br />R recargar · B balas · 1/2 armas · G granada · E tomar
          </>
        )}
      </div>

      {showInvite && <BigInvite room={room} url={url} onClose={() => setShowInvite(false)} />}
      {showTopics && <TopicPicker room={room} isHost={isHost} onClose={() => setShowTopics(false)} />}
      {showSkins && <SkinPicker color={me?.color ?? '#f97316'} onChoose={onSkin} onClose={() => setShowSkins(false)} />}
    </>
  );
}
