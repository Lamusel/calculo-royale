import { BOMBING, CLASS_STATS_MS, INTERCEPT, OPERATOR, TOPICS, WEAPON_IDS, DEPLOY } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { sectorBounds, sectorOf } from '@calculo-royale/shared/zone';
import { drawQuestion } from '../questions/QuestionBank.js';
import { aliveCount, damagePlayer } from './combat.js';
import { dropWithChute } from './deploy.js';
import { recordStats } from './crates.js';
import { airdropSpot, radio, TIME_SCALE } from './match.js';

// Operadores de radio (los caídos), bombardeos por votos e intercepciones de transmisiones.
// Igual que en las cajas, la pregunta con su respuesta correcta vive solo aquí.

const BOMB_INDEX = WEAPON_IDS.indexOf('bomb');
let nextTransmissionId = 1;

export function resetRadio(game) {
  game.votes = new Map(); // sector → votos de la ventana actual
  game.lastBombed = null;
  game.bombing = null; // { sector, impactAt } durante el aviso
  game.nextBombAt = Infinity;
  game.nextInterceptAt = Infinity;
  game.interceptWinners = 0;
  game.nextStatsAt = 0;
}

export function startRadio(game) {
  resetRadio(game);
  game.nextBombAt = game.now + BOMBING.everyMs / TIME_SCALE;
  game.nextInterceptAt = game.now + INTERCEPT.everyMs / TIME_SCALE;
}

function sendTransmission(game, player, kind, difficulty, timeLimitMs) {
  // Operadores e intercepciones: siempre 2 opciones
  const q = drawQuestion({ topics: game.room.topics, difficulty, seen: player.seenQuestions, count: 2, easy: game.room.easy });
  const t = { id: nextTransmissionId++, kind, q, expiresAt: game.now + timeLimitMs };
  if (kind === 'operator') player.transmission = t;
  else player.intercept = t;
  game.room.emitTo(player, EVENTS.TRANSMISSION, {
    id: t.id,
    kind,
    tema: TOPICS[q.tema],
    enunciado: q.enunciado,
    opciones: q.opciones,
    timeLimitMs,
  });
}

// Al caer en partida: pasa a operador. Puede reanimar si cayó en las fases 1 o 2 de la zona
// y todavía no usó su reanimación; si no, vota sectores para bombardear.
export function onPlayerDeath(game, player) {
  if (game.room.phase !== 'playing') return;
  const canRevive = !player.revived && game.zone && game.zone.phase < OPERATOR.revivePhases;
  player.intercept = null;
  player.operator = {
    mode: canRevive ? 'revive' : 'votes',
    streak: 0,
    sector: sectorOf(player.x, player.y),
    nextAt: game.now + OPERATOR.firstDelayMs,
  };
}

export function voteSector(game, player, sector) {
  if (player.operator && /^[A-F][1-6]$/.test(sector)) player.operator.sector = sector;
}

function revive(game, player) {
  const spot = airdropSpot(game.zone.current);
  player.resetCombat();
  player.hp = OPERATOR.reviveHp;
  player.revived = true;
  player.place = null;
  // Vuelve en paracaídas sobre la zona
  dropWithChute(player, spot.x, spot.y, DEPLOY.reviveAltitude);
  radio(game, 'revive', 'Reanimación', `${player.name} vuelve al combate en paracaídas.`, 5000);
}

export function answerTransmission(game, player, id, index) {
  const t = player.transmission?.id === id ? player.transmission : player.intercept?.id === id ? player.intercept : null;
  if (!t) return;
  const correct = game.now <= t.expiresAt && index === t.q.correcta;
  recordStats(player, t.q, correct, index);
  const result = { id: t.id, kind: t.kind, correct, explicacion: correct ? t.q.explicacion : null };

  if (t.kind === 'operator') {
    player.transmission = null;
    const op = player.operator;
    if (op) {
      op.nextAt = game.now + OPERATOR.gapMs;
      if (op.mode === 'revive') {
        op.streak = correct ? op.streak + 1 : 0;
        if (op.streak >= OPERATOR.reviveStreak) {
          revive(game, player);
          result.revived = true;
        }
      } else if (correct) {
        game.votes.set(op.sector, (game.votes.get(op.sector) ?? 0) + 1);
      }
    }
  } else {
    player.intercept = null;
    if (correct && game.interceptWinners < INTERCEPT.winners) {
      game.interceptWinners++;
      const upcoming = game.zone?.peekUpcoming();
      if (upcoming) {
        player.intel = { cx: upcoming.cx, cy: upcoming.cy, phase: game.zone.phase + 1 };
        result.intel = { cx: upcoming.cx, cy: upcoming.cy };
      }
    } else if (correct) {
      result.late = true;
    }
  }
  game.room.emitTo(player, EVENTS.TRANSMISSION_RESULT, result);
}

