import { TOPICS } from '@calculo-royale/shared/constants';
import { ClassTopics } from './HostPanel.jsx';
import MathText from './MathText.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

function TopicBars({ byTopic }) {
  const entries = Object.entries(byTopic ?? {});
  if (entries.length === 0) return <p className="text-sm text-stone-400">No abriste cajas en esta partida.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([slug, { ok, total }]) => (
        <div key={slug} className="flex items-center gap-2 text-sm">
          <span className="w-48 shrink-0 truncate text-stone-300">{TOPICS[slug] ?? slug}</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-black/50">
            <div className="h-full bg-khaki" style={{ width: `${(ok / total) * 100}%` }} />
          </div>
          <span className="w-12 text-right font-mono text-xs text-stone-300">
            {ok}/{total}
          </span>
        </div>
      ))}
    </div>
  );
}

function FailedQuestion({ q }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-stone-400">{TOPICS[q.tema] ?? q.tema}</p>
      <MathText text={q.enunciado} className="block text-sm sm:text-base" />
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
        {q.opciones.map((o, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 rounded px-2 py-1 ${
              i === q.correcta ? 'bg-green-900/60 text-green-100' : i === q.elegida ? 'bg-red-900/60 text-red-100' : 'bg-black/20 text-stone-300'
            }`}
          >
            <b>{LETTERS[i]}</b> <MathText text={o} />
            {i === q.correcta && <span className="ml-auto text-[10px] uppercase">correcta</span>}
            {i === q.elegida && i !== q.correcta && <span className="ml-auto text-[10px] uppercase">tu respuesta</span>}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-stone-300">
        <b className="text-khaki-light">Solución:</b> <MathText text={q.explicacion} />
      </p>
    </div>
  );
}

// Pantalla de resultados: ganador, ranking, aciertos por tema y las preguntas falladas resueltas
// Con myId = null (proyector) se muestran los aciertos de la clase en vez de los propios
export default function Results({ results, mine, myId, isHost, onReset, classStats }) {
  const spectator = myId === null;
  if (!results) return null;
  const winner = results.ranking.find((r) => r.id === results.winnerId);
  const me = results.ranking.find((r) => r.id === myId);
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/80 p-3 text-stone-100 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-2xl font-black uppercase tracking-wider text-khaki sm:text-3xl">
            {winner ? `🏆 Gana ${winner.name}` : 'Fin de la partida'}
          </p>
          {me && <p className="rounded bg-white/10 px-3 py-1 font-mono">Tu puesto: {me.place}° · {me.score} pts</p>}
          <div className="ml-auto">
            {spectator ? null : isHost ? (
              <button onClick={onReset} className="rounded bg-khaki px-4 py-2 font-bold text-olive-950">
                Volver al lobby
              </button>
            ) : (
              <p className="text-sm text-stone-400">Esperando al profe…</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-white/10 bg-black/30 p-3">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Ranking</p>
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase text-stone-400">
                <tr>
                  <th className="pb-1">#</th>
                  <th className="pb-1">Jugador</th>
                  <th className="pb-1 text-right">Puesto</th>
                  <th className="pb-1 text-right">Bajas</th>
                  <th className="pb-1 text-right">Aciertos</th>
                  {results.ranking[0]?.score !== undefined && <th className="pb-1 text-right">Puntos</th>}
                </tr>
              </thead>
              <tbody>
                {results.ranking.map((r, i) => (
                  <tr key={r.id} className={r.id === myId ? 'font-bold text-khaki-light' : ''}>
                    <td className="py-0.5">{i + 1}</td>
                    <td className="py-0.5" style={{ color: r.id === myId ? undefined : r.color }}>
                      {r.name}
                    </td>
                    <td className="py-0.5 text-right">{r.place}°</td>
                    <td className="py-0.5 text-right">{r.kills}</td>
                    <td className="py-0.5 text-right">
                      {r.correct}/{r.answered}
                    </td>
                    {r.score !== undefined && <td className="py-0.5 text-right">{r.score}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-3">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">
              {spectator ? 'Acierto de la clase por tema' : 'Tus aciertos por tema'}
            </p>
            {spectator ? <ClassTopics stats={classStats} /> : <TopicBars byTopic={mine?.byTopic} />}
          </div>
        </div>
        <p className="text-xs text-stone-400">Puntos: 10 por cada puesto superado, 15 por baja y 5 por acierto (cajas, transmisiones e intercepciones).</p>

        {!spectator && <div className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">
            Preguntas que fallaste ({mine?.failed?.length ?? 0})
          </p>
          {mine?.failed?.length ? (
            mine.failed.map((q, i) => <FailedQuestion key={i} q={q} />)
          ) : (
            <p className="text-sm text-stone-400">Ninguna. ¡Bien!</p>
          )}
        </div>}
      </div>
    </div>
  );
}
