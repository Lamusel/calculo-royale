import { cylinder, limb, merge, piece } from './build.js';
import * as THREE from 'three';

// Paracaídas compartido (lanzamiento aéreo, despliegue y reanimación): cúpula de gajos con
// ribete y cuerdas que bajan hasta el punto de enganche (y = hook). Origen en la carga.
const cache = new Map();

export function parachuteGeometry({ radius = 2.4, height = 4.2, hook = 1.2, colors = ['#c9b37a', '#a8442e'] } = {}) {
  const key = `${radius}|${height}|${hook}|${colors}`;
  if (cache.has(key)) return cache.get(key);
  const canopy = new THREE.SphereGeometry(radius, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2.6);
  const pieces = [piece(canopy, colors[0], { position: [0, height, 0], scale: [1, 0.55, 1] })];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pieces.push(limb([Math.cos(a) * radius * 0.75, height + 0.1, Math.sin(a) * radius * 0.75], [Math.cos(a) * 0.3, hook, Math.sin(a) * 0.25], 0.03, '#ddd8c4'));
  }
  pieces.push(piece(cylinder(radius + 0.02, radius + 0.02, 0.1, 10, true), colors[1], { position: [0, height + 0.05, 0] }));
  const g = merge(pieces);
  cache.set(key, g);
  return g;
}
