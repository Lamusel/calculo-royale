import { JEEP, MAP_HALF } from './constants.js';
import { resolveCircle } from './collision.js';
import { onBridgeArea } from './terrain.js';

// Física del jeep, compartida: el servidor manda y el conductor predice con la misma función.
// v: { x, y, heading, speed } (se modifica en el lugar). input: { mx, my } del joystick.
// El jeep gira hacia donde apunta el joystick y acelera más cuanto más alineado va.
// Con el joystick hacia atrás va en reversa (más lento), con la cola hacia donde apunta.

const LIMIT = MAP_HALF - JEEP.radius;
const REVERSE_COS = -0.35; // joystick a más de ~110° del frente: reversa
const REVERSE_FACTOR = 0.45;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function applyVehicleInput(v, input, dt) {
  const len = Math.min(1, Math.hypot(input.mx, input.my));
  let target = 0;
  if (len > 0.1) {
    const stick = Math.atan2(input.my, input.mx);
    const turn = JEEP.turnRate * dt;
    const diff = angleDiff(stick, v.heading);
    if (Math.cos(diff) < REVERSE_COS) {
      const back = angleDiff(stick + Math.PI, v.heading);
      v.heading += clamp(back, -turn, turn);
      target = -JEEP.maxSpeed * REVERSE_FACTOR * len * Math.cos(back);
    } else {
      v.heading += clamp(diff, -turn, turn);
      target = JEEP.maxSpeed * len * Math.max(0.15, Math.cos(diff));
    }
  }
  // Acelera hacia el objetivo; si lo que pide es frenar o cambiar de sentido, frena más fuerte
  const rate = Math.abs(target) > Math.abs(v.speed) && Math.sign(target) * Math.sign(v.speed) >= 0 ? JEEP.accel : JEEP.brake;
  v.speed += clamp(target - v.speed, -rate * dt, rate * dt);

  const step = Math.abs(v.speed) * dt;
  const bx = v.x + Math.cos(v.heading) * v.speed * dt;
  const by = v.y + Math.sin(v.heading) * v.speed * dt;
  v.x = clamp(bx, -LIMIT, LIMIT);
  v.y = clamp(by, -LIMIT, LIMIT);
  resolveCircle(v, JEEP.radius);
  // Lo que un obstáculo o el borde le quitó al paso: de frente es un choque (pierde casi toda
  // la velocidad); de costado se desliza por la pared y solo frena un poco
  const pushed = Math.hypot(v.x - bx, v.y - by);
  // En los puentes las barandas son borde: se desliza sin chocar
  v.crashed = pushed > 0.01 && pushed > step * 0.6 && !onBridgeArea(v.x, v.y, 2);
  if (v.crashed) v.speed *= 0.3;
  else if (pushed > 0.01) v.speed *= 0.97;
}

// Asientos: el conductor adelante a la izquierda, el pasajero atrás a la derecha
export function seatPosition(v, seat) {
  const [forward, side] = seat === 'driver' ? [0.15, -0.45] : [-0.75, 0.35];
  const c = Math.cos(v.heading);
  const s = Math.sin(v.heading);
  return { x: v.x + c * forward + s * side, y: v.y + s * forward - c * side };
}
