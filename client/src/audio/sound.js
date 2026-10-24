import { ATTACHMENTS } from '@calculo-royale/shared/constants';
import { onSettings, settings } from '../settings.js';
import { masterLevel, SHOT_VOICES, spatial } from './mix.js';

// Sonidos sintetizados con Web Audio (sin archivos). El contexto se crea con el primer toque o
// tecla (los navegadores no dejan sonar antes). Todo lo que suena en el mapa usa la posición
// del oyente (el jugador o a quien sigue la cámara) para el volumen y el paneo.

let ctx = null;
let master = null;
let noise = null;
let voices = 0;
const MAX_VOICES = 28;
const listener = { x: 0, y: 0 };

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = masterLevel(settings.volume);
  master.connect(ctx.destination);
  onSettings((s) => master.gain.setTargetAtTime(masterLevel(s.volume), ctx.currentTime, 0.05));
  // Un segundo de ruido blanco que reutilizan todos los sonidos
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function setListener(x, y) {
  listener.x = x;
  listener.y = y;
}

// Salida de un sonido: ganancia y paneo según dónde ocurre (o centrado si es de la interfaz)
function output(level, at = null) {
  if (!ctx || voices >= MAX_VOICES) return null;
  const { gain, pan } = at ? spatial(at.x - listener.x, at.y - listener.y) : { gain: 1, pan: 0 };
  if (gain * level < 0.01) return null;
  const g = ctx.createGain();
  g.gain.value = gain * level;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(master);
  voices++;
  setTimeout(() => voices--, 1500);
  return g;
}

function noiseBurst(dest, { filter = 2000, type = 'lowpass', q = 0.7, attack = 0.002, decay = 0.2, peak = 1, start = 0, sweepTo = null }) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filter, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + decay);
  f.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(f).connect(env).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + attack + decay + 0.05);
}

function tone(dest, { type = 'sine', freq = 440, to = null, attack = 0.005, decay = 0.2, peak = 0.5, start = 0 }) {
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(env).connect(dest);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

export const sound = {
  // Con silenciador: más bajo, más seco y solo se oye de cerca
  shot(weapon, x, y, silent = false) {
    const v = SHOT_VOICES[weapon] ?? SHOT_VOICES[0];
    if (silent && Math.hypot(x - listener.x, y - listener.y) > ATTACHMENTS.silencerHearRadius) return;
    const out = output(silent ? v.level * 0.3 : v.level, { x, y });
    if (!out) return;
    noiseBurst(out, { filter: silent ? v.filter * 0.5 : v.filter, decay: silent ? v.decay * 0.5 : v.decay, peak: 0.9, sweepTo: v.filter * 0.25 });
    if (!silent) tone(out, { freq: v.thump, to: v.thump * 0.4, decay: v.decay * 0.8, peak: 0.6 });
  },
  reload() {
    const out = output(0.35);
    if (!out) return;
    noiseBurst(out, { filter: 4500, type: 'highpass', decay: 0.04, peak: 0.6 });
    noiseBurst(out, { filter: 3500, type: 'highpass', decay: 0.05, peak: 0.7, start: 0.35 });
  },
  grenadeThrow() {
    const out = output(0.4);
    if (out) noiseBurst(out, { filter: 600, type: 'bandpass', q: 2, attack: 0.05, decay: 0.3, peak: 0.7, sweepTo: 2400 });
  },
  explosion(x, y) {
    const out = output(1, { x, y });
    if (!out) return;
    noiseBurst(out, { filter: 1200, decay: 0.9, peak: 1, sweepTo: 90 });
    tone(out, { freq: 70, to: 30, decay: 0.8, peak: 0.9 });
  },
  footstep(x, y) {
    const out = output(0.12, { x, y });
    if (out) noiseBurst(out, { filter: 500 + Math.random() * 300, decay: 0.06, peak: 0.6 });
  },
  lockOpen() {
    const out = output(0.4);
    if (!out) return;
    [523, 659, 784].forEach((f, i) => tone(out, { type: 'triangle', freq: f, decay: 0.18, peak: 0.5, start: i * 0.09 }));
  },
  lockFail() {
    const out = output(0.35);
    if (out) tone(out, { type: 'square', freq: 110, decay: 0.45, peak: 0.4 });
  },
  siren() {
    const out = output(0.4);
    if (!out) return;
    for (let i = 0; i < 3; i++) {
      tone(out, { type: 'sawtooth', freq: 620, to: 920, attack: 0.05, decay: 0.45, peak: 0.25, start: i * 0.6 });
      tone(out, { type: 'sawtooth', freq: 920, to: 620, attack: 0.05, decay: 0.05, peak: 0.25, start: i * 0.6 + 0.5 });
    }
  },
  radio() {
    const out = output(0.3);
    if (!out) return;
    noiseBurst(out, { filter: 2500, type: 'highpass', decay: 0.25, peak: 0.35 });
    tone(out, { type: 'sine', freq: 1050, decay: 0.12, peak: 0.35, start: 0.22 });
  },
  jump() {
    const out = output(0.5);
    if (out) noiseBurst(out, { filter: 2400, type: 'bandpass', q: 1.5, attack: 0.05, decay: 0.7, peak: 0.7, sweepTo: 300 });
  },
  parachute() {
    const out = output(0.5);
    if (!out) return;
    for (let i = 0; i < 3; i++) noiseBurst(out, { filter: 900, type: 'bandpass', q: 1, decay: 0.08, peak: 0.6, start: i * 0.07 });
  },
};

// Motor del jeep más cercano que se mueve: un oscilador continuo que sube con la velocidad
let engine = null;
export function updateEngine(nearest) {
  if (!ctx) return;
  if (!nearest) {
    if (engine) {
      engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      const e = engine;
      setTimeout(() => e.osc.stop(), 400);
      engine = null;
    }
    return;
  }
  if (!engine) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    osc.connect(filter).connect(gain).connect(pan).connect(master);
    osc.start();
    engine = { osc, gain, pan };
  }
  const { gain, pan } = spatial(nearest.x - listener.x, nearest.y - listener.y);
  engine.osc.frequency.setTargetAtTime(38 + Math.abs(nearest.speed) * 5, ctx.currentTime, 0.1);
  engine.gain.gain.setTargetAtTime(gain * 0.25, ctx.currentTime, 0.1);
  engine.pan.pan.setTargetAtTime(pan, ctx.currentTime, 0.1);
}
