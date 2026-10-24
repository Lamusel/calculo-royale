import {
  AIRDROP, ALARM_MS, CRATE_LOCK_MS, CRATE_SPAWN, INTERACT_RADIUS, LOOT_ITEMS, PRACTICE_CRATE_RESET_MS, RADAR_MS, RARITIES,
  STREAK_FOR_RADAR, TOPICS,
} from '@calculo-royale/shared/constants';
import { take, wants } from '@calculo-royale/shared/inventory';
import { dropAround } from './loot.js';
import { CRATE_STATE, EVENTS } from '@calculo-royale/shared/protocol';
import { SUPPLY_CRATES, TRAINING } from '@calculo-royale/shared/mapLayout';
import { drawQuestion } from '../questions/QuestionBank.js';

// Cajas de suministro con candado de código: la pregunta ABCD es el código.
// La pregunta (con su respuesta correcta) vive solo aquí, en player.question.

// Combinaciones posibles por rareza (se elige una al azar). Legendario = dos tiradas épicas.
// La común solo la usa la caja de práctica del lobby: en partida las cajas son de raro en adelante
// (lo común está en el suelo).
export const LOOT_TABLES = [
  [['ammo', 'bandage'], ['ammo', 'grenade'], ['bandage', 'drink'], ['ammo', 'ammo']],
  [['shotgun', 'ammo'], ['rifle', 'ammo'], ['armor2', 'helmet1'], ['backpack2', 'bandage'], ['scope2x', 'extmag'], ['medkit', 'stock']],
  [['sniper', 'scope4x'], ['armor3', 'helmet2'], ['medkit', 'grenade', 'silencer'], ['rifle', 'extmag', 'reddot'], ['backpack3', 'medkit'], ['helmet3', 'drink']],
];

export function rollLoot(rarity, rand = Math.random) {
  const roll = (table) => table[Math.floor(rand() * table.length)];
  if (rarity >= 3) return [...roll(LOOT_TABLES[2]), ...roll(LOOT_TABLES[2])];
  return roll(LOOT_TABLES[rarity]);
}

// Aplica un objeto al jugador; devuelve su nombre. Lo que reemplaza (o lo que no le cabe en la
// mochila) queda en el suelo a su alrededor si hay partida (game); sin game se descarta.
export function applyLoot(player, item, game = null) {
  const name = LOOT_ITEMS[item].name;
  if (!wants(player, item)) {
    if (game?.loot) dropAround(game, player.x, player.y, [{ item }]);
    return `${name} (quedó en el suelo)`;
  }
  const drops = take(player, item);
  if (game?.loot && drops.length) dropAround(game, player.x, player.y, drops);
  return name;
}

// Orden fijo (el snapshot manda un estado por caja): las del mapa, la de práctica y al
// final la del lanzamiento aéreo (su posición se decide en la partida)
export function createCrates() {
  return [
    ...SUPPLY_CRATES.map((c) => ({ ...c, practice: false })),
    { ...TRAINING.crate, practice: true },
    { x: 0, y: 0, rarity: AIRDROP.rarity, airdrop: true },
  ].map((c, id) => ({ ...c, id, state: CRATE_STATE.CLOSED, busyBy: null, lockedUntil: 0, reopenAt: 0 }));
}

// Las del mapa existen en partida; la de práctica, solo en el lobby; la aérea, cuando aterriza
export function crateVisible(crate, phase) {
  if (crate.practice) return phase === 'lobby';
  if (crate.airdrop) return phase === 'playing' && crate.landed;
  return phase === 'playing' && crate.inMatch !== false;
}

// Al iniciar una partida (lo pide la sala): las de los puntos calientes siempre; del resto, una
// parte al azar según su lugar (CRATE_SPAWN). Así cada partida tiene otras cajas.
export function pickMatchCrates(game, rand = Math.random) {
  for (const c of game.crates) {
    if (c.practice || c.airdrop) continue;
    c.inMatch = c.tag === 'hot' || rand() < (CRATE_SPAWN[c.tag] ?? 1);
  }
}

export function resetCrates(game) {
  for (const c of game.crates) {
    Object.assign(c, { state: CRATE_STATE.CLOSED, busyBy: null, lockedUntil: 0, reopenAt: 0 });
    if (c.airdrop) Object.assign(c, { active: false, landed: false });
  }
  game.alarms = [];
}

export function crateStates(game) {
  return game.crates.map((c) => (crateVisible(c, game.room.phase) ? c.state : CRATE_STATE.HIDDEN));
}

