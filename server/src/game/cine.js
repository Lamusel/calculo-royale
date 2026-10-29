import { DUEL, REPLAY, TICK_MS, WEAPON_IDS, WEAPONS, isMelee, isSniper } from '@calculo-royale/shared/constants';
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
  radio(game, 'duel', 'Duelo final', `${a.name} contra ${b.name}. Última zona: $${zoneInequality(circle)}$.`, 8000, 'duelo-final');
}

// Durante la presentación nadie se mueve ni recibe daño
export const duelFrozen = (game) => Boolean(game.duel && game.now < game.duel.introEndsAt);

// ---- Kill cam (7A) ----
// Al caer, la víctima recibe los últimos KILLCAM_MS siguiendo a quien la eliminó (con su nombre, arma y
// vida restante). Solo van los jugadores a menos de KILLCAM_RADIUS del atacante: el paquete es chico.
const KILLCAM_TICKS = Math.round(3_000 / TICK_MS);
const KILLCAM_RADIUS = 70;
export function sendKillCam(game, victim, attacker, weaponIndex) {
  if (game.room.phase !== 'playing' || victim.bot || !attacker || attacker === victim || !victim.socketId) return;
  const frames = game.recorder.frames.slice(-KILLCAM_TICKS);
  if (frames.length < 4) return;
  const near = nearFocus(frames, attacker.id, KILLCAM_RADIUS);
  game.room.emitTo(victim, EVENTS.KILL_CAM, {
    kind: 'killcam',
    title: `${attacker.name} te eliminó`,
    killer: attacker.name,
    weapon: weaponIndex,
    hp: Math.max(0, Math.round(attacker.hp)),
    focusId: attacker.id,
    keyTick: frames.at(-1)[0],
    frames: downsample(near, REPLAY.sendEvery),
  });
}

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
  // 7A: lanzacohetes, desde la tirolina y con arma blanca
  if (weapon === 'rpg' || weapon === 'gl') options.push({ kind: 'rocket', score: 55, title: `${attacker.name} con el ${WEAPONS[weapon].name.toLowerCase()}` });
  if (attacker.zip) options.push({ kind: 'zipline', score: 65, title: `${attacker.name} dispara desde la tirolina` });
  if (isMelee(weapon)) options.push({ kind: 'melee', score: 50, title: `${attacker.name} a filo de ${WEAPONS[weapon].name.toLowerCase()}` });
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

// Grabador (7A): guarda las 3 mejores jugadas de la partida sin que se pisen entre sí. Cada candidata
// espera su "después" (AFTER_TICKS) y se recorta de los últimos BUFFER_TICKS snapshots.
const TOP = 3;
const CLIP_TICKS = BEFORE_TICKS + AFTER_TICKS;
export class Recorder {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = []; // snapshots de los últimos BUFFER_TICKS
    this.pending = []; // jugadas esperando su "después"
    this.clips = []; // ya recortadas, de mayor a menor puntaje
  }

  push(snapshot) {
    this.frames.push(snapshot);
    while (this.frames.length > BUFFER_TICKS) this.frames.shift();
    while (this.pending.length && snapshot[0] >= this.pending[0].keyTick + AFTER_TICKS) this.capture(this.pending.shift());
  }

  // ¿Entraría entre las 3 mejores? (si se pisa con otra, solo si le gana)
  worth(candidate) {
    const all = [...this.clips, ...this.pending];
    const overlap = all.filter((c) => Math.abs(c.keyTick - candidate.keyTick) < CLIP_TICKS);
    if (overlap.some((c) => c.score >= candidate.score)) return false;
    return all.length - overlap.length < TOP || all.some((c) => c.score < candidate.score);
  }

  consider(candidate) {
    if (!candidate || !this.worth(candidate)) return;
    this.pending = this.pending.filter((c) => Math.abs(c.keyTick - candidate.keyTick) >= CLIP_TICKS);
    this.pending.push(candidate);
  }

  capture(p) {
    if (!p) return;
    const frames = this.frames.filter((f) => f[0] >= p.keyTick - BEFORE_TICKS && f[0] <= p.keyTick + AFTER_TICKS);
    if (frames.length < 2) return;
    this.clips = this.clips.filter((c) => Math.abs(c.keyTick - p.keyTick) >= CLIP_TICKS || c.score > p.score);
    if (this.clips.some((c) => Math.abs(c.keyTick - p.keyTick) < CLIP_TICKS)) return;
    this.clips.push({ ...p, frames });
    this.clips.sort((x, y) => y.score - x.score);
    this.clips.length = Math.min(this.clips.length, TOP);
  }

  // Las repeticiones para enviar (o null): en orden de la partida, a 10 Hz, sin perder disparos ni
  // explosiones y solo con los jugadores cerca del protagonista. Los campos de la mejor van arriba.
  take() {
    for (const p of this.pending.splice(0)) this.capture(p);
    const clips = this.clips.splice(0);
    if (!clips.length) return null;
    const packed = clips.map((c) => ({ kind: c.kind, title: c.title, focusId: c.focusId, keyTick: c.keyTick, frames: downsample(nearFocus(c.frames, c.focusId), REPLAY.sendEvery) }));
    return { ...packed[0], clips: [...packed].sort((x, y) => x.keyTick - y.keyTick) };
  }
}

// Solo los jugadores a menos de 70 m del protagonista (las repeticiones pesan mucho menos)
export function nearFocus(frames, focusId, radius = 70) {
  return frames.map((f) => {
    const at = f[1].find((e) => e[0] === focusId);
    if (!at) return f;
    const copy = [...f];
    copy[1] = f[1].filter((e) => Math.abs(e[1] - at[1]) < radius && Math.abs(e[2] - at[2]) < radius);
    return copy;
  });
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
