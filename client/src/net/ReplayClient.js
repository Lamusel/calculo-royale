import { INTERP_DELAY_MS, REPLAY, TICK_MS } from '@calculo-royale/shared/constants';
import { EffectViews, snapshotEffects } from './GameClient.js';
import { SnapshotBuffer } from './interpolation.js';

// Velocidad de reproducción en el tiempo de juego t (ms): cámara lenta alrededor del momento clave
export function replaySpeed(t, keyT) {
  return t >= keyT - REPLAY.slowBeforeMs && t <= keyT + REPLAY.slowAfterMs ? REPLAY.slowSpeed : 1;
}

// Cuánto dura en tiempo real reproducir el clip [startT, endT]
export function replayDuration(startT, endT, keyT) {
  const slowFrom = Math.max(startT, keyT - REPLAY.slowBeforeMs);
  const slowTo = Math.min(endT, keyT + REPLAY.slowAfterMs);
  const slow = Math.max(0, slowTo - slowFrom);
  return endT - startT - slow + slow / REPLAY.slowSpeed;
}

// Reproduce la repetición con la misma interfaz que GameClient usa la escena
// (frame, efectos, lastShot, cinematic). Va metiendo los snapshots grabados en un
// SnapshotBuffer a medida que avanza el tiempo del clip.
export class ReplayClient {
  constructor(replay) {
    this.replay = replay;
    this.myId = null;
    this.spectator = true;
    this.trauma = 0;
    this.effects = [];
    this.effectViews = new EffectViews();
    this.lastShot = new Map();
    this.buffer = new SnapshotBuffer();
    this.frames = replay.frames;
    this.next = 0;
    this.startT = this.frames[0][0] * TICK_MS;
    this.endT = this.frames[this.frames.length - 1][0] * TICK_MS;
    this.keyT = replay.keyTick * TICK_MS;
    this.t = this.startT;
    this.lastNow = null;
    this.done = false;
  }

  get slow() {
    return replaySpeed(this.t, this.keyT) < 1;
  }

  get progress() {
    return (this.t - this.startT) / Math.max(1, this.endT - this.startT);
  }

  // Avanza el reloj del clip según el tiempo real transcurrido
  advance(now) {
    const dt = this.lastNow === null ? 0 : Math.min(250, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    this.t = Math.min(this.endT, this.t + dt * replaySpeed(this.t, this.keyT));
    if (this.t >= this.endT) this.done = true;
  }

  frame(now, frame) {
    this.advance(now);
    // Se cargan los snapshots hasta un poco más adelante (la interpolación necesita el siguiente)
    const ahead = this.t + INTERP_DELAY_MS + 2 * REPLAY.sendEvery * TICK_MS;
    while (this.next < this.frames.length && this.frames[this.next][0] * TICK_MS <= ahead) {
      this.buffer.push(...this.frames[this.next++]);
    }
    this.buffer.offset = 0; // el reloj del búfer es el del clip
    const at = this.t + INTERP_DELAY_MS;
    frame.me = null;
    this.buffer.sample(at, frame);
    frame.meInfo = null;
    frame.follow = frame.others.get(this.replay.focusId) ?? null;
    frame.myVehicleId = null;
    frame.mySeat = null;
    this.buffer.drainEvents(at, (snap) => snapshotEffects(snap, this.effects, this.lastShot, now));
  }

  drainEffects(viewId) {
    return this.effectViews.drain(this.effects, viewId);
  }

  // Cámara de cine: un poco más cerca que la de juego, girando despacio alrededor del protagonista
  cinematic(now, frame) {
    const f = frame.follow;
    if (!f) return null;
    return { x: f.x, y: f.y, angle: Math.PI / 2 - 0.35 + (this.t - this.startT) / 9000, distance: 12, height: 10 };
  }
}
