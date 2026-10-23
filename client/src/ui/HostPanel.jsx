import { TOPICS } from '@calculo-royale/shared/constants';

// Aciertos de la clase por tema, en vivo (host y proyector)
export function ClassTopics({ stats }) {
  const entries = Object.entries(stats?.byTopic ?? {}).sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total);
  if (entries.length === 0) return <p className="text-sm text-stone-400">Todavía nadie ha respondido.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([slug, { ok, total }]) => {
        const pct = Math.round((ok / total) * 100);
        return (
          <div key={slug} className="flex items-center gap-2 text-sm">
            <span className="w-44 shrink-0 truncate text-stone-300">{TOPICS[slug] ?? slug}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded bg-black/50">
              <div className={`h-full ${pct < 50 ? 'bg-red-500' : pct < 75 ? 'bg-yellow-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-20 text-right font-mono text-xs text-stone-300">
              {pct}% ({ok}/{total})
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Panel del host: cómo va la clase por tema, vivos y operadores, y enlace a la vista del proyector
export default function HostPanel({ stats, code, onClose }) {
  const url = `${location.origin}/espectador?code=${code}`;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onPointerUp={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg border border-khaki-dark bg-olive-900 p-4 text-stone-100">
        <div className="mb-3 flex items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Panel del profe</p>
          <button onClick={onClose} className="ml-auto rounded bg-black/40 px-2 py-1 text-xs">
            Cerrar
          </button>
        </div>
        {stats && (
          <p className="mb-3 text-sm text-stone-300">
            Vivos: <b>{stats.alive}</b> de {stats.total} · operadores de radio: <b>{stats.operators}</b>
          </p>
        )}
        <p className="mb-1 text-xs uppercase tracking-wider text-stone-400">Acierto por tema (de menor a mayor)</p>
        <ClassTopics stats={stats} />
        <p className="mt-4 text-xs text-stone-400">
          Vista para el proyector: <span className="break-all font-mono text-khaki-light">{url}</span>
        </p>
      </div>
    </div>
  );
}
