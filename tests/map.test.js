// Mapa (npm test): obstáculos sin superposiciones, cajas y jeeps libres, se puede salir de cada
// edificio, zona a escala y rejilla de colisiones equivalente a la búsqueda completa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_HALF, PLAYER_RADIUS, ZONE_PHASES, ZONE_START } from '@calculo-royale/shared/constants';
import { overlapsObstacle, raycastObstacles } from '@calculo-royale/shared/collision';
import { AREAS, FURNITURE, HOUSES, OBSTACLES, strategicSpot, SUPPLY_CRATES, TRAINING, VEHICLE_SPOTS } from '@calculo-royale/shared/mapLayout';
import { JEEP } from '@calculo-royale/shared/constants';

const boxOf = (o) =>
  o.shape === 'rect' ? { minX: o.x - o.w / 2, maxX: o.x + o.w / 2, minY: o.y - o.h / 2, maxY: o.y + o.h / 2 } : { minX: o.x - o.r, maxX: o.x + o.r, minY: o.y - o.r, maxY: o.y + o.r };
const EPS = 0.02;
const overlap = (a, b) => a.minX < b.maxX - EPS && a.maxX > b.minX + EPS && a.minY < b.maxY - EPS && a.maxY > b.minY + EPS;

test('el mapa cabe en sus límites y es ~2,5 veces el original', () => {
  assert.ok((MAP_HALF * 2) ** 2 / 120 ** 2 > 2.4);
  for (const o of OBSTACLES) {
    const b = boxOf(o);
    assert.ok(b.minX >= -MAP_HALF && b.maxX <= MAP_HALF && b.minY >= -MAP_HALF && b.maxY <= MAP_HALF, `${o.kind} en (${o.x}, ${o.y})`);
  }
});

test('muebles, cajas, árboles y utilería no se meten en las paredes ni entre sí', () => {
  const solids = OBSTACLES.filter((o) => o.kind !== 'wall' && o.kind !== 'fence');
  const walls = OBSTACLES.filter((o) => o.kind === 'wall');
  for (const o of solids) {
    for (const w of walls) assert.ok(!overlap(boxOf(o), boxOf(w)), `${o.kind}${o.item ? `/${o.item}` : ''} (${o.x.toFixed(1)}, ${o.y.toFixed(1)}) atraviesa una pared`);
  }
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      if (a.kind === 'sandbag' && b.kind === 'sandbag') continue; // los sacos se unen en las esquinas
      assert.ok(!overlap(boxOf(a), boxOf(b)), `${a.kind} (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) y ${b.kind} (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) se superponen`);
    }
  }
});

test('cajas de suministro, jeeps y el campo de entrenamiento están en lugares libres', () => {
  for (const c of SUPPLY_CRATES) assert.ok(!overlapsObstacle(c.x, c.y, PLAYER_RADIUS), `caja en (${c.x}, ${c.y})`);
  for (const v of VEHICLE_SPOTS) assert.ok(!overlapsObstacle(v.x, v.y, JEEP.radius + 0.2), `jeep en (${v.x}, ${v.y})`);
  for (const p of [...TRAINING.racks, ...TRAINING.dummies, TRAINING.crate]) assert.ok(!overlapsObstacle(p.x, p.y, 0.8));
});

