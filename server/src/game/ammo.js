import { AMMO, TOPIC_NAMES, WEAPONS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { drawQuickQuestion } from '../questions/QuestionBank.js';
import { recordStats } from './crates.js';

// "Obtener balas": pregunta rápida de cálculo básico. Mientras se responde uno se puede mover
// pero no disparar. Acierto = un cargador de reserva para el arma en mano; fallo o tiempo
// agotado = AMMO.failCooldownMs de espera. La respuesta correcta nunca sale del servidor.

let nextAmmoId = 1;

export function requestAmmo(game, player) {
  if (!player.alive || player.ammoQuestion || player.question || player.engineQuestion) return;
  if (game.now < player.ammoCooldownUntil) return;
  const q = drawQuickQuestion();
  player.ammoQuestion = { id: nextAmmoId++, q, expiresAt: game.now + AMMO.questionMs };
  game.room.emitTo(player, EVENTS.AMMO_QUESTION, {
    id: player.ammoQuestion.id,
    tema: TOPIC_NAMES[q.tema],
    enunciado: q.enunciado,
    opciones: q.opciones,
    timeLimitMs: AMMO.questionMs,
  });
}

export function answerAmmo(game, player, id, index) {
  const pending = player.ammoQuestion;
  if (!pending || pending.id !== id) return;
  player.ammoQuestion = null;
  const timedOut = game.now > pending.expiresAt;
  const correct = !timedOut && index === pending.q.correcta;
  // Cuenta para el ranking y las estadísticas de la clase (en el lobby es práctica)
  if (game.room.phase === 'playing') recordStats(player, pending.q, correct, index);
  if (correct) {
    const weapon = WEAPONS[player.addMagazine()].name;
    player.ammoCooldownUntil = game.now + AMMO.okCooldownMs;
    game.room.emitTo(player, EVENTS.AMMO_RESULT, { id, correct: true, weapon, explicacion: pending.q.explicacion });
  } else {
    player.ammoCooldownUntil = game.now + AMMO.failCooldownMs;
    game.room.emitTo(player, EVENTS.AMMO_RESULT, { id, correct: false, timedOut, cooldownMs: AMMO.failCooldownMs });
  }
}

// Tiempo agotado (cuenta como fallo) o se murió (se cancela sin espera)
export function updateAmmo(game) {
  for (const p of game.room.players.values()) {
    const pending = p.ammoQuestion;
    if (!pending) continue;
    if (!p.alive) {
      p.ammoQuestion = null;
      game.room.emitTo(p, EVENTS.AMMO_RESULT, { id: pending.id, correct: false, cancelled: true });
    } else if (game.now > pending.expiresAt) {
      answerAmmo(game, p, pending.id, -1);
    }
  }
}
