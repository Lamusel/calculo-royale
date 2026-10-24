import { useEffect, useState } from 'react';
import { BOMBING, GRENADE, OPERATOR, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { ALL_SECTORS } from '@calculo-royale/shared/zone';
import MathText from './MathText.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

function useCountdown(item) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!item) return 0;
  return Math.max(0, item.timeLimitMs - (now - item.receivedAt));
}

// Pregunta con 4 opciones que responden al levantar el dedo (sirve también con otro dedo en pantalla)
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

// Cuadrícula A1–H8 para elegir dónde caerá el bombardeo
function SectorPicker({ selected, votes, onPick, bombing }) {
  const max = Math.max(1, ...Object.values(votes ?? {}));
  return (
    <div className="grid grid-cols-8 gap-0.5" style={{ width: 'min(46vw, 15rem)' }}>
      {ALL_SECTORS.map((name) => {
        const v = votes?.[name] ?? 0;
        return (
          <button
            key={name}
            onPointerUp={() => onPick(name)}
            className={`relative aspect-square rounded-sm text-[9px] font-bold ${
              bombing === name ? 'animate-pulse bg-red-600 text-white' : selected === name ? 'bg-khaki text-olive-950' : 'bg-black/40 text-stone-300'
            }`}
            style={v && selected !== name && bombing !== name ? { background: `rgba(239, 68, 68, ${0.15 + (0.5 * v) / max})` } : undefined}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

function killerText(self, roster) {
  const weapon = WEAPON_IDS[self.killedWith];
  if (weapon === 'zone') return 'La zona te alcanzó';
  if (weapon === 'bomb') return 'Bombardeo de los operadores';
  const killer = roster.find((p) => p.id === self.killedBy);
  const name = weapon === 'grenade' ? GRENADE.name : WEAPONS[weapon]?.name;
  return killer ? `Te eliminó ${killer.name}${name ? ` · ${name}` : ''}` : 'Eliminado';
}

// Panel del operador de radio (caído en partida): reanimación o votos de bombardeo + transmisión
export function OperatorPanel({ client, self, roster, others, followName }) {
  const op = self.operator;
  const alive = [...(others?.values() ?? [])].filter((p) => !(p.flags & PLAYER_FLAGS.DEAD)).length;
  const votes = client.classStats?.votes;
  return (
    <div className="absolute inset-x-2 bottom-2 z-30 flex max-h-[62%] gap-3 overflow-y-auto rounded-lg border border-khaki-dark/70 bg-olive-950/90 p-3 text-stone-100 shadow-2xl">
      <div className="flex shrink-0 flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-300">{killerText(self, roster)}</p>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-khaki-light">📻 Operador de radio</p>
        {op?.mode === 'revive' ? (
          <div className="text-sm">
            <p>Acierta {OPERATOR.reviveStreak} seguidas para volver al combate:</p>
            <p className="mt-1 text-2xl tracking-widest text-khaki">
              {Array.from({ length: OPERATOR.reviveStreak }, (_, i) => (i < op.streak ? '●' : '○')).join(' ')}
            </p>
            <p className="text-[11px] text-stone-400">Un fallo reinicia la cuenta.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-[11px] text-stone-300">
            <p>Cada acierto es un voto para el sector elegido. El más votado se bombardea cada 60 s.</p>
            {alive <= BOMBING.disabledAtAlive && <p className="text-orange-300">Bombardeos desactivados: quedan {alive} vivos.</p>}
            <SectorPicker selected={op?.sector} votes={votes} bombing={client.lastFrame?.bombing?.[0]} onPick={(s) => client.voteSector(s)} />
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <button onPointerUp={() => client.cycleFollow(-1)} className="rounded bg-black/40 px-2 py-1">◀</button>
          <span className="truncate text-stone-300">Viendo: {followName ?? '—'}</span>
          <button onPointerUp={() => client.cycleFollow(1)} className="rounded bg-black/40 px-2 py-1">▶</button>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {client.transmission ? (
          <QuestionCard item={client.transmission} onAnswer={(i) => client.answerTransmission(client.transmission.id, i)} />
        ) : (
          <p className="mt-6 text-center text-sm text-stone-400">Esperando la próxima transmisión…</p>
        )}
      </div>
    </div>
  );
}

// Intercepción: pregunta rápida para los vivos, sin detenerse (no tapa los joysticks)
export function InterceptCard({ client }) {
  if (!client.intercept) return null;
  return (
    <div className="absolute left-1/2 top-[5.5rem] z-30 w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border border-sky-400/70 bg-black/80 p-2 text-stone-100 shadow-xl">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300">📡 Transmisión enemiga · descífrala sin detenerte</p>
      <QuestionCard item={client.intercept} compact onAnswer={(i) => client.answerTransmission(client.intercept.id, i)} />
    </div>
  );
}

// Resultado breve de una transmisión o intercepción
export function TransmissionToast({ result }) {
  if (!result || performance.now() - result.at > 4000) return null;
  let text = result.correct ? 'Correcto' : 'Incorrecto';
  if (result.revived) text = '¡Reanimado! Vuelves al combate';
  else if (result.intel) text = `Interceptada: la próxima zona tendrá centro (${result.intel.cx}, ${result.intel.cy})`;
  else if (result.late) text = 'Correcto, pero otros la descifraron antes';
  return (
    <div className="pointer-events-none absolute left-1/2 top-[5.5rem] z-40 -translate-x-1/2">
      <div className={`rounded px-3 py-1.5 text-sm font-bold shadow ${result.correct ? 'bg-green-900/90 text-green-100' : 'bg-red-900/90 text-red-100'}`}>
        {text}
        {result.explicacion && result.kind === 'operator' && !result.revived && (
          <MathText text={result.explicacion} className="mt-1 block text-xs font-normal text-stone-200" />
        )}
      </div>
    </div>
  );
}
