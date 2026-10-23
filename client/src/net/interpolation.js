import { INTERP_DELAY_MS, TICK_MS } from '@calculo-royale/shared/constants';

const BUFFER_MS = 1000;

const lerp = (a, b, t) => a + (b - a) * t;

export function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

const lerpAngle = (a, b, t) => a + angleDiff(b, a) * t;

// Guarda los snapshots del servidor y devuelve a los demás jugadores
// en (ahora − INTERP_DELAY_MS), interpolando entre los dos snapshots vecinos.
export class SnapshotBuffer {
  constructor() {
    this.snaps = [];
    this.offset = null; // reloj local − reloj del servidor (en tiempo de ticks)
  }

  push(tick, players) {
    const t = tick * TICK_MS;
    const offset = performance.now() - t;
    // El paquete más rápido fija el reloj; si la red se vuelve lenta, se ajusta despacio
    if (this.offset === null || offset < this.offset) this.offset = offset;
    else this.offset += (offset - this.offset) * 0.02;

    const byId = new Map();
    for (const p of players) byId.set(p[0], p);
    this.snaps.push({ t, players: byId });
    while (this.snaps.length > 2 && this.snaps[0].t < t - BUFFER_MS) this.snaps.shift();
  }

  sample(now, out) {
    out.clear();
    const n = this.snaps.length;
    if (n === 0) return out;

    const t = now - this.offset - INTERP_DELAY_MS;
    let a = this.snaps[0];
    let b = this.snaps[n - 1];
    if (t <= a.t) b = a;
    else if (t >= b.t) a = b;
    else {
      for (let i = n - 1; i > 0; i--) {
        if (this.snaps[i - 1].t <= t) {
          a = this.snaps[i - 1];
          b = this.snaps[i];
          break;
        }
      }
    }

    const alpha = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
    for (const [id, pb] of b.players) {
      const pa = a.players.get(id) ?? pb;
      out.set(id, {
        x: lerp(pa[1], pb[1], alpha),
        y: lerp(pa[2], pb[2], alpha),
        aim: lerpAngle(pa[3], pb[3], alpha),
      });
    }
    return out;
  }
}
