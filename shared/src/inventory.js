import { ARMOR_ABSORB, ATTACHMENTS, BACKPACK, LOOT_ITEMS, WEAPONS } from './constants.js';

// Reglas del inventario (fase 18). Funciones puras sobre el jugador del servidor; el cliente
// las usa solo para mostrar (cargador, tope, "Tomar …"). El servidor decide siempre.

const SCOPE_TIER = { reddot: 0, scope2x: 1, scope4x: 2 };

// Accesorios vacíos
export const noAttachments = () => ({ scope: null, mag: null, stock: null, muzzle: null });

// Cargador del arma con los accesorios del jugador
export function magazineOf(weaponId, attachments) {
  const base = WEAPONS[weaponId].magazine;
  return attachments?.mag === 'extmag' ? Math.round(base * ATTACHMENTS.extmag) : base;
}

// Arma con la dispersión ajustada por culata y punto rojo (el resto igual)
export function weaponWith(weaponId, attachments) {
  const w = WEAPONS[weaponId];
  let spread = w.spread;
  if (attachments?.stock === 'stock') spread *= ATTACHMENTS.stock;
  if (attachments?.scope === 'reddot') spread *= ATTACHMENTS.reddot;
  return spread === w.spread ? w : { ...w, spread };
}

// Tope de munición de reserva según la mochila
export const reserveCap = (weaponId, backpackLevel = 0) => Math.round(WEAPONS[weaponId].reserve * BACKPACK[backpackLevel].reserve);

// Cuántos de un consumible caben (venda, botiquín, bebida, granada)
export const capacityOf = (item, backpackLevel = 0) => BACKPACK[backpackLevel][item];

const COUNTERS = { bandage: 'bandages', medkit: 'medkits', drink: 'drinks', grenade: 'grenades' };
export const counterOf = (item) => COUNTERS[item];

// ¿Le sirve este objeto al jugador? (para tomarlo del suelo o de una caja de botín)
// state: estado guardado del objeto (munición de un arma soltada, puntos de un chaleco)
export function wants(player, item) {
  const def = LOOT_ITEMS[item];
  if (!def) return false;
  switch (def.kind) {
    case 'weapon':
      return true; // la misma suma munición; otra la reemplaza (la vieja queda en el suelo)
    case 'ammo':
      return reserveRoom(player) > 0;
    case 'heal':
    case 'grenade':
      return player[COUNTERS[item]] < capacityOf(item, player.backpackLevel);
    case 'armor':
      return def.level > player.armorLevel || (def.level === player.armorLevel && player.armor < ARMOR_ABSORB[def.level]);
    case 'helmet':
      return def.level > player.helmetLevel;
    case 'backpack':
      return def.level > player.backpackLevel;
    case 'attachment': {
      const current = player.attachments[def.slot];
      if (!current) return true;
      if (def.slot !== 'scope') return false; // ya tiene uno igual
      return SCOPE_TIER[item] > SCOPE_TIER[current];
    }
    default:
      return false;
  }
}

// Espacio libre de munición (en el arma en mano o, si está llena, en la otra)
function reserveRoom(player) {
  const pistol = reserveCap('pistol', player.backpackLevel) - player.pistolReserve;
  const primary = player.primary ? reserveCap(player.primary.id, player.backpackLevel) - player.primary.reserve : 0;
  return Math.max(pistol, primary);
}

// Aplica un objeto al jugador. Devuelve lo que sale de su inventario y queda en el suelo:
// [{ item, state }] (arma reemplazada con su munición, chaleco, casco o mochila viejos, mira peor).
// Supone que wants() dio true.
export function take(player, item, state = null) {
  const def = LOOT_ITEMS[item];
  const drops = [];
  switch (def.kind) {
    case 'weapon': {
      const w = WEAPONS[item];
      if (player.primary?.id === item) {
        // La misma arma: su munición pasa a la reserva
        const extra = state ? state.mag + state.reserve : w.magazine;
        player.primary.reserve = Math.min(reserveCap(item, player.backpackLevel), player.primary.reserve + extra);
        break;
      }
      if (player.primary) drops.push({ item: player.primary.id, state: { mag: player.primary.mag, reserve: player.primary.reserve } });
      player.primary = {
        id: item,
        mag: Math.min(state?.mag ?? magazineOf(item, player.attachments), magazineOf(item, player.attachments)),
        reserve: Math.min(state?.reserve ?? w.reserve, reserveCap(item, player.backpackLevel)),
      };
      player.slot = 2;
      player.reloadUntil = 0;
      break;
    }
    case 'ammo': {
      // Un cargador para cada arma que lleva, hasta el tope de la mochila
      player.pistolReserve = Math.min(reserveCap('pistol', player.backpackLevel), player.pistolReserve + WEAPONS.pistol.magazine);
      if (player.primary) {
        const id = player.primary.id;
        player.primary.reserve = Math.min(reserveCap(id, player.backpackLevel), player.primary.reserve + WEAPONS[id].magazine);
      }
      break;
    }
    case 'heal':
    case 'grenade':
      player[COUNTERS[item]] += 1;
      break;
    case 'armor':
      if (player.armorLevel > 0) drops.push({ item: `armor${player.armorLevel}`, state: { armor: player.armor } });
      player.armorLevel = def.level;
      player.armor = state?.armor ?? ARMOR_ABSORB[def.level];
      break;
    case 'helmet':
      if (player.helmetLevel > 0) drops.push({ item: `helmet${player.helmetLevel}` });
      player.helmetLevel = def.level;
      break;
    case 'backpack':
      if (player.backpackLevel > 0) drops.push({ item: `backpack${player.backpackLevel}` });
      player.backpackLevel = def.level;
      break;
    case 'attachment': {
      const old = player.attachments[def.slot];
      if (old) drops.push({ item: old });
      player.attachments[def.slot] = item;
      break;
    }
    default:
      break;
  }
  return drops;
}

// Todo lo que lleva un jugador, para su caja de botín al caer: [{ item, state }]
export function inventoryItems(player) {
  const out = [];
  if (player.primary) out.push({ item: player.primary.id, state: { mag: player.primary.mag, reserve: player.primary.reserve } });
  if (player.armorLevel > 0) out.push({ item: `armor${player.armorLevel}`, state: { armor: player.armor } });
  if (player.helmetLevel > 0) out.push({ item: `helmet${player.helmetLevel}` });
  if (player.backpackLevel > 0) out.push({ item: `backpack${player.backpackLevel}` });
  for (const a of Object.values(player.attachments ?? {})) if (a) out.push({ item: a });
  for (const [item, counter] of Object.entries(COUNTERS)) for (let i = 0; i < (player[counter] ?? 0); i++) out.push({ item });
  if (player.pistolReserve > 0 || player.primary?.reserve > 0) out.push({ item: 'ammo' });
  return out;
}
