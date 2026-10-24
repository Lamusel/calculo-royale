// Calidad gráfica. Manual (Opciones: Alta, Media o Baja) o automática: arranca en media (celular)
// o alta (PC) y, si los FPS no alcanzan, recorta de a un paso y en este orden:
//   1. resolución (dpr, nunca por debajo de 0,75)
//   2. sombras (mapa más chico y luego sin sombras)
//   3. partículas y decoración lejana (arbustos)
//   4. niebla más cerca y nivel de detalle lejano
// Con histéresis: baja solo tras 5 s seguidos por debajo de 28 FPS, y como mucho un cambio cada 10 s.

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const QUALITY = {
  high: { name: 'alta', dpr: 1.5, shadows: true, shadowMapSize: 2048, particles: 1, bushes: true, fog: [50, 110], farLod: false },
  medium: { name: 'media', dpr: 1.25, shadows: true, shadowMapSize: 1024, particles: 0.7, bushes: true, fog: [45, 100], farLod: false },
  low: { name: 'baja', dpr: 1, shadows: false, shadowMapSize: 512, particles: 0.35, bushes: false, fog: [37, 83], farLod: true },
};

export const MIN_DPR = 0.75;
const LOW_FPS = 28;
const SLOW_MS = 5000; // tiempo seguido por debajo de LOW_FPS para recortar
const HIGH_FPS = 55;
const FAST_MS = 20000; // tiempo seguido por encima de HIGH_FPS para devolver un paso
const COOLDOWN_MS = 10000;
const WINDOW_MS = 1000;

// Recortes en orden; los que no cambian nada para ese perfil se saltan
const CUTS = [
  ['resolución', (p) => ({ dpr: Math.min(p.dpr, 1.25) })],
  ['resolución', (p) => ({ dpr: Math.min(p.dpr, 1) })],
  ['resolución', (p) => ({ dpr: Math.min(p.dpr, 0.85) })],
  ['resolución', (p) => ({ dpr: Math.max(MIN_DPR, Math.min(p.dpr, MIN_DPR)) })],
  ['sombras', (p) => ({ shadowMapSize: Math.min(p.shadowMapSize, 1024) })],
  ['sombras', () => ({ shadows: false })],
  ['partículas y decoración', (p) => ({ particles: Math.min(p.particles, 0.6), bushes: false })],
  ['partículas y decoración', (p) => ({ particles: Math.min(p.particles, 0.35) })],
  ['niebla y detalle lejano', (p) => ({ fog: [Math.min(p.fog[0], 37), Math.min(p.fog[1], 83)], farLod: true })],
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Escalera de perfiles desde un nivel: [inicial, primer recorte, segundo…]
export function qualitySteps(level) {
  const steps = [{ ...QUALITY[level], step: 0, cut: null }];
  for (const [cut, apply] of CUTS) {
    const prev = steps.at(-1);
    const next = { ...prev, ...apply(prev), step: steps.length, cut };
    const { step: _s, cut: _c, ...a } = prev;
    const { step: _s2, cut: _c2, ...b } = next;
    if (!same(a, b)) steps.push(next);
  }
  return steps;
}

// Controlador puro (sin DOM): recibe cuadros y decide si cambiar de perfil.
// Con `forced` nunca cambia. No sube por encima del perfil inicial.
// onSlow: se llama una vez si ya no queda nada por recortar y sigue lento.
export function createQualityController({ initial, forced = null, onSlow = null }) {
  const steps = qualitySteps(forced ?? initial);
  let index = 0;
  let windowStart = null;
  let frames = 0;
  let slowSince = null;
  let fastSince = null;
  let changedAt = -Infinity;
  let warned = false;

  return {
    get profile() {
      return steps[index];
    },
    get level() {
      return forced ?? initial;
    },
    // Devuelve el nuevo perfil si cambió, o null
    frame(now) {
      if (forced) return null;
      if (windowStart === null) windowStart = now;
      frames++;
      if (now - windowStart < WINDOW_MS) return null;
      const fps = (frames * 1000) / (now - windowStart);
      const start = windowStart;
      windowStart = now;
      frames = 0;
      slowSince = fps < LOW_FPS ? (slowSince ?? start) : null;
      fastSince = fps > HIGH_FPS ? (fastSince ?? start) : null;
      if (now - changedAt < COOLDOWN_MS) return null;
      if (slowSince !== null && now - slowSince >= SLOW_MS) {
        if (index === steps.length - 1) {
          if (!warned) onSlow?.();
          warned = true;
          return null;
        }
        index++;
      } else if (fastSince !== null && now - fastSince >= FAST_MS && index > 0) {
        index--;
      } else {
        return null;
      }
      slowSince = null;
      fastSince = null;
      changedAt = now;
      return steps[index];
    },
  };
}

// Nivel: ?calidad=alta|media|baja o la opción manual lo fijan; si no (Auto), media en celular y alta en PC
export function initialQuality(search = '', touch = false, manual = 'auto') {
  const names = { alta: 'high', media: 'medium', baja: 'low' };
  const forced = names[new URLSearchParams(search).get('calidad')] ?? (QUALITY[manual] ? manual : null);
  return { initial: touch ? 'medium' : 'high', forced };
}
