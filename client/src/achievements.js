import { HATS } from '@calculo-royale/shared/constants';
import { ACHIEVEMENTS, DEFAULT_SKIN, SKIN_IDS, SKINS } from '@calculo-royale/shared/skins';

// Progreso de logros y skin elegida, guardados en este navegador (sin base de datos).
// Si el almacenamiento no está disponible, el juego sigue sin guardar.

const KEY = 'cr-progress';
const SKIN_KEY = 'cr-skin';

const empty = () => ({ legendarias: 0, invicto: 0, operador: 0, aciertos: 0 });

export function loadProgress(storage = globalThis.localStorage) {
  try {
    return { ...empty(), ...JSON.parse(storage.getItem(KEY) ?? '{}') };
  } catch {
    return empty();
  }
}

function saveProgress(progress, storage) {
  try {
    storage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // sin almacenamiento: el progreso dura solo esta sesión
  }
}

export function unlockedSkins(progress) {
  return SKINS.filter((s) => s.achievement && progress[s.achievement] >= ACHIEVEMENTS[s.achievement].goal).map((s) => s.id);
}

// Registra un evento y devuelve las skins que se acaban de desbloquear.
// Eventos: 'correct' (cualquier acierto), 'legendary' (caja dorada acertada),
// 'operatorStreak' (racha de operador, valor = racha actual), 'flawlessWin'.
export function recordEvent(type, value = 1, storage = globalThis.localStorage) {
  const progress = loadProgress(storage);
  const before = new Set(unlockedSkins(progress));
  if (type === 'correct') progress.aciertos += 1;
  else if (type === 'legendary') progress.legendarias += 1;
  else if (type === 'operatorStreak') progress.operador = Math.max(progress.operador, value);
  else if (type === 'flawlessWin') progress.invicto += 1;
  saveProgress(progress, storage);
  return unlockedSkins(progress).filter((id) => !before.has(id));
}

export function loadSkin(storage = globalThis.localStorage) {
  try {
    // Una skin que ya no existe (carpeta borrada o espacio viejo) vuelve a la base
    const id = storage.getItem(SKIN_KEY);
    return SKIN_IDS.has(id) ? id : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function saveSkin(id, storage = globalThis.localStorage) {
  try {
    storage.setItem(SKIN_KEY, id);
  } catch {
    // es solo una comodidad
  }
}

// Accesorio de temporada (7A): '' | 'bruja' | 'calabaza' | 'navidad'
const HAT_KEY = 'cr-hat';
export function loadHat(storage = globalThis.localStorage) {
  try {
    const hat = storage.getItem(HAT_KEY) ?? '';
    return HATS[hat] ? hat : '';
  } catch {
    return '';
  }
}
export function saveHat(hat, storage = globalThis.localStorage) {
  try {
    storage.setItem(HAT_KEY, HATS[hat] ? hat : '');
  } catch {
    // es solo una comodidad
  }
}
