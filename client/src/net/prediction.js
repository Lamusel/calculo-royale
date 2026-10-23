import { TICK_MS } from '@calculo-royale/shared/constants';
import { applyInput } from '@calculo-royale/shared/movement';

const DT = TICK_MS / 1000;
// Si la corrección es mayor que esto (ej. teletransporte al iniciar), se salta sin suavizar
const SNAP_DISTANCE = 5;
// Qué tan rápido se absorbe el error de predicción (1/s)
const CORRECTION_RATE = 10;

const lerp = (a, b, t) => a + (b - a) * t;

// Predicción del jugador propio: aplica cada input al instante con el mismo código
// que el servidor y, al llegar un snapshot, reaplica los inputs aún no confirmados.
export class Predictor {
  constructor() {
    this.state = null; // { x, y, aim } tras el último input
    this.prev = null; // estado anterior, para suavizar entre pasos
    this.pending = [];
    this.stepAt = 0;
    this.error = { x: 0, y: 0 };
    this.lastFrame = 0;
  }

  step(input, now) {
    if (!this.state) return;
    this.prev = { ...this.state };
    applyInput(this.state, input, DT);
    this.pending.push(input);
    this.stepAt = now;
  }

  // Paso sin movimiento (no se envió input)
  idle(now) {
    if (!this.state) return;
    this.prev = { ...this.state };
    this.stepAt = now;
  }

  reconcile(x, y, lastSeq) {
    if (!this.state) {
      this.state = { x, y, aim: 0 };
      this.prev = { ...this.state };
      return;
    }
    this.pending = this.pending.filter((i) => i.seq > lastSeq);
    const next = { x, y, aim: this.state.aim };
    for (const input of this.pending) applyInput(next, input, DT);

    const dx = next.x - this.state.x;
    const dy = next.y - this.state.y;
    this.state = next;
    this.prev.x += dx;
    this.prev.y += dy;
    if (Math.hypot(dx, dy) > SNAP_DISTANCE) {
      this.error = { x: 0, y: 0 };
    } else {
      // Se compensa el salto y el error se desvanece en los próximos cuadros
      this.error.x -= dx;
      this.error.y -= dy;
    }
  }

  render(now, aim) {
    if (!this.state) return null;
    const dt = this.lastFrame ? (now - this.lastFrame) / 1000 : 0;
    this.lastFrame = now;
    const decay = Math.exp(-CORRECTION_RATE * dt);
    this.error.x *= decay;
    this.error.y *= decay;

    const t = Math.min((now - this.stepAt) / TICK_MS, 1);
    return {
      x: lerp(this.prev.x, this.state.x, t) + this.error.x,
      y: lerp(this.prev.y, this.state.y, t) + this.error.y,
      aim,
    };
  }
}
