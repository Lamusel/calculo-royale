import { LEADER, LIVE_SCORE, WEATHERS, WIND_ACCEL } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { applyLoot, rollLoot } from './crates.js';
import { radio } from './match.js';

// Recompensa al líder y clima de la partida.

export const liveScore = (p) => p.kills * LIVE_SCORE.kill + p.stats.correct * LIVE_SCORE.correct;

// Desde la fase 2 de la zona, el vivo con más puntos es el líder (con al menos 1 punto)
export function updateLeader(game) {
  if (game.room.phase !== 'playing' || !game.zone || game.zone.phase < LEADER.fromPhase) return;
  if (game.now < (game.nextLeaderCheck ?? 0)) return;
  game.nextLeaderCheck = game.now + LEADER.checkMs;
  let best = null;
  for (const p of game.room.players.values()) {
    if (p.alive && p.connected && liveScore(p) > 0 && (!best || liveScore(p) > liveScore(best))) best = p;
  }
  const id = best?.id ?? null;
  if (id === game.leaderId) return;
  game.leaderId = id;
  if (best) {
    radio(game, 'leader', 'Objetivo de alto valor', `${best.name} lidera con ${liveScore(best)} puntos. Botín épico para quien lo elimine.`, 6000);
  }
}

// Si cae el líder, quien lo eliminó cobra la recompensa
export function onLeaderDeath(game, target) {
  if (target.id !== game.leaderId) return;
  game.leaderId = null;
  game.nextLeaderCheck = game.now + LEADER.checkMs;
  const hunter = game.room.players.get(target.killedBy);
  if (!hunter || hunter === target || !hunter.alive) return;
  const loot = rollLoot(2).map((item) => applyLoot(hunter, item, game));
  game.room.emitTo(hunter, EVENTS.CRATE_RESULT, {
    crateId: null, outcome: 'correct', title: 'Recompensa: eliminaste al líder', loot, explicacion: '',
  });
  radio(game, 'leader', 'Recompensa cobrada', `${hunter.name} eliminó al líder ${target.name} y se lleva el botín épico.`, 6000);
}

// Clima: el host lo elige; "aleatorio" se resuelve al iniciar. El viento solo sopla con arena.
export function pickWeather(choice, rand = Math.random) {
  const options = Object.keys(WEATHERS);
  const weather = WEATHERS[choice] ? choice : options[Math.floor(rand() * options.length)];
  return { weather, windAngle: Math.round(rand() * Math.PI * 2 * 100) / 100 };
}

export function windOf(room) {
  if (room.weather !== 'arena') return null;
  return { x: Math.cos(room.windAngle) * WIND_ACCEL, y: Math.sin(room.windAngle) * WIND_ACCEL };
}
