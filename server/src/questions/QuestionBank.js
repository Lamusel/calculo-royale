import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optionCount, TOPICS } from '@calculo-royale/shared/constants';
import aritmetica from './basic/aritmetica.js';
import clasificar from './generators/clasificar.js';
import derivadaDireccional from './generators/derivadaDireccional.js';
import gradientePunto from './generators/gradientePunto.js';
import integralDobleRect from './generators/integralDobleRect.js';
import integralTipoI from './generators/integralTipoI.js';
import lagrangeLineal from './generators/lagrangeLineal.js';
import lagrangeRecta from './generators/lagrangeRecta.js';
import puntoCritico from './generators/puntoCritico.js';
import { QUICK } from './quick/rapidas.js';

// Banco de preguntas: JSON por tema (bank/) más generadores paramétricos (generators/).
// Las preguntas que salen de aquí incluyen `correcta`: eso nunca se envía al cliente.

const BANK_DIR = fileURLToPath(new URL('./bank/', import.meta.url));

export const BANK = readdirSync(BANK_DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(BANK_DIR, f), 'utf8')));

// Dos generadores paramétricos por tema
export const GENERATORS = [gradientePunto, derivadaDireccional, lagrangeLineal, lagrangeRecta, integralDobleRect, integralTipoI, puntoCritico, clasificar];

export const ALL_TOPICS = Object.keys(TOPICS);

// Preguntas rápidas de dificultad 1 de los temas del corte ("Obtener balas" y reanimación en equipo)
export const QUICK_GENERATORS = QUICK;

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
// easy: modo fácil de la sala (aritmética básica, no cuenta para los logros)
export function drawQuestion({ topics = ALL_TOPICS, difficulty, rand = Math.random, seen = new Set(), count = optionCount(difficulty), easy = false }) {
  if (easy) return drawEasyQuestion(difficulty, rand, count);
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

// Modo fácil: aritmética con la dificultad pedida
export function drawEasyQuestion(difficulty = 1, rand = Math.random, count = optionCount(difficulty)) {
  return shuffleOptions(aritmetica.generar(rand, count, difficulty), rand);
}

// Pregunta rápida (dificultad 1, 2 opciones) de los temas de la sala; en modo fácil, una suma
export function drawQuickQuestion(rand = Math.random, easy = false, topics = ALL_TOPICS) {
  if (easy) return drawEasyQuestion(1, rand);
  const allowed = QUICK_GENERATORS.filter((g) => topics.includes(g.tema));
  const list = allowed.length ? allowed : QUICK_GENERATORS;
  const g = list[Math.floor(rand() * list.length)];
  return shuffleOptions(g.generar(rand, optionCount(g.dificultad)), rand);
}
