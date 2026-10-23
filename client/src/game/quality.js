// Calidad gráfica automática: arranca en media (celular) o alta (PC) y se ajusta según los FPS.

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const QUALITY = {
  high: { name: 'alta', dpr: [1, 1.5], shadows: true, shadowMapSize: 2048, particles: 1, bushes: true, fog: [50, 110] },
  medium: { name: 'media', dpr: [1, 1.25], shadows: true, shadowMapSize: 1024, particles: 0.7, bushes: true, fog: [45, 100] },
  low: { name: 'baja', dpr: 1, shadows: false, shadowMapSize: 512, particles: 0.35, bushes: false, fog: [37, 83] },
};

const WINDOW_MS = 2000; // cada medición promedia 2 s
const LOW_FPS = 40;
const HIGH_FPS = 57;
const COOLDOWN_MS = 4000;

// Controlador puro (sin DOM): recibe cuadros y decide si cambiar de nivel.
// No sube por encima del nivel inicial; con `forced` nunca cambia.
export function createQualityController({ initial, forced = null }) {
  let level = forced ?? initial;
  const ceiling = QUALITY_LEVELS.indexOf(forced ?? initial);
  let windowStart = null;
  let frames = 0;
  let slowWindows = 0;
  let fastWindows = 0;
  let changedAt = -Infinity;

  return {
    get level() {
      return level;
    },
    // Devuelve el nuevo nivel si cambió, o null
    frame(now) {
      if (forced) return null;
      if (windowStart === null) windowStart = now;
      frames++;
      if (now - windowStart < WINDOW_MS) return null;
      const fps = (frames * 1000) / (now - windowStart);
      windowStart = now;
      frames = 0;
      if (now - changedAt < COOLDOWN_MS) return null;

      slowWindows = fps < LOW_FPS ? slowWindows + 1 : 0;
      fastWindows = fps > HIGH_FPS ? fastWindows + 1 : 0;
      const index = QUALITY_LEVELS.indexOf(level);
      if (slowWindows >= 2 && index > 0) {
        level = QUALITY_LEVELS[index - 1];
      } else if (fastWindows >= 5 && index < ceiling) {
        level = QUALITY_LEVELS[index + 1];
      } else {
        return null;
      }
      slowWindows = 0;
      fastWindows = 0;
      changedAt = now;
      return level;
    },
  };
}

// Nivel inicial: ?calidad=alta|media|baja lo fuerza; si no, media en celular y alta en PC
export function initialQuality(search = '', touch = false) {
  const names = { alta: 'high', media: 'medium', baja: 'low' };
  const forced = names[new URLSearchParams(search).get('calidad')] ?? null;
  return { initial: touch ? 'medium' : 'high', forced };
}
