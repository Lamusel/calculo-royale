import { GULAG, optionCount, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { GULAG_ARENAS, GULAG_SPAWNS } from '@calculo-royale/shared/mapLayout';
import { emptyInventory, newWeapon, SECONDARY } from '@calculo-royale/shared/inventory';
import { damagePlayer } from './combat.js';
import { startReturnPick } from './deploy.js';
import { airdropSpot, radio } from './match.js';
import { Player } from './Player.js';
import { makeSpectator, sendTransmission } from './radio.js';

// Gulag (fase 30): al caer por primera vez mientras la zona esté en las fases 1 a 3, el jugador
// entra a una cola. Con 3 en cola (o 2 si en 10 s no llega un tercero; o contra un bot si lleva 45 s
// solo) pelean en una arena privada fuera del mapa: 3 preguntas (dificultad 1, 2 y 3) congelados en
// su esquina, el equipo según los aciertos, cuenta regresiva, 60 s de combate y muerte súbita. El
// ganador vuelve a la partida en paracaídas; los demás pasan a espectadores. Una vez por partida.

const STATES = ['questions', 'countdown', 'fight', 'sudden'];
const ZONE_INDEX = WEAPON_IDS.indexOf('zone');
const teamOf = (p) => p.team ?? p.id;
let nextFightId = 1;

export function resetGulag(game) {
  game.gulag = { queue: [], fights: [] };
}

const scaled = (game, ms) => ms / (game.timeScale ?? 1);

// ¿Entra al Gulag? (y lo pone en la cola). Una oportunidad por partida.
export function enterGulag(game, player) {
  if (!game.gulag) resetGulag(game);
  if (player.gulagUsed || player.gulagBot || (game.zone?.phase ?? 0) >= GULAG.untilPhase) return false;
  player.gulagUsed = true;
  player.gulag = { state: 'queue', since: game.now };
  game.gulag.queue.push(player.id);
  return true;
}

function makeBot(game) {
  const id = game.room.nextId != null ? game.room.nextId++ : 90_000 + nextFightId;
  const bot = new Player({ id, name: 'Guardia del Gulag', color: '#7f1d1d', token: `gulag-${id}` });
  bot.bot = true;
  bot.gulagBot = true;
  bot.connected = true;
  bot.gulagUsed = true;
  game.room.players.set(id, bot);
  game.room.broadcastInfo?.();
  return bot;
}

function askNext(game, fight, p) {
  const k = fight.asked[p.id];
  fight.asked[p.id] = k + 1;
  sendTransmission(game, p, 'gulag', k + 1, scaled(game, GULAG.questionMs), optionCount(k + 1));
}

function startFight(game, group, arena) {
  const fight = { id: nextFightId++, arena: arena.index, ids: group.map((p) => p.id), state: 'questions', endsAt: 0, correct: {}, asked: {}, choice: {} };
  game.gulag.queue = game.gulag.queue.filter((id) => !fight.ids.includes(id));
  group.forEach((p, i) => {
    p.resetCombat();
    p.arena = arena.index;
    p.gulag = { state: 'fight', since: game.now, fightId: fight.id };
    p.frozen = true;
    emptyInventory(p);
    p.teleport(arena.x + GULAG_SPAWNS[i][0], arena.y + GULAG_SPAWNS[i][1]);
    p.aim = Math.atan2(-GULAG_SPAWNS[i][1], -GULAG_SPAWNS[i][0]); // mirando al centro
    fight.correct[p.id] = 0;
    fight.asked[p.id] = 0;
    // Los bots no responden: pelean con pistola (como con un acierto)
    if (p.bot) {
      fight.asked[p.id] = 3;
      fight.correct[p.id] = 1;
    } else askNext(game, fight, p);
  });
  game.gulag.fights.push(fight);
  return fight;
}

// Equipo según aciertos: 0 puños; 1 M1911 (un cargador); 2 + casco y una venda; 3 + M4A1 o M870 a elección
export function equip(p, correct, choice) {
  emptyInventory(p);
  p.weapons[SECONDARY] = newWeapon(correct === 0 ? 'fists' : 'm1911');
  p.active = SECONDARY;
  if (correct >= 2) {
    p.helmetLevel = Math.max(p.helmetLevel ?? 0, 1);
    p.heals.bandage = 1;
  }
  if (correct >= 3) {
    const id = choice === 'shotgun' ? 'm870' : 'm4a1';
    p.weapons[0] = newWeapon(id);
    p.ammo[WEAPONS[id].ammo] = WEAPONS[id].magazine;
    p.active = 0;
  }
}

const fightOf = (game, player) => game.gulag?.fights.find((f) => f.id === player.gulag?.fightId) ?? null;

export function answerGulag(game, player, correct) {
  const fight = fightOf(game, player);
  if (!fight || fight.state !== 'questions') return;
  if (correct) fight.correct[player.id]++;
  if (fight.asked[player.id] < 3) askNext(game, fight, player);
  else if (fight.correct[player.id] === 3) player.gulag.choose = true;
}

// Con 3 aciertos elige rifle o escopeta (hasta que empiece el combate)
export function chooseGulagWeapon(game, player, weapon) {
  const fight = fightOf(game, player);
  if (!fight || fight.correct[player.id] !== 3 || !['rifle', 'shotgun'].includes(weapon) || fight.state === 'fight' || fight.state === 'sudden') return;
  fight.choice[player.id] = weapon;
  player.gulag.choose = false;
  if (fight.state === 'countdown') equip(player, 3, weapon);
}

function finish(game, fight) {
  fight.state = 'done';
  const fighters = fight.ids.map((id) => game.room.players.get(id)).filter(Boolean);
  const winner = fighters.find((p) => p.alive) ?? null;
  for (const p of fighters) {
    p.frozen = false;
    p.arena = null;
    p.gulag = null;
    if (p.gulagBot) game.room.players.delete(p.id);
    else if (p !== winner) makeSpectator(game, p);
  }
  if (fighters.some((p) => p.gulagBot)) game.room.broadcastInfo?.();
  if (winner && !winner.gulagBot) {
    winner.place = null;
    if (game.balance) game.balance.gulagReturns++;
    // Nunca vuelve a puños: al menos la pistola con unas pocas balas (como al empezar)
    if (winner.weapons.every((w) => !w || w.id === 'fists')) {
      winner.weapons[SECONDARY] = newWeapon('m1911', GULAG.returnBullets);
      winner.active = SECONDARY;
    }
    // Elige en el mapa dónde caer (6 s) y baja en paracaídas
    startReturnPick(game, winner, airdropSpot(game.zone.current));
    radio(game, 'gulag', 'Gulag', `Aquí Mando. ${winner.name} ganó en el Gulag y vuelve al combate en paracaídas.`, 6000, 'gulag-ganador');
  } else if (winner) {
    radio(game, 'gulag', 'Gulag', 'Aquí Mando. El guardia del Gulag ganó: nadie regresa de esa arena.', 5000);
  }
}

function updateFight(game, fight, dt) {
  const fighters = fight.ids.map((id) => game.room.players.get(id)).filter(Boolean);
  const arena = GULAG_ARENAS[fight.arena];
  if (fight.state === 'questions') {
    const ready = fighters.every((p) => fight.asked[p.id] >= 3 && !p.transmission);
    if (!ready) return;
    fight.state = 'countdown';
    fight.endsAt = game.now + scaled(game, GULAG.countdownMs);
    for (const p of fighters) equip(p, fight.correct[p.id], fight.choice[p.id]);
    return;
  }
  if (fighters.filter((p) => p.alive).length <= 1) {
    finish(game, fight);
    return;
  }
  if (game.now < fight.endsAt) {
    if (fight.state === 'sudden') {
      const t = 1 - (fight.endsAt - game.now) / scaled(game, GULAG.suddenMs);
      fight.radius = GULAG.suddenStartRadius + (1.5 - GULAG.suddenStartRadius) * t;
      for (const p of fighters) {
        if (p.alive && Math.hypot(p.x - arena.x, p.y - arena.y) > fight.radius) damagePlayer(game, p, GULAG.suddenDps * dt, null, ZONE_INDEX, { ignoreArmor: true });
      }
    }
    return;
  }
  if (fight.state === 'countdown') {
    fight.state = 'fight';
    fight.endsAt = game.now + scaled(game, GULAG.fightMs);
    for (const p of fighters) {
      p.frozen = false;
      if (p.gulag) p.gulag.choose = false;
    }
  } else if (fight.state === 'fight') {
    fight.state = 'sudden';
    fight.radius = GULAG.suddenStartRadius;
    fight.endsAt = game.now + scaled(game, GULAG.suddenMs);
  } else {
    // Al cerrarse del todo el círculo sigue haciendo daño hasta que quede uno
    fight.endsAt = game.now + 1000;
  }
}

// Emparejamiento: el más antiguo de la cola y hasta dos más que no sean de su equipo
function matchmake(game) {
  const g = game.gulag;
  for (const arena of GULAG_ARENAS) {
    if (!g.queue.length) return;
    if (g.fights.some((f) => f.arena === arena.index)) continue;
    const queued = g.queue.map((id) => game.room.players.get(id)).filter((p) => p?.gulag?.state === 'queue');
    if (!queued.length) return;
    const group = [queued[0]];
    for (const p of queued.slice(1)) if (group.length < 3 && !group.some((q) => teamOf(q) === teamOf(p))) group.push(p);
    const waited = game.now - group[group.length - 1].gulag.since;
    if (group.length === 3 || (group.length === 2 && waited >= scaled(game, GULAG.pairWaitMs))) startFight(game, group, arena);
    else if (group.length === 1 && waited >= scaled(game, GULAG.botWaitMs)) startFight(game, [group[0], makeBot(game)], arena);
    else return;
  }
}

export function updateGulag(game, dt) {
  const g = game.gulag;
  if (game.room.phase !== 'playing' || !g) return;
  // Desde la fase 4 de la zona: los combates en curso terminan normal; la cola pasa a espectador
  if ((game.zone?.phase ?? 0) >= GULAG.untilPhase && g.queue.length) {
    for (const id of g.queue) {
      const p = game.room.players.get(id);
      if (p?.gulag?.state === 'queue') {
        makeSpectator(game, p);
        game.room.emitTo(p, EVENTS.RADIO_MESSAGE, { kind: 'gulag', title: 'Gulag cerrado', text: 'La zona entró en la fase 4: el Gulag cerró. Ahora eres espectador.', durationMs: 5000 });
      }
    }
    g.queue = [];
  }
  g.queue = g.queue.filter((id) => game.room.players.has(id));
  matchmake(game);
  for (const fight of g.fights) updateFight(game, fight, dt);
  g.fights = g.fights.filter((f) => f.state !== 'done');
}

// Snapshot: [en cola, [[id del combate, arena, estado, ms restantes, radio, [[jugador, aciertos], …]], …]]
export function encodeGulag(game) {
  const g = game.gulag;
  if (!g || game.room.phase !== 'playing') return [];
  return [
    g.queue.length,
    g.fights.map((f) => [
      f.id, f.arena, STATES.indexOf(f.state), f.state === 'questions' ? 0 : Math.max(0, Math.round(f.endsAt - game.now)),
      Math.round((f.radius ?? GULAG.suddenStartRadius) * 10) / 10, f.ids.map((id) => [id, f.correct[id] ?? 0]),
    ]),
  ];
}
