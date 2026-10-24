// Ajustes del jugador guardados en el navegador (menú Opciones): brillo, volumen, calidad y escala de la interfaz.

const KEY = 'calculo-royale:ajustes';
const DEFAULTS = { brightness: 1, volume: 0.7, quality: 'auto', uiScale: 'normal' };
export const QUALITY_OPTIONS = [['auto', 'Auto'], ['high', 'Alta'], ['medium', 'Media'], ['low', 'Baja']];
export const UI_SCALES = { small: 0.85, normal: 1, large: 1.18 };
export const UI_SCALE_OPTIONS = [['small', 'Pequeña'], ['normal', 'Normal'], ['large', 'Grande']];
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
// Escala de la interfaz (Opciones): multiplica el tamaño base de index.css
export function applyUiScale(scale = settings.uiScale) {
  globalThis.document?.documentElement.style.setProperty('--ui-scale', String(UI_SCALES[scale] ?? 1));
}
onSettings((s) => applyUiScale(s.uiScale));

export const exposureFor = (touch, brightness = settings.brightness) => (touch ? 1.3 : 1.12) * brightness;

// Margen que respeta las zonas seguras (muesca, barra de gestos): estilo inline para cualquier capa
export const safePadding = (min = '0.5rem') => ({
  paddingTop: `max(${min}, env(safe-area-inset-top))`,
  paddingRight: `max(${min}, env(safe-area-inset-right))`,
  paddingBottom: `max(${min}, env(safe-area-inset-bottom))`,
  paddingLeft: `max(${min}, env(safe-area-inset-left))`,
});
