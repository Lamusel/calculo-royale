import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sectorOf } from '@calculo-royale/shared/zone';
import { createQualityController, initialQuality, QUALITY } from '../game/quality.js';
import Scene from '../game/Scene.jsx';
import { attachKeyboardMouse } from '../input/KeyboardMouse.js';
import { resetInput } from '../input/inputState.js';
import TouchControls, { isTouchDevice } from '../input/TouchControls.jsx';
import { GameClient } from '../net/GameClient.js';
import { resetGame } from '../net/session.js';
import { socket } from '../net/socket.js';
import CombatHUD from '../ui/CombatHUD.jsx';
import HUD from '../ui/HUD.jsx';
import Killfeed from '../ui/Killfeed.jsx';
import { CrateResult, LockModal } from '../ui/LockModal.jsx';
import RadarOverlay from '../ui/RadarOverlay.jsx';
import { RadioFeed, ZoneStatus } from '../ui/Radio.jsx';
import Results from '../ui/Results.jsx';
import TacticalMap, { minimapSize } from '../ui/TacticalMap.jsx';
import HostPanel from '../ui/HostPanel.jsx';
import { InterceptCard, OperatorPanel, TransmissionToast } from '../ui/Operator.jsx';
import RotateDevice, { canFullscreen, enterLandscape } from '../ui/RotateDevice.jsx';
import { useClientView } from '../ui/useClientView.js';
import Lobby from './Lobby.jsx';

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
      {stats.fps} fps · {stats.calls} draws · {(stats.triangles / 1000).toFixed(0)}k tris · calidad {quality.name}
    </div>
  );
}

// Aviso para quien está dentro del sector que van a bombardear
function BombingWarning({ bombing, me, alive }) {
  if (!bombing?.length || !me || !alive || sectorOf(me.x, me.y) !== bombing[0]) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 animate-pulse rounded bg-red-700/90 px-4 py-2 text-center font-black uppercase tracking-wider text-white">
      ¡Bombardeo en {bombing[0]} en {Math.ceil(bombing[1] / 1000)} s! Sal del sector
    </div>
  );
}

function ClientUI({ client, frameRef, room, myId, isTouch, onLeave }) {
  const view = useClientView(client, frameRef, room.phase);
  const isHost = room.hostId === myId;
  const [panel, setPanel] = useState(false);
  const operating = room.phase === 'playing' && view.self && !view.self.alive;
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
      <TacticalMap
        frameRef={frameRef}
        myId={myId}
        radar={view.radarLeft > 0}
        radio={client.radio}
        isTouch={isTouch}
        intel={view.self?.intel}
      />
      <ZoneStatus zone={frameRef.current.zone} me={view.me} alive={view.self?.alive} mapSize={minimapSize(isTouch)} />
      <RadioFeed radio={client.radio} />
      <BombingWarning bombing={frameRef.current.bombing} me={view.me} alive={view.self?.alive} />
      {!operating && <InterceptCard client={client} />}
      <TransmissionToast result={client.transmissionResult} />
      {operating && (
        <OperatorPanel client={client} self={view.self} roster={room.players} others={view.others} followName={followName} />
      )}
      {panel && <HostPanel stats={client.classStats} code={room.code} onClose={() => setPanel(false)} />}
      <CombatHUD view={view} phase={room.phase} roster={room.players} myId={myId} isTouch={isTouch} />
      {view.radarLeft > 0 && <RadarOverlay me={view.me} others={view.others} myId={myId} secondsLeft={view.radarLeft} />}
      {view.question && (
        <LockModal question={view.question} onAnswer={(i) => client.answer(i)} onCancel={() => client.cancelQuestion()} />
      )}
      {view.crateResult && <CrateResult result={view.crateResult} onClose={() => (client.crateResult = null)} />}
      {room.phase === 'results' && (
        <Results results={client.results} mine={client.privateResults} myId={myId} isHost={isHost} onReset={resetGame} />
      )}
    </>
  );
}

// Pantalla de la sala: la misma escena sirve para el campo de entrenamiento y para la partida
export default function Game({ room, myId, sessionKey, onLeave }) {
  const [client, setClient] = useState(null);
  const [banner, setBanner] = useState(false);
  const frameRef = useRef({
    me: null, meInfo: null, others: new Map(), grenades: new Map(), dummies: [], crates: [], alarms: [], zone: [], airdrop: [],
  });
  const isTouch = isTouchDevice();

  // Calidad automática: el controlador mide FPS cada cuadro y cambia el nivel si hace falta
  const quality = useMemo(() => createQualityController(initialQuality(location.search, isTouch)), [isTouch]);
  const [level, setLevel] = useState(quality.level);
  const onFrame = useCallback((now) => {
    const changed = quality.frame(now);
    if (changed) setLevel(changed);
  }, [quality]);
  const stats = useMemo(() => (new URLSearchParams(location.search).has('debug') ? { frames: [] } : null), []);

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
  }, [client, room.phase]);

  useEffect(() => {
    const detach = attachKeyboardMouse();
    return () => {
      detach();
      resetInput();
    };
  }, []);

  useEffect(() => {
    if (room.phase !== 'playing') return;
    setBanner(true);
    const id = setTimeout(() => setBanner(false), 3000);
    return () => clearTimeout(id);
  }, [room.phase]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-stone-900">
      {client && (
        <Scene
          client={client}
          roster={room.players}
          myId={myId}
          phase={room.phase}
          frameRef={frameRef}
          quality={QUALITY[level]}
          onFrame={onFrame}
          stats={stats}
        />
      )}
      {stats && <DebugOverlay stats={stats} quality={QUALITY[level]} />}
      {isTouch && <TouchControls />}
      {client && (
        <ClientUI client={client} frameRef={frameRef} room={room} myId={myId} isTouch={isTouch} onLeave={onLeave} />
      )}
      {room.phase === 'lobby' && <Lobby room={room} myId={myId} isTouch={isTouch} onSkin={(skin) => client?.sendSkin(skin)} />}
      {banner && <StartBanner />}
      {isTouch && <RotateDevice />}
    </div>
  );
}
