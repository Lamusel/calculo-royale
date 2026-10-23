import { REGISTRY } from './registry.js';

// Acceso al registro de skins (ver registry.js)

export const FALLBACK_SKIN = 'fallback';

// Entrada de una skin; si no existe, la del soldado gris
export const getSkinEntry = (id) => REGISTRY.get(id) ?? REGISTRY.get(FALLBACK_SKIN);

export const isExternalSkin = (id) => REGISTRY.get(id)?.type === 'external';

// Todas las que se pueden elegir (sin el soldado gris)
export const listSkins = () => [...REGISTRY.values()].filter((s) => !s.hidden);

export const externalSkins = () => listSkins().filter((s) => s.type === 'external');
