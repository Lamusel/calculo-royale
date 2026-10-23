import { useEffect, useRef, useState } from 'react';
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

function ClientUI({ client, frameRef, room, myId, isTouch, onLeave }) {
  const view = useClientView(client, frameRef, room.phase);
  const isHost = room.hostId === myId;
  return (
    <>
      <HUD
        view={view}
        isHost={isHost}
        phase={room.phase}
        onLeave={onLeave}
        onReset={resetGame}
        onFullscreen={isTouch && canFullscreen() ? enterLandscape : null}
      />
      <Killfeed killfeed={view.killfeed} roster={room.players} myId={myId} />
      <CombatHUD view={view} phase={room.phase} roster={room.players} myId={myId} isTouch={isTouch} />
    </>
  );
}

// Pantalla de la sala: la misma escena sirve para el campo de entrenamiento y para la partida
export default function Game({ room, myId, sessionKey, onLeave }) {
  const [client, setClient] = useState(null);
  const [banner, setBanner] = useState(false);
  const frameRef = useRef({ me: null, meInfo: null, others: new Map(), grenades: new Map(), dummies: [] });
  const isTouch = isTouchDevice();

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
      {client && <Scene client={client} roster={room.players} myId={myId} phase={room.phase} frameRef={frameRef} />}
      {isTouch && <TouchControls />}
      {client && (
        <ClientUI client={client} frameRef={frameRef} room={room} myId={myId} isTouch={isTouch} onLeave={onLeave} />
      )}
      {room.phase === 'lobby' && <Lobby room={room} myId={myId} isTouch={isTouch} />}
      {banner && <StartBanner />}
      {isTouch && <RotateDevice />}
    </div>
  );
}
