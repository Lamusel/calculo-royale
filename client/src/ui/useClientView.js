import { useEffect, useState } from 'react';
import { INTERACT_RADIUS, ITEM_NAMES, JEEP, RARITIES, WEAPONS } from '@calculo-royale/shared/constants';
import { CRATE_STATE, VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { nearestRack } from '@calculo-royale/shared/mapLayout';
import { CRATES, cratePosition } from '../game/crateList.js';
import { selfWeaponId } from '../net/GameClient.js';

const RESULT_MS = 4500;
const CRATE_STATUS = {
  [CRATE_STATE.BUSY]: 'ocupada',
  [CRATE_STATE.LOCKED]: 'bloqueada',
  [CRATE_STATE.OPEN]: 'vacía',
};

// Qué se puede hacer con un jeep según su estado y sus asientos
function jeepAction(v) {
  if (v.state === VEHICLE_STATE.LOCKED) return { label: 'Encender jeep (código del motor)', enabled: true, color: '#fb923c' };
  if (v.state === VEHICLE_STATE.JAMMED) return { label: 'Motor atascado', enabled: false };
  if (!v.driver) return { label: 'Conducir jeep', enabled: true, color: '#fb923c' };
  if (!v.passenger) return { label: 'Subir de pasajero', enabled: true, color: '#fb923c' };
  return { label: 'Jeep lleno', enabled: false };
}

// Lo más cercano con lo que se puede interactuar: armero (lobby), caja visible o jeep
function nearestInteractable(me, phase, crateStates, airdrop, vehicles, inVehicle) {
  if (inVehicle) return { label: 'Bajarse del jeep', enabled: true, color: '#fb923c' };
  let best = null;
  let bestDist = INTERACT_RADIUS;
  const rack = phase === 'lobby' ? nearestRack(me.x, me.y, INTERACT_RADIUS) : null;
  if (rack) {
    bestDist = Math.hypot(rack.x - me.x, rack.y - me.y);
    best = { label: `Tomar ${ITEM_NAMES[rack.item]}`, enabled: true };
  }
  CRATES.forEach((crate, i) => {
    const state = crateStates[i];
    const c = cratePosition(i, airdrop);
    if (state === undefined || state === CRATE_STATE.HIDDEN || !c) return;
    const d = Math.hypot(c.x - me.x, c.y - me.y);
    if (d > bestDist) return;
    bestDist = d;
    const rarity = RARITIES[crate.rarity];
    best = {
      label: state === CRATE_STATE.CLOSED ? `Abrir caja ${rarity.name.toLowerCase()}` : `Caja ${CRATE_STATUS[state]}`,
      enabled: state === CRATE_STATE.CLOSED,
      color: rarity.color,
    };
  });
  for (const v of vehicles?.values() ?? []) {
    const d = Math.hypot(v.x - me.x, v.y - me.y);
    if (v.state === VEHICLE_STATE.DESTROYED || d > JEEP.enterRadius || d > bestDist) continue;
    bestDist = d;
    best = jeepAction(v);
  }
  return best;
}

// Lee el estado del GameClient a 10 Hz para la interfaz (sin re-renderizar a 60 fps)
export function useClientView(client, frameRef, phase) {
  const [view, setView] = useState({});

  useEffect(() => {
    let deathAt = 0;
    const read = () => {
      const now = performance.now();
      const { me, others, crates, airdrop, vehicles } = frameRef.current;
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
        interact:
          me && self?.alive && !client.question
            ? nearestInteractable(me, phase, crates ?? [], airdrop, vehicles, client.vehicleId !== null)
            : null,
        vehicle: client.vehicleId !== null ? { ...vehicles?.get(client.vehicleId), seat: client.seat } : null,
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
