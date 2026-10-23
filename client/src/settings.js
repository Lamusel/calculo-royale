// Ajustes del jugador guardados en el navegador (menú Opciones): brillo y volumen.

const KEY = 'calculo-royale:ajustes';
const DEFAULTS = { brightness: 1, volume: 0.7 };
export const BRIGHTNESS_RANGE = [0.6, 1.8];

function load(storage = globalThis.localStorage) {
  try {
    return { ...DEFAULTS, ...JSON.parse(storage?.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();
const listeners = new Set();

export function setSetting(key, value, storage = globalThis.localStorage) {
  settings[key] = value;
  try {
    storage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Navegación privada o almacenamiento lleno: el ajuste vale solo para esta sesión
  }
  for (const fn of listeners) fn(settings);
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Exposición base: en celular un poco más (pantallas chicas, a pleno sol); el brillo la multiplica
export const exposureFor = (touch, brightness = settings.brightness) => (touch ? 1.3 : 1.12) * brightness;
