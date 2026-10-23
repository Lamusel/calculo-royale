import { TERRAIN } from './constants.js';

// Superficie del mapa: z = f(x, y). Solo interna: da la altura del terreno y,
// con su gradiente, el factor de velocidad según la pendiente.

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
