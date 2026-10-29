import { TICK_MS } from '@calculo-royale/shared/constants';
import { applyInput } from '@calculo-royale/shared/movement';
import { applyVehicleInput, seatPosition } from '@calculo-royale/shared/vehicle';

const DT = TICK_MS / 1000;
// Si la corrección es mayor que esto (ej. teletransporte al iniciar), se salta sin suavizar
const SNAP_DISTANCE = 5;
// Qué tan rápido se absorbe el error de predicción (1/s)
const CORRECTION_RATE = 10;

const lerp = (a, b, t) => a + (b - a) * t;

// Predicción del jugador propio: aplica cada input al instante con el mismo código
// que el servidor y, al llegar un snapshot, reaplica los inputs aún no confirmados.
// Al manejar un jeep se predice el jeep (misma física que el servidor) y el jugador va en su asiento.
export class Predictor {
  constructor() {
    this.state = null; // { x, y, aim } tras el último input
    this.prev = null; // estado anterior, para suavizar entre pasos
    this.pending = [];
    this.stepAt = 0;
    this.error = { x: 0, y: 0 };
    this.lastFrame = 0;
    this.snapNext = false;
    this.drive = null; // jeep que maneja: { x, y, heading, speed }
    this.prevDrive = null;
    this.speedFactor = 1; // curándose o con bebida (llega en el estado privado)
  }

  step(input, now) {
    if (!this.state) return;
    this.prev = { ...this.state };
    if (this.drive) {
      this.prevDrive = { ...this.drive };
      applyVehicleInput(this.drive, input, DT);
      Object.assign(this.state, seatPosition(this.drive, 'driver'));
    } else {
      this.state.speedFactor = this.speedFactor;
      applyInput(this.state, input, DT);
    }
    this.pending.push(input);
    this.stepAt = now;
  }

  // Paso sin movimiento (no se envió input)
  idle(now) {
    if (!this.state) return;
    this.prev = { ...this.state };
    if (this.drive) this.prevDrive = { ...this.drive };
    this.stepAt = now;
  }

  // El próximo snapshot se aplica sin suavizar (reaparición)
  forceSnap() {
    this.snapNext = true;
  }

  // vehicle: el jeep que manejo según el servidor (o null si voy a pie)
  // air: 'fall' | 'chute' cayendo del bus (movimiento sin colisiones), o null
  reconcile(x, y, lastSeq, vehicle = null, air = null) {
    if (!this.state) {
      this.state = { x, y, aim: 0 };
      this.prev = { ...this.state };
      return;
    }
    // Subir o bajar del jeep, saltar o aterrizar cambia el modo: sin suavizar
    if (Boolean(vehicle) !== Boolean(this.drive) || Boolean(air) !== Boolean(this.state.air)) this.snapNext = true;
    this.pending = this.pending.filter((i) => i.seq > lastSeq);
    const next = { x, y, aim: this.state.aim, air, speedFactor: this.speedFactor };
    let dx;
    let dy;
    if (vehicle) {
      const drive = { x: vehicle.x, y: vehicle.y, heading: vehicle.heading, speed: vehicle.speed, type: vehicle.type };
      for (const input of this.pending) applyVehicleInput(drive, input, DT);
      Object.assign(next, seatPosition(drive, 'driver'));
      dx = drive.x - (this.drive?.x ?? drive.x);
      dy = drive.y - (this.drive?.y ?? drive.y);
      if (this.prevDrive && this.drive) {
        this.prevDrive.x += dx;
        this.prevDrive.y += dy;
        this.prevDrive.heading += drive.heading - this.drive.heading;
      } else {
        this.prevDrive = { ...drive };
      }
      this.drive = drive;
    } else {
      for (const input of this.pending) applyInput(next, input, DT);
      dx = next.x - this.state.x;
      dy = next.y - this.state.y;
      this.drive = null;
      this.prevDrive = null;
    }
    this.prev.x += next.x - this.state.x;
    this.prev.y += next.y - this.state.y;
    this.state = next;
    if (this.snapNext || Math.hypot(dx, dy) > SNAP_DISTANCE) {
      this.error = { x: 0, y: 0 };
      this.snapNext = false;
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
    if (this.drive) {
      const p = this.prevDrive ?? this.drive;
      const jeep = {
        x: lerp(p.x, this.drive.x, t) + this.error.x,
        y: lerp(p.y, this.drive.y, t) + this.error.y,
        heading: p.heading + Math.atan2(Math.sin(this.drive.heading - p.heading), Math.cos(this.drive.heading - p.heading)) * t,
        speed: this.drive.speed,
      };
      return { ...seatPosition(jeep, 'driver'), aim, jeep };
    }
    return {
      x: lerp(this.prev.x, this.state.x, t) + this.error.x,
      y: lerp(this.prev.y, this.state.y, t) + this.error.y,
      aim,
    };
  }
}
