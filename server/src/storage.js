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
export function buildRecord(room, classStats) {
  return {
    codigo: room.code,
    fecha: new Date().toISOString(),
    temas: room.topics,
    ganador: room.results.ranking.find((r) => r.id === room.results.winnerId)?.name ?? null,
    ranking: room.results.ranking,
    por_tema: classStats.byTopic,
    jugadores: [...room.players.values()].map((p) => ({
      nombre: p.name,
      puesto: p.place,
      bajas: p.kills,
      aciertos: p.stats.correct,
      respuestas: p.stats.answered,
      por_tema: p.stats.byTopic,
      falladas: p.stats.failed.map((f) => f.enunciado),
    })),
  };
}
