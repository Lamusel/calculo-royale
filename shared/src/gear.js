import { ATTACHMENTS, BACKPACK, HELMET, HELMET_SNIPER, RECOIL } from './constants.js';

// Equipo visible de un jugador (fase 25): viaja en el snapshot como un número para que todos lo
// vean puesto en el modelo. Bits: casco (0–1), mochila (2–3), mira (4–5: 0 nada, 1 punto rojo,
// 2 2x, 3 4x), cargador ampliado (6), culata (7), silenciador (8).

const SCOPES = [null, 'reddot', 'scope2x', 'scope4x'];

export function encodeGear(p) {
  const a = p.attachments ?? {};
  return (
    (p.helmetLevel ?? 0) |
    ((p.backpackLevel ?? 0) << 2) |
    (Math.max(0, SCOPES.indexOf(a.scope ?? null)) << 4) |
    (a.mag ? 1 << 6 : 0) |
    (a.stock ? 1 << 7 : 0) |
    (a.muzzle ? 1 << 8 : 0)
  );
}

export function decodeGear(n = 0) {
  return {
    helmet: n & 3,
    backpack: (n >> 2) & 3,
    scope: SCOPES[(n >> 4) & 3],
    mag: Boolean(n & (1 << 6)),
    stock: Boolean(n & (1 << 7)),
    muzzle: Boolean(n & (1 << 8)),
  };
}

const pct = (f) => `${Math.round(f * 100)} %`;

// Icono, nombre corto y efecto de cada objeto de equipo (tarjeta al recogerlo y panel del HUD)
export const GEAR_INFO = {
  reddot: { icon: '🔴', short: 'Punto rojo', effect: `−${pct(1 - ATTACHMENTS.reddot)} de dispersión y retícula al apuntar` },
  scope2x: { icon: '🔭', short: 'Mira 2x', effect: 'Al apuntar ves más lejos (la cámara se aleja y se adelanta) y retícula 2x' },
  scope4x: { icon: '🎯', short: 'Mira 4x', effect: 'Al apuntar ves mucho más lejos y retícula 4x' },
  extmag: { icon: '📦', short: 'Cargador ampliado', effect: `+${pct(ATTACHMENTS.extmag - 1)} de balas por cargador` },
  stock: { icon: '🪵', short: 'Culata', effect: `−${pct(1 - RECOIL.stock)} de retroceso y −${pct(1 - ATTACHMENTS.stock)} de dispersión` },
  silencer: { icon: '🔇', short: 'Silenciador', effect: `Disparo apagado: solo se oye a menos de ${ATTACHMENTS.silencerHearRadius} m y no te marca en el minimapa` },
  helmet1: { icon: '⛑️', short: 'Casco 1', effect: `−${pct(HELMET[1])} de daño y −${pct(HELMET_SNIPER[1])} del francotirador` },
  helmet2: { icon: '⛑️', short: 'Casco 2', effect: `−${pct(HELMET[2])} de daño y −${pct(HELMET_SNIPER[2])} del francotirador` },
  helmet3: { icon: '⛑️', short: 'Casco 3', effect: `−${pct(HELMET[3])} de daño y −${pct(HELMET_SNIPER[3])} del francotirador` },
  backpack1: { icon: '🎒', short: 'Mochila 1', effect: `Más capacidad: ${BACKPACK[1].bandage} vendas, ${BACKPACK[1].medkit} botiquines, ${BACKPACK[1].grenade} granadas, munición ×${BACKPACK[1].reserve}` },
  backpack2: { icon: '🎒', short: 'Mochila 2', effect: `Más capacidad: ${BACKPACK[2].bandage} vendas, ${BACKPACK[2].medkit} botiquines, ${BACKPACK[2].grenade} granadas, munición ×${BACKPACK[2].reserve}` },
  backpack3: { icon: '🎒', short: 'Mochila 3', effect: `Más capacidad: ${BACKPACK[3].bandage} vendas, ${BACKPACK[3].medkit} botiquines, ${BACKPACK[3].grenade} granadas, munición ×${BACKPACK[3].reserve}` },
  armor1: { icon: '🦺', short: 'Chaleco 1', effect: 'Absorbe 25 de daño antes que la vida' },
  armor2: { icon: '🦺', short: 'Chaleco 2', effect: 'Absorbe 50 de daño antes que la vida' },
  armor3: { icon: '🦺', short: 'Chaleco 3', effect: 'Absorbe 75 de daño antes que la vida' },
};

// Factor de daño que deja pasar el casco (al francotirador, más protección)
export const helmetFactor = (level = 0, sniper = false) => 1 - (sniper ? HELMET_SNIPER[level] : HELMET[level]);
