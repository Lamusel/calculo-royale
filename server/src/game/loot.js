import { HEALING, LOOT, LOOT_GROUND, LOOT_IDS, LOOT_ITEMS, MAP_HALF, MAX_HP, THROWABLES, TICK_MS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { AREAS, HOUSES, waterAt } from '@calculo-royale/shared/mapLayout';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { bestTier, countOf, inventoryItems, take } from '@calculo-royale/shared/inventory';

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

// [id, índice del objeto (−1 = caja de botín), x, y, cantidad, contenido de la caja, rareza, dueño temporal]
// El contenido de una caja: [[índice, cantidad], …] (el cliente arma la lista para tomar objeto por objeto)
const encode = (e) => [
  e.id, e.box ? -1 : LOOT_IDS.indexOf(e.item), round2(e.x), round2(e.y), e.box ? e.box.length : countOf(e.item, e.state),
  e.box ? e.box.map((c) => [LOOT_IDS.indexOf(c.item), countOf(c.item, c.state)]) : 0,
  e.box ? bestTier(e.box) : (LOOT_ITEMS[e.item]?.tier ?? 0), e.owner && e.ownerUntil ? e.owner : 0,
];

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

// ¿Lo puede tomar? (lo que no eligió otro de una caja es solo suyo por un rato)
const mayTake = (game, player, e) => !e.owner || e.owner === player.id || game.now >= e.ownerUntil;

// Objeto o caja más cercano al alcance (o null)
export function nearestLoot(game, x, y, player = null) {
  let best = null;
  let bestDist = LOOT.pickupRadius;
  for (const e of game.loot?.values() ?? []) {
    if (player && !mayTake(game, player, e)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best && { entry: best, dist: bestDist };
}

// Lugar válido para dejar algo: dentro del mapa, fuera del agua y sin obstáculos (el más cercano)
function validSpot(x, y) {
  const ok = (px, py) => Math.abs(px) < MAP_HALF - 1 && Math.abs(py) < MAP_HALF - 1 && !waterAt(px, py) && !overlapsObstacle(px, py, 0.4);
  if (ok(x, y)) return { x, y };
  for (let r = 1; r <= 40; r += 1) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const px = Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, x + Math.cos(a) * r));
      const py = Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, y + Math.sin(a) * r));
      if (ok(px, py)) return { x: px, y: py };
    }
  }
  return { x: Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, x)), y: Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, y)) };
}

// Lo que sale del inventario queda alrededor del punto, en un lugar libre. owner: solo para él un rato
export function dropAround(game, x, y, drops, owner = null) {
  const added = drops.map(({ item, state }, i) => {
    let at = null;
    for (let k = 0; k < 8 && !at; k++) {
      const a = ((i + k * 0.37) / Math.max(drops.length, 1)) * Math.PI * 2 + k;
      const p = { x: x + Math.cos(a) * LOOT.dropSpread, y: y + Math.sin(a) * LOOT.dropSpread };
      if (Math.abs(p.x) < MAP_HALF - 1 && Math.abs(p.y) < MAP_HALF - 1 && !waterAt(p.x, p.y) && !overlapsObstacle(p.x, p.y, 0.4)) at = p;
    }
    at ??= validSpot(x, y);
    return add(game, { item, state: state ?? null, ...at, ...(owner ? { owner, ownerUntil: game.now + LOOT.privateMs } : {}) });
  });
  if (added.length) game.room.broadcast?.(EVENTS.LOOT_ADD, added.map(encode));
  return added;
}

// Reemplaza una entrada por otra con el mismo lugar (cambió su contenido o su cantidad)
function replaceEntry(game, entry, changes) {
  game.loot.delete(entry.id);
  game.room.broadcast?.(EVENTS.LOOT_REMOVE, [entry.id]);
  const keep = entry.box ? (changes.box ?? entry.box).length > 0 : countOf(entry.item, changes.state ?? entry.state) > 0;
  if (!keep) return null;
  const { id, ...rest } = entry;
  const next = add(game, { ...rest, ...changes });
  game.room.broadcast?.(EVENTS.LOOT_ADD, [encode(next)]);
  return next;
}

