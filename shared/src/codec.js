// Codificación compacta de mensajes frecuentes (arrays en vez de objetos con claves).
//
// Input (C → S):  [seq, mx, my, aim, buttons, viewTick, aimDist]
//   viewTick: tick del servidor que el cliente estaba viendo (compensación de lag)
//   aimDist:  distancia al punto apuntado (alcance de la granada)
//
// Snapshot (S → C): [tick, players, grenades, dummies, shots, explosions, crates, alarms]
//   players:    [[id, x, y, aim, lastSeq, hp, armorLevel, weaponIndex, flags], ...]
//   grenades:   [[id, x, y], ...]
//   dummies:    [hp, ...] (solo en el lobby)
//   shots:      [[shooterId, weaponIndex, ox, oy, a1, d1, a2, d2, ...], ...] ángulo y distancia por bala
//   explosions: [[x, y], ...]
//   crates:     [estado, ...] en el orden de SUPPLY_CRATES (+ la de práctica al final), ver CRATE_STATE
//   alarms:     [[x, y], ...] cajas que alguien acaba de fallar (visibles para todos 3 s)

const round2 = (v) => Math.round(v * 100) / 100;

export function encodeInput({ seq, mx, my, aim, buttons = 0, viewTick = 0, aimDist = 0 }) {
  return [seq, round2(mx), round2(my), round2(aim), buttons, round2(viewTick), round2(aimDist)];
}

// Valida lo que llega del cliente: devuelve null si el mensaje no es válido
export function decodeInput(data) {
  if (!Array.isArray(data) || data.length < 4) return null;
  const [seq, mx, my, aim, buttons = 0, viewTick = 0, aimDist = 0] = data;
  if (!Number.isInteger(seq) || seq < 1) return null;
  if (![mx, my, aim, viewTick, aimDist].every(Number.isFinite)) return null;
  return {
    seq,
    mx: Math.max(-1, Math.min(1, mx)),
    my: Math.max(-1, Math.min(1, my)),
    aim,
    buttons: Number.isInteger(buttons) ? buttons & 0xff : 0,
    viewTick,
    aimDist: Math.max(0, aimDist),
  };
}

export function encodePlayerState(p, weaponIndex, flags) {
  return [p.id, round2(p.x), round2(p.y), round2(p.aim), p.lastSeq, Math.ceil(p.hp), p.armorLevel, weaponIndex, flags];
}

export function encodeShot(shooterId, weaponIndex, x, y, pellets) {
  const shot = [shooterId, weaponIndex, round2(x), round2(y)];
  for (const { angle, dist } of pellets) shot.push(round2(angle), round2(dist));
  return shot;
}

export function decodeShot(shot) {
  const [shooterId, weaponIndex, x, y] = shot;
  const pellets = [];
  for (let i = 4; i < shot.length; i += 2) pellets.push({ angle: shot[i], dist: shot[i + 1] });
  return { shooterId, weaponIndex, x, y, pellets };
}

export { round2 };
