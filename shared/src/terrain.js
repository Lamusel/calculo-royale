import { TERRAIN } from './constants.js';

// Superficie del mapa: z = f(x, y). Solo visual por ahora; en la fase 2 la pendiente
// modificará la velocidad (entre 80 % y 115 %).

const { amplitude: A, scale: K } = TERRAIN;

export function terrainHeight(x, y) {
  return A * Math.sin(x / K) * Math.cos(y / K);
}

// ∇f = (∂f/∂x, ∂f/∂y)
export function terrainGradient(x, y) {
  return [
    (A / K) * Math.cos(x / K) * Math.cos(y / K),
    -(A / K) * Math.sin(x / K) * Math.sin(y / K),
  ];
}

export const TERRAIN_FORMULA = `z = ${A}·sin(x/${K})·cos(y/${K})`;
