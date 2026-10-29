import { MAP_HALF } from '@calculo-royale/shared/constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WEATHERS } from '@calculo-royale/shared/constants';
import { sectorOf } from '@calculo-royale/shared/zone';
import { createQualityController, initialQuality } from '../game/quality.js';
import { onSettings, settings } from '../settings.js';
import Scene from '../game/Scene.jsx';
import { loadSkinSystem } from '../game/character/Character.js';
import { sound, unlockAudio } from '../audio/sound.js';
import { useMusic } from '../audio/useMusic.js';
import { isExternalSkin } from '../game/character/skins/index.js';
import { debugSkinsEnabled } from '../game/character/debug.js';
import { attachKeyboardMouse } from '../input/KeyboardMouse.js';
import { resetInput } from '../input/inputState.js';
import TouchControls, { isTouchDevice } from '../input/TouchControls.jsx';
import { GameClient } from '../net/GameClient.js';
import { resetGame } from '../net/session.js';
import { socket } from '../net/socket.js';
import CombatHUD from '../ui/CombatHUD.jsx';
import DeployHUD from '../ui/Deploy.jsx';
import MathText from '../ui/MathText.jsx';
import { AmmoCard, AmmoToast } from '../ui/AmmoCard.jsx';
import HUD from '../ui/HUD.jsx';
import Killfeed from '../ui/Killfeed.jsx';
import { CrateResult, LockModal } from '../ui/LockModal.jsx';
import RadarOverlay from '../ui/RadarOverlay.jsx';
import { RadioFeed, ZoneStatus } from '../ui/Radio.jsx';
import Results from '../ui/Results.jsx';
import Replay from '../ui/Replay.jsx';
import { DuelIntro } from '../ui/Cinema.jsx';
import TacticalMap, { minimapSize } from '../ui/TacticalMap.jsx';
import HostPanel from '../ui/HostPanel.jsx';
import QuickPhrases from '../ui/QuickPhrases.jsx';
import { OperatorPanel, TransmissionToast } from '../ui/Operator.jsx';
import { GulagPanel } from '../ui/Gulag.jsx';
import RotateDevice, { canFullscreen, enterLandscape } from '../ui/RotateDevice.jsx';
import { useClientView } from '../ui/useClientView.js';
import Lobby from './Lobby.jsx';

const FONT_WARMUP = '$\\displaystyle\\lim_{x \\to 2} \\frac{3x^{2} - 1}{x + 4} = \\nabla f \\cdot \\int_0^1 \\lambda\\, dy$';

function StartBanner() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[14%] z-30 flex flex-col items-center gap-1 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-khaki-light/80">Aquí Mando</p>
      <p className="text-5xl font-black uppercase tracking-wider text-khaki drop-shadow-lg">¡Despliegue!</p>
    </div>
  );
}

// ?debug=1: FPS, llamadas de dibujo, triángulos y nivel de calidad
function DebugOverlay({ stats, quality }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-none absolute bottom-24 left-3 z-30 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-lime-300">
      {stats.fps} fps · {stats.calls} draws · {(stats.triangles / 1000).toFixed(0)}k tris · calidad {quality.name}{quality.step ? ` −${quality.step} (${quality.cut})` : ''} · dpr {quality.dpr}
    </div>
  );
}

