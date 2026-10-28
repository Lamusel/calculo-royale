import { CLASS_STATS_MS, OPERATOR, TOPICS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { drawQuestion } from '../questions/QuestionBank.js';
import { recordStats } from './crates.js';
import { answerGulag, enterGulag } from './gulag.js';

// Preguntas por radio: las de práctica de los espectadores (caídos que no van al Gulag o que ya lo
// perdieron) y las del Gulag. Igual que en las cajas, la respuesta correcta vive solo aquí.
// (Fase 30: se retiraron el bombardeo por votos, la intercepción y la reanimación por 3 aciertos.)

let nextTransmissionId = 1;

export function resetRadio(game) {
  game.nextStatsAt = 0;
}

export function startRadio(game) {
  resetRadio(game);
}

// kind: 'operator' (práctica del espectador) | 'gulag'. count: opciones (2 en práctica)
export function sendTransmission(game, player, kind, difficulty, timeLimitMs, count = 2) {
  const q = drawQuestion({ topics: game.room.topics, difficulty, seen: player.seenQuestions, count, easy: game.room.easy });
  const t = { id: nextTransmissionId++, kind, q, expiresAt: game.now + timeLimitMs };
  player.transmission = t;
  game.room.emitTo(player, EVENTS.TRANSMISSION, {
    id: t.id,
    kind,
    tema: TOPICS[q.tema],
    dificultad: q.dificultad,
    enunciado: q.enunciado,
    opciones: q.opciones,
    timeLimitMs,
  });
}

// Pasa a espectador con preguntas de práctica (suman puntos)
export function makeSpectator(game, player) {
  player.gulag = null;
  player.operator = { nextAt: game.now + OPERATOR.firstDelayMs };
}

// Al caer en partida: al Gulag si todavía se puede; si no, espectador
export function onPlayerDeath(game, player) {
  if (game.room.phase !== 'playing') return;
  if (player.arena != null) return; // murió peleando en el Gulag: lo resuelve gulag.js
  if (!enterGulag(game, player)) makeSpectator(game, player);
}

export function answerTransmission(game, player, id, index) {
  const t = player.transmission?.id === id ? player.transmission : null;
  if (!t) return;
  player.transmission = null;
  const correct = game.now <= t.expiresAt && index === t.q.correcta;
  if (!player.gulagBot) recordStats(player, t.q, correct, index);
  game.room.emitTo(player, EVENTS.TRANSMISSION_RESULT, { id: t.id, kind: t.kind, correct, explicacion: correct ? t.q.explicacion : null });
  if (t.kind === 'gulag') answerGulag(game, player, correct);
  else if (player.operator) player.operator.nextAt = game.now + OPERATOR.gapMs;
}

function updateSpectators(game) {
  for (const p of game.room.players.values()) {
    // Las preguntas vencidas cuentan como fallo
    if (p.transmission && game.now > p.transmission.expiresAt) answerTransmission(game, p, p.transmission.id, -1);
    const op = p.operator;
    if (!op || p.alive || !p.connected || p.bot || p.transmission || game.now < op.nextAt) continue;
    sendTransmission(game, p, 'operator', 1 + Math.floor(Math.random() * 3), OPERATOR.questionMs);
  }
}

// Aciertos por tema de toda la clase (en vivo, para el host y la vista del proyector)
export function classStats(game) {
  const byTopic = {};
  let spectators = 0;
  let alive = 0;
  for (const p of game.room.players.values()) {
    if (p.gulagBot) continue;
    for (const [slug, { ok, total }] of Object.entries(p.stats.byTopic)) {
      const t = (byTopic[slug] ??= { ok: 0, total: 0 });
      t.ok += ok;
      t.total += total;
    }
    if (p.alive && p.arena == null) alive++;
    else if (p.operator) spectators++;
  }
  return { byTopic, alive, total: game.room.players.size, spectators, gulag: game.gulag ? game.gulag.queue.length + game.gulag.fights.reduce((n, f) => n + f.ids.length, 0) : 0 };
}

export function updateRadio(game) {
  if (game.room.phase === 'playing') updateSpectators(game);
  if (game.room.phase !== 'lobby' && game.now >= game.nextStatsAt) {
    game.nextStatsAt = game.now + CLASS_STATS_MS;
    game.room.sendClassStats?.(classStats(game));
  }
}
