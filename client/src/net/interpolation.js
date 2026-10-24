import { INTERP_DELAY_MS, TICK_MS } from '@calculo-royale/shared/constants';

const BUFFER_MS = 1000;

const lerp = (a, b, t) => a + (b - a) * t;

export function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

const lerpAngle = (a, b, t) => a + angleDiff(b, a) * t;

// Guarda los snapshots del servidor y devuelve el mundo en (ahora − INTERP_DELAY_MS),
// interpolando entre los dos snapshots vecinos. Los eventos (disparos, explosiones)
// se entregan cuando ese tiempo de dibujo los alcanza, sincronizados con las posiciones.
export class SnapshotBuffer {
  constructor() {
    this.snaps = [];
    this.offset = null; // reloj local − reloj del servidor (en tiempo de ticks)
    this.lastEventTick = 0;
  }

  push(tick, players, grenades = [], dummies = [], shots = [], explosions = [], crates = [], alarms = [], zone = [], airdrop = [], bombing = [], vehicles = [], bus = []) {
    const t = tick * TICK_MS;
    const offset = performance.now() - t;
    // El paquete más rápido fija el reloj; si la red se vuelve lenta, se ajusta despacio
    if (this.offset === null || offset < this.offset) this.offset = offset;
    else this.offset += (offset - this.offset) * 0.02;

    const byId = new Map();
    for (const p of players) byId.set(p[0], p);
    const grenadesById = new Map();
    for (const g of grenades) grenadesById.set(g[0], g);
    this.snaps.push({ tick, t, players: byId, grenades: grenadesById, dummies, shots, explosions, crates, alarms, zone, airdrop, bombing, vehicles: new Map(vehicles.map((v) => [v[0], v])), bus });
    while (this.snaps.length > 2 && this.snaps[0].t < t - BUFFER_MS) this.snaps.shift();
  }

  get latest() {
    return this.snaps[this.snaps.length - 1] ?? null;
  }

  // Tick (fraccionario) que se está dibujando: es el que se envía para la compensación de lag
  renderTick(now) {
    if (this.offset === null) return 0;
    return (now - this.offset - INTERP_DELAY_MS) / TICK_MS;
  }

  // Llena frame.others, frame.grenades, frame.vehicles, frame.dummies, frame.crates, frame.alarms, frame.zone y frame.airdrop
  sample(now, frame) {
    frame.others.clear();
    frame.grenades.clear();
    frame.vehicles ??= new Map();
    const n = this.snaps.length;
    if (n === 0) return;

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
      frame.others.set(id, {
        x: lerp(pa[1], pb[1], alpha),
        y: lerp(pa[2], pb[2], alpha),
        aim: lerpAngle(pa[3], pb[3], alpha),
        hp: pb[5],
        armorLevel: pb[6],
        weapon: pb[7],
        flags: pb[8],
        z: lerp(pa[9] ?? 0, pb[9] ?? 0, alpha), // altura en el despliegue (0 en el suelo)
        gear: pb[10] ?? 0, // equipo visible (shared/gear.js)
      });
    }
    for (const [id, gb] of b.grenades) {
      const ga = a.grenades.get(id) ?? gb;
      frame.grenades.set(id, { x: lerp(ga[1], gb[1], alpha), y: lerp(ga[2], gb[2], alpha) });
    }
    // Jeeps: [id, x, y, heading, speed, hp, driver, passenger, state]
    frame.vehicles.clear();
    for (const [id, vb] of b.vehicles) {
      const va = a.vehicles.get(id) ?? vb;
      frame.vehicles.set(id, {
        id,
        x: lerp(va[1], vb[1], alpha),
        y: lerp(va[2], vb[2], alpha),
        heading: lerpAngle(va[3], vb[3], alpha),
        speed: vb[4],
        hp: vb[5],
        driver: vb[6],
        passenger: vb[7],
        state: vb[8],
      });
    }
    // Bus de despliegue: [x, y, rumbo, ms para arrancar]
    frame.bus = b.bus.length
      ? { x: lerp(a.bus[0] ?? b.bus[0], b.bus[0], alpha), y: lerp(a.bus[1] ?? b.bus[1], b.bus[1], alpha), heading: b.bus[2], waitMs: b.bus[3] }
      : null;
    frame.dummies = b.dummies;
    frame.crates = b.crates;
    frame.alarms = b.alarms;
    frame.airdrop = b.airdrop;
    frame.bombing = b.bombing;
    // La zona se interpola para que el muro se cierre suave
    if (b.zone.length && a.zone.length) {
      frame.zone = b.zone.map((v, i) => (i < 4 ? lerp(a.zone[i], v, alpha) : v));
    } else {
      frame.zone = b.zone;
    }
  }

  // Entrega los eventos de los snapshots que el tiempo de dibujo ya alcanzó
  drainEvents(now, onEvents) {
    const t = now - this.offset - INTERP_DELAY_MS;
    for (const snap of this.snaps) {
      if (snap.tick <= this.lastEventTick || snap.t > t) continue;
      this.lastEventTick = snap.tick;
      onEvents(snap);
    }
  }
}