function updateOperators(game) {
  for (const p of game.room.players.values()) {
    // Las transmisiones vencidas cuentan como fallo
    if (p.transmission && game.now > p.transmission.expiresAt) answerTransmission(game, p, p.transmission.id, -1);
    if (p.intercept && game.now > p.intercept.expiresAt) p.intercept = null;
    if (p.intel && game.zone && game.zone.phase >= p.intel.phase) p.intel = null;
    const op = p.operator;
    if (!op || p.alive || !p.connected || p.transmission || game.now < op.nextAt) continue;
    sendTransmission(game, p, 'operator', 1 + Math.floor(Math.random() * 3), OPERATOR.questionMs);
  }
}

// Cada 60 s, el sector más votado (que no sea el último bombardeado) recibe el bombardeo
function updateBombing(game) {
  if (game.bombing && game.now >= game.bombing.impactAt) {
    const { sector } = game.bombing;
    const b = sectorBounds(sector);
    for (const p of game.room.players.values()) {
      if (p.alive && !p.deploying && p.x >= b.minX && p.x < b.maxX && p.y >= b.minY && p.y < b.maxY) {
        damagePlayer(game, p, BOMBING.damage, null, BOMB_INDEX);
      }
    }
    for (let i = 0; i < 7; i++) {
      game.explosions.push([b.minX + Math.random() * (b.maxX - b.minX), b.minY + Math.random() * (b.maxY - b.minY)]);
    }
    game.lastBombed = sector;
    game.bombing = null;
  }
  if (game.bombing || game.now < game.nextBombAt) return;
  game.nextBombAt = game.now + BOMBING.everyMs / TIME_SCALE;
  const votes = [...game.votes].filter(([s]) => s !== game.lastBombed).sort((a, b) => b[1] - a[1]);
  game.votes.clear();
  if (aliveCount(game) <= BOMBING.disabledAtAlive || votes.length === 0) return;
  const sector = votes[0][0];
  game.bombing = { sector, impactAt: game.now + BOMBING.warningMs };
  radio(game, 'bombing', 'Bombardeo de los operadores', `Los caídos votaron: bombardeo en el sector ${sector} en 5 s. ¡Salgan de ahí!`, 6000);
}

// Cada 2 minutos, pregunta para todos los vivos. Se salta si el próximo anuncio de zona está
// tan cerca que los ganadores no alcanzarían a enterarse antes (se reintenta en 20 s).
function updateIntercept(game) {
  if (!game.zone || game.now < game.nextInterceptAt) return;
  const ms = game.zone.msToNextAnnounce(game.now);
  if (ms === null) {
    game.nextInterceptAt = Infinity;
    return;
  }
  if (ms < (INTERCEPT.questionMs + 15_000) / TIME_SCALE) {
    game.nextInterceptAt = game.now + 20_000 / TIME_SCALE;
    return;
  }
  game.nextInterceptAt = game.now + INTERCEPT.everyMs / TIME_SCALE;
  game.interceptWinners = 0;
  for (const p of game.room.players.values()) {
    if (p.alive && p.connected) sendTransmission(game, p, 'intercept', 1 + Math.floor(Math.random() * 2), INTERCEPT.questionMs);
  }
  radio(game, 'intercept', 'Transmisión enemiga', 'Interceptamos una transmisión: los 5 primeros en descifrarla conocerán la próxima zona antes que nadie.', 6000);
}

// Aciertos por tema de toda la clase (en vivo, para el host y la vista del proyector)
export function classStats(game) {
  const byTopic = {};
  let operators = 0;
  let alive = 0;
  for (const p of game.room.players.values()) {
    for (const [slug, { ok, total }] of Object.entries(p.stats.byTopic)) {
      const t = (byTopic[slug] ??= { ok: 0, total: 0 });
      t.ok += ok;
      t.total += total;
    }
    if (p.alive) alive++;
    else if (p.operator) operators++;
  }
  return { byTopic, alive, total: game.room.players.size, operators, votes: Object.fromEntries(game.votes ?? []) };
}

export function encodeBombing(game) {
  return game.bombing ? [game.bombing.sector, Math.max(0, Math.round(game.bombing.impactAt - game.now))] : [];
}

export function updateRadio(game) {
  if (game.room.phase === 'playing' && !game.boss) {
    updateOperators(game);
    updateBombing(game);
    updateIntercept(game);
  }
  if (game.room.phase !== 'lobby' && game.now >= game.nextStatsAt) {
    game.nextStatsAt = game.now + CLASS_STATS_MS;
    game.room.sendClassStats?.(classStats(game));
  }
}
