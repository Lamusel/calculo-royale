import { useEffect, useState } from 'react';
import { BOSS } from '@calculo-royale/shared/constants';
import { QuestionCard } from './Operator.jsx';
import { TouchButton } from './CombatHUD.jsx';
import { actions } from '../input/inputState.js';

// Modo Profe Jefe Final (fase 21): barra del jefe (fase, vida, escudo y tiempo), botón "Romper
// escudo" (o Q), la pregunta del escudo o de volver y, caído, la cuenta para volver a la cancha.

const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function BossBar({ boss }) {
  if (!boss) return null;
  const hp = Math.max(0, boss.hp / boss.maxHp);
  return (
    <div className="pointer-events-none absolute left-1/2 z-30 w-[min(70vw,30rem)] -translate-x-1/2" style={{ top: 'calc(max(0.5rem, env(safe-area-inset-top)) + 2.6rem)' }}>
      <div className="flex items-baseline justify-between text-[clamp(0.7rem,2vw,0.85rem)] font-black uppercase tracking-wider">
        <span className="text-red-300">🎓 {BOSS.name}</span>
        <span className="font-mono text-stone-200">
          Fase {boss.phase + 1}/{BOSS.phases.length} · {clock(boss.timeLeft)}
        </span>
      </div>
      <div className="mt-0.5 h-3 overflow-hidden rounded bg-black/70 ring-1 ring-red-900">
        <div className="h-full bg-gradient-to-r from-red-700 to-red-400 transition-all" style={{ width: `${hp * 100}%` }} />
      </div>
      <div className="mt-1 flex items-center gap-2 text-[clamp(0.65rem,1.8vw,0.8rem)]">
        {boss.shieldUp ? (
          <>
            <span className="text-sky-200">🛡 Escudo · aciertos del equipo</span>
            <div className="flex flex-1 gap-0.5">
              {Array.from({ length: boss.goal }, (_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-sm ${i < boss.progress ? 'bg-sky-300' : 'bg-black/60 ring-1 ring-sky-900'}`} />
              ))}
            </div>
          </>
        ) : (
          <span className="animate-pulse font-bold text-amber-300">¡Escudo abajo! Disparen al profe</span>
        )}
      </div>
      {boss.waveIn >= 0 && <p className="mt-1 animate-pulse text-center text-sm font-black uppercase text-orange-400">¡Onda expansiva! Aléjate</p>}
    </div>
  );
}

// Pedir la pregunta del escudo (vivo) o la de volver (caído); la tarjeta de la pregunta y el resultado
export default function BossHUD({ client, frameRef, self, isTouch }) {
  const [, tick] = useState(0);
  useEffect(() => {
    actions.bossShield = () => client.bossRequest('shield');
    const id = setInterval(() => tick((n) => n + 1), 300);
    return () => {
      actions.bossShield = () => {};
      clearInterval(id);
    };
  }, [client]);
  const boss = frameRef.current.boss;
  if (!boss || !self) return null;
  const now = performance.now();
  const q = client.bossQuestion;
  const result = client.bossResult && now - client.bossResult.at < 3000 ? client.bossResult : null;
  const reviveIn = !self.alive && client.reviveAt ? Math.max(0, Math.ceil((client.reviveAt - now) / 1000)) : null;
  return (
    <>
      <BossBar boss={boss} />
      {q && (
        <div className="absolute left-1/2 top-[11rem] z-40 w-[min(92vw,26rem)] -translate-x-1/2 rounded-lg border border-sky-400/70 bg-black/85 p-2 text-stone-100 shadow-xl">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300">
            {q.kind === 'shield' ? '🛡 Código del escudo · puedes moverte' : '🪂 Responde bien para volver a la cancha'}
          </p>
          <QuestionCard item={q} compact onAnswer={(i) => client.answerBoss(i)} />
        </div>
      )}
      {result && !q && (
        <p className={`pointer-events-none absolute left-1/2 top-[11rem] z-40 -translate-x-1/2 rounded px-3 py-1.5 text-sm font-bold ${result.correct ? 'bg-green-900/90 text-green-100' : 'bg-red-900/90 text-red-100'}`}>
          {result.kind === 'revive'
            ? result.correct
              ? '¡De vuelta en la cancha!'
              : `Incorrecto · otra vez en ${Math.round(BOSS.reviveRetryMs / 1000)} s`
            : result.correct
              ? `+1 al escudo (${result.progress}/${result.goal})`
              : `Incorrecto · espera ${Math.round(BOSS.failCooldownMs / 1000)} s`}
        </p>
      )}
      {self.alive && boss.shieldUp && !q && (
        <div className="absolute bottom-[7.5rem] right-3 z-30">
          <TouchButton
            onPress={() => client.bossRequest('shield')}
            className={`rounded-2xl px-3 py-2 text-xs font-black uppercase ${self.bossCooldown ? 'bg-black/50 text-stone-400' : 'bg-sky-600 text-white shadow-lg'}`}
          >
            🛡 Romper escudo {isTouch ? '' : '(Q)'}
          </TouchButton>
        </div>
      )}
      {!self.alive && !q && (
        <div className="absolute inset-x-0 top-1/3 z-30 flex flex-col items-center gap-2 text-center">
          <p className="text-3xl font-black uppercase tracking-widest text-red-500 drop-shadow">Caíste</p>
          {reviveIn > 0 ? (
            <p className="rounded bg-black/60 px-3 py-1 text-stone-200">Puedes volver en {reviveIn} s</p>
          ) : (
            <TouchButton onPress={() => client.bossRequest('revive')} className="rounded-xl bg-khaki px-4 py-2 font-bold text-olive-950">
              Responder para volver
            </TouchButton>
          )}
        </div>
      )}
    </>
  );
}
