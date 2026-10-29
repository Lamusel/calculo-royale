import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guarda los resultados de cada partida. Con SUPABASE_URL y SUPABASE_SERVICE_KEY van a la
// tabla `partidas` de Supabase; si no están (o Supabase falla) se escriben en un JSON local.
// El juego no depende de que esto funcione.

const LOCAL_DIR = fileURLToPath(new URL('../data/resultados/', import.meta.url));

export async function saveLocal(record, dir = LOCAL_DIR) {
  await mkdir(dir, { recursive: true });
  const stamp = record.fecha.replace(/[:.]/g, '-');
  const file = join(dir, `${stamp}-${record.codigo}.json`);
  await writeFile(file, JSON.stringify(record, null, 2));
  return file;
}

async function saveSupabase(record, env) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const { error } = await supabase.from('partidas').insert(record);
  if (error) throw error;
}

export async function saveResults(record, env = process.env, dir = LOCAL_DIR) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
    try {
      await saveSupabase(record, env);
      return { where: 'supabase' };
    } catch (err) {
      console.error('[resultados] Supabase falló, se guarda en local:', err.message ?? err);
    }
  }
  const file = await saveLocal(record, dir);
  return { where: 'local', file };
}

// Registro de una partida a partir de la sala ya terminada
// Estadísticas de balance (6.5): bajas por arma, acierto por tema y dificultad, regresos del Gulag,
// duración y FPS promedio de los clientes
export function balanceStats(room) {
  const game = room.game;
  const people = [...room.players.values()].filter((p) => !p.gulagBot);
  const levels = {};
  for (const p of people) {
    for (const [key, { ok, total }] of Object.entries(p.stats.byLevel ?? {})) {
      const l = (levels[key] ??= { ok: 0, total: 0 });
      l.ok += ok;
      l.total += total;
    }
  }
  const fps = people.filter((p) => p.fps?.n).map((p) => p.fps.sum / p.fps.n);
  return {
    duracion_s: game?.matchStartedAt !== undefined ? Math.round((game.now - game.matchStartedAt) / 1000) : null,
    bajas_por_arma: game?.balance?.kills ?? {},
    acierto_por_tema_y_dificultad: Object.fromEntries(Object.entries(levels).map(([k, l]) => [k, { ...l, porcentaje: Math.round((l.ok / l.total) * 100) }])),
    volvieron_del_gulag: game?.balance?.gulagReturns ?? 0,
    fps_promedio: fps.length ? Math.round(fps.reduce((a, b) => a + b, 0) / fps.length) : null,
  };
}

export function buildRecord(room, classStats) {
  return {
    codigo: room.code,
    fecha: new Date().toISOString(),
    temas: room.topics,
    modo_facil: Boolean(room.easy), // las partidas en modo fácil no cuentan como evaluación
    ganador: room.results.ranking.find((r) => r.id === room.results.winnerId)?.name ?? null,
    ranking: room.results.ranking,
    por_tema: classStats.byTopic,
    balance: balanceStats(room),
    jugadores: [...room.players.values()].map((p) => ({
      nombre: p.name,
      equipo: p.team ?? null,
      bot: Boolean(p.bot),
      puesto: p.place,
      bajas: p.kills,
      aciertos: p.stats.correct,
      respuestas: p.stats.answered,
      por_tema: p.stats.byTopic,
      falladas: p.stats.failed.map((f) => f.enunciado),
    })),
  };
}

// CSV de una partida (fase 20): una fila por jugador, para abrir en Excel o Google Sheets sin
// Supabase. Separado por punto y coma (Excel en español) y con BOM para las tildes.
const csvCell = (v) => {
  const text = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function recordToCsv(record) {
  const header = ['fecha', 'sala', 'modo', 'jugador', 'equipo', 'tipo', 'puesto', 'bajas', 'aciertos', 'respuestas', 'porcentaje', 'puntaje', 'temas_fallados'];
  const scoreOf = new Map(record.ranking.map((r) => [r.name, r.score]));
  const rows = [...record.jugadores]
    .sort((a, b) => (a.puesto ?? 99) - (b.puesto ?? 99))
    .map((j) => [
      record.fecha,
      record.codigo,
      record.modo_facil ? 'fácil (no cuenta)' : 'normal',
      j.nombre,
      j.equipo ?? '',
      j.bot ? 'bot' : 'estudiante',
      j.puesto ?? '',
      j.bajas,
      j.aciertos,
      j.respuestas,
      j.respuestas ? Math.round((j.aciertos / j.respuestas) * 100) : '',
      scoreOf.get(j.nombre) ?? '',
      Object.entries(j.por_tema ?? {})
        .filter(([, t]) => t.total > t.correct)
        .map(([tema]) => tema)
        .join(', '),
    ]);
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
