import { DEFAULT_SKIN, SKIN_RARITIES } from '@calculo-royale/shared/skins';
import { REGISTRY } from './registry.js';

// Acceso al registro de skins (ver registry.js)

// Respaldo: la skin procedural base (mientras carga una externa o si su archivo falla)
export const FALLBACK_SKIN = DEFAULT_SKIN;

// Entrada de una skin; si no existe, la del soldado base
export const getSkinEntry = (id) => REGISTRY.get(id) ?? REGISTRY.get(FALLBACK_SKIN);

export const isExternalSkin = (id) => REGISTRY.get(id)?.type === 'external';

// Todas las que se pueden elegir
export const listSkins = () => [...REGISTRY.values()].filter((s) => !s.hidden);

export const externalSkins = () => listSkins().filter((s) => s.type === 'external');

// Iniciales para la tarjeta sin retrato: "Isaac Newton" → "IN", "2B" → "2B", "Furina" → "FU"
export function skinInitials(name) {
  const words = name.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

export const rarityColor = (rarity) => SKIN_RARITIES[rarity]?.color ?? SKIN_RARITIES.comun.color;
