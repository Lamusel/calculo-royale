import { ZONE_FINAL_DPS, ZONE_PHASES, ZONE_START } from '@calculo-royale/shared/constants';
import { lerpZone } from '@calculo-royale/shared/zone';

// Zona segura por fases. En cada fase: aviso (la zona nueva ya se conoce) y luego cierre.
// Cada zona nueva queda completamente dentro de la anterior.

// Zona siguiente dentro de `cur`: semiejes enteros y centro entero (desigualdad legible)
export function nextZone(cur, def, rand = Math.random) {
  const [sx, sy] = def.ellipse ?? [1, 1];
  const p = Math.round(def.radius * sx);
  const q = Math.round(def.radius * sy);
  // Holgura para que la nueva quepa en la anterior aunque el centro se redondee
  const room = Math.max(0, Math.min(cur.p, cur.q) - Math.max(p, q) - 1.5);
  const angle = rand() * Math.PI * 2;
  const dist = Math.sqrt(rand()) * room;
  return { cx: Math.round(cur.cx + Math.cos(angle) * dist), cy: Math.round(cur.cy + Math.sin(angle) * dist), p, q };
}

// ¿La elipse `inner` está dentro de `outer`? (muestreo del borde)
export function zoneContains(outer, inner) {
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const x = inner.cx + inner.p * Math.cos(t);
    const y = inner.cy + inner.q * Math.sin(t);
    const dx = (x - outer.cx) / outer.p;
    const dy = (y - outer.cy) / outer.q;
    if (dx * dx + dy * dy > 1 + 1e-9) return false;
  }
  return true;
}

export class Zone {
  // timeScale > 1 acelera la zona (solo para pruebas: variable CR_TIME_SCALE)
  constructor(rand = Math.random, timeScale = 1) {
    this.rand = rand;
    this.timeScale = timeScale;
    this.reset();
  }

  reset() {
    this.current = { ...ZONE_START };
    this.from = this.current;
    this.target = this.current;
    this.phase = -1;
    this.upcoming = null; // zona de la fase siguiente, ya decidida pero sin anunciar
    this.state = 'idle'; // 'idle' | 'waiting' | 'shrinking' | 'final'
    this.stateEndsAt = 0;
  }

  // Devuelve los eventos para anunciar por radio: [{ type, zone, phase }]
  start(now) {
    return [this.beginPhase(0, now)];
  }

  beginPhase(i, now) {
    this.phase = i;
    this.from = { ...this.current };
    this.target = this.upcoming ?? nextZone(this.current, ZONE_PHASES[i], this.rand);
    this.upcoming = null;
    this.state = 'waiting';
    this.stateEndsAt = now + ZONE_PHASES[i].waitMs / this.timeScale;
    return { type: 'announce', phase: i, zone: this.target, waitMs: ZONE_PHASES[i].waitMs / this.timeScale };
  }

  update(now) {
    const events = [];
    if (this.state === 'waiting' && now >= this.stateEndsAt) {
      this.state = 'shrinking';
      this.stateEndsAt = now + ZONE_PHASES[this.phase].shrinkMs / this.timeScale;
      events.push({ type: 'closing', phase: this.phase });
    }
    if (this.state === 'shrinking') {
      const def = ZONE_PHASES[this.phase];
      const t = Math.min(1, 1 - (this.stateEndsAt - now) / (def.shrinkMs / this.timeScale));
      this.current = lerpZone(this.from, this.target, t);
      if (t >= 1) {
        this.current = { ...this.target };
        if (this.phase + 1 < ZONE_PHASES.length) events.push(this.beginPhase(this.phase + 1, now));
        else {
          this.state = 'final';
          events.push({ type: 'final' });
        }
      }
    }
    return events;
  }

  // Zona de la fase siguiente (sin anunciar): la reciben antes quienes interceptan una transmisión.
  // Se decide una sola vez y es la que se anunciará después.
  peekUpcoming() {
    const next = this.phase + 1;
    if (this.state === 'idle' || next >= ZONE_PHASES.length) return null;
    this.upcoming ??= nextZone(this.target, ZONE_PHASES[next], this.rand);
    return this.upcoming;
  }

  // ms hasta el próximo anuncio de zona (o null si ya no habrá más)
  msToNextAnnounce(now) {
    if (this.phase + 1 >= ZONE_PHASES.length) return null;
    const shrink = ZONE_PHASES[this.phase].shrinkMs / this.timeScale;
    return this.state === 'waiting' ? this.stateEndsAt - now + shrink : this.stateEndsAt - now;
  }

  // Daño por segundo fuera de la zona: el de la fase que se está cerrando (o la anterior)
  get dps() {
    if (this.state === 'shrinking') return ZONE_PHASES[this.phase].dps;
    if (this.state === 'waiting') return this.phase > 0 ? ZONE_PHASES[this.phase - 1].dps : 0;
    if (this.state === 'final') return ZONE_FINAL_DPS;
    return 0;
  }

  // [cx, cy, p, q, cx', cy', p', q', fase, ms al siguiente evento, cerrándose]
  encode(now) {
    const r = (v) => Math.round(v * 100) / 100;
    const c = this.current;
    const n = this.target;
    return [
      r(c.cx), r(c.cy), r(c.p), r(c.q), n.cx, n.cy, n.p, n.q,
      this.phase, Math.max(0, Math.round(this.stateEndsAt - now)), this.state === 'shrinking' ? 1 : 0,
    ];
  }
}

