import { useEffect, useRef, useState } from 'react';
import { TERRAIN_FORMULA } from '@calculo-royale/shared/terrain';
import Scene from '../game/Scene.jsx';
import { attachKeyboardMouse } from '../input/KeyboardMouse.js';
import { resetInput } from '../input/inputState.js';
import TouchControls, { isTouchDevice } from '../input/TouchControls.jsx';
import { GameClient } from '../net/GameClient.js';
import { socket } from '../net/socket.js';
import HUD from '../ui/HUD.jsx';
import RotateDevice, { canFullscreen, enterLandscape } from '../ui/RotateDevice.jsx';
import Lobby from './Lobby.jsx';

function StartBanner() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[12%] z-30 flex flex-col items-center gap-2 text-center">
      <p className="text-5xl font-black text-amber-400 drop-shadow-lg">¡A jugar!</p>
      <p className="rounded-lg bg-black/50 px-4 py-1.5 font-mono text-slate-100">Mapa de hoy: {TERRAIN_FORMULA}</p>
    </div>
  );
}

// Pantalla de la sala: la misma escena sirve para el lobby y para la partida
export default function Game({ room, myId, sessionKey, onLeave }) {
  const [client, setClient] = useState(null);
  const [banner, setBanner] = useState(false);
  const frameRef = useRef({ me: null, others: new Map() });
  const isTouch = isTouchDevice();

  useEffect(() => {
    const c = new GameClient(socket, myId);
    setClient(c);
    return () => {
      c.dispose();
      frameRef.current.me = null;
    };
  }, [myId, sessionKey]);

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
    const id = setTimeout(() => setBanner(false), 3500);
    return () => clearTimeout(id);
  }, [room.phase]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#0b1220]">
      {client && <Scene client={client} roster={room.players} myId={myId} frameRef={frameRef} />}
      {isTouch && <TouchControls />}
      {client && (
        <HUD
          client={client}
          frameRef={frameRef}
          onLeave={onLeave}
          onFullscreen={isTouch && canFullscreen() ? enterLandscape : null}
        />
      )}
      {room.phase === 'lobby' && <Lobby room={room} myId={myId} isTouch={isTouch} />}
      {banner && <StartBanner />}
      {isTouch && <RotateDevice />}
    </div>
  );
}
