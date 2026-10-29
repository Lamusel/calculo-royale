import {
  ARMOR_ABSORB, ATTACHMENTS, BACKPACK, LOOT_ITEMS, START_BULLETS, START_WEAPON, THROWABLE_IDS, THROWABLES, WEAPON_CATEGORIES, WEAPONS,
} from './constants.js';

// Inventario de battle royale (fase 29). Funciones puras sobre el jugador del servidor; el cliente
// las usa solo para mostrar. El servidor decide siempre.
//   weapons: [principal 1, principal 2, secundaria] — cada una { id, mag, att } o null
//   active: índice del arma en mano · ammo: { tipo: n } · heals: { venda, botiquín, bebida }
//   throwables: { frag, smoke, … } · throwSel: lanzable elegido · loose: accesorios sueltos
// Nada se cambia sin que el jugador lo decida: si no hay lugar para un arma, take() lo pregunta.

const SCOPE_TIER = { reddot: 0, scope2x: 1, scope4x: 2 };
export const SECONDARY = 2;

export const noAttachments = () => ({ scope: null, mag: null, stock: null, muzzle: null });
export const newWeapon = (id, mag = null, att = null) => ({ id, mag: mag ?? WEAPONS[id].magazine, att: att ? { ...att } : noAttachments() });

// Inventario vacío y el de arranque: la M1911 con solo 3 balas
export function emptyInventory(p) {
  p.weapons = [null, null, null];
  p.melee = null; // arma blanca (ranura propia, 7A); sin ella, los puños
  p.active = SECONDARY;
  p.ammo = {};
  p.heals = { bandage: 0, medkit: 0, drink: 0 };
  p.throwables = Object.fromEntries(THROWABLE_IDS.map((id) => [id, 0]));
  p.throwSel = 'frag';
  p.loose = [];
}
export function startingKit(p) {
  emptyInventory(p);
  p.weapons[SECONDARY] = newWeapon(START_WEAPON, START_BULLETS);
}

// Cargador del arma con sus accesorios
export function magazineOf(weaponId, att) {
  const base = WEAPONS[weaponId].magazine;
  return att?.mag === 'extmag' ? Math.round(base * ATTACHMENTS.extmag) : base;
}

// Arma con la dispersión ajustada por culata, punto rojo y retroceso acumulado (el resto igual).
// recoil: 0 en el primer disparo; disparando seguido sube (ver RECOIL y combat.js).
export function weaponWith(weaponId, att, recoil = 0) {
  const w = WEAPONS[weaponId];
  let spread = w.spread;
  if (att?.stock === 'stock') spread *= ATTACHMENTS.stock;
  if (att?.scope === 'reddot') spread *= ATTACHMENTS.reddot;
  // La escopeta abre su abanico fijo: el retroceso no lo ensancha
  if (w.pellets === 1) spread *= 1 + recoil;
  return spread === w.spread ? w : { ...w, spread };
}

// ¿Este accesorio va en esta arma? (pistolas: solo punto rojo; francotiradores: solo 2x y 4x)
export function attachmentFits(weaponId, attId) {
  const def = LOOT_ITEMS[attId];
  const w = WEAPONS[weaponId];
  if (!def || !w || !WEAPON_CATEGORIES[w.category].slots.includes(def.slot)) return false;
  if (def.slot === 'scope' && w.category === 'pistol') return attId === 'reddot';
  if (def.slot === 'scope' && w.category === 'sniper') return attId !== 'reddot';
  return true;
}

export const ammoCap = (p, type) => BACKPACK[p.backpackLevel ?? 0].ammo[type] ?? 0;
export const healCap = (p, item) => BACKPACK[p.backpackLevel ?? 0][item];
const throwTotal = (p) => THROWABLE_IDS.reduce((n, id) => n + (p.throwables[id] ?? 0), 0);
export const throwableRoom = (p, id) => Math.max(0, Math.min(THROWABLES[id].max - (p.throwables[id] ?? 0), BACKPACK[p.backpackLevel ?? 0].throwables - throwTotal(p)));
export const looseCap = (p) => BACKPACK[p.backpackLevel ?? 0].loose;

const isSecondary = (id) => Boolean(WEAPON_CATEGORIES[WEAPONS[id].category].secondary);

