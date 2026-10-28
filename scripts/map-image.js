// Dibuja el plano del mapa visto desde arriba en docs/mapa.svg y, si hay Edge o Chrome,
// lo convierte en docs/mapa.png (fuera del bundle). Uso: npm run map:image
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MAP_HALF, MAP_SIZE, SECTORS } from '@calculo-royale/shared/constants';
import {
  AREAS, BRIDGES, DAM, DOCKS, FIELDS, FORD, HOUSES, MOUNTAINS, OBSTACLES, PARKING, PATHS, PLATFORMS, RAILWAY, RESERVOIR, RIVER, ROADS, RUNWAY,
  SUPPLY_CRATES, TOWERS, ZIPLINES, riverY,
} from '@calculo-royale/shared/mapLayout';

const PX = 1.4; // píxeles por metro
const PAD = 40;
const size = MAP_SIZE * PX + PAD * 2;
const X = (x) => ((x + MAP_HALF) * PX + PAD).toFixed(1);
const Y = (y) => ((MAP_HALF - y) * PX + PAD).toFixed(1);
const line = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)},${Y(y)}`).join('');
const rect = (r, fill, extra = '') => `<rect x="${X(r.x - r.w / 2)}" y="${Y(r.y + r.h / 2)}" width="${(r.w * PX).toFixed(1)}" height="${(r.h * PX).toFixed(1)}" fill="${fill}" ${extra}/>`;

const out = [];
out.push(`<rect width="${size}" height="${size}" fill="#2b3424"/>`);
out.push(rect({ x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE }, '#6f8b45'));
// Montañas: anillos de altura
for (const m of MOUNTAINS) for (let k = 3; k >= 1; k--) out.push(`<circle cx="${X(m.x)}" cy="${Y(m.y)}" r="${(m.sigma * k * 0.8 * PX).toFixed(1)}" fill="#8a8150" opacity="${0.25 + (3 - k) * 0.12}"/>`);
for (const f of FIELDS) out.push(rect(f, '#b3a35a', 'opacity="0.8"'));
// Río y embalse
const riverPts = [];
for (let x = DAM.x; x <= MAP_HALF; x += 5) riverPts.push([x, riverY(x)]);
out.push(`<path d="${line(riverPts)}" stroke="#2a8bb5" stroke-width="${(RIVER.halfWidth * 2 * PX).toFixed(1)}" fill="none"/>`);
out.push(`<ellipse cx="${X(RESERVOIR.x)}" cy="${Y(RESERVOIR.y)}" rx="${RESERVOIR.rx * PX}" ry="${RESERVOIR.ry * PX}" fill="#2a8bb5"/>`);
out.push(rect(FORD, '#5fc2c4'));
// Vía del tren, carreteras y caminos
out.push(`<path d="${line([[RAILWAY.x0, RAILWAY.y], [RAILWAY.x1, RAILWAY.y]])}" stroke="#4a3b2c" stroke-width="4" stroke-dasharray="2 3" fill="none"/>`);
for (const p of PATHS) out.push(`<path d="${line(p)}" stroke="#b39466" stroke-width="2.5" fill="none"/>`);
for (const r of ROADS) out.push(`<path d="${line(r)}" stroke="#9b8357" stroke-width="${12 * PX}" fill="none" stroke-linejoin="round"/>`);
for (const r of ROADS) out.push(`<path d="${line(r)}" stroke="#3b3c39" stroke-width="${8.5 * PX}" fill="none" stroke-linejoin="round"/>`);
for (const r of ROADS) out.push(`<path d="${line(r)}" stroke="#e2b53a" stroke-width="1" stroke-dasharray="4 4" fill="none"/>`);
out.push(rect(RUNWAY, '#44453f'));
for (const b of BRIDGES) out.push(rect(b, '#c9c2b0', 'stroke="#222" stroke-width="1"'));
out.push(rect(DAM, '#d8d5cc', 'stroke="#222" stroke-width="1"'));
// Zonas con nombre (borde según tamaño)
const COLORS = { big: '#e05b3a', mid: '#e8b23a', small: '#9fd06a' };
for (const a of Object.values(AREAS)) if (a.name) out.push(rect(a, 'none', `stroke="${COLORS[a.size]}" stroke-width="2" stroke-dasharray="6 4"`));
// Árboles, rocas y demás obstáculos
for (const o of OBSTACLES) {
  if (o.kind === 'tree') out.push(`<circle cx="${X(o.x)}" cy="${Y(o.y)}" r="1.8" fill="#2f4a1f"/>`);
  else if (o.kind === 'rock') out.push(`<circle cx="${X(o.x)}" cy="${Y(o.y)}" r="1.4" fill="#8d8a80"/>`);
  else if (!['wall', 'furniture'].includes(o.kind)) out.push(rect(o.shape === 'circle' ? { x: o.x, y: o.y, w: o.r * 2, h: o.r * 2 } : o, '#5d5a50'));
}
for (const h of HOUSES) out.push(rect(h, h.floors > 1 ? '#a08060' : '#c7b38e', 'stroke="#3a2e22" stroke-width="0.8"'));
for (const c of SUPPLY_CRATES) out.push(`<circle cx="${X(c.x)}" cy="${Y(c.y)}" r="1.6" fill="${['#ccc', '#3b82f6', '#a855f7', '#eab308'][c.rarity]}"/>`);
for (const t of TOWERS) out.push(`<rect x="${X(t.x) - 3}" y="${Y(t.y) - 3}" width="6" height="6" fill="#222"/>`);
// Puntos marcados para la parte 6.4
for (const p of PARKING) out.push(`<text x="${X(p.x)}" y="${Y(p.y)}" font-size="11" text-anchor="middle" fill="#fff">P</text>`);
for (const d of DOCKS) out.push(`<text x="${X(d.x)}" y="${Y(d.y)}" font-size="11" text-anchor="middle" fill="#fff">⚓</text>`);
for (const p of PLATFORMS) out.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="none" stroke="#ff4fd8" stroke-width="2"/>`);
for (const z of ZIPLINES) out.push(`<path d="${line([z.from, z.to])}" stroke="#ff4fd8" stroke-width="1.5" stroke-dasharray="5 3"/>`);
// Cuadrícula 10×10
const cell = (MAP_SIZE / SECTORS) * PX;
for (let i = 0; i <= SECTORS; i++) {
  const t = PAD + i * cell;
  out.push(`<line x1="${t}" y1="${PAD}" x2="${t}" y2="${size - PAD}" stroke="#000" stroke-opacity="0.35"/>`);
  out.push(`<line x1="${PAD}" y1="${t}" x2="${size - PAD}" y2="${t}" stroke="#000" stroke-opacity="0.35"/>`);
  if (i < SECTORS) {
    out.push(`<text x="${t + cell / 2}" y="${PAD - 12}" font-size="18" text-anchor="middle" fill="#eee">${String.fromCharCode(65 + i)}</text>`);
    out.push(`<text x="${PAD - 18}" y="${t + cell / 2 + 6}" font-size="18" text-anchor="middle" fill="#eee">${i + 1}</text>`);
  }
}
for (const a of Object.values(AREAS)) {
  if (!a.name) continue;
  const fs2 = a.size === 'big' ? 16 : a.size === 'mid' ? 13 : 11;
  out.push(`<text x="${X(a.x)}" y="${Y(a.y + a.h / 2) - 4}" font-size="${fs2}" font-weight="bold" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${a.name}</text>`);
}
out.push(`<text x="${PAD}" y="${size - 12}" font-size="13" fill="#ddd">Cálculo Royale · 1 km × 1 km · zonas: rojo grande, ámbar mediana, verde pequeña · P estacionamiento · ⚓ muelle · rosa: tirolinas y plataformas</text>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" font-family="Segoe UI, Arial, sans-serif">${out.join('')}</svg>`;
const dir = path.resolve('docs');
fs.mkdirSync(dir, { recursive: true });
const svgPath = path.join(dir, 'mapa.svg');
fs.writeFileSync(svgPath, svg);
console.log('Plano en', svgPath);

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const browser = browsers.find((b) => fs.existsSync(b));
if (browser) {
  const png = path.join(dir, 'mapa.png');
  execFileSync(browser, ['--headless', '--disable-gpu', '--hide-scrollbars', `--window-size=${size},${size}`, `--screenshot=${png}`, pathToFileURL(svgPath).href], { stdio: 'ignore' });
  console.log('Imagen en', png);
} else console.log('Sin Edge ni Chrome: abre docs/mapa.svg en el navegador');
