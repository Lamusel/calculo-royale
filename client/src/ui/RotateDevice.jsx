import { useEffect, useState } from 'react';

export const canFullscreen = () => Boolean(document.fullscreenEnabled);

// Pantalla completa y, donde el navegador lo permite (Android), bloqueo en horizontal
export async function enterLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    await screen.orientation?.lock?.('landscape');
  } catch {
    // iOS y algunos navegadores no lo permiten; el aviso de girar se encarga
  }
}

// Aviso a pantalla completa si el celular está en vertical
export default function RotateDevice() {
  const [portrait, setPortrait] = useState(() => matchMedia('(orientation: portrait)').matches);

  useEffect(() => {
    const mq = matchMedia('(orientation: portrait)');
    const onChange = (e) => setPortrait(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (!portrait) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-950/95 p-8 text-center text-slate-100">
      <div className="animate-[spin_2.5s_ease-in-out_infinite] text-6xl">📱</div>
      <p className="text-xl font-bold">Gira tu celular</p>
      <p className="text-slate-400">Cálculo Royale se juega en horizontal.</p>
      {canFullscreen() && (
        <button onClick={enterLandscape} className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-900">
          Pantalla completa
        </button>
      )}
    </div>
  );
}
