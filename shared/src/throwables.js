import { THROWABLES } from './constants.js';

// Geometría compartida de los lanzables (servidor y cliente): la granada muro levanta un arco de
// círculos frente a quien la lanzó (de frente a él), que bloquean balas y paso.
export function wallPieces(x, y, angle) {
  const { arc, pieces, pieceRadius } = THROWABLES.wall;
  const out = [];
  for (let i = 0; i < pieces; i++) {
    // De −50° a +50° alrededor del rumbo, sobre un círculo con centro hacia quien la lanzó: el muro lo envuelve
    const t = -0.87 + (1.74 * i) / (pieces - 1);
    const a = angle + t;
    out.push({ x: x - Math.cos(angle) * arc + Math.cos(a) * arc, y: y - Math.sin(angle) * arc + Math.sin(a) * arc, r: pieceRadius });
  }
  return out;
}
