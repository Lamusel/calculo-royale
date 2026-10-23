import { useState } from 'react';
import { sectorOf } from '@calculo-royale/shared/zone';
import Options from './Options.jsx';

// Barra superior: GPS con sector (las coordenadas que usa el mando), latencia y botones
const fmt = (v) => (Math.abs(v) < 0.5 ? '0' : Math.round(v).toString().replace('-', '−'));

export default function HUD({ view, isHost, phase, onLeave, onReset, onFullscreen, onPanel }) {
  const { me, latency } = view;
  const [options, setOptions] = useState(false);

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-khaki-light sm:text-sm">
        {me && (
          <div className="rounded bg-black/55 px-2.5 py-1">
            POS {fmt(me.x)}, {fmt(me.y)} · {sectorOf(me.x, me.y)}
          </div>
        )}
        {latency != null && <div className="rounded bg-black/40 px-2 py-1 text-stone-400">{latency} ms</div>}
      </div>

      <div className="absolute right-3 top-3 z-20 flex gap-2">
        {isHost && phase !== 'lobby' && (
          <button onClick={onPanel} className="rounded bg-black/55 px-3 py-1.5 text-sm text-khaki-light">
            Panel
          </button>
        )}
        {isHost && phase === 'playing' && (
          <button onClick={onReset} className="rounded bg-black/55 px-3 py-1.5 text-sm text-khaki-light">
            Volver al lobby
          </button>
        )}
        <button onClick={() => setOptions(true)} className="rounded bg-black/55 px-3 py-1.5 text-sm text-white" aria-label="Opciones">
          ⚙
        </button>
        {onFullscreen && (
          <button onClick={onFullscreen} className="rounded bg-black/55 px-3 py-1.5 text-sm text-white" aria-label="Pantalla completa">
            ⛶
          </button>
        )}
        <button onClick={onLeave} className="rounded bg-black/55 px-3 py-1.5 text-sm text-white">
          Salir
        </button>
      </div>
      {options && <Options onClose={() => setOptions(false)} />}
    </>
  );
}
