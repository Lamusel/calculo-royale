import MathText from './MathText.jsx';
import { QuestionCard } from './Operator.jsx';

// "Obtener balas": tarjeta compacta que no tapa los joysticks (te puedes mover, no disparar)
export function AmmoCard({ client }) {
  if (!client.ammoQuestion) return null;
  return (
    <div className="absolute left-1/2 top-[5.5rem] z-30 w-[min(92vw,26rem)] -translate-x-1/2 rounded-lg border border-amber-400/70 bg-black/80 p-2 text-stone-100 shadow-xl">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-amber-300">🔫 Obtener balas · puedes moverte, no disparar</p>
      <QuestionCard item={client.ammoQuestion} compact onAnswer={(i) => client.answerAmmo(i)} />
    </div>
  );
}

// Resultado breve
export function AmmoToast({ result }) {
  if (!result || result.cancelled || performance.now() - result.at > 3500) return null;
  const text = result.correct
    ? `+1 cargador · ${result.weapon}`
    : result.timedOut
      ? `Se acabó el tiempo · espera ${Math.round(result.cooldownMs / 1000)} s`
      : `Incorrecto · espera ${Math.round(result.cooldownMs / 1000)} s`;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[5.5rem] z-40 -translate-x-1/2">
      <div className={`rounded px-3 py-1.5 text-sm font-bold shadow ${result.correct ? 'bg-green-900/90 text-green-100' : 'bg-red-900/90 text-red-100'}`}>
        {text}
        {result.correct && result.explicacion && <MathText text={result.explicacion} className="mt-1 block text-xs font-normal text-stone-200" />}
      </div>
    </div>
  );
}
