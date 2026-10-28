import { LOOT, THROWABLES } from '@calculo-royale/shared/constants';
import { attachLoose, detach, dropFromInventory } from '@calculo-royale/shared/inventory';
import { dropAround, pickUp } from './loot.js';

// Acciones del inventario que pide el cliente (fase 29). Todo se valida aquí: el cliente solo pide.
//   drop:   { what } (ver dropFromInventory)        attach: { index, slot }   detach: { slot, att }
//   take:   { lootId, index?, all?, replace? }       select: { item } (lanzable elegido)
export function inventoryOp(game, player, data) {
  if (!player.alive || player.deploying || !data || typeof data !== 'object') return;
  switch (data.op) {
    case 'drop': {
      const drops = dropFromInventory(player, data.what);
      if (drops.length && game.loot) dropAround(game, player.x, player.y, drops);
      break;
    }
    case 'attach': {
      const drops = attachLoose(player, Number(data.index), Number(data.slot));
      if (drops.length && game.loot) dropAround(game, player.x, player.y, drops);
      break;
    }
    case 'detach': {
      const drops = detach(player, Number(data.slot), String(data.att));
      if (drops.length && game.loot) dropAround(game, player.x, player.y, drops);
      break;
    }
    case 'take': {
      const entry = game.loot?.get(Number(data.lootId));
      if (!entry || Math.hypot(entry.x - player.x, entry.y - player.y) > LOOT.pickupRadius + 0.5) return;
      const replace = data.replace === undefined || data.replace === null ? null : Number(data.replace);
      pickUp(game, player, entry, { index: data.index === undefined ? undefined : Number(data.index), all: Boolean(data.all), replace });
      break;
    }
    case 'select':
      if (THROWABLES[data.item]) player.throwSel = data.item;
      break;
    default:
      break;
  }
}
