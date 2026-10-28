import { useEffect, useState } from 'react';
import { FollowControls, QuestionCard } from './Operator.jsx';

// Interfaz del Gulag (fase 30): en la cola (espectea el combate o la partida), las 3 preguntas
// congelado en la esquina, la elección de arma con 3 aciertos, la cuenta regresiva y el combate.

const LOADOUT = ['Puños', 'Pistola (un cargador)', 'Pistola, casco y una venda', 'Pistola, casco, venda y rifle o escopeta'];
const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function useTick(ms = 250) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function GulagPanel({ client, self, roster, frameRef }) {
  useTick();
  const g = self?.gulag;
  if (!g) return null;
  const snap = frameRef.current.gulag ?? [];
  const fights = snap[1] ?? [];
  const name = (id) => roster.find((p) => p.id === id)?.name ?? 'Guardia del Gulag';

  if (g.state === 'queue') {
    const waited = Math.max(0, (performance.now() - (client.gulagQueuedAt ??= performance.now())) / 1000);
    return (
      <div className="absolute inset-x-2 bottom-2 z-30 flex flex-col gap-2 rounded-lg border border-red-900/70 bg-black/85 p-3 text-stone-100 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-[30rem] sm:-translate-x-1/2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-red-300">⛓ Gulag</p>
        <p className="text-sm">
          Esperando rivales en el Gulag… <b>{snap[0] ?? 1}</b> en cola · {Math.floor(waited)} s
        </p>
        <p className="text-[11px] text-stone-400">Gana el combate y vuelves a la partida. Mientras esperas, mira el Gulag o la partida.</p>
        <FollowControls client={client} followName={roster.find((p) => p.id === client.followId)?.name} gulagFights={fights.length} />
      </div>
    );
  }
  client.gulagQueuedAt = null;

  const fight = fights.find((f) => f[5].some(([id]) => id === client.myId));
  if (!fight) return null;
  const [, , state, msLeft, , scores] = fight;
  const mine = scores.find(([id]) => id === client.myId)?.[1] ?? 0;
  const rivals = scores.filter(([id]) => id !== client.myId);

  if (state === 0) {
    const t = client.transmission?.kind === 'gulag' ? client.transmission : null;
    return (
      <div className="absolute left-1/2 top-[4.5rem] z-40 flex w-[min(94vw,32rem)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-red-900/70 bg-black/85 p-3 text-stone-100 shadow-2xl">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red-300">
          <span>⛓ Gulag · pregunta {Math.min(3, t?.dificultad ?? 3)} de 3</span>
          <span className="ml-auto text-khaki-light">Aciertos: {mine}</span>
        </div>
        {t ? (
          <QuestionCard item={t} compact onAnswer={(i) => client.answerTransmission(t.id, i)} />
        ) : g.choose ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">¡3 de 3! Elige tu arma principal:</p>
            <div className="grid grid-cols-2 gap-2">
              {[['rifle', 'Rifle de asalto'], ['shotgun', 'Escopeta']].map(([id, label]) => (
                <button key={id} onPointerUp={() => client.chooseGulagWeapon(id)} className="min-h-[3rem] rounded border border-khaki bg-khaki/20 font-bold">
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-300">Esperando a los rivales…</p>
        )}
        <p className="text-[11px] text-stone-400">
          Con {mine}: {LOADOUT[mine]} · Rivales: {rivals.map(([id, c]) => `${name(id)} ${c}/3`).join(' · ')}
        </p>
      </div>
    );
  }

  // Cuenta regresiva y combate: solo una etiqueta arriba (no tapa los controles)
  const label = state === 1 ? `¡A pelear en ${Math.ceil(msLeft / 1000)}!` : state === 2 ? `Gulag · ${clock(msLeft)}` : '¡Muerte súbita! El círculo se cierra';
  return (
    <div className="pointer-events-none absolute left-1/2 top-12 z-30 -translate-x-1/2 rounded bg-red-950/85 px-3 py-1 text-center text-sm font-bold text-red-100">
      ⛓ {label}
      <span className="ml-2 text-xs font-normal text-red-200">{rivals.map(([id]) => name(id)).join(' · ')}</span>
    </div>
  );
}

// Proyector: cola del Gulag y combates en curso con los aciertos de cada uno
export function GulagBoard({ frameRef, roster, onWatch }) {
  useTick(500);
  const snap = frameRef.current.gulag ?? [];
  const fights = snap[1] ?? [];
  if (!snap.length || (!snap[0] && !fights.length)) return null;
  const name = (id) => roster.find((p) => p.id === id)?.name ?? 'Guardia del Gulag';
  const STATES = ['preguntas', 'cuenta regresiva', 'combate', 'muerte súbita'];
  return (
    <div className="pointer-events-auto absolute right-3 top-28 z-30 w-64 rounded-lg border border-red-900/70 bg-black/80 p-2 text-xs text-stone-100">
      <p className="font-mono font-bold uppercase tracking-[0.2em] text-red-300">⛓ Gulag · {snap[0]} en cola</p>
      {fights.map(([id, , state, ms, , scores]) => (
        <button key={id} onClick={() => onWatch?.(scores[0][0])} className="mt-1 block w-full rounded bg-white/5 p-1.5 text-left hover:bg-white/10">
          <span className="text-stone-400">
            {STATES[state]}
            {state > 0 ? ` · ${Math.ceil(ms / 1000)} s` : ''}
          </span>
          {scores.map(([pid, c]) => (
            <span key={pid} className="block">
              {name(pid)} <b className="text-khaki-light">{c}/3</b>
            </span>
          ))}
        </button>
      ))}
    </div>
  );
}
