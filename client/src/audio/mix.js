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
export const SHOT_VOICES = [
  { filter: 2600, decay: 0.12, thump: 140, level: 0.55 }, // pistola
  { filter: 1300, decay: 0.32, thump: 90, level: 0.9 }, // escopeta
  { filter: 2000, decay: 0.09, thump: 120, level: 0.5 }, // rifle (ráfagas)
  { filter: 3600, decay: 0.45, thump: 70, level: 1 }, // francotirador
];
