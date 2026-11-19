import { useEffect, useState } from 'react';
import { inputState } from '../input/inputState.js';

// Mira fija en el centro de la pantalla (tercera persona). El disparo va exacto hacia el punto que
// marca, a la distancia de CAMERA.third.lookAhead; más cerca o más lejos la diferencia es mínima.
export default function Crosshair({ isTouch }) {
  const [state, setState] = useState({ on: false, ads: false, locked: true });
  useEffect(() => {
    const id = setInterval(() => {
      const next = { on: inputState.thirdActive, ads: inputState.adsHeld, locked: isTouch || Boolean(document.pointerLockElement) };
      setState((s) => (s.on === next.on && s.ads === next.ads && s.locked === next.locked ? s : next));
    }, 120);
    return () => clearInterval(id);
  }, [isTouch]);
  if (!state.on) return null;
  const gap = state.ads ? 4 : 7;
  const bar = 'absolute bg-white shadow-[0_0_2px_rgba(0,0,0,0.9)]';
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      <div className={bar} style={{ left: -1, top: -gap - 9, width: 2, height: 9 }} />
      <div className={bar} style={{ left: -1, top: gap, width: 2, height: 9 }} />
      <div className={bar} style={{ top: -1, left: -gap - 9, width: 9, height: 2 }} />
      <div className={bar} style={{ top: -1, left: gap, width: 9, height: 2 }} />
      <div className={bar} style={{ left: -1, top: -1, width: 2, height: 2 }} />
      {!state.locked && (
        <p className="absolute left-1/2 top-6 w-56 -translate-x-1/2 rounded bg-black/60 px-2 py-1 text-center text-[11px] text-stone-200">
          Clic en el juego para mover la cámara con el mouse · Esc para soltarlo
        </p>
      )}
    </div>
  );
}
