import { useEffect, useState } from 'react';
import { CREDITS } from '../credits.js';
import Logo from './Logo.jsx';

// Intro (fase 20): el logo aparece, el título sube y se desvanece. Una vez por pestaña; un toque la salta.
const KEY = 'cr-intro-vista';

export function shouldShowIntro(storage = globalThis.sessionStorage) {
  try {
    if (new URLSearchParams(location.search).get('intro') === '0' || storage.getItem(KEY)) return false;
    storage.setItem(KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export default function Intro({ onDone }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [setTimeout(() => setStep(1), 150), setTimeout(() => setStep(2), 1600), setTimeout(onDone, 2400)];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);
  return (
    <div
      onPointerDown={onDone}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-olive-950 text-stone-100 transition-opacity duration-700 ${step === 2 ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className={`transition-all duration-1000 ${step >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
        <Logo className="h-[clamp(5rem,22vmin,10rem)] w-[clamp(5rem,22vmin,10rem)]" />
      </div>
      <p className={`text-[clamp(1.8rem,7vmin,3.5rem)] font-black uppercase tracking-tight transition-all delay-300 duration-700 ${step >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        Cálculo <span className="text-khaki">Royale</span>
      </p>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-stone-400">{CREDITS.subtitle}</p>
    </div>
  );
}

// Créditos: todo sale de client/src/credits.js
export function Credits({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onPointerUp={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-khaki-dark bg-olive-900 p-5 text-stone-100">
        <div className="flex items-center gap-3">
          <Logo className="h-12 w-12" />
          <div>
            <p className="text-xl font-black uppercase">{CREDITS.title}</p>
            <p className="text-xs text-stone-400">{CREDITS.subtitle}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-stone-300">{CREDITS.institution}</p>
        <p className="text-sm text-stone-300">{CREDITS.course}</p>
        <dl className="mt-3 flex flex-col gap-2">
          {CREDITS.sections.map((s) => (
            <div key={s.role}>
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-khaki-light">{s.role}</dt>
              <dd className="text-sm">{s.names.join(', ')}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-stone-400">{CREDITS.tech}</p>
        <p className="text-xs text-stone-500">© {CREDITS.year}</p>
        <button onClick={onClose} className="mt-4 w-full rounded bg-khaki py-2 font-bold text-olive-950">
          Cerrar
        </button>
      </div>
    </div>
  );
}
