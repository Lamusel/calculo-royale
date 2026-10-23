import { useEffect, useState } from 'react';
import { RARITIES } from '@calculo-royale/shared/constants';
import MathText from './MathText.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

// Candado de código de una caja de suministro: la pregunta ABCD es el código.
// Las opciones responden al levantar el dedo (pointerup): funciona aunque otro dedo esté en
// la pantalla y evita elegir por accidente al apoyar el pulgar.
export function LockModal({ question, onAnswer, onCancel }) {
  const [chosen, setChosen] = useState(null);
  const [now, setNow] = useState(performance.now());
  const rarity = RARITIES[question.rarity];

  useEffect(() => {
    setChosen(null);
    const id = setInterval(() => setNow(performance.now()), 200);
    return () => clearInterval(id);
  }, [question]);

  const left = Math.max(0, question.timeLimitMs - (now - question.receivedAt));
  const ratio = left / question.timeLimitMs;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-2 backdrop-blur-[2px]">
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-2 overflow-y-auto rounded-lg border-2 border-khaki-dark bg-gradient-to-b from-olive-800 to-olive-950 p-3 text-stone-100 shadow-2xl sm:gap-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-khaki-light">🔒 Candado de código</span>
          <span className="rounded px-2 py-0.5 text-[11px] font-bold uppercase text-black" style={{ background: rarity.color }}>
            {rarity.name}
          </span>
          <span className="truncate text-xs text-stone-300">{question.tema}</span>
          <button
            onPointerUp={onCancel}
            className="ml-auto rounded bg-black/40 px-2.5 py-1 text-xs text-stone-200"
            aria-label="Cancelar"
          >
            ✕ Cancelar
          </button>
        </div>

        <div className="h-1.5 overflow-hidden rounded bg-black/50">
          <div
            className={`h-full transition-[width] duration-200 ${ratio < 0.25 ? 'bg-red-500' : 'bg-khaki'}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>

        <MathText text={question.enunciado} className="text-base leading-relaxed sm:text-lg" />

        <div className="grid grid-cols-2 gap-2">
          {question.opciones.map((option, i) => (
            <button
              key={i}
              disabled={chosen !== null}
              onPointerUp={() => {
                if (chosen !== null) return;
                setChosen(i);
                onAnswer(i);
              }}
              className={`flex min-h-[3.25rem] items-center gap-3 rounded-md border px-3 py-2 text-left text-base transition sm:text-lg ${
                chosen === i ? 'border-khaki bg-khaki/25' : 'border-white/15 bg-black/35 active:bg-khaki/20'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-khaki font-bold text-olive-950">{LETTERS[i]}</span>
              <MathText text={option} />
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-300">
          <span className="font-mono text-khaki-light">{Math.ceil(left / 1000)} s</span>
          <span>Botín posible: {rarity.loot.join(' · ')}</span>
          <span className="ml-auto text-orange-300">⚠ Estás expuesto · moverte cancela</span>
        </div>
      </div>
    </div>
  );
}

const OUTCOMES = {
  correct: { title: '¡Código correcto!', tone: 'border-green-400 bg-green-950/85' },
  wrong: { title: 'Código incorrecto', tone: 'border-red-400 bg-red-950/85' },
  timeout: { title: 'Se acabó el tiempo', tone: 'border-red-400 bg-red-950/85' },
  cancelled: { title: 'Candado cancelado', tone: 'border-stone-400 bg-stone-900/85' },
};

// Resultado de la caja: botín y explicación si acertó; bloqueo si falló
export function CrateResult({ result, onClose }) {
  const outcome = OUTCOMES[result.outcome];
  return (
    <div className="absolute left-1/2 top-14 z-40 w-[min(92vw,34rem)] -translate-x-1/2" onPointerUp={onClose}>
      <div className={`rounded-lg border-2 px-4 py-3 text-stone-100 shadow-xl ${outcome.tone}`}>
        <p className="font-bold uppercase tracking-wider">{outcome.title}</p>
        {result.outcome === 'correct' && (
          <>
            <p className="mt-1 text-sm text-green-200">Botín: {result.loot.join(' · ')}</p>
            {result.radar && <p className="text-sm font-bold text-sky-300">Racha de 3: radar activado 10 s</p>}
            <MathText text={result.explicacion} className="mt-2 block text-sm text-stone-200" />
          </>
        )}
        {(result.outcome === 'wrong' || result.outcome === 'timeout') && (
          <p className="mt-1 text-sm text-red-200">
            La caja quedó bloqueada 15 s y sonó la alarma.{result.lostArmor ? ' Todo o nada: perdiste el chaleco.' : ''} La solución
            aparece en los resultados al final.
          </p>
        )}
        {result.outcome === 'cancelled' && result.reason && <p className="mt-1 text-sm text-stone-300">{result.reason}</p>}
      </div>
    </div>
  );
}