// Toma un objeto (suelto o de una caja). Devuelve { name, need? }
function takeOne(game, player, item, state, replace) {
  const res = take(player, item, state, replace);
  if (res.drops.length) dropAround(game, player.x, player.y, res.drops);
  return res;
}

// Tomar lo que hay en el suelo ("Tomar" o E). opts: { index } un objeto de la caja de botín,
// { all: true } todo lo que quepa, { replace } la ranura de arma que el jugador eligió reemplazar.
// Si es un arma y no hay lugar, avisa con LOOT_TAKEN { need } para que elija.
export function pickUp(game, player, entry, opts = {}) {
  if (!mayTake(game, player, entry)) return [];
  const names = [];
  const items = [];
  const tell = (data) => game.room.emitTo?.(player, EVENTS.LOOT_TAKEN, data);
  if (entry.box) {
    // Sin índice ni "todo": solo abre la lista en el cliente
    if (opts.index === undefined && !opts.all) {
      tell({ box: entry.id });
      return names;
    }
    const box = entry.box.map((c) => ({ ...c }));
    const indices = opts.all ? box.map((_, i) => i) : [Number(opts.index)];
    for (const i of indices) {
      const c = box[i];
      if (!c) continue;
      // "Todo lo que quepa" no reemplaza armas: esas se toman de a una
      const res = takeOne(game, player, c.item, c.state, opts.all ? null : opts.replace ?? null);
      if (res.need) {
        if (!opts.all) tell({ need: res.need, lootId: entry.id, index: i, item: c.item });
        continue;
      }
      if (!res.taken) continue;
      names.push(LOOT_ITEMS[c.item].name);
      items.push(c.item);
      if (res.left > 0) c.state = { ...(c.state ?? {}), n: res.left };
      else c.done = true;
    }
    replaceEntry(game, entry, { box: box.filter((c) => !c.done).map(({ done, ...c }) => c) });
  } else {
    const res = takeOne(game, player, entry.item, entry.state, opts.replace ?? null);
    if (res.need) {
      tell({ need: res.need, lootId: entry.id, item: entry.item });
      return names;
    }
    if (res.taken) {
      names.push(LOOT_ITEMS[entry.item].name);
      items.push(entry.item);
      if (res.left > 0) replaceEntry(game, entry, { state: { ...(entry.state ?? {}), n: res.left } });
      else replaceEntry(game, entry, { state: { ...(entry.state ?? {}), n: 0 } });
    }
  }
  if (!names.length) {
    if (!opts.silent) tell({ full: true, name: entry.box ? 'Caja de botín' : LOOT_ITEMS[entry.item].name });
    return names;
  }
  player.pickups = (player.pickups ?? 0) + names.length;
  tell({ names, items });
  return names;
}

// Caja de botín con todo el inventario del caído (solo en partida). Si cayó al agua o fuera del mapa,
// aparece en el punto válido más cercano.
export function deathBox(game, player) {
  if (!LOOT.deathBox || !game.loot) return null;
  const contents = inventoryItems(player);
  if (!contents.length) return null;
  const at = validSpot(player.x, player.y);
  const box = add(game, { box: contents, ...at });
  game.room.broadcast?.(EVENTS.LOOT_ADD, [encode(box)]);
  return box;
}

// --- Curación con tiempo ---
export function useItem(game, player, item) {
  const heal = HEALING[item];
  if (!heal || !player.alive || player.downed || player.deploying || player.question || player.engineQuestion || player.healing) return false;
  if ((player.heals?.[item] ?? 0) <= 0) return false;
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
      if (p.heals[item] > 0) {
        p.heals[item] -= 1;
        if (item === 'drink') p.drinkUntil = game.now + HEALING.drink.durationMs;
        else p.hp = Math.min(MAX_HP, p.hp + HEALING[item].heal);
      }
    }
    if (p.drinkUntil > game.now) p.hp = Math.min(MAX_HP, p.hp + (HEALING.drink.heal / HEALING.drink.durationMs) * TICK_MS);
    p.speedFactor = (p.healing ? HEALING.moveFactor : p.drinkUntil > game.now ? HEALING.drink.speedBoost : 1) * (p.flashUntil > game.now ? THROWABLES.flash.slow : 1) * (p.downed ? 0.25 : 1) * (p.reviving ? 0 : 1);
  }
}

