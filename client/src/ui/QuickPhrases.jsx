import { useEffect, useState } from 'react';
import { PHRASE_LIMIT, QUICK_PHRASES } from '@calculo-royale/shared/constants';
import { actions } from '../input/inputState.js';
import { TouchButton } from './CombatHUD.jsx';

// Frases rápidas (fase 20): botón 💬 (o T) que abre las 6 frases; con el menú abierto, 1–6 eligen.
// El servidor aplica el antispam; aquí solo se evita repetir por error. Abajo, las últimas frases.
export default function QuickPhrases({ client, roster }) {
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    actions.phraseMenu = () => setOpen((o) => !o);
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => {
      actions.phraseMenu = () => {};
      clearInterval(id);
    };
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= QUICK_PHRASES.length) {
        e.stopImmediatePropagation();
        e.preventDefault();
        say(n - 1);
      } else if (e.key === 'Escape') setOpen(false);
    };
    // Captura: con el menú abierto, 1 y 2 no cambian de arma
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [open]);
  const say = (i) => {
    actions.phrase(i);
    setOpen(false);
  };
  const now = performance.now();
  const recent = client.phrases.filter((p) => now - p.at < PHRASE_LIMIT.showMs);
  const nameOf = (id) => roster.find((p) => p.id === id);
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1">
        {recent.map((p) => {
          const who = nameOf(p.id);
          return (
            <p key={`${p.id}-${p.at}`} className="rounded bg-black/60 px-2 py-0.5 text-xs text-stone-100">
              <b style={{ color: who?.color }}>{who?.name ?? '?'}</b>: {QUICK_PHRASES[p.index]}
            </p>
          );
        })}
      </div>
      <div className="absolute right-3 top-14 z-30 flex flex-col items-end gap-1">
        <TouchButton onPress={() => setOpen((o) => !o)} className="rounded bg-black/55 px-2.5 py-1 text-sm" title="Frases rápidas (T)">
          💬
        </TouchButton>
        {open && (
          <div className="flex w-44 flex-col gap-1 rounded border border-white/10 bg-black/80 p-1.5">
            {QUICK_PHRASES.map((text, i) => (
              <TouchButton key={text} onPress={() => say(i)} className="rounded bg-white/10 px-2 py-1 text-left text-xs text-stone-100">
                <span className="mr-1 font-mono text-khaki-light">{i + 1}</span>
                {text}
              </TouchButton>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
