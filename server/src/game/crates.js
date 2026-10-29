import {
  AIRDROP, ALARM_MS, CRATE_LOCK_MS, CRATE_SPAWN, INTERACT_RADIUS, LOOT_ITEMS, PRACTICE_CRATE_RESET_MS, RADAR_MS, RARITIES,
  LOOT, STREAK_FOR_RADAR, TOPICS, WEAPONS,
} from '@calculo-royale/shared/constants';
import { take } from '@calculo-royale/shared/inventory';
import { dropAround } from './loot.js';
import { CRATE_STATE, EVENTS } from '@calculo-royale/shared/protocol';
import { SUPPLY_CRATES, TRAINING } from '@calculo-royale/shared/mapLayout';
import { drawQuestion } from '../questions/QuestionBank.js';

// Cajas de suministro con candado de código: la pregunta ABCD es el código.
// La pregunta (con su respuesta correcta) vive solo aquí, en player.question.

// Premios por rareza (fase 29): al acertar, el jugador ELIGE uno entre 2 (común y raro) o 3 (épico y
// legendario). Cada premio es un paquete: un arma viene con munición de su tipo. Lo que no elige
// queda junto a la caja, solo para él por LOOT.privateMs. Nada se cambia sin que él lo decida.
const withAmmo = (id) => [id, `ammo_${WEAPONS[id].ammo}`];
const weaponsOf = (rarity) => Object.keys(WEAPONS).filter((id) => WEAPONS[id].rarity === rarity && id !== 'fists' && !(rarity === 0 && id === 'm1911'));
export const LOOT_TABLES = [
  [['ammo_9mm', 'bandage'], ['frag', 'ammo_9mm'], ['bandage', 'drink'], ['smoke', 'ammo_9mm']],
  [
    ...[...weaponsOf(0), ...weaponsOf(1)].map(withAmmo),
    ['armor2', 'helmet1'], ['backpack1', 'drink'], ['backpack2', 'bandage'], ['reddot', 'frag'], ['scope2x', 'extmag'], ['medkit', 'stock'],
    ['silencer', 'smoke'], ['wall', 'flash'], ['molotov', 'bandage'], ['armor1', 'frag'],
  ],
  [
    ...weaponsOf(2).map(withAmmo),
    ['armor3', 'helmet2'], ['helmet3', 'drink'], ['backpack3', 'medkit'], ['scope4x', 'extmag'], ['sensor', 'wall'], ['uav', 'medkit'], ['molotov', 'frag', 'medkit'],
  ],
  // Doradas y lanzamientos aéreos: las especiales y lo mejor (munición escasa)
  [...weaponsOf(3).map(withAmmo), ['armor3', 'helmet3', 'medkit'], ['backpack3', 'uav', 'wall']],
];

// Opciones para elegir: distintas entre sí
const OFFER_MS = 20_000; // tiempo para elegir el premio

export function rollOffers(rarity, rand = Math.random) {
  const table = [...LOOT_TABLES[Math.min(rarity, 3)]];
  const n = rarity >= 2 ? 3 : 2;
  const out = [];
  while (out.length < n && table.length) out.push(table.splice(Math.floor(rand() * table.length), 1)[0]);
  return out;
}
// Compatibilidad: un paquete al azar (bots y pruebas)
export const rollLoot = (rarity, rand = Math.random) => rollOffers(rarity, rand)[0];

// Aplica un objeto al jugador; devuelve su nombre. Lo que reemplaza o no le cabe queda en el suelo a su
// alrededor si hay partida (game). Las armas nunca reemplazan sin preguntar: si no hay lugar, al suelo.
export function applyLoot(player, item, game = null, owner = null, state = null) {
  const name = LOOT_ITEMS[item].name;
  const res = take(player, item, state);
  if (res.need || !res.taken) {
    if (game?.loot) dropAround(game, player.x, player.y, [{ item, state }], owner);
    return `${name} (quedó en el suelo)`;
  }
  if (game?.loot && res.drops.length) dropAround(game, player.x, player.y, res.drops);
  if (res.left > 0 && game?.loot) dropAround(game, player.x, player.y, [{ item, state: { n: res.left } }], owner);
  return name;
}

// Estado de un objeto dentro de un paquete: el arma sale con un tercio del cargador y su munición es
// UN cargador (correcciones 6.3: las cajas no dan reservas grandes)
export function bundleState(bundle, item) {
  const weapon = bundle.find((i) => WEAPONS[i]);
  if (item === weapon) return { mag: Math.max(1, Math.ceil(WEAPONS[weapon].magazine * LOOT.weaponMagFraction)) };
  if (weapon && item === `ammo_${WEAPONS[weapon].ammo}`) return { n: WEAPONS[weapon].magazine };
  return null;
}

// El jugador eligió un premio (o se le acabó el tiempo: index null, todo queda en el suelo para él)
export function chooseOffer(game, player, index) {
  const offer = player.offer;
  if (!offer) return;
  player.offer = null;
  const crate = game.crates[offer.crateId];
  const chosen = Number.isInteger(index) ? offer.options[index] : null;
  const loot = chosen ? chosen.map((item) => applyLoot(player, item, game, player.id, bundleState(chosen, item))) : [];
  const rest = offer.options.filter((o) => o !== chosen).flatMap((b) => b.map((item) => ({ item, state: bundleState(b, item) })));
  if (rest.length && game.loot) dropAround(game, crate?.x ?? player.x, crate?.y ?? player.y, rest, player.id);
  game.room.emitTo(player, EVENTS.CRATE_CHOSEN, { loot, items: chosen ?? [] });
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

// Un dígito por caja (el mapa de 1 km tiene cientos): "0042…"
export function crateStates(game) {
  return game.crates.map((c) => (crateVisible(c, game.room.phase) ? c.state : CRATE_STATE.HIDDEN)).join('');
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
  const q = drawQuestion({ topics: game.room.topics, difficulty: rarity.difficulty, seen: player.seenQuestions, easy: game.room.easy });
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
    // Elige su premio entre las opciones (tiene OFFER_MS; si no, todo queda junto a la caja para él)
    const options = rollOffers(crate.rarity);
    player.offer = { crateId, options, until: game.now + OFFER_MS };
    crate.state = CRATE_STATE.OPEN;
    if (crate.practice) crate.reopenAt = game.now + PRACTICE_CRATE_RESET_MS;
    player.streak++;
    const radar = player.streak % STREAK_FOR_RADAR === 0;
    if (radar) player.radarUntil = game.now + RADAR_MS;
    game.room.emitTo(player, EVENTS.CRATE_RESULT, { crateId, outcome, loot: [], options, explicacion: q.explicacion, radar });
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
    // Premio sin elegir: al caer o al vencerse el tiempo queda todo junto a la caja
    if (p.offer && (!p.alive || game.now > p.offer.until)) chooseOffer(game, p, null);
    if (!p.question) continue;
    if (!p.alive) cancelQuestion(game, p, 'Caíste en combate');
    else if (game.now > p.question.expiresAt) finish(game, p, 'timeout');
  }
  game.alarms = game.alarms.filter((a) => a.until > game.now);
}