// Ranuras donde puede ir un arma: secundarias (pistolas) a la 3; principales a la 1 o la 2
export const slotsFor = (id) => (isSecondary(id) ? [SECONDARY] : [0, 1]);
// Ranura libre para el arma (los puños cuentan como libre), o -1 si hay que elegir cuál reemplazar
export function freeSlot(p, id) {
  return slotsFor(id).find((i) => !p.weapons[i] || p.weapons[i].id === 'fists') ?? -1;
}

// ¿Cuántos caben? (munición en balas; el resto en unidades). 0 = no le sirve o no le cabe
export function roomFor(p, item) {
  const def = LOOT_ITEMS[item];
  if (!def) return 0;
  switch (def.kind) {
    case 'weapon':
    case 'melee':
      return 1;
    case 'ammo':
      return Math.max(0, ammoCap(p, def.ammo) - (p.ammo[def.ammo] ?? 0));
    case 'heal':
      return Math.max(0, healCap(p, item) - (p.heals[item] ?? 0));
    case 'throwable':
      return throwableRoom(p, item);
    case 'armor':
      return def.level > p.armorLevel || (def.level === p.armorLevel && p.armor < ARMOR_ABSORB[def.level]) ? 1 : 0;
    case 'helmet':
      return def.level > p.helmetLevel ? 1 : 0;
    case 'backpack':
      return def.level > p.backpackLevel ? 1 : 0;
    case 'attachment':
      return attachTarget(p, item) !== null || p.loose.length < looseCap(p) ? 1 : 0;
    default:
      return 0;
  }
}

// Arma equipada donde se coloca solo el accesorio (la de la mano primero), o null
function attachTarget(p, attId) {
  const slot = LOOT_ITEMS[attId].slot;
  const order = [p.active, 0, 1, SECONDARY].filter((v, i, a) => a.indexOf(v) === i);
  for (const i of order) {
    const w = p.weapons[i];
    if (!w || !attachmentFits(w.id, attId)) continue;
    const current = w.att[slot];
    if (!current || (slot === 'scope' && SCOPE_TIER[attId] > SCOPE_TIER[current])) return i;
  }
  return null;
}

// Cantidad que trae una entrada del suelo o de una caja
export const countOf = (item, state) => state?.n ?? (LOOT_ITEMS[item]?.kind === 'ammo' ? LOOT_ITEMS[item].amount : 1);

// Toma un objeto. Devuelve { taken (cantidad tomada), left (lo que no cupo), drops: [{ item, state }]
// (lo que sale del inventario), need: [ranuras] si es un arma y hay que elegir cuál reemplazar }.
// replace: ranura que el jugador eligió reemplazar.
export function take(p, item, state = null, replace = null) {
  const def = LOOT_ITEMS[item];
  const n = countOf(item, state);
  const out = { taken: 0, left: n, drops: [] };
  if (!def) return out;
  switch (def.kind) {
    case 'weapon': {
      let slot = freeSlot(p, item);
      if (slot < 0) {
        if (replace === null || !slotsFor(item).includes(replace)) return { ...out, need: slotsFor(item) };
        slot = replace;
      }
      const old = p.weapons[slot];
      if (old && old.id !== 'fists') out.drops.push({ item: old.id, state: { mag: old.mag, att: old.att } });
      p.weapons[slot] = newWeapon(item, state?.mag ?? WEAPONS[item].magazine, state?.att);
      // Si no hay accesorios propios, se ponen los sueltos que le sirvan
      p.active = slot;
      p.reloadUntil = 0;
      for (const a of [...p.loose]) {
        if (attachTarget(p, a) === slot) {
          p.loose.splice(p.loose.indexOf(a), 1);
          placeAttachment(p, slot, a, out.drops);
        }
      }
      return { ...out, taken: 1, left: 0 };
    }
    case 'melee': {
      if (p.melee) out.drops.push({ item: p.melee });
      p.melee = item;
      return { ...out, taken: 1, left: 0 };
    }
    case 'ammo': {
      const k = Math.min(n, roomFor(p, item));
      p.ammo[def.ammo] = (p.ammo[def.ammo] ?? 0) + k;
      return { ...out, taken: k, left: n - k };
    }
    case 'heal':
    case 'throwable': {
      const bag = def.kind === 'heal' ? p.heals : p.throwables;
      const k = Math.min(n, roomFor(p, item));
      bag[item] = (bag[item] ?? 0) + k;
      return { ...out, taken: k, left: n - k };
    }
    case 'armor':
      if (!roomFor(p, item)) return out;
      if (p.armorLevel > 0) out.drops.push({ item: `armor${p.armorLevel}`, state: { armor: p.armor } });
      p.armorLevel = def.level;
      p.armor = state?.armor ?? ARMOR_ABSORB[def.level];
      return { ...out, taken: 1, left: 0 };
    case 'helmet':
      if (!roomFor(p, item)) return out;
      if (p.helmetLevel > 0) out.drops.push({ item: `helmet${p.helmetLevel}` });
      p.helmetLevel = def.level;
      return { ...out, taken: 1, left: 0 };
    case 'backpack':
      if (!roomFor(p, item)) return out;
      if (p.backpackLevel > 0) out.drops.push({ item: `backpack${p.backpackLevel}` });
      p.backpackLevel = def.level;
      return { ...out, taken: 1, left: 0 };
    case 'attachment': {
      const target = attachTarget(p, item);
      if (target !== null) placeAttachment(p, target, item, out.drops);
      else if (p.loose.length < looseCap(p)) p.loose.push(item);
      else return out;
      return { ...out, taken: 1, left: 0 };
    }
    default:
      return out;
  }
}

