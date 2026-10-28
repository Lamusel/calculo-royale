import { MAP_HALF, ZONE_FINAL_DPS, ZONE_FIRST_DELAY_MS, ZONE_PHASES, ZONE_START } from '@calculo-royale/shared/constants';
import { onDam, waterAt } from '@calculo-royale/shared/mapPlan';
import { lerpZone } from '@calculo-royale/shared/zone';

// Zona segura por fases. En cada fase: aviso (la zona nueva ya se conoce) y luego cierre.
// Cada zona nueva queda completamente dentro de la anterior.

// ¿Sirve como centro? Dentro del mapa con todo el radio y fuera del río y la represa
const goodCenter = (cx, cy, p, q) => Math.abs(cx) + p <= MAP_HALF && Math.abs(cy) + q <= MAP_HALF && !waterAt(cx, cy) && !onDam(cx, cy);

// Zona siguiente dentro de `cur`: semiejes enteros y centro entero (desigualdad legible).
// En las fases que se desplazan (def.moving) el centro nuevo queda lejos del anterior.
export function nextZone(cur, def, rand = Math.random) {
  const [sx, sy] = def.ellipse ?? [1, 1];
  const p = Math.round(def.radius * sx);
  const q = Math.round(def.radius * sy);
  // Holgura para que la nueva quepa en la anterior aunque el centro se redondee
  const room = Math.max(0, Math.min(cur.p, cur.q) - Math.max(p, q) - 1.5);
  let fallback = null;
  for (let i = 0; i < 40; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = def.moving ? room * (0.75 + rand() * 0.25) : Math.sqrt(rand()) * room;
    const zone = { cx: Math.round(cur.cx + Math.cos(angle) * dist), cy: Math.round(cur.cy + Math.sin(angle) * dist), p, q };
    if (goodCenter(zone.cx, zone.cy, p, q)) return zone;
    if (!fallback && Math.abs(zone.cx) + p <= MAP_HALF && Math.abs(zone.cy) + q <= MAP_HALF) fallback = zone;
  }
  return fallback ?? { cx: Math.round(cur.cx), cy: Math.round(cur.cy), p, q };
}

// Rumbo de un desplazamiento en palabras ("noreste")
const HEADINGS = ['este', 'noreste', 'norte', 'noroeste', 'oeste', 'suroeste', 'sur', 'sureste'];
export function headingName(dx, dy) {
  const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return HEADINGS[(k + 8) % 8];
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
  // timeScale > 1 acelera la zona (pruebas: CR_TIME_SCALE; duración corta del anfitrión: 1 / 0,62)
  constructor(rand = Math.random, timeScale = 1) {
    this.rand = rand;
    this.timeScale = timeScale;
    this.startAt = 0;
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
    this.shrinkMs = 0; // duración del cierre en curso
    this.nextShrinkMs = null; // cierre forzado (duelo final)
  }

  // La primera fase se anuncia tras ZONE_FIRST_DELAY_MS (mientras, la zona cubre todo el mapa).
  // Devuelve los eventos para anunciar por radio: [{ type, zone, phase }]
  start(now, delayMs = ZONE_FIRST_DELAY_MS) {
    this.startAt = now + delayMs / this.timeScale;
    this.stateEndsAt = this.startAt;
    return delayMs > 0 ? [] : [this.beginPhase(0, now)];
  }

  beginPhase(i, now) {
    this.phase = i;
    this.from = { ...this.current };
    this.target = this.upcoming ?? nextZone(this.current, ZONE_PHASES[i], this.rand);
    this.upcoming = null;
    this.state = 'waiting';
    this.stateEndsAt = now + ZONE_PHASES[i].waitMs / this.timeScale;
    return { type: 'announce', phase: i, zone: this.target, from: this.from, moving: Boolean(ZONE_PHASES[i].moving), waitMs: ZONE_PHASES[i].waitMs / this.timeScale };
  }

  update(now) {
    const events = [];
    if (this.state === 'idle' && this.startAt && now >= this.startAt) events.push(this.beginPhase(0, now));
    if (this.state === 'waiting' && now >= this.stateEndsAt) {
      this.state = 'shrinking';
      this.shrinkMs = this.nextShrinkMs ?? ZONE_PHASES[this.phase].shrinkMs / this.timeScale;
      this.nextShrinkMs = null;
      this.stateEndsAt = now + this.shrinkMs;
      events.push({ type: 'closing', phase: this.phase });
    }
    if (this.state === 'shrinking') {
      const t = Math.min(1, 1 - (this.stateEndsAt - now) / this.shrinkMs);
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

  // Duelo final: salta a la última fase con un círculo propio que empieza a cerrarse tras delayMs
  forceFinal(circle, now, delayMs, shrinkMs) {
    this.phase = ZONE_PHASES.length - 1;
    this.from = { ...this.current };
    this.target = circle;
    this.upcoming = null;
    this.state = 'waiting';
    this.stateEndsAt = now + delayMs;
    this.nextShrinkMs = shrinkMs;
  }

  // Zona de la fase siguiente (sin anunciar): se decide una sola vez y es la que se anunciará.
  // Se decide una sola vez y es la que se anunciará después.
  peekUpcoming() {
    const next = this.phase + 1;
    if (next >= ZONE_PHASES.length) return null;
    this.upcoming ??= nextZone(this.target, ZONE_PHASES[next], this.rand);
    return this.upcoming;
  }

  // ms hasta que la última zona termine de cerrarse (0 si ya terminó)
  msToEnd(now) {
    if (this.state === 'final') return 0;
    let ms = Math.max(0, this.stateEndsAt - now);
    const from = this.state === 'idle' ? 0 : this.phase + 1;
    if (this.state === 'waiting') ms += ZONE_PHASES[this.phase].shrinkMs / this.timeScale;
    for (let i = from; i < ZONE_PHASES.length; i++) ms += (ZONE_PHASES[i].waitMs + ZONE_PHASES[i].shrinkMs) / this.timeScale;
    return ms;
  }

  // ms hasta el próximo anuncio de zona (o null si ya no habrá más)
  msToNextAnnounce(now) {
    if (this.state === 'idle') return Math.max(0, this.startAt - now);
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

  // [cx, cy, p, q, cx', cy', p', q', fase, ms al siguiente evento, cerrándose, se desplaza, ms al final]
  encode(now) {
    const r = (v) => Math.round(v * 100) / 100;
    const c = this.current;
    const n = this.target;
    return [
      r(c.cx), r(c.cy), r(c.p), r(c.q), n.cx, n.cy, n.p, n.q,
      this.phase, Math.max(0, Math.round(this.stateEndsAt - now)), this.state === 'shrinking' ? 1 : 0,
      this.phase >= 0 && ZONE_PHASES[this.phase].moving && this.state !== 'final' ? 1 : 0, Math.round(this.msToEnd(now)),
    ];
  }
}