// Clima de la partida (y hacia dónde sopla el viento en la tormenta de arena)
// Contadores siempre visibles (vivos, mis bajas y, al caer o ganar, mi puesto)
function Counters({ frameRef, self }) {
  let alive = self?.alive && frameRef.current.me && Math.abs(frameRef.current.me.x) <= MAP_HALF ? 1 : 0;
  for (const p of frameRef.current.others?.values() ?? []) if (!(p.flags & PLAYER_FLAGS.DEAD) && Math.abs(p.x) <= MAP_HALF) alive++;
  const chip = 'rounded bg-black/65 px-2 py-0.5 font-mono text-[11px] font-bold';
  return (
    <div className="flex gap-1">
      <span className={`${chip} text-stone-100`} title="Vivos">👤 {alive}</span>
      <span className={`${chip} text-red-300`} title="Mis bajas">✕ {self?.kills ?? 0}</span>
      {self?.place && <span className={`${chip} text-khaki-light`} title="Mi puesto">#{self.place}</span>}
    </div>
  );
}

function WeatherChip({ weather, windAngle }) {
  if (!weather || weather === 'despejado') return null;
  return (
    <div className="pointer-events-none flex items-center gap-1.5 rounded bg-black/55 px-2 py-0.5 text-[11px] text-stone-200">
      {WEATHERS[weather]}
      {weather === 'arena' && (
        <span className="inline-block text-orange-300" style={{ transform: `rotate(${-windAngle}rad)` }} title="Viento: desvía las granadas">
          ➜
        </span>
      )}
    </div>
  );
}

// ?debugSkins=1: skin, modo, LOD y triángulos de cada jugador (los llena Players)
function SkinDebugOverlay({ roster }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const d = globalThis.__skinDebug;
  if (!d) return null;
  return (
    <div className="pointer-events-none absolute bottom-24 right-3 z-30 max-h-[50vh] overflow-hidden rounded bg-black/75 px-2 py-1 font-mono text-[10px] text-cyan-200">
      <p className="text-white">
        Skins · {d.calls} llamadas · {(d.triangles / 1000).toFixed(0)}k tris
      </p>
      {d.players.map((p) => (
        <p key={p.id}>
          {roster.find((r) => r.id === p.id)?.name ?? p.id}: {p.skin} · {p.mode} · {p.status} · LOD{p.lod} · {p.triangles} tris · {p.meshes} mallas · {p.materials} mat · {p.textures} tex
        </p>
      ))}
    </div>
  );
}

// Aviso para quien está dentro del sector que van a bombardear
function ClientUI({ client, frameRef, room, myId, isTouch, onLeave, replaying }) {
  const view = useClientView(client, frameRef, room.phase);
  const isHost = room.hostId === myId;
  const [panel, setPanel] = useState(false);
  // Espectador (caído sin Gulag o que ya lo perdió): preguntas de práctica
  const operating = room.phase === 'playing' && view.self && !view.self.alive && !view.self.gulag;
  const followName = room.players.find((p) => p.id === client.followId)?.name;
  return (
    <>
      <HUD
        view={view}
        isHost={isHost}
        phase={room.phase}
        onLeave={onLeave}
        onReset={resetGame}
        onFullscreen={isTouch && canFullscreen() ? enterLandscape : null}
        onPanel={() => setPanel(true)}
      />
      <Killfeed killfeed={view.killfeed} roster={room.players} myId={myId} />
      {!replaying && <QuickPhrases client={client} roster={room.players} isTouch={isTouch} />}
      <TacticalMap
        frameRef={frameRef}
        myId={myId}
        radar={view.radarLeft > 0}
        marks={view.self?.marks}
        radio={client.radio}
        isTouch={isTouch}
        night={room.phase === 'playing' && room.weather === 'noche'}
        lastShot={client.heardShot}
        deployRoute={client.deploying === 'bus' && client.deployInfo?.route ? client.deployInfo.route : null}
      />
      {room.phase === 'playing' && (
        <div className={`pointer-events-none absolute top-12 z-20 flex flex-col items-end gap-1 ${isTouch ? 'right-16' : 'right-3'}`}>
          <Counters frameRef={frameRef} self={view.self} />
          <WeatherChip weather={room.weather} windAngle={room.windAngle} />
          {view.self?.alive && view.self.streak > 0 && (
            <span className="rounded bg-black/55 px-2 py-0.5 font-mono text-[11px] text-sky-200">Racha {view.self.streak % 3 === 0 ? 3 : view.self.streak % 3}/3</span>
          )}
        </div>
      )}
      <ZoneStatus zone={frameRef.current.zone} me={view.me} alive={view.self?.alive} mapSize={minimapSize(isTouch)} />
      <RadioFeed radio={client.radio} />
      {room.phase === 'playing' && <GulagPanel client={client} self={view.self} roster={room.players} frameRef={frameRef} />}
      <TransmissionToast result={client.transmissionResult} />
      {operating && (
        <OperatorPanel client={client} self={view.self} roster={room.players} followName={followName} gulagFights={frameRef.current.gulag?.[1]?.length ?? 0} />
      )}
      {panel && <HostPanel stats={client.classStats} code={room.code} onClose={() => setPanel(false)} />}
      <CombatHUD view={view} phase={room.phase} roster={room.players} myId={myId} isTouch={isTouch} client={client} />
      {!operating && <AmmoCard client={client} />}
      <AmmoToast result={client.ammoResult} />
      {view.radarLeft > 0 && <RadarOverlay me={view.me} others={view.others} myId={myId} secondsLeft={view.radarLeft} />}
      {view.question && (
        <LockModal question={view.question} onAnswer={(i) => client.answer(i)} onCancel={() => client.cancelQuestion()} />
      )}
      {view.crateResult && <CrateResult result={view.crateResult} onClose={() => (client.crateResult = null)} />}
      {room.phase === 'playing' && <DuelIntro client={client} roster={room.players} />}
      {room.phase === 'playing' && <DeployHUD client={client} frameRef={frameRef} isTouch={isTouch} />}
      {room.phase === 'results' && !replaying && (
        <Results results={client.results} mine={client.privateResults} myId={myId} isHost={isHost} onReset={resetGame} csv={client.csv} />
      )}
    </>
  );
}

// Aviso único (por navegador) cuando la calidad automática ya recortó todo y sigue lento
const SLOW_KEY = 'cr-aviso-lento';
function showSlowWarningOnce(show) {
  try {
    if (localStorage.getItem(SLOW_KEY)) return;
    localStorage.setItem(SLOW_KEY, '1');
  } catch {
    // sin almacenamiento: se avisa igual, una vez por sesión (el controlador ya avisa una sola vez)
  }
  show(true);
}

function SlowWarning({ onClose }) {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-14 z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-lg border border-orange-400/70 bg-black/85 p-3 text-[clamp(12px,3.2vw,14px)] text-stone-100">
      <p className="font-bold text-orange-300">Tu dispositivo va lento</p>
      <p className="mt-1 text-stone-300">Ya bajamos los gráficos al mínimo. Cierra otras apps o pestañas y, si puedes, conecta el cargador.</p>
      <button onClick={onClose} className="mt-2 rounded bg-khaki px-3 py-1 font-bold text-olive-950">
        Entendido
      </button>
    </div>
  );
}