// Pone un accesorio en un arma; el que estaba pasa a la mochila (o al suelo si no cabe)
function placeAttachment(p, slot, attId, drops) {
  const w = p.weapons[slot];
  const s = LOOT_ITEMS[attId].slot;
  const old = w.att[s];
  w.att[s] = attId;
  if (s === 'mag') w.mag = Math.min(w.mag, magazineOf(w.id, w.att));
  if (old) {
    if (p.loose.length < looseCap(p)) p.loose.push(old);
    else drops.push({ item: old });
  }
}

// Desde la mochila: poner un accesorio suelto en el arma de la ranura (si es compatible)
export function attachLoose(p, looseIndex, slot) {
  const a = p.loose[looseIndex];
  const w = p.weapons[slot];
  if (!a || !w || !attachmentFits(w.id, a)) return [];
  p.loose.splice(looseIndex, 1);
  const drops = [];
  placeAttachment(p, slot, a, drops);
  return drops;
}

// Quitar un accesorio de un arma: a la mochila (o al suelo si no cabe)
export function detach(p, slot, attSlot) {
  const w = p.weapons[slot];
  const a = w?.att[attSlot];
  if (!a) return [];
  w.att[attSlot] = null;
  if (attSlot === 'mag') w.mag = Math.min(w.mag, magazineOf(w.id, w.att));
  if (p.loose.length < looseCap(p)) {
    p.loose.push(a);
    return [];
  }
  return [{ item: a }];
}

