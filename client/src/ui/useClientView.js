import { useEffect, useState } from 'react';
import { HEALING, INTERACT_RADIUS, ITEM_NAMES, JEEP, LOOT, LOOT_ITEMS, RARITIES, TIER_COLORS, vehicleType, WEAPONS, ZIPLINE } from '@calculo-royale/shared/constants';
import { CRATE_STATE, VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { nearestRack, ZIPLINE_LINES } from '@calculo-royale/shared/mapLayout';
import { CRATES, cratePosition } from '../game/crateList.js';
import { selfWeaponId } from '../net/GameClient.js';

const RESULT_MS = 4500;
const LOOT_TOAST_MS = 2200;
// Color del aviso según la rareza del objeto (común gris, raro azul, épico violeta)
const tierColor = (item) => TIER_COLORS[LOOT_ITEMS[item]?.tier ?? 0];
const CRATE_STATUS = {
  [CRATE_STATE.BUSY]: 'ocupada',
  [CRATE_STATE.LOCKED]: 'bloqueada',
  [CRATE_STATE.OPEN]: 'vacía',
};

// Qué se puede hacer con un jeep según su estado y sus asientos
function jeepAction(v) {
  const name = vehicleType(v).name.toLowerCase();
  if (v.state === VEHICLE_STATE.LOCKED) return { label: `Encender ${name}`, enabled: true, color: '#fb923c' };
  if (v.state === VEHICLE_STATE.JAMMED) return { label: 'Motor atascado', enabled: false };
  if (!v.driver) return { label: `Conducir ${name}`, enabled: true, color: '#fb923c' };
  if ((v.passengers ?? [v.passenger]).some((p) => !p)) return { label: 'Subir', enabled: true, color: '#fb923c' };
  return { label: `${vehicleType(v).name} lleno`, enabled: false };
}

// Todo lo que está al alcance, de más cercano a más lejano (una acción por tipo, como en el servidor):
// armero (lobby), caja visible, jeep o botín del suelo (el botín con la misma ventaja de 0,3 m).
// La zona de acción muestra la primera y una flechita para cambiar entre ellas.
export function interactables(me, phase, crateStates, airdrop, vehicles, inVehicle, loot, myId, now) {
  if (inVehicle) return [{ kind: 'vehicle', icon: 'exit', label: 'Bajar', enabled: true, color: '#fb923c', dist: 0 }];
  const out = [];
  const rack = phase === 'lobby' ? nearestRack(me.x, me.y, INTERACT_RADIUS) : null;
  if (rack) out.push({ kind: 'rack', icon: 'take', label: `Tomar ${ITEM_NAMES[rack.item]}`, enabled: true, dist: Math.hypot(rack.x - me.x, rack.y - me.y) });
  let crate = null;
  CRATES.forEach((c0, i) => {
    const state = crateStates[i] === undefined ? undefined : +crateStates[i];
    const c = cratePosition(i, airdrop);
    if (state === undefined || state === CRATE_STATE.HIDDEN || !c) return;
    const d = Math.hypot(c.x - me.x, c.y - me.y);
    if (d > INTERACT_RADIUS || (crate && d > crate.dist)) return;
    const rarity = RARITIES[c0.rarity] ?? RARITIES[1];
    crate = {
      kind: 'crate', icon: 'open', dist: d, color: rarity.color, enabled: state === CRATE_STATE.CLOSED,
      label: state === CRATE_STATE.CLOSED ? `Abrir caja ${rarity.name.toLowerCase()}` : `Caja ${CRATE_STATUS[state] ?? 'cerrada'}`,
    };
  });
  if (crate) out.push(crate);
  let jeep = null;
  for (const v of vehicles?.values() ?? []) {
    const d = Math.hypot(v.x - me.x, v.y - me.y);
    if (v.state === VEHICLE_STATE.DESTROYED || d > vehicleType(v).enterRadius || (jeep && d > jeep.dist)) continue;
    jeep = { kind: 'vehicle', icon: 'enter', dist: d, ...jeepAction(v) };
  }
  if (jeep) out.push(jeep);
  // Tirolina: en cualquiera de sus dos puntas
  if (phase === 'playing') {
    for (const z of ZIPLINE_LINES) {
      const d = Math.min(Math.hypot(z.from[0] - me.x, z.from[1] - me.y), Math.hypot(z.to[0] - me.x, z.to[1] - me.y));
      if (d < ZIPLINE.grabRadius) {
        out.push({ kind: 'zip', icon: 'zipline', label: 'Tirolina', enabled: true, color: '#38bdf8', dist: d });
        break;
      }
    }
  }
  let near = null;
  for (const e of loot?.values() ?? []) {
    // Lo que otro no eligió de una caja es solo suyo por un rato
    if (e.owner && e.owner !== myId) continue;
    const d = Math.hypot(e.x - me.x, e.y - me.y) - 0.3;
    if (d + 0.3 > LOOT.pickupRadius || (near && d > near.dist)) continue;
    near = e.item
      ? { kind: 'loot', icon: 'take', dist: d, label: `Tomar ${LOOT_ITEMS[e.item].name}${e.count > 1 ? ` × ${e.count}` : ''}`, enabled: true, color: tierColor(e.item) }
      : { kind: 'loot', icon: 'loot', dist: d, label: `Saquear (${e.count})`, enabled: true, color: TIER_COLORS[e.tier ?? 0] };
  }
  if (near) out.push(near);
  return out.sort((x, y) => x.dist - y.dist);
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
        actions:
          me && self?.alive && !client.question && !client.deploying
            ? interactables(me, phase, crates ?? [], airdrop, vehicles, client.vehicleId !== null, client.loot, client.myId, now)
            : [],
        vehicle: client.vehicleId !== null ? { ...vehicles?.get(client.vehicleId), seat: client.seat } : null,
        question: client.question,
        crateResult: result,
        radarLeft: Math.max(0, Math.ceil((client.radarEndsAt - now) / 1000)),
        // Curándose: { item, progress } · bebida: segundos que le quedan
        healing:
          self?.healing && client.healingEndsAt > now
            ? { item: self.healing.item, progress: 1 - (client.healingEndsAt - now) / HEALING[self.healing.item].useMs }
            : null,
        drinkLeft: Math.max(0, Math.ceil(((client.drinkEndsAt ?? 0) - now) / 1000)),
        toasts: (client.toasts ?? []).filter((t) => now - t.at < 3000),
        gearCard: client.gearCard && now - client.gearCard.at < 4000 ? client.gearCard : null,
      });
    };
    read();
    const id = setInterval(read, 100);
    return () => clearInterval(id);
  }, [client, frameRef, phase]);

  return view;
}
