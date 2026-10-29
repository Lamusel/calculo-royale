import { TOPIC_NAMES, teamColor, teamName } from '@calculo-royale/shared/constants';
import { ClassTopics } from './HostPanel.jsx';
import MathText from './MathText.jsx';
import { SkinPortrait } from './SkinPicker.jsx';
import { loadSkin } from '../achievements.js';
import { getSkinEntry } from '../game/character/skins/index.js';

// Apodo de la tarjeta (6.5) según el tema más fuerte; con aciertos parejos a medias, "Punto de silla"
const NICKNAMES = {
  lagrange: 'El Lagrangiano',
  integrales_dobles: 'Integral andante',
  derivadas_direccionales: 'Gradiente con patas',
  maximos_minimos: 'Máximo absoluto',
};
export function playerCard(byTopic = {}) {
  const rated = Object.entries(byTopic)
    .filter(([, t]) => t.total > 0)
    .map(([slug, t]) => ({ slug, rate: t.ok / t.total, total: t.total }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
  if (!rated.length) return { strong: null, weak: null, nickname: 'Punto de silla' };
  const strong = rated[0];
  const weak = rated.length > 1 ? rated.at(-1) : null;
  const ok = rated.reduce((n, t) => n + t.rate * t.total, 0) / rated.reduce((n, t) => n + t.total, 0);
  const nickname = ok >= 0.4 && ok <= 0.6 && weak ? 'Punto de silla' : NICKNAMES[strong.slug] ?? 'Punto de silla';
  return { strong: strong.slug, weak: weak?.slug ?? null, nickname };
}

function PlayerCard({ me, mine, medals = [] }) {
  const card = playerCard(mine?.byTopic);
  const ants = medals.find((m) => m.id === 'hormigas' && m.playerId === me.id);
  return (
    <div className="flex items-center gap-3 rounded border border-khaki-dark bg-black/40 p-2">
      <SkinPortrait skin={getSkinEntry(loadSkin())} className="aspect-[3/4] w-20 shrink-0 rounded" />
      <div className="min-w-0 text-sm">
        <p className="text-lg font-black text-khaki">“{card.nickname}”</p>
        <p className="font-bold">{me.name}</p>
        <p className="text-stone-300">
          Puesto {me.place}° · {me.kills} bajas · {me.correct}/{me.answered} aciertos
        </p>
        {card.strong && <p className="text-xs text-green-300">Más fuerte: {TOPIC_NAMES[card.strong] ?? card.strong}</p>}
        {card.weak && <p className="text-xs text-orange-300">Para repasar: {TOPIC_NAMES[card.weak] ?? card.weak}</p>}
        {me.ants > 0 && <p className="text-xs text-orange-200">🐜 {me.ants} hormigas culonas{ants ? ' · medalla Comehormigas' : ''}</p>}
      </div>
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D'];

// Descarga el CSV de la partida (llega al anfitrión y al proyector; no necesita Supabase)
export function downloadCsv({ filename, csv }) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Medallas de la partida (una por categoría)
function Medals({ medals, myId }) {
  if (!medals?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {medals.map((m) => (
        <div key={m.id} className={`rounded border p-2 ${m.playerId === myId ? 'border-khaki bg-khaki/15' : 'border-white/10 bg-black/30'}`}>
          <p className="text-xl leading-none">{m.icon}</p>
          <p className="mt-1 text-[0.7rem] uppercase tracking-wider text-stone-400">{m.name}</p>
          <p className="truncate font-bold">{m.playerName}</p>
          <p className="font-mono text-xs text-khaki-light">
            {m.value} {m.unit}
          </p>
        </div>
      ))}
    </div>
  );
}

function TopicBars({ byTopic }) {
  const entries = Object.entries(byTopic ?? {});
  if (entries.length === 0) return <p className="text-sm text-stone-400">No abriste cajas en esta partida.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([slug, { ok, total }]) => (
        <div key={slug} className="flex items-center gap-2 text-sm">
          <span className="w-48 shrink-0 truncate text-stone-300">{TOPIC_NAMES[slug] ?? slug}</span>
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

// Repaso (7A): enunciado, lo que respondió, la correcta y la explicación paso a paso
function ReviewQuestion({ q }) {
  return (
    <div className={`rounded border p-3 ${q.ok ? 'border-green-500/30 bg-black/30' : 'border-red-500/60 bg-red-950/20'}`}>
      <p className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-stone-400">
        <span className={`rounded px-1.5 font-bold ${q.ok ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`}>{q.ok ? '✓ Acertaste' : '✗ Fallaste'}</span>
        {TOPIC_NAMES[q.tema] ?? q.tema} · dificultad {q.dificultad}
      </p>
      <MathText text={q.enunciado} className="block text-sm sm:text-base" />
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
        {q.opciones.map((o, i) => (
          <div key={i} className={`flex items-center gap-2 rounded px-2 py-1 ${i === q.correcta ? 'bg-green-900/60 text-green-100' : i === q.elegida ? 'bg-red-900/60 text-red-100' : 'bg-black/20 text-stone-300'}`}>
            <b>{LETTERS[i]}</b> <MathText text={o} />
            {i === q.correcta && <span className="ml-auto text-[10px] uppercase">correcta</span>}
            {i === q.elegida && i !== q.correcta && <span className="ml-auto text-[10px] uppercase">tu respuesta</span>}
          </div>
        ))}
      </div>
      {q.elegida === null || q.elegida < 0 ? <p className="mt-1 text-xs text-orange-300">Sin responder (se acabó el tiempo o cancelaste)</p> : null}
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-stone-300">
        {(q.pasos ?? []).map((p, i) => (
          <li key={i}>
            <MathText text={p} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function FailedQuestion({ q }) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-stone-400">{TOPIC_NAMES[q.tema] ?? q.tema}</p>
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
export default function Results({ results, mine, myId, isHost, onReset, classStats, csv }) {
  const spectator = myId === null;
  if (!results) return null;
  const winner = results.ranking.find((r) => r.id === results.winnerId);
  const me = results.ranking.find((r) => r.id === myId);
  const won = Boolean(me && winner && (me.id === winner.id || (me.team != null && me.team === winner.team)));
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/80 p-3 text-stone-100 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-2xl font-black uppercase tracking-wider text-khaki sm:text-3xl">
            {winner ? `🏆 Gana ${winner.team ? `el ${teamName(winner.team)} (${winner.name})` : winner.name}` : 'Fin de la partida'}
          </p>
          {me && <p className="rounded bg-white/10 px-3 py-1 font-mono">Tu puesto: {me.place}° · {me.score} pts</p>}
          {results.easy && <p className="rounded bg-amber-800/70 px-2 py-1 text-xs text-amber-100">Modo fácil · no cuenta para logros</p>}
          <div className="ml-auto flex items-center gap-2">
            {csv && (spectator || isHost) && (
              <button onClick={() => downloadCsv(csv)} className="rounded bg-black/50 px-3 py-2 text-sm text-khaki-light">
                ⬇ CSV
              </button>
            )}
            {csv?.json && (spectator || isHost) && (
              <button onClick={() => downloadCsv({ filename: csv.filename.replace(/\.csv$/, '.json'), csv: csv.json })} className="rounded bg-black/50 px-3 py-2 text-sm text-khaki-light" title="Resultados con estadísticas de balance">
                ⬇ JSON
              </button>
            )}
            {spectator ? null : isHost ? (
              <button onClick={onReset} className="rounded bg-khaki px-4 py-2 font-bold text-olive-950">
                Volver al lobby
              </button>
            ) : (
              <p className="text-sm text-stone-400">Esperando al anfitrión…</p>
            )}
          </div>
        </div>

        {won && <p className="text-center text-3xl font-black uppercase tracking-wider text-yellow-300 drop-shadow sm:text-5xl">¡Victoria! Una integral para cenar</p>}
        {me && <PlayerCard me={me} mine={mine} medals={results.medals} />}

        <Medals medals={results.medals} myId={myId} />

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
                      {r.team && <span className="ml-1 text-[10px]" style={{ color: teamColor(r.team) }}>{teamName(r.team)}</span>}
                      {r.bot && <span className="ml-1 text-[10px] text-stone-500">bot</span>}
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
        <p className="text-xs text-stone-400">
          Puntos: 10 por cada puesto superado, 15 por baja y 5 por acierto (cajas, Obtener balas, Gulag, reanimar, código del motor y práctica de espectador).
        </p>

        {!spectator && mine?.history ? (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">
              Repaso de tus preguntas ({mine.history.length}; {mine.history.filter((q) => !q.ok).length} falladas, primero)
            </p>
            {Object.keys(mine.adjusted ?? {}).length > 0 && (
              <p className="text-sm text-stone-300">
                Tu dificultad se ajustó en:{' '}
                {Object.entries(mine.adjusted)
                  .map(([t, dir]) => `${TOPIC_NAMES[t] ?? t} (${dir})`)
                  .join(', ')}
              </p>
            )}
            {mine.history.length ? mine.history.map((q, i) => <ReviewQuestion key={i} q={q} />) : <p className="text-sm text-stone-400">No te salió ninguna pregunta.</p>}
          </div>
        ) : (
          !spectator && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Preguntas que fallaste ({mine?.failed?.length ?? 0})</p>
              {mine?.failed?.length ? mine.failed.map((q, i) => <FailedQuestion key={i} q={q} />) : <p className="text-sm text-stone-400">Ninguna. ¡Bien!</p>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