// Caja visible más cercana dentro del radio de interacción (en cualquier estado)
export function nearestCrate(game, x, y) {
  let best = null;
  let bestDist = INTERACT_RADIUS;
  for (const c of game.crates) {
    if (!crateVisible(c, game.room.phase)) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best ? { crate: best, dist: bestDist } : null;
}

export function openCrate(game, player, crate) {
  if (player.question || crate.state !== CRATE_STATE.CLOSED) return false;
  const rarity = RARITIES[crate.rarity];
  const q = drawQuestion({ topics: game.room.topics, difficulty: rarity.difficulty, seen: player.seenQuestions });
  player.question = { crateId: crate.id, q, expiresAt: game.now + rarity.timeMs };
  crate.state = CRATE_STATE.BUSY;
  crate.busyBy = player.id;
  game.room.emitTo(player, EVENTS.CRATE_QUESTION, {
    crateId: crate.id,
    rarity: crate.rarity,
    tema: TOPICS[q.tema],
    enunciado: q.enunciado,
    opciones: q.opciones,
    timeLimitMs: rarity.timeMs,
    loot: rarity.loot,
  });
  return true;
}

// Registra una respuesta (caja, transmisión o intercepción) para los resultados y el ranking
export function recordStats(player, q, correct, chosen) {
  const s = player.stats;
  const t = (s.byTopic[q.tema] ??= { ok: 0, total: 0 });
  t.total++;
  s.answered++;
  if (correct) {
    t.ok++;
    s.correct++;
  } else {
    s.failed.push({
      tema: q.tema,
      enunciado: q.enunciado,
      opciones: q.opciones,
      correcta: q.correcta,
      elegida: chosen,
      explicacion: q.explicacion,
    });
  }
}

function finish(game, player, outcome, chosen = null) {
  const { crateId, q } = player.question;
  const crate = game.crates[crateId];
  player.question = null;
  crate.busyBy = null;
  const correct = outcome === 'correct';
  if (!crate.practice) recordStats(player, q, correct, chosen);

  if (correct) {
    const loot = rollLoot(crate.rarity).map((item) => applyLoot(player, item, game));
    crate.state = CRATE_STATE.OPEN;
    if (crate.practice) crate.reopenAt = game.now + PRACTICE_CRATE_RESET_MS;
    player.streak++;
    const radar = player.streak % STREAK_FOR_RADAR === 0;
    if (radar) player.radarUntil = game.now + RADAR_MS;
    game.room.emitTo(player, EVENTS.CRATE_RESULT, { crateId, outcome, loot, explicacion: q.explicacion, radar });
    return;
  }

  crate.state = CRATE_STATE.LOCKED;
  crate.lockedUntil = game.now + CRATE_LOCK_MS;
  player.streak = 0;
  game.alarms.push({ x: crate.x, y: crate.y, until: game.now + ALARM_MS });
  // Todo o nada: fallar una dorada cuesta el chaleco
  const lostArmor = crate.rarity >= 3 && player.armorLevel > 0;
  if (crate.rarity >= 3) {
    player.armorLevel = 0;
    player.armor = 0;
  }
  game.room.emitTo(player, EVENTS.CRATE_RESULT, { crateId, outcome, loot: [], lostArmor });
}

export function answerCrate(game, player, crateId, index) {
  const pq = player.question;
  if (!pq || pq.crateId !== crateId || !Number.isInteger(index)) return;
  if (game.now > pq.expiresAt) return finish(game, player, 'timeout');
  finish(game, player, index === pq.q.correcta ? 'correct' : 'wrong', index);
}

// Cancelar no cuenta como fallo: la caja vuelve a quedar cerrada
export function cancelQuestion(game, player, reason) {
  if (!player.question) return;
  const crate = game.crates[player.question.crateId];
  crate.state = CRATE_STATE.CLOSED;
  crate.busyBy = null;
  player.question = null;
  game.room.emitTo(player, EVENTS.CRATE_RESULT, { crateId: crate.id, outcome: 'cancelled', loot: [], reason });
}

export function updateCrates(game) {
  for (const c of game.crates) {
    if (c.state === CRATE_STATE.LOCKED && game.now >= c.lockedUntil) c.state = CRATE_STATE.CLOSED;
    if (c.state === CRATE_STATE.OPEN && c.practice && game.now >= c.reopenAt) c.state = CRATE_STATE.CLOSED;
  }
  for (const p of game.room.players.values()) {
    if (!p.question) continue;
    if (!p.alive) cancelQuestion(game, p, 'Caíste en combate');
    else if (game.now > p.question.expiresAt) finish(game, p, 'timeout');
  }
  game.alarms = game.alarms.filter((a) => a.until > game.now);
}
