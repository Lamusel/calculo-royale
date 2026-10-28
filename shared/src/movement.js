import { AIM_MOVE_FACTOR, DEPLOY, MAP_HALF, PLAYER_RADIUS, PLAYER_SPEED, SLOPE_SPEED } from './constants.js';
import { resolveCircle } from './collision.js';
import { BUTTONS } from './protocol.js';
import { worldLimits } from './mapLayout.js';
import { waterAt } from './mapPlan.js';
import { terrainGradient } from './terrain.js';

// Movimiento compartido: el servidor lo usa como verdad y el cliente para predecir.
// Si cambia aquí, cambia en ambos lados y la predicción nunca se desfasa.

const LIMIT = MAP_HALF - PLAYER_RADIUS;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// En el agua: honda se nada lento; poco profunda (orillas y vado) se camina más despacio
export const WATER_SPEED = [1, 0.7, 0.45];

// Factor de velocidad según la derivada direccional ∇f·û: cuesta arriba más lento
export function slopeFactor(x, y, ux, uy) {
  const [fx, fy] = terrainGradient(x, y);
  return clamp(1 - SLOPE_SPEED.k * (fx * ux + fy * uy), SLOPE_SPEED.min, SLOPE_SPEED.max);
}

// player: { x, y, aim, air?, speedFactor? } — se modifica en el lugar (speedFactor: curándose o con bebida)
// input: { mx, my, aim, buttons } con mx, my en [-1, 1]
// air: 'fall' | 'chute' mientras cae del bus (sin colisiones ni pendiente, otra velocidad)
export function applyInput(player, input, dt) {
  player.aim = input.aim;
  const len = Math.hypot(input.mx, input.my);
  // Cayendo: cuánto se inclina (de 0 a 1); el servidor lo usa para la velocidad de caída
  if (player.air) player.lean = Math.min(len, 1);
  if (len < 1e-6) return;

  const ux = input.mx / len;
  const uy = input.my / len;
  if (player.air) {
    const step = (player.air === 'chute' ? DEPLOY.chuteAirSpeed : DEPLOY.airSpeed) * Math.min(len, 1) * dt;
    player.x = clamp(player.x + ux * step, -LIMIT, LIMIT);
    player.y = clamp(player.y + uy * step, -LIMIT, LIMIT);
    return;
  }
  const aiming = input.buttons & BUTTONS.AIM ? AIM_MOVE_FACTOR : 1;
  const water = WATER_SPEED[waterAt(player.x, player.y)];
  const step = PLAYER_SPEED * (player.speedFactor ?? 1) * Math.min(len, 1) * aiming * water * slopeFactor(player.x, player.y, ux, uy) * dt;
  // Dentro del mapa, o dentro de la arena del Gulag si está en una
  const box = worldLimits(player.x, player.y, PLAYER_RADIUS);
  player.x = clamp(player.x + ux * step, box.minX, box.maxX);
  player.y = clamp(player.y + uy * step, box.minY, box.maxY);
  resolveCircle(player, PLAYER_RADIUS);
}
