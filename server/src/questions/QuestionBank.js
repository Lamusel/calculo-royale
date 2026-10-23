import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS } from '@calculo-royale/shared/constants';
import derivadaDireccional from './generators/derivadaDireccional.js';
import gradientePunto from './generators/gradientePunto.js';
import integralDobleRect from './generators/integralDobleRect.js';
import polarACartesiano from './generators/polarACartesiano.js';

// Banco de preguntas: JSON por tema (bank/) más generadores paramétricos (generators/).
// Las preguntas que salen de aquí incluyen `correcta`: eso nunca se envía al cliente.

const BANK_DIR = fileURLToPath(new URL('./bank/', import.meta.url));

export const BANK = readdirSync(BANK_DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(BANK_DIR, f), 'utf8')));

export const GENERATORS = [integralDobleRect, gradientePunto, derivadaDireccional, polarACartesiano];

export const ALL_TOPICS = Object.keys(TOPICS);

// Baraja las opciones (para cada jugador por separado) y recalcula el índice correcto
export function shuffleOptions(q, rand = Math.random) {
  const order = q.opciones.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, opciones: order.map((i) => q.opciones[i]), correcta: order.indexOf(q.correcta) };
}

// Elige una pregunta de los temas de la sala con la dificultad pedida (o la más cercana).
// `seen` evita repetir preguntas del banco al mismo jugador: antes de repetir, prefiere
// una no vista de la dificultad más cercana.
export function drawQuestion({ topics = ALL_TOPICS, difficulty, rand = Math.random, seen = new Set() }) {
  const allowed = new Set(topics.length ? topics : ALL_TOPICS);
  const pool = [
    ...BANK.filter((q) => allowed.has(q.tema)),
    ...GENERATORS.filter((g) => allowed.has(g.tema)).map((g) => ({ generator: g, tema: g.tema, dificultad: g.dificultad })),
  ];
  if (pool.length === 0) return drawQuestion({ topics: ALL_TOPICS, difficulty, rand, seen });

  const fresh = pool.filter((q) => q.generator || !seen.has(q.id));
  const usable = fresh.length ? fresh : pool;
  const distance = (q) => Math.abs(q.dificultad - difficulty);
  const best = Math.min(...usable.map(distance));
  const candidates = usable.filter((q) => distance(q) === best);

  const choice = candidates[Math.floor(rand() * candidates.length)];
  const question = choice.generator ? choice.generator.generar(rand) : choice;
  seen.add(question.id);
  return shuffleOptions(question, rand);
}