// Soltar algo del inventario. what: { kind: 'weapon', slot } | { kind: 'ammo', type, n } |
// { kind: 'heal'|'throwable', item, n } | { kind: 'loose', index } | { kind: 'gear', item: 'armor'|'helmet'|'backpack' }.
// Devuelve lo que queda en el suelo: [{ item, state }]
export function dropFromInventory(p, what) {
  switch (what?.kind) {
    case 'melee': {
      if (!p.melee) return [];
      const item = p.melee;
      p.melee = null;
      return [{ item }];
    }
    case 'weapon': {
      const w = p.weapons[what.slot];
      if (!w || w.id === 'fists') return [];
      p.weapons[what.slot] = null;
      if (p.active === what.slot) p.active = [SECONDARY, 0, 1].find((i) => p.weapons[i]) ?? SECONDARY;
      p.reloadUntil = 0;
      return [{ item: w.id, state: { mag: w.mag, att: w.att } }];
    }
    case 'ammo': {
      const have = p.ammo[what.type] ?? 0;
      const k = Math.max(0, Math.min(have, Math.floor(Number(what.n) || have)));
      if (!k) return [];
      p.ammo[what.type] = have - k;
      return [{ item: `ammo_${what.type}`, state: { n: k } }];
    }
    case 'heal':
    case 'throwable': {
      const bag = what.kind === 'heal' ? p.heals : p.throwables;
      const have = bag[what.item] ?? 0;
      const k = Math.max(0, Math.min(have, Math.floor(Number(what.n) || have)));
      if (!k || !LOOT_ITEMS[what.item]) return [];
      bag[what.item] = have - k;
      return [{ item: what.item, state: { n: k } }];
    }
    case 'loose': {
      const a = p.loose[what.index];
      if (!a) return [];
      p.loose.splice(what.index, 1);
      return [{ item: a }];
    }
    case 'gear': {
      if (what.item === 'armor' && p.armorLevel > 0) {
        const out = [{ item: `armor${p.armorLevel}`, state: { armor: p.armor } }];
        p.armorLevel = 0;
        p.armor = 0;
        return out;
      }
      if (what.item === 'helmet' && p.helmetLevel > 0) {
        const out = [{ item: `helmet${p.helmetLevel}` }];
        p.helmetLevel = 0;
        return out;
      }
      if (what.item === 'backpack' && p.backpackLevel > 0) {
        const out = [{ item: `backpack${p.backpackLevel}` }];
        p.backpackLevel = 0;
        // Lo que ya no cabe sin mochila también cae
        return [...out, ...overflow(p)];
      }
      return [];
    }
    default:
      return [];
  }
}

// Lo que sobra al bajar de mochila
function overflow(p) {
  const out = [];
  for (const [type, n] of Object.entries(p.ammo)) {
    const extra = n - ammoCap(p, type);
    if (extra > 0) {
      p.ammo[type] = n - extra;
      out.push({ item: `ammo_${type}`, state: { n: extra } });
    }
  }
  for (const item of Object.keys(p.heals)) {
    const extra = p.heals[item] - healCap(p, item);
    if (extra > 0) {
      p.heals[item] -= extra;
      out.push({ item, state: { n: extra } });
    }
  }
  while (throwTotal(p) > BACKPACK[p.backpackLevel].throwables) {
    const id = THROWABLE_IDS.find((t) => p.throwables[t] > 0);
    p.throwables[id] -= 1;
    out.push({ item: id, state: { n: 1 } });
  }
  while (p.loose.length > looseCap(p)) out.push({ item: p.loose.pop() });
  return out;
}

// Todo lo que lleva un jugador, para su caja de botín al caer: [{ item, state }]
export function inventoryItems(p) {
  const out = [];
  for (const w of p.weapons ?? []) if (w && w.id !== 'fists') out.push({ item: w.id, state: { mag: w.mag, att: w.att } });
  if (p.melee) out.push({ item: p.melee });
  for (const [type, n] of Object.entries(p.ammo ?? {})) if (n > 0) out.push({ item: `ammo_${type}`, state: { n } });
  if (p.armorLevel > 0) out.push({ item: `armor${p.armorLevel}`, state: { armor: p.armor } });
  if (p.helmetLevel > 0) out.push({ item: `helmet${p.helmetLevel}` });
  if (p.backpackLevel > 0) out.push({ item: `backpack${p.backpackLevel}` });
  for (const [item, n] of Object.entries(p.heals ?? {})) if (n > 0) out.push({ item, state: { n } });
  for (const [item, n] of Object.entries(p.throwables ?? {})) if (n > 0) out.push({ item, state: { n } });
  for (const a of p.loose ?? []) out.push({ item: a });
  return out;
}

// Mejor rareza de una lista de objetos (para el brillo de la caja de botín)
export const bestTier = (items) => Math.max(0, ...items.map(({ item }) => LOOT_ITEMS[item]?.tier ?? 0));

// Barras de un arma (0 a 1) para comparar: daño por disparo, cadencia, alcance y control
export function weaponBars(id) {
  const w = WEAPONS[id];
  return {
    damage: Math.min(1, (w.damage * w.pellets) / 110),
    rate: Math.min(1, 1000 / w.intervalMs / 16),
    range: Math.min(1, w.range / 62),
    control: Math.max(0.05, 1 - Math.min(1, w.spread / 0.12) * 0.7 - (WEAPON_CATEGORIES[w.category].recoil / 0.6) * 0.3),
  };
}
