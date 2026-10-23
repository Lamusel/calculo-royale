import { useEffect, useState } from 'react';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { socket } from './net/socket.js';
import { clearSession, leaveRoom, loadSession, resumeRoom } from './net/session.js';
import Game from './screens/Game.jsx';
import Home from './screens/Home.jsx';

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  // { code, playerId, key } — key cambia en cada (re)ingreso para recrear el cliente de juego
  const [session, setSession] = useState(null);
  const [room, setRoom] = useState(null);
  const [notice, setNotice] = useState('');
  const [resuming, setResuming] = useState(() => Boolean(loadSession()));

  useEffect(() => {
    const enter = (res) => setSession({ code: res.code, playerId: res.playerId, key: Date.now() });
    const exit = (message) => {
      setSession(null);
      setRoom(null);
      setNotice(message);
    };

    // Al conectar (o reconectar) se vuelve a la sala guardada con el mismo jugador
    const onConnect = async () => {
      setConnected(true);
      const res = await resumeRoom();
      if (res?.ok) enter(res);
      else if (res) exit(res.error);
      setResuming(false);
    };
    const onDisconnect = (reason) => {
      setConnected(false);
      // Tras un "kick" el servidor cierra el socket; se reconecta para poder volver a entrar
      if (reason === 'io server disconnect') socket.connect();
    };
    const onInfo = (info) => setRoom(info);
    const onKicked = ({ reason }) => {
      clearSession();
      exit(reason);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(EVENTS.ROOM_INFO, onInfo);
    socket.on(EVENTS.ROOM_KICKED, onKicked);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(EVENTS.ROOM_INFO, onInfo);
      socket.off(EVENTS.ROOM_KICKED, onKicked);
    };
  }, []);

  function onEnter(res) {
    setNotice('');
    setSession({ code: res.code, playerId: res.playerId, key: Date.now() });
  }

  function onLeave() {
    leaveRoom();
    setSession(null);
    setRoom(null);
  }

  if (resuming) {
    return <div className="flex h-full items-center justify-center bg-slate-950 text-slate-400">Volviendo a la sala…</div>;
  }

  if (session && room?.code === session.code) {
    return <Game room={room} myId={session.playerId} sessionKey={session.key} onLeave={onLeave} />;
  }

  return <Home connected={connected} notice={notice} onEnter={onEnter} />;
}
