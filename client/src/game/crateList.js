import { AIRDROP } from '@calculo-royale/shared/constants';
import { SUPPLY_CRATES, TRAINING } from '@calculo-royale/shared/mapLayout';

// Mismo orden que el servidor (un estado por caja en el snapshot): las del mapa, la de
// práctica y al final la del lanzamiento aéreo, cuya posición llega en el snapshot.
export const CRATES = [...SUPPLY_CRATES, TRAINING.crate, { x: 0, y: 0, rarity: AIRDROP.rarity, airdrop: true }];
export const AIRDROP_INDEX = CRATES.length - 1;

// Posición de la caja i (la aérea usa la del snapshot: [x, y, ms para aterrizar])
export function cratePosition(i, airdrop) {
  if (i === AIRDROP_INDEX) return airdrop?.length ? { x: airdrop[0], y: airdrop[1] } : null;
  return CRATES[i];
}
