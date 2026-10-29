import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DEPLOY_MODES, DURATIONS, MAX_PLAYERS, TEAM_MODES, TOPICS, WEATHERS, teamName } from '@calculo-royale/shared/constants';
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

// Despliegue de la próxima partida: bus o elegir punto (el host lo elige, los demás lo ven)
function DeployPicker({ room, isHost }) {
  const mode = room.deployMode ?? 'bus';
  if (!isHost) return <span className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200">{mode === 'bus' ? '🚌' : '📍'} {DEPLOY_MODES[mode]}</span>;
  return (
    <select
      value={mode}
      onChange={(e) => socket.emit(EVENTS.ROOM_DEPLOY, e.target.value)}
      className="rounded bg-white/10 px-1.5 py-1 text-xs text-stone-100"
      title="Despliegue"
    >
      {Object.entries(DEPLOY_MODES).map(([id, name]) => (
        <option key={id} value={id} className="bg-olive-900">
          {id === 'bus' ? '🚌' : '📍'} Despliegue: {name}
        </option>
      ))}
    </select>
  );
}

// Dúos y escuadras (fase 33): el anfitrión elige el modo; cada uno se une a un equipo o se mezclan
function TeamPicker({ room, isHost, myId }) {
  const mode = room.teamMode ?? 'solo';
  const size = TEAM_MODES[mode].size;
  const me = room.players.find((p) => p.id === myId);
  const teams = Math.max(2, Math.ceil(room.players.length / size) + 1);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {isHost ? (
        <select value={mode} onChange={(e) => socket.emit(EVENTS.ROOM_TEAM_MODE, e.target.value)} className="rounded bg-white/10 px-1.5 py-1 text-xs text-stone-100" title="Equipos">
          {Object.entries(TEAM_MODES).map(([id, m]) => (
            <option key={id} value={id} className="bg-olive-900">
              👥 {m.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200">👥 {TEAM_MODES[mode].name}</span>
      )}
      {size > 1 && (
        <>
          <select value={me?.teamChoice ?? 0} onChange={(e) => socket.emit(EVENTS.ROOM_TEAM_JOIN, Number(e.target.value))} className="rounded bg-white/10 px-1.5 py-1 text-xs text-stone-100" title="Tu equipo">
            <option value={0} className="bg-olive-900">Equipo: al azar</option>
            {Array.from({ length: teams }, (_, i) => i + 1).map((n) => {
              const count = room.players.filter((p) => p.teamChoice === n).length;
              return (
                <option key={n} value={n} disabled={count >= size && me?.teamChoice !== n} className="bg-olive-900">
                  {teamName(n)} ({count}/{size})
                </option>
              );
            })}
          </select>
          {isHost && (
            <button onClick={() => socket.emit(EVENTS.ROOM_TEAM_SHUFFLE)} className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200">
              Mezclar
            </button>
          )}
        </>
      )}
    </span>
  );
}

// Duración de la partida: escala la zona (el host la elige, los demás la ven)
function DurationPicker({ room, isHost }) {
  const value = room.duration ?? 'normal';
  if (!isHost) return <span className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200">⏱ {DURATIONS[value]?.name}</span>;
  return (
    <select
      value={value}
      onChange={(e) => socket.emit(EVENTS.ROOM_DURATION, e.target.value)}
      className="rounded bg-white/10 px-1.5 py-1 text-xs text-stone-100"
      title="Duración"
    >
      {Object.entries(DURATIONS).map(([id, d]) => (
        <option key={id} value={id} className="bg-olive-900">
          ⏱ {d.name}
        </option>
      ))}
    </select>
  );
}

// Modo fácil y bots (fase 20): solo el anfitrión los cambia; los demás ven qué está activo
const BOT_TARGETS = [0, 4, 8, 12, 20, 30, 40];
function PresentationPicker({ room, isHost }) {
  const bots = room.players.filter((p) => p.bot).length;
  if (!isHost) {
    return (
      <>
        {room.easy && <span className="rounded bg-amber-700/70 px-2 py-1 text-xs text-amber-50">Modo fácil</span>}
        {bots > 0 && <span className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200">🤖 {bots} bots</span>}
      </>
    );
  }
  return (
    <>
      <button
        onClick={() => socket.emit(EVENTS.ROOM_EASY, !room.easy)}
        className={`rounded px-2 py-1 text-xs ${room.easy ? 'bg-amber-600 font-bold text-black' : 'bg-white/10 text-stone-200'}`}
        title="Preguntas de aritmética para probar el juego (no cuenta para logros; el CSV lo marca)"
      >
        {room.easy ? '✓ Modo fácil' : 'Modo fácil'}
      </button>
      <button onClick={() => socket.emit(EVENTS.ROOM_CHAT, Boolean(room.chatOff))} className={`rounded px-2 py-1 text-xs ${room.chatOff ? 'bg-white/10 text-stone-400 line-through' : 'bg-white/10 text-stone-200'}`} title="Chat de texto de la sala">
        💬 Chat
      </button>
      <select
        value=""
        onChange={(e) => socket.emit(EVENTS.ROOM_BOTS, Number(e.target.value))}
        className="rounded bg-white/10 px-1.5 py-1 text-xs text-stone-100"
        title="Bots"
      >
        <option value="" disabled className="bg-olive-900">
          🤖 {bots ? `${bots} bots` : 'Bots'}
        </option>
        {BOT_TARGETS.map((n) => (
          <option key={n} value={n} className="bg-olive-900">
            {n === 0 ? 'Quitar los bots' : `Completar hasta ${n}`}
          </option>
        ))}
      </select>
    </>
  );
}

// Ayuda de controles abajo a la izquierda (solo en el lobby): se va sola a los pocos segundos o
// apenas se usan los controles, para no quedar encima del juego
const HELP_MS = 8_000;
function ControlsHelp({ isTouch }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const hide = () => setVisible(false);
    const timer = setTimeout(hide, HELP_MS);
    // Cualquier tecla o toque fuera de los menús (escena, joysticks) cuenta como usar los controles
    const onPointer = (e) => !e.target.closest?.('button, select, input, a, [role=dialog]') && hide();
    window.addEventListener('keydown', hide);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', hide);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);
  return (
    <div
      className={`pointer-events-none absolute bottom-[7.5rem] left-3 z-20 max-w-[28vw] rounded bg-black/45 px-2.5 py-1.5 text-[10px] leading-snug text-stone-200 transition-opacity duration-500 sm:text-[11px] ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {isTouch ? (
        <>
          <b className="text-khaki-light">Toca</b> el joystick derecho: dispara al más cercano
          <br />
          <b className="text-khaki-light">Arrastra</b>: apuntar y disparar
        </>
      ) : (
        <>
          WASD moverse · clic disparar
          <br />R recargar · B balas · 1/2 armas · G granada · E tomar · 4/5/6 curar
        </>
      )}
    </div>
  );
}

// Tutorial de 1 minuto (6.5): la primera vez en el lobby, 6 tarjetas de ~10 s; se puede saltar
const TUTORIAL_KEY = 'cr-tutorial-v1';
const TUTORIAL_MS = 10_000;
const tutorialSteps = (touch) => [
  ['Moverse', touch ? 'Joystick izquierdo para caminar; el botón de salto para saltar.' : 'WASD para caminar, el mouse apunta y Espacio salta.'],
  ['Disparar', touch ? 'Toca el joystick derecho: dispara al más cercano. Arrástralo para apuntar.' : 'Clic izquierdo dispara; clic derecho mantenido apunta con la mira.'],
  ['Abrir caja', touch ? 'Junto a una caja toca Abrir y responde la pregunta: acertar da el botín.' : 'Junto a una caja pulsa E y responde la pregunta: acertar da el botín.'],
  ['Obtener balas', touch ? 'Toca Balas y responde: es la forma principal de llenar la reserva.' : 'Pulsa B y responde: es la forma principal de llenar la reserva.'],
  ['Tarjeta de zona', 'La zona segura es una desigualdad: el Mando la anuncia y la tarjeta dice si estás adentro.'],
  ['Gulag', 'Si caes, vas al Gulag: responde y gana el duelo para volver a la partida.'],
];
function Tutorial({ isTouch }) {
  const [step, setStep] = useState(() => {
    try {
      return localStorage.getItem(TUTORIAL_KEY) ? -1 : 0;
    } catch {
      return -1;
    }
  });
  const steps = tutorialSteps(isTouch);
  const done = () => {
    setStep(-1);
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {
      // Sin almacenamiento: se vuelve a ver la próxima vez
    }
  };
  useEffect(() => {
    if (step < 0) return undefined;
    const id = setTimeout(() => (step + 1 < steps.length ? setStep(step + 1) : done()), TUTORIAL_MS);
    return () => clearTimeout(id);
  }, [step, steps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (step < 0) return null;
  const [title, text] = steps[step];
  return (
    <div role="dialog" className="absolute bottom-[7.5rem] left-1/2 z-40 w-[min(90vw,24rem)] -translate-x-1/2 rounded-lg border border-khaki-dark bg-black/80 p-3 text-stone-100 shadow-xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-khaki-light">
        Tutorial {step + 1}/{steps.length} · {title}
      </p>
      <p className="mt-1 text-sm">{text}</p>
      <div className="mt-2 flex justify-end gap-2 text-xs">
        <button onClick={done} className="rounded bg-white/10 px-2 py-1 text-stone-300">
          Saltar
        </button>
        <button onClick={() => (step + 1 < steps.length ? setStep(step + 1) : done())} className="rounded bg-khaki px-3 py-1 font-bold text-olive-950">
          {step + 1 < steps.length ? 'Siguiente' : 'Listo'}
        </button>
      </div>
    </div>
  );
}

// Panel del lobby jugable: la escena sigue viva detrás, todos pueden moverse mientras esperan
export default function Lobby({ room, myId, isTouch, onSkin }) {
  const [showInvite, setShowInvite] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showSkins, setShowSkins] = useState(false);
  // Configuración agrupada en un panel plegable (6.5); cerrado muestra un resumen
  const [showConfig, setShowConfig] = useState(false);
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
      {/* En pantallas bajas (celular acostado) va debajo de la barra superior (GPS, latencia, botones)
          para no encimarse; en pantallas altas cabe arriba entre ellos */}
      <div className="absolute left-1/2 top-[calc(max(0.5rem,env(safe-area-inset-top))+2.6rem)] z-20 flex w-max max-w-[62vw] -translate-x-1/2 flex-col items-center gap-1.5 [@media(min-height:600px)]:top-3">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-lg bg-black/60 px-3 py-2 text-stone-100 backdrop-blur">
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-3" title="Mostrar código y QR">
            <span className="font-mono text-[clamp(1.1rem,3.2vw,1.5rem)] font-black tracking-[0.2em] text-khaki">{room.code}</span>
            <span className="rounded-lg bg-white/10 px-2 py-1 text-xs">QR</span>
          </button>
          <span className="text-sm text-stone-300">
            {room.players.length}/{MAX_PLAYERS}
          </span>
          <button onClick={() => setShowSkins(true)} className="rounded bg-white/10 px-2 py-1 text-xs text-khaki-light">
            Skin
          </button>
          <button onClick={() => setShowConfig((o) => !o)} className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200" title="Configuración de la partida">
            ⚙ {TEAM_MODES[room.teamMode ?? 'solo'].name} · {DURATIONS[room.duration ?? 'normal']?.name.split(' ')[0]} · {topicCount} temas {showConfig ? '▴' : '▾'}
          </button>
          {isHost && (
            <button onClick={onStart} className="rounded bg-khaki px-4 py-1.5 font-bold text-olive-950">
              Iniciar
            </button>
          )}
        </div>
        {showConfig && (
          <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-lg bg-black/60 px-3 py-2 text-stone-100 backdrop-blur">
            <TeamPicker room={room} isHost={isHost} myId={myId} />
            <DurationPicker room={room} isHost={isHost} />
            <button onClick={() => setShowTopics(true)} className="rounded bg-white/10 px-2 py-1 text-xs text-stone-200">
              Temas {topicCount}/{Object.keys(TOPICS).length}
            </button>
            <WeatherPicker room={room} isHost={isHost} />
            <DeployPicker room={room} isHost={isHost} />
            <PresentationPicker room={room} isHost={isHost} />
          </div>
        )}
        <p className="rounded bg-black/45 px-3 py-1 text-center text-[11px] text-stone-200">
          {isHost ? 'Campo de entrenamiento · prueba la caja de práctica' : 'Esperando a que el anfitrión inicie…'}
        </p>
        {error && <p className="rounded-lg bg-red-950/80 px-3 py-1 text-xs text-red-300">{error}</p>}
      </div>

      <ControlsHelp isTouch={isTouch} />
      <Tutorial isTouch={isTouch} />

      {showInvite && <BigInvite room={room} url={url} onClose={() => setShowInvite(false)} />}
      {showTopics && <TopicPicker room={room} isHost={isHost} onClose={() => setShowTopics(false)} />}
      {showSkins && <SkinPicker color={me?.color ?? '#f97316'} onChoose={onSkin} onClose={() => setShowSkins(false)} />}
    </>
  );
}
