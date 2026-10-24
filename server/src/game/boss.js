import { ARMOR_ABSORB, BOSS, BOSS_ID, PLAYER_RADIUS, TOPIC_NAMES, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { encodeShot } from '@calculo-royale/shared/codec';
import { hasLineOfSight, overlapsObstacle, raycastObstacles, rayCircle } from '@calculo-royale/shared/collision';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { drawQuestion } from '../questions/QuestionBank.js';
import { recordStats } from './crates.js';
import { damagePlayer } from './combat.js';
import { radio } from './match.js';

// Modo Profe Jefe Final (fase 21): todos contra un jefe gigante en el estadio. Su escudo
// matemático solo baja con aciertos del equipo ("Romper escudo"); con el escudo arriba las balas
// rebotan. Tres fases (cada una con más vida, más disparos y, desde la segunda, ondas expansivas).
// Los caídos vuelven a los 20 s si aciertan una pregunta. A los 8 minutos sin derrotarlo, gana él.
// La respuesta correcta vive solo aquí (player.bossQuestion).

const RIFLE = WEAPON_IDS.indexOf('rifle');
const round2 = (v) => Math.round(v * 100) / 100;
let nextQuestionId = 1;

const people = (game) => [...game.room.players.values()].filter((p) => p.connected);
const goalFor = (game, phase) => BOSS.phases[phase].shieldGoal + Math.floor(people(game).length / BOSS.goalEveryPlayers);
const hpFor = (game, phase) => Math.round(BOSS.phases[phase].hp * (1 + BOSS.hpPerExtraPlayer * Math.max(0, people(game).length - 1)));

// Lugar libre en el borde de la cancha (elipse: la cancha es más larga en y)
export function arenaSpot(i, count, rand = Math.random) {
  const base = (i / Math.max(count, 1)) * Math.PI * 2 + rand() * 0.3;
  for (let k = 0; k < 20; k++) {
    const a = base + (k % 2 ? 1 : -1) * k * 0.05;
    const x = BOSS.arena.x + Math.cos(a) * 10.5;
    const y = BOSS.arena.y + Math.sin(a) * 17;
    if (!overlapsObstacle(x, y, PLAYER_RADIUS + 0.4)) return { x, y };
  }
  return { x: BOSS.arena.x, y: BOSS.arena.y + 17 };
}

// Equipo de inicio (y al volver): rifle, chaleco 2 y vendas
function equip(player) {
  player.giveItem(BOSS.loadout.weapon);
  player.armorLevel = BOSS.loadout.armor;
  player.armor = ARMOR_ABSORB[BOSS.loadout.armor];
  player.bandages = BOSS.loadout.bandages;
}

export function startBoss(game, rand = Math.random) {
  game.boss = {
    x: BOSS.arena.x,
    y: BOSS.arena.y,
    aim: Math.PI / 2,
    phase: 0,
    hp: hpFor(game, 0),
    maxHp: hpFor(game, 0),
    shieldUp: true,
    progress: 0,
    goal: goalFor(game, 0),
    downUntil: 0,
    nextFireAt: game.now + 3_000,
    nextWaveAt: Infinity,
    waveAt: null,
    startedAt: game.now,
    finished: false,
    dir: rand() * Math.PI * 2,
  };
  game.finished = false;
  game.startingPlayers = people(game).length;
  const players = [...game.room.players.values()];
  players.forEach((p, i) => {
    const spot = arenaSpot(i, players.length, rand);
    p.teleport(spot.x, spot.y);
    p.deploy = null;
    p.bossDamage = 0;
    p.reviveAt = 0;
    p.bossCooldownUntil = 0;
    p.bossQuestion = null;
    equip(p);
  });
  radio(game, 'duel', BOSS.name, `El profe tiene un escudo matemático: respondan bien entre todos para romperlo (${game.boss.goal} aciertos). Tienen 8 minutos.`, 8000);
}

export function stopBoss(game) {
  game.boss = null;
}

// Pregunta para romper el escudo (vivo, con el escudo arriba) o para volver (caído, pasados 20 s)
export function requestBossQuestion(game, player, kind) {
  const boss = game.boss;
  if (!boss || boss.finished || player.bossQuestion || game.room.phase !== 'playing') return false;
  if (kind === 'shield' && (!player.alive || !boss.shieldUp || game.now < (player.bossCooldownUntil ?? 0))) return false;
  if (kind === 'revive' && (player.alive || game.now < (player.reviveAt ?? Infinity))) return false;
  if (kind !== 'shield' && kind !== 'revive') return false;
  const q = drawQuestion({
    topics: game.room.topics,
    difficulty: kind === 'revive' ? 1 : Math.min(4, boss.phase + 2),
    seen: player.seenQuestions,
    count: 2,
    easy: game.room.easy,
  });
  player.bossQuestion = { id: nextQuestionId++, kind, q, expiresAt: game.now + BOSS.questionMs };
  game.room.emitTo(player, EVENTS.BOSS_QUESTION, {
    id: player.bossQuestion.id,
    kind,
    tema: TOPIC_NAMES[q.tema] ?? q.tema,
    enunciado: q.enunciado,
    opciones: q.opciones,
    timeLimitMs: BOSS.questionMs,
  });
  return true;
}

function revive(game, player) {
  const spot = arenaSpot(Math.floor(Math.random() * 12), 12);
  player.alive = true;
  player.hp = BOSS.reviveHp;
  player.reloadUntil = 0;
  player.teleport(spot.x, spot.y);
  if (!player.primary) equip(player);
}

export function answerBoss(game, player, id, index) {
  const pending = player.bossQuestion;
  const boss = game.boss;
  if (!pending || pending.id !== id || !boss) return;
  player.bossQuestion = null;
  const correct = game.now <= pending.expiresAt && index === pending.q.correcta;
  recordStats(player, pending.q, correct, index);
  const result = { id, kind: pending.kind, correct, explicacion: correct ? undefined : pending.q.explicacion };
  if (pending.kind === 'shield') {
    if (correct && boss.shieldUp) {
      boss.progress++;
      if (boss.progress >= boss.goal) {
        boss.shieldUp = false;
        boss.downUntil = game.now + BOSS.shieldDownMs;
        radio(game, 'closing', '¡Escudo abajo!', `${player.name} completó el código. ¡Disparen al profe! Tienen ${Math.round(BOSS.shieldDownMs / 1000)} s.`, 5000);
      }
    }
    if (!correct) player.bossCooldownUntil = game.now + BOSS.failCooldownMs;
    Object.assign(result, { progress: boss.progress, goal: boss.goal });
  } else if (correct) {
    revive(game, player);
  } else {
    player.reviveAt = game.now + BOSS.reviveRetryMs;
  }
  game.room.emitTo(player, EVENTS.BOSS_RESULT, result);
}

// Daño al jefe (solo sin escudo). Devuelve lo que se descontó.
export function damageBoss(game, amount, attackerId) {
  const boss = game.boss;
  if (!boss || boss.finished || boss.shieldUp) return 0;
  const dealt = Math.min(boss.hp, amount);
  boss.hp -= dealt;
  const attacker = game.room.players.get(attackerId);
  if (attacker) attacker.bossDamage = (attacker.bossDamage ?? 0) + dealt;
  if (boss.hp > 0) return dealt;
  if (boss.phase === BOSS.phases.length - 1) {
    finishBoss(game, true);
    return dealt;
  }
  boss.phase++;
  boss.maxHp = hpFor(game, boss.phase);
  boss.hp = boss.maxHp;
  boss.shieldUp = true;
  boss.progress = 0;
  boss.goal = goalFor(game, boss.phase);
  boss.nextWaveAt = BOSS.phases[boss.phase].waveMs ? game.now + BOSS.phases[boss.phase].waveMs : Infinity;
  radio(game, 'final', `Fase ${boss.phase + 1} de ${BOSS.phases.length}`, `El profe se recupera y vuelve a levantar el escudo: ${boss.goal} aciertos para romperlo.`, 6000);
  return dealt;
}

function finishBoss(game, victory) {
  const boss = game.boss;
  if (boss.finished) return;
  boss.finished = true;
  game.finished = true;
  game.room.finishBoss?.({ victory, timeMs: game.now - boss.startedAt });
}

// Al caer en el modo jefe: vuelve a los 20 s si acierta (sin caja de botín ni operador)
export function onBossDeath(game, player) {
  player.reviveAt = game.now + BOSS.reviveMs;
  player.bossQuestion = null;
}

function fireBurst(game, boss, target, phase) {
  const weapon = { spread: BOSS.spread, pellets: 1 };
  const aim = Math.atan2(target.y - boss.y, target.x - boss.x);
  boss.aim = aim;
  const pellets = [];
  for (let i = 0; i < phase.burst; i++) {
    const angle = aim + (Math.random() * 2 - 1) * weapon.spread;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let dist = raycastObstacles(boss.x, boss.y, dx, dy, BOSS.range);
    let hit = null;
    for (const p of game.room.players.values()) {
      if (!p.alive || p.deploying) continue;
      const d = rayCircle(boss.x, boss.y, dx, dy, p.x, p.y, PLAYER_RADIUS + 0.15);
      if (d < dist) {
        dist = d;
        hit = p;
      }
    }
    if (hit) damagePlayer(game, hit, phase.damage, BOSS_ID, RIFLE);
    pellets.push({ angle, dist });
  }
  game.shots.push(encodeShot(BOSS_ID, RIFLE, boss.x, boss.y, pellets));
}

export function updateBoss(game, dt) {
  const boss = game.boss;
  if (!boss || boss.finished || game.room.phase !== 'playing') return;
  if (game.now - boss.startedAt >= BOSS.limitMs) {
    radio(game, 'final', 'Se acabó el tiempo', 'El profe resistió los 8 minutos. ¡Revancha!', 6000);
    finishBoss(game, false);
    return;
  }
  const phase = BOSS.phases[boss.phase];
  // El escudo vuelve a subir
  if (!boss.shieldUp && game.now >= boss.downUntil) {
    boss.shieldUp = true;
    boss.progress = 0;
    boss.goal = goalFor(game, boss.phase);
    radio(game, 'zone', 'El escudo volvió', `Otra vez: ${boss.goal} aciertos para romperlo.`, 4000);
  }
  // Preguntas vencidas
  for (const p of game.room.players.values()) {
    if (p.bossQuestion && game.now > p.bossQuestion.expiresAt + 1000) answerBoss(game, p, p.bossQuestion.id, -1);
  }
  const alive = [...game.room.players.values()].filter((p) => p.alive && !p.deploying);
  // Camina despacio hacia el más cercano, sin salir de su zona
  const nearest = alive.reduce((best, p) => (!best || Math.hypot(p.x - boss.x, p.y - boss.y) < Math.hypot(best.x - boss.x, best.y - boss.y) ? p : best), null);
  if (nearest) boss.dir = Math.atan2(nearest.y - boss.y, nearest.x - boss.x);
  const nx = boss.x + Math.cos(boss.dir) * BOSS.speed * dt;
  const ny = boss.y + Math.sin(boss.dir) * BOSS.speed * dt;
  if (Math.hypot(nx - BOSS.arena.x, ny - BOSS.arena.y) <= BOSS.roam && !overlapsObstacle(nx, ny, BOSS.radius)) {
    boss.x = nx;
    boss.y = ny;
  }
  // Ráfaga a un jugador visible al azar
  if (game.now >= boss.nextFireAt) {
    boss.nextFireAt = game.now + phase.fireMs;
    const visible = alive.filter((p) => Math.hypot(p.x - boss.x, p.y - boss.y) <= BOSS.range && hasLineOfSight(boss.x, boss.y, p.x, p.y));
    if (visible.length) fireBurst(game, boss, visible[Math.floor(Math.random() * visible.length)], phase);
  }
  // Onda expansiva (desde la fase 2): aviso y después daño alrededor
  if (phase.waveMs && boss.waveAt === null && game.now >= boss.nextWaveAt) boss.waveAt = game.now + BOSS.waveWarnMs;
  if (boss.waveAt !== null && game.now >= boss.waveAt) {
    boss.waveAt = null;
    boss.nextWaveAt = game.now + phase.waveMs;
    game.explosions.push([round2(boss.x), round2(boss.y)]);
    for (const p of alive) {
      if (Math.hypot(p.x - boss.x, p.y - boss.y) <= BOSS.waveRadius) damagePlayer(game, p, BOSS.waveDamage, BOSS_ID, RIFLE);
    }
  }
}

// [x, y, mira, vida, vida máx., fase, escudo (1/0), aciertos, meta, ms restantes, ms para la onda]
export function encodeBoss(game) {
  const b = game.boss;
  if (!b || game.room.phase !== 'playing') return [];
  return [
    round2(b.x), round2(b.y), round2(b.aim), Math.ceil(b.hp), b.maxHp, b.phase, b.shieldUp ? 1 : 0, b.progress, b.goal,
    Math.max(0, Math.round(BOSS.limitMs - (game.now - b.startedAt))),
    b.waveAt !== null ? Math.max(0, Math.round(b.waveAt - game.now)) : -1,
  ];
}
