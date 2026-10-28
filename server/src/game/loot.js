import { HEALING, LOOT, LOOT_GROUND, LOOT_IDS, LOOT_ITEMS, MAP_HALF, MAX_HP, TICK_MS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { AREAS, HOUSES, waterAt } from '@calculo-royale/shared/mapLayout';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { counterOf, inventoryItems, take, wants } from '@calculo-royale/shared/inventory';

// Botín en el suelo (fase 18): objetos sueltos por partida, tomar y soltar, caja de botín al
// caer y curación con tiempo. Todo lo decide el servidor; el cliente solo dibuja y pide.

const round2 = (v) => Math.round(v * 100) / 100;

function weighted(pool, rand) {
  const total = pool.reduce((t, id) => t + (LOOT.weights[id] ?? 1), 0);
  let r = rand() * total;
  for (const id of pool) {
    r -= LOOT.weights[id] ?? 1;
    if (r <= 0) return id;
  }
  return pool[pool.length - 1];
}

// Un objeto del suelo: solo munición, vendas o casco 1 (LOOT_GROUND); el resto sale de cajas con pregunta
export const rollGroundItem = (rand = Math.random) => weighted(LOOT_GROUND, rand);

// Punto libre dentro de un rectángulo (o null si no se encontró)
function freeSpot(rand, cx, cy, w, h) {
  for (let i = 0; i < 20; i++) {
    const x = cx + (rand() - 0.5) * w;
    const y = cy + (rand() - 0.5) * h;
    if (Math.abs(x) > MAP_HALF - 3 || Math.abs(y) > MAP_HALF - 3) continue;
    if (!waterAt(x, y) && !overlapsObstacle(x, y, 0.6)) return { x, y };
  }
  return null;
}

// Puntos de botín de esta partida: dentro de cada casa, en cada zona con nombre y sueltos
export function groundSpots(rand) {
  const spots = [];
  for (const h of HOUSES) {
    for (let i = 0; i < LOOT.perHouseRoom * (h.rooms ?? 1); i++) {
      const p = freeSpot(rand, h.x, h.y, h.w - 1.6, h.h - 1.6);
      if (p) spots.push(p);
    }
  }
  for (const a of Object.values(AREAS)) {
    if (!a.name) continue;
    for (let i = 0; i < (LOOT.perArea[a.size] ?? 6); i++) {
      const p = freeSpot(rand, a.x, a.y, a.w, a.h);
      if (p) spots.push(p);
    }
  }
  for (let i = 0; i < LOOT.scattered; i++) {
    const p = freeSpot(rand, 0, 0, MAP_HALF * 2 - 8, MAP_HALF * 2 - 8);
    if (p) spots.push(p);
  }
  return spots;
}

// [id, índice del objeto (−1 = caja de botín), x, y, cantidad]
const encode = (e) => [e.id, e.box ? -1 : LOOT_IDS.indexOf(e.item), round2(e.x), round2(e.y), e.box ? e.box.length : 1];

function add(game, entry) {
  const e = { id: game.nextLootId++, ...entry };
  game.loot.set(e.id, e);
  return e;
}

// Al iniciar la partida (lo pide la sala con la misma semilla que las cajas)
export function spawnGroundLoot(game, rand = Math.random) {
  clearLoot(game);
  for (const { x, y } of groundSpots(rand)) add(game, { item: rollGroundItem(rand), state: null, x, y });
  game.room.broadcast?.(EVENTS.LOOT_SYNC, encodeAll(game));
}

export function clearLoot(game) {
  game.loot = new Map();
  game.nextLootId = 1;
}

export const encodeAll = (game) => [...(game.loot ?? new Map()).values()].map(encode);

// Al reconectar o entrar a mitad de partida
export function syncLoot(game, player) {
  game.room.emitTo?.(player, EVENTS.LOOT_SYNC, encodeAll(game));
}

// Objeto o caja más cercano al alcance (o null)
export function nearestLoot(game, x, y) {
  let best = null;
  let bestDist = LOOT.pickupRadius;
  for (const e of game.loot?.values() ?? []) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best && { entry: best, dist: bestDist };
}

// Lo que sale del inventario queda alrededor del jugador, en un lugar libre
export function dropAround(game, x, y, drops) {
  const added = drops.map(({ item, state }, i) => {
    let at = { x, y };
    for (let k = 0; k < 8; k++) {
      const a = ((i + k * 0.37) / Math.max(drops.length, 1)) * Math.PI * 2 + k;
      const p = { x: x + Math.cos(a) * LOOT.dropSpread, y: y + Math.sin(a) * LOOT.dropSpread };
      if (Math.abs(p.x) < MAP_HALF - 1 && Math.abs(p.y) < MAP_HALF - 1 && !overlapsObstacle(p.x, p.y, 0.4)) {
        at = p;
        break;
      }
    }
    return add(game, { item, state: state ?? null, ...at });
  });
  if (added.length) game.room.broadcast?.(EVENTS.LOOT_ADD, added.map(encode));
  return added;
}

// En una caja de botín, un arma distinta a la propia no reemplaza la que ya tiene
const takesFromBox = (player, { item }) => LOOT_ITEMS[item].kind !== 'weapon' || !player.primary || player.primary.id === item;

// Tomar lo que hay en el suelo (E o "Tomar"). Devuelve los nombres de lo que tomó.
export function pickUp(game, player, entry) {
  const names = [];
  const items = [];
  const drops = [];
  if (entry.box) {
    entry.box = entry.box.filter((content) => {
      if (!takesFromBox(player, content) || !wants(player, content.item)) return true;
      drops.push(...take(player, content.item, content.state));
      names.push(LOOT_ITEMS[content.item].name);
      items.push(content.item);
      return false;
    });
  } else if (wants(player, entry.item)) {
    drops.push(...take(player, entry.item, entry.state));
    names.push(LOOT_ITEMS[entry.item].name);
    items.push(entry.item);
  }
  if (!names.length) {
    game.room.emitTo?.(player, EVENTS.LOOT_TAKEN, { full: true, name: entry.box ? 'Caja de botín' : LOOT_ITEMS[entry.item].name });
    return names;
  }
  game.loot.delete(entry.id);
  game.room.broadcast?.(EVENTS.LOOT_REMOVE, [entry.id]);
  // La caja con cosas que no le sirvieron sigue ahí (con otro id, para que todos la actualicen)
  if (entry.box?.length) {
    const rest = add(game, { box: entry.box, x: entry.x, y: entry.y });
    game.room.broadcast?.(EVENTS.LOOT_ADD, [encode(rest)]);
  }
  dropAround(game, player.x, player.y, drops);
  player.pickups = (player.pickups ?? 0) + names.length;
  game.room.emitTo?.(player, EVENTS.LOOT_TAKEN, { names, items });
  return names;
}

// Caja de botín con todo lo del caído (solo en partida)
export function deathBox(game, player) {
  if (!LOOT.deathBox || !game.loot) return null;
  const contents = inventoryItems(player);
  if (!contents.length) return null;
  const box = add(game, { box: contents, x: player.x, y: player.y });
  game.room.broadcast?.(EVENTS.LOOT_ADD, [encode(box)]);
  return box;
}

// --- Curación con tiempo ---
export function useItem(game, player, item) {
  const heal = HEALING[item];
  if (!heal || !player.alive || player.deploying || player.question || player.engineQuestion || player.healing) return false;
  const counter = counterOf(item);
  if (!counter || player[counter] <= 0) return false;
  if (item === 'drink') {
    if (player.drinkUntil > game.now) return false;
  } else if (player.hp >= MAX_HP) {
    return false;
  }
  player.healing = { item, startedAt: game.now, until: game.now + heal.useMs };
  player.reloadUntil = 0;
  return true;
}

export function cancelHealing(player) {
  player.healing = null;
}

// Cada tick: termina las curaciones, la bebida suma vida de a poco y se ajusta la velocidad
export function updateHealing(game) {
  for (const p of game.room.players.values()) {
    if (!p.alive) {
      p.healing = null;
      p.drinkUntil = 0;
      p.speedFactor = 1;
      continue;
    }
    if (p.healing && game.now >= p.healing.until) {
      const { item } = p.healing;
      p.healing = null;
      const counter = counterOf(item);
      if (p[counter] > 0) {
        p[counter] -= 1;
        if (item === 'drink') p.drinkUntil = game.now + HEALING.drink.durationMs;
        else p.hp = Math.min(MAX_HP, p.hp + HEALING[item].heal);
      }
    }
    if (p.drinkUntil > game.now) p.hp = Math.min(MAX_HP, p.hp + (HEALING.drink.heal / HEALING.drink.durationMs) * TICK_MS);
    p.speedFactor = p.healing ? HEALING.moveFactor : p.drinkUntil > game.now ? HEALING.drink.speedBoost : 1;
  }
}

