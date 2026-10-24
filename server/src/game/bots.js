import { BOTS, MAP_HALF } from '@calculo-royale/shared/constants';
import { findAutoTarget } from '@calculo-royale/shared/combat';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { nearestLoot, pickUp } from './loot.js';
import { choosePoint } from './deploy.js';
import { answerBoss, requestBossQuestion } from './boss.js';

// Bots del servidor (fase 20): "Completar con bots hasta N" desde el lobby. Son jugadores sin
// socket (player.bot) que reciben un input por tick como cualquiera, así el servidor los trata
// igual que a una persona. Caminan, vuelven a la zona, disparan con puntería imperfecta, saltan
// del bus, toman botín del suelo y, sin balas, reciben un cargador cada tanto. No abren cajas
// (son para las personas); en el modo jefe responden al azar para volver y, de vez en cuando,
// para romper el escudo (aciertan como quien adivina).

const brains = new WeakMap();

function brainOf(player) {
  if (!brains.has(player)) brains.set(player, { dir: Math.random() * Math.PI * 2, seq: 0, refillAt: 0, picked: false });
  return brains.get(player);
}

// Input del bot para este tick (o null si no hace nada)
export function botInput(game, bot, rand = Math.random) {
  const brain = brainOf(bot);
  if (game.boss) bossChores(game, bot, rand);
  if (!bot.alive) return null;
  let buttons = 0;
  let aim = brain.dir;

  // Despliegue: en "elegir punto" elige un lugar dentro de la zona; en el bus salta al azar
  if (bot.deploy) {
    if (bot.deploy.phase === 'pick' && !brain.picked) {
      brain.picked = true;
      const z = game.zone?.current;
      const r = (z?.p ?? MAP_HALF) * 0.6;
      const a = rand() * Math.PI * 2;
      choosePoint(game, bot, (z?.cx ?? 0) + Math.cos(a) * r * rand(), (z?.cy ?? 0) + Math.sin(a) * r * rand());
    }
    if (bot.deploy.phase === 'bus' && game.deploy?.mode === 'bus' && game.now >= (game.deploy.departAt ?? 0) && rand() < 0.02) buttons = BUTTONS.JUMP;
    return { seq: ++brain.seq, mx: 0, my: 0, aim, buttons, viewTick: game.tick, aimDist: 0 };
  }
  brain.picked = false;

  if (rand() < 0.03) brain.dir = rand() * Math.PI * 2;
  // Modo jefe: no se alejan de la cancha
  if (game.boss && Math.hypot(bot.x - game.boss.x, bot.y - game.boss.y) > 16) brain.dir = Math.atan2(game.boss.y - bot.y, game.boss.x - bot.x);
  // Fuera (o casi) de la zona: hacia su centro
  const z = game.zone?.current;
  if (z && game.room.phase === 'playing') {
    const dx = (bot.x - z.cx) / z.p;
    const dy = (bot.y - z.cy) / z.q;
    if (dx * dx + dy * dy > 0.6) brain.dir = Math.atan2(z.cy - bot.y, z.cx - bot.x);
  }

  // Sin balas: un cargador cada tanto
  if (bot.mag + bot.reserve === 0 && game.now >= brain.refillAt) {
    bot.addMagazine();
    brain.refillAt = game.now + BOTS.ammoRefillMs;
  }

  // Botín al alcance: lo toma (solo lo que le sirve)
  if (game.room.phase === 'playing' && rand() < 0.1) {
    const loot = nearestLoot(game, bot.x, bot.y);
    if (loot) pickUp(game, bot, loot.entry);
  }

  // Enemigo visible cerca: apunta (con error) y a veces dispara. En el modo jefe, solo al jefe.
  const others = [];
  if (game.boss) {
    if (!game.boss.finished) others.push({ id: -1, x: game.boss.x, y: game.boss.y });
  } else {
    for (const p of game.room.players.values()) {
      if (p !== bot && p.alive && !p.deploying) others.push({ id: p.id, x: p.x, y: p.y });
    }
  }
  const target = findAutoTarget(bot.x, bot.y, game.boss ? BOTS.range * 1.8 : BOTS.range, others);
  if (target) {
    aim = Math.atan2(target.y - bot.y, target.x - bot.x) + (rand() - 0.5) * BOTS.aimError;
    if (rand() < BOTS.fireChance) buttons |= BUTTONS.FIRE;
    if (bot.reloadUntil === 0 && bot.mag === 0) buttons |= BUTTONS.RELOAD;
  }
  const moving = rand() > 0.05;
  return { seq: ++brain.seq, mx: moving ? Math.cos(brain.dir) : 0, my: moving ? Math.sin(brain.dir) : 0, aim, buttons, viewTick: game.tick, aimDist: 0 };
}

// Modo jefe: preguntas de volver y de escudo respondidas al azar
function bossChores(game, bot, rand) {
  const kind = bot.alive ? (rand() < 0.004 ? 'shield' : null) : 'revive';
  if (!kind || !requestBossQuestion(game, bot, kind)) return;
  const q = bot.bossQuestion;
  answerBoss(game, bot, q.id, Math.floor(rand() * q.q.opciones.length));
}

// Cada tick, antes de procesar los inputs: un input por bot
export function driveBots(game) {
  for (const p of game.room.players.values()) {
    if (!p.bot) continue;
    const input = botInput(game, p);
    if (input) p.queueInput(input);
  }
}

// Al reiniciar la sala los bots vuelven a empezar su secuencia de inputs
export function resetBot(player) {
  brains.delete(player);
}
