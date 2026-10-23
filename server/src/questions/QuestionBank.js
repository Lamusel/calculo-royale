import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optionCount, TOPICS } from '@calculo-royale/shared/constants';
import derivadaEnPunto from './basic/derivadaEnPunto.js';
import limiteSustitucion from './basic/limiteSustitucion.js';
import reglaPotencia from './basic/reglaPotencia.js';
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

// Preguntas rápidas de "Obtener balas" (cálculo básico, no dependen de los temas de la sala)
export const QUICK_GENERATORS = [derivadaEnPunto, reglaPotencia, limiteSustitucion];

// Deja n opciones: la correcta y los primeros distractores. En el banco, el orden en que están
// escritos (o el campo opcional `plausibles`, índices de los distractores de más a menos plausible).
export function trimOptions(q, n) {
  if (q.opciones.length <= n) return q;
  const order = q.plausibles ?? q.opciones.map((_, i) => i).filter((i) => i !== q.correcta);
  const keep = [q.correcta, ...order.filter((i) => i !== q.correcta).slice(0, n - 1)];
  return { ...q, opciones: keep.map((i) => q.opciones[i]), correcta: 0 };
}

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
// count: número de opciones (por defecto según la dificultad pedida, ver optionCount)
export function drawQuestion({ topics = ALL_TOPICS, difficulty, rand = Math.random, seen = new Set(), count = optionCount(difficulty) }) {
  const allowed = new Set(topics.length ? topics : ALL_TOPICS);
  const pool = [
    ...BANK.filter((q) => allowed.has(q.tema)),
    ...GENERATORS.filter((g) => allowed.has(g.tema)).map((g) => ({ generator: g, tema: g.tema, dificultad: g.dificultad })),
  ];
  if (pool.length === 0) return drawQuestion({ topics: ALL_TOPICS, difficulty, rand, seen, count });

  const fresh = pool.filter((q) => q.generator || !seen.has(q.id));
  const usable = fresh.length ? fresh : pool;
  const distance = (q) => Math.abs(q.dificultad - difficulty);
  const best = Math.min(...usable.map(distance));
  const candidates = usable.filter((q) => distance(q) === best);

  const choice = candidates[Math.floor(rand() * candidates.length)];
  const question = choice.generator ? choice.generator.generar(rand, count) : trimOptions(choice, count);
  seen.add(question.id);
  return shuffleOptions(question, rand);
}

// Pregunta rápida de "Obtener balas" (dificultad 1, 2 opciones)
export function drawQuickQuestion(rand = Math.random) {
  const g = QUICK_GENERATORS[Math.floor(rand() * QUICK_GENERATORS.length)];
  return shuffleOptions(g.generar(rand, optionCount(g.dificultad)), rand);
}