// Inundación en una cuadrícula de 0,25 m con el radio del jugador: ¿se llega al exterior?
function canLeave(x, y, house) {
  const step = 0.25;
  const out = (px, py) => Math.abs(px - house.x) > house.w / 2 + 1.5 || Math.abs(py - house.y) > house.h / 2 + 1.5;
  const seen = new Set();
  const queue = [[Math.round(x / step), Math.round(y / step)]];
  while (queue.length) {
    const [i, j] = queue.shift();
    const k = `${i},${j}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const px = i * step;
    const py = j * step;
    if (out(px, py)) return true;
    if (seen.size > 20000) return false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = (i + di) * step;
      const ny = (j + dj) * step;
      if (!overlapsObstacle(nx, ny, PLAYER_RADIUS * 0.95)) queue.push([i + di, j + dj]);
    }
  }
  return false;
}

test('desde cada caja dentro de un edificio se puede salir por la puerta', () => {
  const inside = (c, h) => Math.abs(c.x - h.x) < h.w / 2 && Math.abs(c.y - h.y) < h.h / 2;
  let checked = 0;
  for (const c of SUPPLY_CRATES) {
    const h = HOUSES.find((house) => inside(c, house));
    if (!h) continue;
    checked++;
    assert.ok(canLeave(c.x, c.y, h), `atrapado en la caja (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) de ${h.type}`);
  }
  assert.ok(checked >= HOUSES.length, 'cada edificio tiene al menos una caja');
});

test('las casas tienen muebles y algunas varios cuartos; hay árboles en el bosque y sacos en las trincheras', () => {
  assert.ok(HOUSES.filter((h) => h.rooms > 1).length >= 3);
  const kinds = new Set(FURNITURE.map((f) => f.kind));
  for (const k of ['sofa', 'bed', 'table', 'shelf', 'fridge', 'counter', 'painting', 'rug', 'bunk', 'rack']) assert.ok(kinds.has(k), k);
  const inArea = (o, a) => Math.abs(o.x - a.x) < a.w / 2 && Math.abs(o.y - a.y) < a.h / 2;
  assert.ok(OBSTACLES.filter((o) => o.kind === 'tree' && inArea(o, AREAS.forest)).length > 100);
  assert.ok(OBSTACLES.filter((o) => o.kind === 'sandbag' && inArea(o, AREAS.trenches)).length >= 10);
});

test('zona a escala: la primera cubre casi todo el mapa y la zona dura ~9 a 11 minutos (partida de 10–12 con despliegue y duelo)', () => {
  assert.ok(ZONE_START.p >= MAP_HALF * Math.SQRT2);
  assert.ok(ZONE_PHASES[0].radius >= MAP_HALF * 0.9);
  const total = ZONE_PHASES.reduce((t, p) => t + p.waitMs + p.shrinkMs, 0) / 60000;
  assert.ok(total >= 9 && total <= 11, `${total} min`);
});

// Búsqueda completa (sin rejilla) para comparar
function bruteOverlap(x, y, r) {
  return OBSTACLES.some((o) => {
    if (o.shape === 'circle') return Math.hypot(x - o.x, y - o.y) < r + o.r;
    const b = boxOf(o);
    const dx = x - Math.max(b.minX, Math.min(b.maxX, x));
    const dy = y - Math.max(b.minY, Math.min(b.maxY, y));
    return dx * dx + dy * dy < r * r;
  });
}

test('la rejilla de colisiones da lo mismo que revisar todos los obstáculos', () => {
  let s = 99;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 4000; i++) {
    const x = (rand() * 2 - 1) * MAP_HALF;
    const y = (rand() * 2 - 1) * MAP_HALF;
    const r = 0.2 + rand() * 2;
    assert.equal(overlapsObstacle(x, y, r), bruteOverlap(x, y, r), `(${x}, ${y}, ${r})`);
  }
  // Rayos largos (francotirador): la distancia coincide con avanzar en pasos pequeños
  for (let i = 0; i < 200; i++) {
    const x = (rand() * 2 - 1) * (MAP_HALF - 5);
    const y = (rand() * 2 - 1) * (MAP_HALF - 5);
    const a = rand() * Math.PI * 2;
    const d = raycastObstacles(x, y, Math.cos(a), Math.sin(a), 55);
    if (bruteOverlap(x, y, 1e-6)) continue;
    let t = 0;
    while (t < 55 && !bruteOverlap(x + Math.cos(a) * t, y + Math.sin(a) * t, 1e-6)) t += 0.05;
    // Un rayo que roza justo una esquina: los pasos de 5 cm no lo ven, pero ahí hay un obstáculo
    const grazes = d < 55 && bruteOverlap(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.02);
    assert.ok(Math.abs(Math.min(t, 55) - d) < 0.08 || grazes, `rayo desde (${x.toFixed(1)}, ${y.toFixed(1)}): ${d} vs ${t}`);
  }
});

test('cajas por partida: las calientes siempre, todas en lugares estratégicos (nunca en campo abierto) y cambian entre partidas', async () => {
  const { createCrates, pickMatchCrates, crateVisible } = await import('../server/src/game/crates.js');
  const runs = [];
  for (let seed = 1; seed <= 30; seed++) {
    let s = seed * 7919;
    const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const game = { crates: createCrates() };
    pickMatchCrates(game, rand);
    const active = game.crates.filter((c) => crateVisible(c, 'playing') && !c.airdrop && !c.practice);
    assert.ok(active.filter((c) => c.tag === 'hot').length === SUPPLY_CRATES.filter((c) => c.tag === 'hot').length, 'todas las calientes');
    // Fase 23: cada caja de la partida dentro de un edificio o de un punto de interés
    for (const c of active) assert.ok(strategicSpot(c.x, c.y), `caja en campo abierto en (${c.x}, ${c.y})`);
    assert.equal(active.some((c) => c.tag === 'open'), false);
    // Desde la fase 18 las cajas son de raro en adelante (lo común está en el suelo)
    for (const c of active) assert.ok(c.rarity >= 1, 'ninguna caja común en partida');
    runs.push(active.map((c) => c.id).join(','));
  }
  assert.ok(new Set(runs).size > 25, 'cada partida tiene otras cajas');
  // Las de mayor rareza están en los lugares disputados
  for (const c of SUPPLY_CRATES.filter((x) => x.rarity === 3)) assert.equal(c.tag, 'hot');
});

test('todos los puntos posibles de cajas están en un edificio o un punto de interés (ninguno en el bosque ni en campo abierto)', () => {
  for (const c of SUPPLY_CRATES) {
    assert.ok(strategicSpot(c.x, c.y), `caja en (${c.x}, ${c.y}) fuera de lugares estratégicos`);
    const inForest = Math.abs(c.x - AREAS.forest.x) < AREAS.forest.w / 2 && Math.abs(c.y - AREAS.forest.y) < AREAS.forest.h / 2;
    const inHouse = HOUSES.some((h) => Math.abs(c.x - h.x) <= h.w / 2 && Math.abs(c.y - h.y) <= h.h / 2);
    assert.ok(!inForest || inHouse, 'en el bosque solo dentro de la cabaña');
  }
  // Un punto de campo abierto no cuenta
  assert.equal(strategicSpot(20, 30), false);
});