// Pantalla de la sala: la misma escena sirve para el campo de entrenamiento y para la partida
export default function Game({ room, myId, sessionKey, onLeave }) {
  const [client, setClient] = useState(null);
  const [banner, setBanner] = useState(false);
  const [replayDone, setReplayDone] = useState(false);
  const frameRef = useRef({
    me: null, meInfo: null, others: new Map(), grenades: new Map(), dummies: [], crates: [], alarms: [], zone: [], airdrop: [],
  });
  const isTouch = isTouchDevice();

  // Calidad: manual (Opciones) o automática (el controlador mide FPS y recorta de a un paso)
  const [qualityMode, setQualityMode] = useState(settings.quality);
  useEffect(() => onSettings((s) => setQualityMode(s.quality)), []);
  const [slowWarning, setSlowWarning] = useState(false);
  const quality = useMemo(
    () => createQualityController({ ...initialQuality(location.search, isTouch, qualityMode), onSlow: () => showSlowWarningOnce(setSlowWarning) }),
    [isTouch, qualityMode],
  );
  const [profile, setProfile] = useState(quality.profile);
  useEffect(() => setProfile(quality.profile), [quality]);
  const onFrame = useCallback((now) => {
    const changed = quality.frame(now);
    if (changed) setProfile(changed);
  }, [quality]);
  const stats = useMemo(() => (new URLSearchParams(location.search).has('debug') ? { frames: [] } : null), []);
  const skinDebug = useMemo(() => debugSkinsEnabled(), []);

  useEffect(() => {
    const c = new GameClient(socket, myId, room.phase);
    setClient(c);
    return () => {
      c.dispose();
      frameRef.current.me = null;
    };
    // La fase se actualiza aparte; el cliente solo se recrea al (re)ingresar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, sessionKey]);

  useEffect(() => {
    client?.setPhase(room.phase);
    if (room.phase !== 'results') setReplayDone(false);
  }, [client, room.phase]);
  const onReplayDone = useCallback(() => setReplayDone(true), []);
  useMusic(client, room, myId);
  if (client) client.easy = Boolean(room.easy);
  // Al terminar la partida, primero la repetición (en lugar de la escena en vivo: un solo WebGL)
  const replaying = room.phase === 'results' && Boolean(client?.replay) && !replayDone;

  // El audio solo puede arrancar después de un toque o una tecla (regla de los navegadores)
  useEffect(() => {
    // Además, un clic suave en cada botón de la interfaz
    const unlock = (e) => {
      unlockAudio();
      if (e.target instanceof Element && e.target.closest('button')) sound.click();
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    return () => {
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const detach = attachKeyboardMouse();
    return () => {
      detach();
      resetInput();
    };
  }, []);

  // Al iniciar la partida se descargan las skins externas elegidas (mientras, se ve la skin base)
  useEffect(() => {
    if (room.phase !== 'playing') return;
    const skins = room.players.map((p) => p.skin);
    if (skins.some(isExternalSkin)) loadSkinSystem().then((m) => m.preloadMatchSkins(skins));
    // Solo al cambiar de fase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.phase]);

  useEffect(() => {
    if (room.phase !== 'playing') return;
    setBanner(true);
    const id = setTimeout(() => setBanner(false), 3000);
    return () => clearTimeout(id);
  }, [room.phase]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-stone-900">
      {replaying && <Replay replay={client.replay} room={room} quality={profile} onDone={onReplayDone} />}
      {client && !replaying && (
        <Scene
          client={client}
          roster={room.players}
          myId={myId}
          phase={room.phase}
          frameRef={frameRef}
          quality={profile}
          onFrame={onFrame}
          stats={stats}
          weather={room.weather}
          windAngle={room.windAngle}
        />
      )}
      {stats && <DebugOverlay stats={stats} quality={profile} />}
      {skinDebug && <SkinDebugOverlay roster={room.players} />}
      {/* Interfaz dentro de las zonas seguras (muesca, barra de gestos); la escena 3D ocupa toda la pantalla */}
      <div className="safe-layer">
        {isTouch && <TouchControls />}
        {client && (
          <ClientUI client={client} frameRef={frameRef} room={room} myId={myId} isTouch={isTouch} onLeave={onLeave} replaying={replaying} />
        )}
        {room.phase === 'lobby' && <Lobby room={room} myId={myId} isTouch={isTouch} onSkin={(skin) => client?.sendSkin(skin)} />}
        {banner && <StartBanner />}
        {slowWarning && <SlowWarning onClose={() => setSlowWarning(false)} />}
      </div>
      {isTouch && <RotateDevice />}
      {/* Fórmula invisible: precarga las fuentes de KaTeX para que la primera pregunta no salga vacía */}
      <MathText text={FONT_WARMUP} className="pointer-events-none invisible absolute" />
    </div>
  );
}
