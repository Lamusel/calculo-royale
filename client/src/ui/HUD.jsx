import { useEffect, useState } from 'react';
import { terrainHeight, TERRAIN_FORMULA } from '@calculo-royale/shared/terrain';

// Una cifra decimal con signo menos tipográfico, sin "−0.0"
const fmt = (v) => (Math.abs(v) < 0.05 ? '0.0' : v.toFixed(1).replace('-', '−'));

// Coordenadas propias en el plano, altura del terreno y latencia
export default function HUD({ client, frameRef, onLeave, onFullscreen }) {
  const [view, setView] = useState({ me: null, latency: null });

  useEffect(() => {
    const id = setInterval(() => {
      const me = frameRef.current.me;
      setView({ me: me && { x: me.x, y: me.y }, latency: client.latency });
    }, 100);
    return () => clearInterval(id);
  }, [client, frameRef]);

  const { me, latency } = view;

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-1 font-mono text-xs text-slate-100 sm:text-sm">
        {me && (
          <div className="rounded-lg bg-black/50 px-2.5 py-1 backdrop-blur-sm">
            (x, y) = ({fmt(me.x)}, {fmt(me.y)}) · z = {fmt(terrainHeight(me.x, me.y))}
          </div>
        )}
        <div className="w-fit rounded-lg bg-black/40 px-2.5 py-1 text-slate-300">{TERRAIN_FORMULA}</div>
        {latency !== null && <div className="w-fit rounded-lg bg-black/40 px-2.5 py-1 text-slate-400">{latency} ms</div>}
      </div>

      <div className="absolute right-3 top-3 z-20 flex gap-2">
        {onFullscreen && (
          <button onClick={onFullscreen} className="rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white" aria-label="Pantalla completa">
            ⛶
          </button>
        )}
        <button onClick={onLeave} className="rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white">
          Salir
        </button>
      </div>
    </>
  );
}
