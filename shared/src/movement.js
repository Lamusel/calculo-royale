import { MAP_HALF, PLAYER_RADIUS, PLAYER_SPEED } from './constants.js';

// Movimiento compartido: el servidor lo usa como verdad y el cliente para predecir.
// Si cambia aquí, cambia en ambos lados y la predicción nunca se desfasa.

const LIMIT = MAP_HALF - PLAYER_RADIUS;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// player: { x, y, aim } — se modifica en el lugar
// input: { mx, my, aim } con mx, my en [-1, 1]
export function applyInput(player, input, dt) {
  let { mx, my } = input;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  player.x = clamp(player.x + mx * PLAYER_SPEED * dt, -LIMIT, LIMIT);
  player.y = clamp(player.y + my * PLAYER_SPEED * dt, -LIMIT, LIMIT);
  player.aim = input.aim;
}
