import { DUEL, REPLAY, TICK_MS, WEAPON_IDS, isSniper } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { zoneInequality } from '@calculo-royale/shared/zone';
import { aliveCount, inMatch } from './combat.js';
import { radio } from './match.js';
import { zoneContains } from './Zone.js';

// Cine: duelo final (al quedar 2 vivos) y repetición de la mejor jugada.

const BEFORE_TICKS = Math.round(REPLAY.beforeMs / TICK_MS);
const AFTER_TICKS = Math.round(REPLAY.afterMs / TICK_MS);
const BUFFER_TICKS = Math.round(REPLAY.bufferMs / TICK_MS);

// ---- Duelo final ----

// Último círculo entre los dos finalistas, entero y dentro de la zona actual
export function duelCircle(current, a, b, radius = DUEL.radius) {
  const r = Math.max(2, Math.min(radius, Math.floor(Math.min(current.p, current.q)) - 1));
  let cx = (a.x + b.x) / 2;
  let cy = (a.y + b.y) / 2;
  // Si no cabe, se acerca al centro de la zona actual hasta que quepa
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const circle = {
      cx: Math.round(cx + (current.cx - cx) * t),
      cy: Math.round(cy + (current.cy - cy) * t),
      p: r,
      q: r,
    };
    if (zoneContains(current, circle)) return circle;
  }
  return { cx: Math.round(current.cx), cy: Math.round(current.cy), p: r, q: r };
}

// Al quedar 2 vivos (si la partida empezó con más): presentación y última zona
export function checkDuel(game) {
  if (game.duel || game.room.phase !== 'playing' || !game.zone || game.startingPlayers <= 2 || (game.room.teamMode ?? 'solo') !== 'solo') return;
  const alive = [...game.room.players.values()].filter(inMatch);
  if (alive.length !== 2) return;
  const [a, b] = alive;
  game.duel = { ids: [a.id, b.id], introEndsAt: game.now + DUEL.introMs };
  const circle = duelCircle(game.zone.current, a, b);
  game.zone.forceFinal(circle, game.now, DUEL.introMs, DUEL.shrinkMs);
  game.room.broadcast(EVENTS.MATCH_DUEL, { ids: game.duel.ids, introMs: DUEL.introMs });
  radio(game, 'duel', 'Duelo final', `${a.name} contra ${b.name}. Última zona: $${zoneInequality(circle)}$.`, 8000);
}

// Durante la presentación nadie se mueve ni recibe daño
export const duelFrozen = (game) => Boolean(game.duel && game.now < game.duel.introEndsAt);

// ---- Repetición ----

// Puntaje de una baja como jugada candidata (o null si no la hizo un jugador)
export function scoreKill(game, target) {
  const attacker = game.room.players.get(target.killedBy);
  if (!attacker || attacker === target) return null;
  const weapon = WEAPON_IDS[target.killedWith];
  const dist = Math.hypot(attacker.x - target.x, attacker.y - target.y);
  const times = (game.killTimes.get(attacker.id) ?? []).filter((t) => game.now - t <= REPLAY.multiKillMs);
  times.push(game.now);
  game.killTimes.set(attacker.id, times);

  const options = [{ kind: 'kill', score: 10, title: `${attacker.name} elimina a ${target.name}` }];
  if (weapon === 'jeep') options.push({ kind: 'runover', score: 70, title: `Atropello de ${attacker.name} a ${target.name}` });
  if (isSniper(weapon) && dist >= REPLAY.sniperDistance) {
    options.push({ kind: 'sniper', score: 50 + dist, title: `Francotirador: ${attacker.name} a ${Math.round(dist)} m` });
  }
  if (times.length >= 2) {
    const name = ['', '', 'Doble', 'Triple'][times.length] ?? 'Multi';
    options.push({ kind: 'multikill', score: 40 + 25 * times.length, title: `${name} baja de ${attacker.name}` });
  }
  if (game.room.phase === 'playing' && aliveCount(game) === 1) {
    options.push({ kind: 'final', score: 60, title: `Baja final: ${attacker.name} gana el duelo` });
  }
  const best = options.reduce((a, b) => (b.score > a.score ? b : a));
  return { ...best, focusId: attacker.id, keyTick: game.tick };
}

export class Recorder {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = []; // snapshots de los últimos BUFFER_TICKS
    this.pending = null; // mejor jugada esperando su "después"
    this.best = null; // mejor clip ya recortado
  }

  push(snapshot) {
    this.frames.push(snapshot);
    while (this.frames.length > BUFFER_TICKS) this.frames.shift();
    if (this.pending && snapshot[0] >= this.pending.keyTick + AFTER_TICKS) this.capture();
  }

  consider(candidate) {
    if (!candidate) return;
    const top = Math.max(this.best?.score ?? 0, this.pending?.score ?? 0);
    if (candidate.score <= top) return;
    // Si había otra esperando, se recorta ya con lo que tiene
    if (this.pending) this.capture();
    this.pending = candidate;
  }

  capture() {
    const p = this.pending;
    this.pending = null;
    if (!p || p.score <= (this.best?.score ?? 0)) return;
    const frames = this.frames.filter((f) => f[0] >= p.keyTick - BEFORE_TICKS && f[0] <= p.keyTick + AFTER_TICKS);
    if (frames.length >= 2) this.best = { ...p, frames };
  }

  // La repetición para enviar (o null): a 10 Hz, sin perder disparos ni explosiones
  take() {
    if (this.pending) this.capture();
    const best = this.best;
    this.best = null;
    if (!best) return null;
    return { kind: best.kind, title: best.title, focusId: best.focusId, keyTick: best.keyTick, frames: downsample(best.frames, REPLAY.sendEvery) };
  }
}

// Se queda con 1 de cada `every` snapshots; los disparos (4) y explosiones (5) de los omitidos
// pasan al siguiente que se envía. El último siempre se envía.
export function downsample(frames, every) {
  const out = [];
  let shots = [];
  let explosions = [];
  frames.forEach((f, i) => {
    shots = shots.concat(f[4]);
    explosions = explosions.concat(f[5]);
    if (i % every !== 0 && i !== frames.length - 1) return;
    const copy = [...f];
    copy[4] = shots;
    copy[5] = explosions;
    out.push(copy);
    shots = [];
    explosions = [];
  });
  return out;
}
