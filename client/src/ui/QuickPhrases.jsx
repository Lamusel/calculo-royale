import { useEffect, useState } from 'react';
import { CHAT, PHRASE_LIMIT, QUICK_PHRASES } from '@calculo-royale/shared/constants';
import { actions } from '../input/inputState.js';
import { TouchButton } from './CombatHUD.jsx';
import { minimapSize } from './TacticalMap.jsx';

// Frases rápidas (fase 20): botón 💬 (o T) que abre las 6 frases; con el menú abierto, 1–6 eligen.
// El servidor aplica el antispam; aquí solo se evita repetir por error. Abajo, las últimas frases.
// Chat de texto (6.5): Enter o ⌨ abre la caja con pestañas Equipo/Todos; se cierra al enviar.
export default function QuickPhrases({ client, roster, isTouch, teams = false, chatOff = false }) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(false);
  const [toTeam, setToTeam] = useState(true);
  const [text, setText] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    actions.phraseMenu = () => setOpen((o) => !o);
    actions.chatOpen = () => setChat(true);
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => {
      actions.phraseMenu = () => {};
      actions.chatOpen = () => {};
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
  const send = (e) => {
    e.preventDefault();
    if (text.trim()) actions.chat(text, teams && toTeam);
    setText('');
    setChat(false);
  };
  const now = performance.now();
  const recent = client.phrases.filter((p) => now - p.at < (p.text ? CHAT.showMs : PHRASE_LIMIT.showMs)).slice(-4);
  const nameOf = (id) => roster.find((p) => p.id === id);
  return (
    <>
      <div className="pointer-events-none absolute bottom-[8.5rem] left-3 z-20 flex max-w-[60vw] flex-col gap-1 sm:max-w-xs">
        {recent.map((p) => {
          const who = nameOf(p.id);
          return (
            <p key={`${p.id}-${p.at}`} className="rounded bg-black/60 px-2 py-0.5 text-xs text-stone-100">
              {p.team && <span className="mr-1 text-[10px] text-green-300">[Equipo]</span>}
              <b style={{ color: who?.color }}>{who?.name ?? '?'}</b>: {p.text ?? QUICK_PHRASES[p.index]}
            </p>
          );
        })}
      </div>
      <div className="absolute left-3 z-30 flex flex-col items-start gap-1" style={{ top: minimapSize(isTouch) + 52 }}>
        <TouchButton onPress={() => setOpen((o) => !o)} className="rounded bg-black/55 px-2.5 py-1 text-sm" title="Frases rápidas (T)">
          💬
        </TouchButton>
        {!chatOff && !chat && (
          <TouchButton onPress={() => setChat(true)} className="rounded bg-black/55 px-2.5 py-1 text-sm" title="Chat (Enter)">
            ⌨
          </TouchButton>
        )}
        {!chatOff && chat && (
          <form onSubmit={send} className="flex w-64 flex-col gap-1 rounded border border-white/10 bg-black/80 p-1.5">
            <div className="flex gap-1 text-xs">
              {teams && (
                <button type="button" onClick={() => setToTeam(true)} className={`rounded px-2 py-0.5 ${toTeam ? 'bg-green-700 text-white' : 'bg-white/10 text-stone-300'}`}>
                  Equipo
                </button>
              )}
              <button type="button" onClick={() => setToTeam(false)} className={`rounded px-2 py-0.5 ${!teams || !toTeam ? 'bg-khaki text-olive-950' : 'bg-white/10 text-stone-300'}`}>
                Todos
              </button>
              <button type="button" onClick={() => setChat(false)} className="ml-auto px-1 text-stone-400">
                ✕
              </button>
            </div>
            <input autoFocus value={text} maxLength={CHAT.maxLength} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setChat(false)} placeholder="Escribe y Enter…" className="rounded bg-white/10 px-2 py-1 text-sm text-stone-100 outline-none" />
          </form>
        )}
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
