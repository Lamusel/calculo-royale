import {
  AIRDROP, ALARM_MS, ARMOR_ABSORB, BANDAGE_HEAL, CRATE_LOCK_MS, GRENADE, INTERACT_RADIUS, MAX_HP,
  PRACTICE_CRATE_RESET_MS, RADAR_MS, RARITIES, STREAK_FOR_RADAR, TOPICS, WEAPONS,
} from '@calculo-royale/shared/constants';
import { CRATE_STATE, EVENTS } from '@calculo-royale/shared/protocol';
import { SUPPLY_CRATES, TRAINING } from '@calculo-royale/shared/mapLayout';
import { drawQuestion } from '../questions/QuestionBank.js';

// Cajas de suministro con candado de código: la pregunta ABCD es el código.
// La pregunta (con su respuesta correcta) vive solo aquí, en player.question.

const LOOT_NAMES = {
  ammo: 'Munición',
  bandage: 'Venda (+25)',
  medkit: 'Botiquín',
  grenade: 'Granada',
  shotgun: WEAPONS.shotgun.name,
  rifle: WEAPONS.rifle.name,
  sniper: WEAPONS.sniper.name,
  armor1: 'Chaleco 1',
  armor2: 'Chaleco 2',
  armor3: 'Chaleco 3',
};

// Combinaciones posibles por rareza (se elige una al azar). Legendario = dos tiradas épicas.
export const LOOT_TABLES = [
  [['ammo', 'bandage'], ['ammo', 'grenade'], ['bandage', 'grenade'], ['ammo', 'ammo']],
  [['shotgun', 'ammo'], ['rifle', 'ammo'], ['armor1', 'bandage'], ['armor2']],
  [['sniper', 'bandage'], ['armor3'], ['medkit', 'grenade'], ['rifle', 'armor2']],
];

export function rollLoot(rarity, rand = Math.random) {
  const roll = (table) => table[Math.floor(rand() * table.length)];
  if (rarity >= 3) return [...roll(LOOT_TABLES[2]), ...roll(LOOT_TABLES[2])];
  return roll(LOOT_TABLES[rarity]);
}

// Aplica un objeto al jugador; devuelve el nombre de lo que recibió
export function applyLoot(player, item) {
  if (item === 'ammo') {
    // Un cargador para el arma en mano (también la pistola)
    player.addMagazine();
  } else if (item === 'bandage') {
    player.hp = Math.min(MAX_HP, player.hp + BANDAGE_HEAL);
  } else if (item === 'medkit') {
    player.hp = MAX_HP;
  } else if (item === 'grenade') {
    player.grenades = Math.min(GRENADE.max, player.grenades + 1);
  } else if (WEAPONS[item]) {
    // La misma arma suma munición; otra la reemplaza
    if (player.primary?.id === item) player.primary.reserve += WEAPONS[item].magazine;
    else player.giveItem(item);
  } else if (item.startsWith('armor')) {
    const level = Number(item.slice(5));
    if (level >= player.armorLevel) {
      player.armorLevel = level;
      player.armor = ARMOR_ABSORB[level];
    }
  }
  return LOOT_NAMES[item];
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
  return phase === 'playing';
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
    const loot = rollLoot(crate.rarity).map((item) => applyLoot(player, item));
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
