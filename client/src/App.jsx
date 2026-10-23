import { useEffect, useState } from 'react';
import { socket } from './net/socket.js';
import { EVENTS } from '@calculo-royale/shared/protocol';

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setLatency(null);
    };
    const onPong = ({ clientTime }) => setLatency(Date.now() - clientTime);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(EVENTS.PONG, onPong);

    // Medir latencia cada 2 s
    const interval = setInterval(() => {
      if (socket.connected) socket.emit(EVENTS.PING, Date.now());
    }, 2000);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(EVENTS.PONG, onPong);
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-slate-900 text-slate-100">
      <h1 className="text-4xl font-extrabold tracking-tight">Cálculo Royale</h1>
      <div className="flex items-center gap-3 rounded-full bg-slate-800 px-5 py-2">
        <span className={`h-3 w-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
        <span>{connected ? 'Conectado' : 'Desconectado'}</span>
        {latency !== null && <span className="text-slate-400">{latency} ms</span>}
      </div>
    </main>
  );
}
