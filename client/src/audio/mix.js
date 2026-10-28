import { WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
// Reglas de mezcla (sin Web Audio, para poder probarlas): volumen y paneo según dónde suena
// algo respecto al jugador.

export const HEARING = 60; // más allá de esto no se oye
const FALLOFF = 12; // a esta distancia suena a la mitad

// Ganancia (0 a 1) y paneo (−1 izquierda, 1 derecha) de un sonido en (dx, dy) respecto al oyente.
// La cámara mira al norte: lo que está al este suena a la derecha.
export function spatial(dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d > HEARING) return { gain: 0, pan: 0 };
  const fade = 1 - Math.max(0, (d - HEARING * 0.7) / (HEARING * 0.3));
  return { gain: fade / (1 + d / FALLOFF), pan: Math.max(-1, Math.min(1, dx / 25)) };
}

// Volumen maestro: curva perceptual (el deslizador al 50 % se siente como la mitad)
export const masterLevel = (volume) => Math.max(0, Math.min(1, volume)) ** 2;

// Timbre de cada arma (índice en WEAPON_IDS): filtro, duración, cuerpo grave y volumen
// Timbre de cada arma (fase 29): el de su categoría con una variación propia, para reconocerla de oído
const CATEGORY_VOICE = {
  pistol: { filter: 2600, decay: 0.12, thump: 140, level: 0.55 },
  smg: { filter: 2300, decay: 0.08, thump: 110, level: 0.45 },
  ar: { filter: 2000, decay: 0.09, thump: 120, level: 0.5 },
  shotgun: { filter: 1300, decay: 0.32, thump: 90, level: 0.9 },
  dmr: { filter: 3000, decay: 0.25, thump: 95, level: 0.75 },
  sniper: { filter: 3600, decay: 0.45, thump: 70, level: 1 },
  lmg: { filter: 1800, decay: 0.1, thump: 130, level: 0.6 },
  special: { filter: 900, decay: 0.5, thump: 60, level: 0.95 },
  melee: { filter: 600, decay: 0.05, thump: 200, level: 0.3 },
};
const OVERRIDES = { crossbow: { filter: 500, decay: 0.06, thump: 30, level: 0.15 } };
const hash = (id) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7);
export const SHOT_VOICES = WEAPON_IDS.map((id) => {
  const w = WEAPONS[id];
  if (!w) return null;
  const base = OVERRIDES[id] ?? CATEGORY_VOICE[w.category];
  const k = hash(id);
  return { ...base, filter: base.filter * (0.86 + (k % 29) / 100), decay: base.decay * (0.9 + (k % 23) / 100) };
});

// --- Fase 19: canales, prioridad de voces, ducking y momento musical ---

// Volumen de un canal (Música, Efectos, Voz) con el general y el silencio
export const channelLevel = (settings, channel) => (settings.muted ? 0 : masterLevel(settings.volume) * masterLevel(settings[`${channel}Volume`] ?? 1));

// Mientras habla el Mando, la música y los efectos bajan a esta fracción
export const DUCK = { music: 0.3, sfx: 0.6 };
export const duckLevel = (channel, speaking) => (speaking ? (DUCK[channel] ?? 1) : 1);

// Límite de voces con prioridad: 0 relleno (pasos), 1 normal, 2 importante (disparos, explosiones,
// avisos). Con el cupo casi lleno solo entran las importantes.
export const MAX_VOICES = 28;
export function allowVoice(active, priority) {
  if (active >= MAX_VOICES) return false;
  if (priority <= 0) return active < MAX_VOICES - 10;
  if (priority === 1) return active < MAX_VOICES - 4;
  return true;
}

// Momento musical según lo que pasa en la sala (ver music.js)
export function musicMoment({ phase, deploying, duel, closing, winner, alive = true }) {
  if (phase === 'lobby') return 'lobby';
  if (phase === 'results') return winner ? 'victoria' : 'resultados';
  if (deploying) return 'bus';
  if (duel) return 'duelo';
  if (closing || !alive) return 'zona';
  return 'partida';
}
