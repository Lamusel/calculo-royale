import { MAP_HALF, MAP_SIZE, SECTORS } from './constants.js';

// Geometría de la zona segura, compartida: el servidor decide el daño y el cliente dibuja.
// Una zona es { cx, cy, p, q }: la región (x − cx)²/p² + (y − cy)²/q² ≤ 1.

export function insideZone(z, x, y) {
  const dx = (x - z.cx) / z.p;
  const dy = (y - z.cy) / z.q;
  return dx * dx + dy * dy <= 1;
}

export function lerpZone(a, b, t) {
  const l = (u, v) => u + (v - u) * t;
  return { cx: l(a.cx, b.cx), cy: l(a.cy, b.cy), p: l(a.p, b.p), q: l(a.q, b.q) };
}

// "(x − 12)²", "(y + 5)²" o "x²" en LaTeX
function shifted(v, c) {
  if (c === 0) return `${v}^2`;
  return `(${v} ${c > 0 ? '-' : '+'} ${Math.abs(c)})^2`;
}

// Desigualdad de la zona en LaTeX, como la anuncia el mando
export function zoneInequality(z) {
  const x = shifted('x', z.cx);
  const y = shifted('y', z.cy);
  if (z.p === z.q) return `${x} + ${y} \\le ${z.p * z.p}`;
  return `\\frac{${x}}{${z.p * z.p}} + \\frac{${y}}{${z.q * z.q}} \\le 1`;
}

// Sector militar de un punto: columnas A–H a lo largo de x, filas 1–8 de norte a sur
const SECTOR_SIZE = MAP_SIZE / SECTORS;
export function sectorOf(x, y) {
  const col = Math.min(SECTORS - 1, Math.max(0, Math.floor((x + MAP_HALF) / SECTOR_SIZE)));
  const row = Math.min(SECTORS - 1, Math.max(0, Math.floor((MAP_HALF - y) / SECTOR_SIZE)));
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

// Centro y límites de un sector ("C3")
export function sectorBounds(name) {
  const col = name.charCodeAt(0) - 65;
  const row = Number(name.slice(1)) - 1;
  const minX = -MAP_HALF + col * SECTOR_SIZE;
  const maxY = MAP_HALF - row * SECTOR_SIZE;
  return { minX, maxX: minX + SECTOR_SIZE, minY: maxY - SECTOR_SIZE, maxY, cx: minX + SECTOR_SIZE / 2, cy: maxY - SECTOR_SIZE / 2 };
}

export const ALL_SECTORS = Array.from({ length: SECTORS * SECTORS }, (_, i) =>
  `${String.fromCharCode(65 + (i % SECTORS))}${Math.floor(i / SECTORS) + 1}`,
);
