import { useEffect, useState } from 'react';
import { GRENADE, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import MathText from './MathText.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

export function useCountdown(item) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!item) return 0;
  return Math.max(0, item.timeLimitMs - (now - item.receivedAt));
}

// Pregunta con opciones que responden al levantar el dedo (sirve también con otro dedo en pantalla)
export function QuestionCard({ item, onAnswer, compact = false }) {
  const [chosen, setChosen] = useState(null);
  const left = useCountdown(item);
  useEffect(() => setChosen(null), [item?.id]);
  if (!item) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[11px] text-stone-300">
        <span className="truncate">{item.tema}</span>
        <span className="ml-auto font-mono text-khaki-light">{Math.ceil(left / 1000)} s</span>
      </div>
      <div className="h-1 overflow-hidden rounded bg-black/50">
        <div className="h-full bg-khaki" style={{ width: `${(left / item.timeLimitMs) * 100}%` }} />
      </div>
      <MathText text={item.enunciado} className={compact ? 'text-sm' : 'text-sm sm:text-base'} />
      <div className={`grid gap-1.5 ${item.opciones.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {item.opciones.map((o, i) => (
          <button
            key={i}
            disabled={chosen !== null}
            onPointerUp={() => {
              if (chosen !== null) return;
              setChosen(i);
              onAnswer(i);
            }}
            className={`flex items-center gap-2 rounded border px-2 text-left ${compact ? 'min-h-[2.75rem] text-base' : 'min-h-[3.25rem] text-base sm:text-lg'} ${
              chosen === i ? 'border-khaki bg-khaki/25' : 'border-white/15 bg-black/35'
            }`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-khaki text-xs font-bold text-olive-950">{LETTERS[i]}</span>
            <MathText text={o} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function killerText(self, roster) {
  const weapon = WEAPON_IDS[self.killedWith];
  if (weapon === 'zone') return 'La zona te alcanzó';
  const killer = roster.find((p) => p.id === self.killedBy);
  const name = weapon === 'grenade' ? GRENADE.name : WEAPONS[weapon]?.name;
  return killer ? `Te eliminó ${killer.name}${name ? ` · ${name}` : ''}` : 'Eliminado';
}

// Controles del espectador: a quién sigue y, si hay combates, cambiar entre el Gulag y la partida
export function FollowControls({ client, followName, gulagFights }) {
  const watching = client.watchingGulag;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button onPointerUp={() => client.cycleFollow(-1)} className="rounded bg-black/40 px-2 py-1">◀</button>
      <span className="truncate text-stone-300">Viendo: {followName ?? '—'}</span>
      <button onPointerUp={() => client.cycleFollow(1)} className="rounded bg-black/40 px-2 py-1">▶</button>
      {(gulagFights > 0 || watching) && (
        <button onPointerUp={() => client.watchGulag(!watching)} className="rounded bg-red-900/70 px-2 py-1 font-bold text-red-100">
          {watching ? 'Ver la partida' : 'Ver el Gulag'}
        </button>
      )}
    </div>
  );
}

// Panel del espectador (caído sin Gulag o que ya lo perdió): sigue a otros y responde preguntas de práctica
export function OperatorPanel({ client, self, roster, followName, gulagFights = 0 }) {
  return (
    <div className="absolute inset-x-2 bottom-2 z-30 flex max-h-[55%] gap-3 overflow-y-auto rounded-lg border border-khaki-dark/70 bg-olive-950/90 p-3 text-stone-100 shadow-2xl">
      <div className="flex shrink-0 flex-col gap-2" style={{ maxWidth: '42%' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-300">{killerText(self, roster)}</p>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-khaki-light">👁 Espectador</p>
        <p className="text-[11px] text-stone-300">Cada acierto de práctica suma puntos a tu resultado.</p>
        <FollowControls client={client} followName={followName} gulagFights={gulagFights} />
      </div>
      <div className="min-w-0 flex-1">
        {client.transmission ? (
          <QuestionCard item={client.transmission} onAnswer={(i) => client.answerTransmission(client.transmission.id, i)} />
        ) : (
          <p className="mt-6 text-center text-sm text-stone-400">Esperando la próxima pregunta de práctica…</p>
        )}
      </div>
    </div>
  );
}

// Resultado breve de una pregunta de práctica o del Gulag
export function TransmissionToast({ result }) {
  if (!result || performance.now() - result.at > 4000) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[5.5rem] z-40 -translate-x-1/2">
      <div className={`rounded px-3 py-1.5 text-sm font-bold shadow ${result.correct ? 'bg-green-900/90 text-green-100' : 'bg-red-900/90 text-red-100'}`}>
        {result.correct ? 'Correcto' : 'Incorrecto'}
        {result.explicacion && <MathText text={result.explicacion} className="mt-1 block text-xs font-normal text-stone-200" />}
      </div>
    </div>
  );
}
