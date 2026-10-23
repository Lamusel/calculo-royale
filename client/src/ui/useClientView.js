import { useEffect, useState } from 'react';
import { INTERACT_RADIUS, ITEM_NAMES, RARITIES, WEAPONS } from '@calculo-royale/shared/constants';
import { CRATE_STATE } from '@calculo-royale/shared/protocol';
import { nearestRack, SUPPLY_CRATES, TRAINING } from '@calculo-royale/shared/mapLayout';
import { selfWeaponId } from '../net/GameClient.js';

const CRATES = [...SUPPLY_CRATES, TRAINING.crate];
const RESULT_MS = 4500;
const CRATE_STATUS = {
  [CRATE_STATE.BUSY]: 'ocupada',
  [CRATE_STATE.LOCKED]: 'bloqueada',
  [CRATE_STATE.OPEN]: 'vacía',
};

// Lo más cercano con lo que se puede interactuar: armero (lobby) o caja visible
function nearestInteractable(me, phase, crateStates) {
  let best = null;
  let bestDist = INTERACT_RADIUS;
  const rack = phase === 'lobby' ? nearestRack(me.x, me.y, INTERACT_RADIUS) : null;
  if (rack) {
    bestDist = Math.hypot(rack.x - me.x, rack.y - me.y);
    best = { label: `Tomar ${ITEM_NAMES[rack.item]}`, enabled: true };
  }
  CRATES.forEach((c, i) => {
    const state = crateStates[i];
    if (state === undefined || state === CRATE_STATE.HIDDEN) return;
    const d = Math.hypot(c.x - me.x, c.y - me.y);
    if (d > bestDist) return;
    bestDist = d;
    const rarity = RARITIES[c.rarity];
    best = {
      label: state === CRATE_STATE.CLOSED ? `Abrir caja ${rarity.name.toLowerCase()}` : `Caja ${CRATE_STATUS[state]}`,
      enabled: state === CRATE_STATE.CLOSED,
      color: rarity.color,
    };
  });
  return best;
}

// Lee el estado del GameClient a 10 Hz para la interfaz (sin re-renderizar a 60 fps)
export function useClientView(client, frameRef, phase) {
  const [view, setView] = useState({});

  useEffect(() => {
    let deathAt = 0;
    const read = () => {
      const now = performance.now();
      const { me, others, crates } = frameRef.current;
      const self = client.self;
      if (self && !self.alive && !deathAt) deathAt = now;
      if (!self || self.alive) deathAt = 0;
      const result = client.crateResult && now - client.crateResult.at < RESULT_MS ? client.crateResult : null;
      setView({
        me: me && { x: me.x, y: me.y },
        others: new Map(others),
        self,
        latency: client.latency,
        reloadProgress:
          self && client.reloadEndsAt > now
            ? 1 - (client.reloadEndsAt - now) / WEAPONS[selfWeaponId(self)].reloadMs
            : null,
        killfeed: [...client.killfeed],
        damageFlashAt: client.damageFlashAt,
        deathAt,
        interact: me && self?.alive && !client.question ? nearestInteractable(me, phase, crates ?? []) : null,
        question: client.question,
        crateResult: result,
        radarLeft: Math.max(0, Math.ceil((client.radarEndsAt - now) / 1000)),
      });
    };
    read();
    const id = setInterval(read, 100);
    return () => clearInterval(id);
  }, [client, frameRef, phase]);

  return view;
}
