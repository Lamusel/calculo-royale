import { TEAM_MODES, TEAM_REVIVE, TOPIC_NAMES, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { drawQuickQuestion } from '../questions/QuestionBank.js';
import { damagePlayer, inMatch } from './combat.js';
import { recordStats } from './crates.js';

// Dúos y escuadras (fase 33): equipos, sin fuego amigo, derribado y reanimación, marcador de equipo.
// Derribado: se arrastra sin disparar; un compañero lo levanta con "Reanimar" (5 s y una pregunta
// rápida). Si nadie lo levanta en 30 s, o no le queda ningún compañero en pie, muere (y va al Gulag).

const ZONE_INDEX = WEAPON_IDS.indexOf('zone');
const DOWN_MS = 30_000;
const REVIVE_HOLD_MS = 5_000;
const REVIVE_RADIUS = 2.6;
const REVIVE_HP = 30;
let nextReviveId = 1;

export const teamSize = (room) => TEAM_MODES[room.teamMode ?? 'solo']?.size ?? 1;
export const sameTeam = (a, b) => Boolean(a && b && a !== b && a.team != null && a.team === b.team);
const standing = (p) => inMatch(p) && !p.downed;

// Al iniciar: cada uno en el equipo que eligió si cabe; los demás llenan los equipos con lugar
export function assignTeams(room, rand = Math.random) {
  const size = teamSize(room);
  const players = [...room.players.values()];
  if (size === 1) {
    for (const p of players) p.team = null;
    return;
  }
  const count = new Map();
  for (const p of players) p.team = null;
  const sorted = [...players].sort(() => rand() - 0.5);
  for (const p of sorted) {
    const t = p.teamChoice;
    if (t && (count.get(t) ?? 0) < size) {
      p.team = t;
      count.set(t, (count.get(t) ?? 0) + 1);
    }
  }
  let t = 1;
  for (const p of sorted) {
    if (p.team) continue;
    while ((count.get(t) ?? 0) >= size) t++;
    p.team = t;
    count.set(t, (count.get(t) ?? 0) + 1);
  }
}

// Mezclar (anfitrión): borra las elecciones para que se repartan al azar
export function shuffleTeams(room) {
  for (const p of room.players.values()) p.teamChoice = null;
}

// Antes de morir: ¿queda derribado? (solo en equipos y si tiene un compañero en pie)
export function tryDown(game, target, attackerId) {
  if (game.room.phase !== 'playing' || teamSize(game.room) === 1 || target.downed || target.arena != null) return false;
  const mate = [...game.room.players.values()].some((q) => sameTeam(q, target) && standing(q));
  if (!mate) return false;
  target.downed = { until: game.now + DOWN_MS, by: attackerId };
  target.hp = 1;
  target.healing = null;
  target.reloadUntil = 0;
  target.question = null;
  return true;
}

// "Reanimar": junto a un compañero derribado. 5 s quieto y después la pregunta rápida
export function startRevive(game, player) {
  if (player.downed || player.reviving) return false;
  const target = [...game.room.players.values()].find((q) => q.downed && sameTeam(q, player) && Math.hypot(q.x - player.x, q.y - player.y) < REVIVE_RADIUS);
  if (!target) return false;
  player.reviving = { targetId: target.id, until: game.now + REVIVE_HOLD_MS, x: player.x, y: player.y };
  return true;
}

function askRevive(game, player) {
  const q = drawQuickQuestion(Math.random, game.room.easy, game.room.topics);
  const t = { id: `r${nextReviveId++}`, kind: 'revive', q, expiresAt: game.now + TEAM_REVIVE.questionMs, targetId: player.reviving.targetId };
  player.reviving.asked = true;
  player.transmission = t;
  game.room.emitTo(player, EVENTS.TRANSMISSION, { id: t.id, kind: 'revive', tema: TOPIC_NAMES[q.tema], dificultad: 1, enunciado: q.enunciado, opciones: q.opciones, timeLimitMs: TEAM_REVIVE.questionMs });
}

export function answerRevive(game, player, t, correct, index) {
  recordStats(player, t.q, correct, index);
  player.reviving = null;
  const target = game.room.players.get(t.targetId);
  if (correct && target?.downed && target.alive) {
    target.downed = null;
    target.hp = REVIVE_HP;
  }
  game.room.emitTo(player, EVENTS.TRANSMISSION_RESULT, { id: t.id, kind: 'revive', correct, explicacion: correct ? t.q.explicacion : null });
}

export function updateTeams(game) {
  if (game.room.phase !== 'playing' || teamSize(game.room) === 1) return;
  const players = [...game.room.players.values()];
  for (const p of players) {
    // Reanimando: moverse o que el otro muera lo cancela; a los 5 s, la pregunta
    if (p.reviving) {
      const target = game.room.players.get(p.reviving.targetId);
      if (!p.alive || p.downed || !target?.downed || Math.hypot(p.x - p.reviving.x, p.y - p.reviving.y) > 1) p.reviving = null;
      else if (!p.reviving.asked && game.now >= p.reviving.until) askRevive(game, p);
      else if (p.transmission?.kind === 'revive' && game.now > p.transmission.expiresAt) {
        const t = p.transmission;
        p.transmission = null;
        answerRevive(game, p, t, false, -1);
      }
    }
    if (!p.downed || !p.alive) continue;
    // Se desangra, o ya no le queda ningún compañero en pie
    const mate = players.some((q) => sameTeam(q, p) && standing(q));
    if (game.now >= p.downed.until || !mate) {
      const by = p.downed.by;
      p.downed = null;
      damagePlayer(game, p, 1e6, by ?? null, ZONE_INDEX, { ignoreArmor: true });
    }
  }
}

// Marcador de equipo: un punto en el mapa para los compañeros (y para uno mismo)
export function teamPing(game, player, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || game.room.phase !== 'playing') return;
  const ping = { id: player.id, x: Math.round(x), y: Math.round(y) };
  for (const q of game.room.players.values()) if (q === player || sameTeam(q, player)) game.room.emitTo(q, EVENTS.TEAM_PING, ping);
}

// Equipos con alguien en la partida (para la victoria y los contadores)
export function teamsAlive(game) {
  return new Set([...game.room.players.values()].filter(inMatch).map((p) => p.team ?? `solo${p.id}`)).size;
}
