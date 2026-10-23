import { AIRDROP, MAP_HALF, WEAPON_IDS, ZONE_PHASES } from '@calculo-royale/shared/constants';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { CRATE_STATE, EVENTS } from '@calculo-royale/shared/protocol';
import { insideZone, sectorOf, zoneInequality } from '@calculo-royale/shared/zone';
import { aliveCount, damagePlayer } from './combat.js';
import { Zone } from './Zone.js';

// La partida en sí: zona segura, transmisiones del mando, lanzamiento aéreo y victoria.

const ZONE_INDEX = WEAPON_IDS.indexOf('zone');
// Solo para pruebas: CR_TIME_SCALE=10 hace la zona y el lanzamiento aéreo 10 veces más rápidos
export const TIME_SCALE = Math.max(1, Number(globalThis.process?.env.CR_TIME_SCALE) || 1);

export function radio(game, kind, title, text, durationMs = 9000) {
  game.room.broadcast(EVENTS.RADIO_MESSAGE, { kind, title, text, durationMs });
}

function announce(game, event) {
  if (event.type === 'announce') {
    radio(
      game,
      'zone',
      `Zona ${event.phase + 1} de ${ZONE_PHASES.length}`,
      `Aquí Mando. Nueva zona segura: $${zoneInequality(event.zone)}$. Tienen ${Math.round(event.waitMs / 1000)} s.`,
    );
  } else if (event.type === 'closing') {
    radio(game, 'closing', 'La zona se está cerrando', `Fuera de $${zoneInequality(game.zone.target)}$ se recibe daño.`, 6000);
  } else if (event.type === 'final') {
    radio(game, 'final', 'Última zona', 'La zona ya no se cierra más. Que gane el mejor.', 6000);
  }
}

export function startMatch(game, rand = Math.random) {
  game.zone = new Zone(rand, TIME_SCALE);
  game.matchStartedAt = game.now;
  game.airdropDone = false;
  game.finished = false;
  game.startingPlayers = aliveCount(game);
  for (const event of game.zone.start(game.now)) announce(game, event);
}

export function stopMatch(game) {
  game.zone = null;
  game.finished = false;
}

// Punto de aterrizaje: dentro de la zona siguiente, sin chocar con obstáculos, coordenadas enteras
export function airdropSpot(zone, rand = Math.random) {
  for (let i = 0; i < 80; i++) {
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.75;
    const x = Math.round(zone.cx + Math.cos(angle) * zone.p * r);
    const y = Math.round(zone.cy + Math.sin(angle) * zone.q * r);
    if (Math.abs(x) < MAP_HALF - 3 && Math.abs(y) < MAP_HALF - 3 && !overlapsObstacle(x, y, 1.5)) return { x, y };
  }
  return { x: Math.round(zone.cx), y: Math.round(zone.cy) };
}

function updateAirdrop(game) {
  const crate = game.airdropCrate;
  if (!game.airdropDone && game.now - game.matchStartedAt >= AIRDROP.atMs / TIME_SCALE) {
    const { x, y } = airdropSpot(game.zone.target);
    Object.assign(crate, { x, y, active: true, landed: false, landAt: game.now + AIRDROP.fallMs / TIME_SCALE, state: CRATE_STATE.CLOSED });
    game.airdropDone = true;
    radio(
      game,
      'airdrop',
      'Lanzamiento aéreo',
      `Aquí Mando. Caja dorada (Todo o nada) cayendo en $(${x}, ${y})$, sector ${sectorOf(x, y)}. Aterriza en ${Math.round(AIRDROP.fallMs / TIME_SCALE / 1000)} s.`,
    );
  }
  if (crate.active && !crate.landed && game.now >= crate.landAt) crate.landed = true;
}

export function encodeAirdrop(game) {
  const crate = game.airdropCrate;
  if (!crate.active || game.room.phase !== 'playing') return [];
  return [crate.x, crate.y, Math.max(0, Math.round(crate.landAt - game.now))];
}

function checkVictory(game) {
  if (game.finished || game.startingPlayers < 2) return;
  const alive = [...game.room.players.values()].filter((p) => p.alive && p.connected);
  if (alive.length > 1) return;
  game.finished = true;
  // Si murieron todos a la vez, gana el último en caer (posición 1)
  const winner = alive[0] ?? [...game.room.players.values()].find((p) => p.place === 1) ?? null;
  game.room.finishMatch(winner?.id ?? null);
}

export function updateMatch(game, dt) {
  if (game.room.phase !== 'playing' || !game.zone) return;
  for (const event of game.zone.update(game.now)) announce(game, event);
  const dps = game.zone.dps;
  // Durante la presentación del duelo final la zona no hace daño
  const frozen = game.duel && game.now < game.duel.introEndsAt;
  if (dps > 0 && !frozen) {
    for (const p of game.room.players.values()) {
      if (p.alive && !p.deploying && !insideZone(game.zone.current, p.x, p.y)) {
        damagePlayer(game, p, dps * dt, null, ZONE_INDEX, { ignoreArmor: true });
      }
    }
  }
  updateAirdrop(game);
  checkVictory(game);
}
