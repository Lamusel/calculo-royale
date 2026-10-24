import { ATTACHMENTS } from '@calculo-royale/shared/constants';
import { onSettings, settings } from '../settings.js';
import MANIFEST from './audio-manifest.json' with { type: 'json' };
import { allowVoice, channelLevel, duckLevel, SHOT_VOICES, spatial } from './mix.js';
import { createMusic } from './music.js';
import { radioToSpeech, Speaker } from './speech.js';

// Audio del juego con Web Audio. El contexto se crea con el primer toque o tecla (los navegadores
// no dejan sonar antes). Tres canales con su volumen (Música, Efectos y Voz) bajo el general y
// "Silenciar todo" (Opciones). Los efectos son sintetizados; si existe un archivo propio
// (client/public/assets/audio/sfx/<nombre>.mp3, ver audio-manifest.json) se usa ese.
// Todo lo que suena en el mapa usa la posición del oyente para el volumen y el paneo.
// Mientras habla el Mando (speechSynthesis), la música y los efectos bajan (ducking).

let ctx = null;
let sfxBus = null; // canal de efectos (volumen del canal × ducking)
let musicBus = null;
let noise = null;
let music = null;
let voices = 0;
let speaking = false;
const listener = { x: 0, y: 0 };
const buffers = new Map(); // ruta → Promise<AudioBuffer | null>

const speaker = new Speaker({
  onStart: () => setSpeaking(true),
  onEnd: () => setSpeaking(false),
});

function applyLevels(s = settings) {
  speaker.volume = channelLevel(s, 'voice');
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(channelLevel(s, 'sfx') * duckLevel('sfx', speaking), ctx.currentTime, 0.08);
  musicBus.gain.setTargetAtTime(channelLevel(s, 'music') * duckLevel('music', speaking), ctx.currentTime, 0.2);
  if (s.muted) speaker.stop();
}

function setSpeaking(on) {
  speaking = on;
  applyLevels();
}

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(ctx.destination);
  musicBus.connect(ctx.destination);
  sfxBus.gain.value = 0;
  musicBus.gain.value = 0;
  applyLevels();
  onSettings(applyLevels);
  // Un segundo de ruido blanco que reutilizan todos los sonidos
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  music = createMusic(ctx, musicBus, noise, (moment) => (MANIFEST.music[moment] ? loadBuffer(MANIFEST.music[moment]) : null));
  if (pendingMoment) music.setMoment(pendingMoment);
}

applyLevels();

// Archivo propio: se descarga una vez (la primera vez suena el sintetizado mientras tanto)
function loadBuffer(path) {
  if (!buffers.has(path)) {
    buffers.set(
      path,
      fetch(path)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((data) => (data ? ctx.decodeAudioData(data) : null))
        .catch(() => null),
    );
  }
  return buffers.get(path);
}
const loaded = new Map(); // ruta → AudioBuffer listo

export function setListener(x, y) {
  listener.x = x;
  listener.y = y;
}

// Salida de un sonido en el canal de efectos: ganancia y paneo según dónde ocurre (o centrado si
// es de la interfaz). priority: 0 relleno, 1 normal, 2 importante (ver allowVoice).
function output(level, at = null, priority = 1) {
  if (!ctx || !allowVoice(voices, priority)) return null;
  const { gain, pan } = at ? spatial(at.x - listener.x, at.y - listener.y) : { gain: 1, pan: 0 };
  if (gain * level < 0.01) return null;
  const g = ctx.createGain();
  g.gain.value = gain * level;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(sfxBus);
  voices++;
  setTimeout(() => voices--, 1500);
  return g;
}

// Si hay archivo propio para `name` y ya cargó, suena ese y devuelve true
function playFile(name, out) {
  const path = MANIFEST.sfx[name];
  if (!path) return false;
  const buffer = loaded.get(path);
  if (!buffer) {
    loadBuffer(path).then((b) => b && loaded.set(path, b));
    return false;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(out);
  src.start();
  return true;
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

// Efecto con nombre: archivo propio si lo hay, si no la versión sintetizada
function effect(name, { level = 0.5, at = null, priority = 1 }, synth) {
  const out = output(level, at, priority);
  if (!out) return;
  if (!playFile(name, out)) synth(out);
}

// Nombres de efecto (para los archivos propios): ver la sección "Sonido" del README
export const SFX_NAMES = [
  'disparo-pistola', 'disparo-escopeta', 'disparo-rifle', 'disparo-francotirador', 'recarga', 'granada', 'explosion', 'paso',
  'candado-abierto', 'candado-fallido', 'sirena', 'radio', 'salto', 'paracaidas', 'impacto', 'baja', 'dano', 'curar', 'curado',
  'tomar', 'cambio-arma', 'sin-balas', 'fuera-zona', 'cuenta', 'pregunta', 'tiempo', 'avion', 'aterrizaje', 'jeep-arranque',
  'jeep-choque', 'radar', 'logro', 'clic',
];
const SHOT_NAMES = ['disparo-pistola', 'disparo-escopeta', 'disparo-rifle', 'disparo-francotirador'];

export const sound = {
  // Con silenciador: más bajo, más seco y solo se oye de cerca
  shot(weapon, x, y, silent = false) {
    const v = SHOT_VOICES[weapon] ?? SHOT_VOICES[0];
    if (silent && Math.hypot(x - listener.x, y - listener.y) > ATTACHMENTS.silencerHearRadius) return;
    effect(SHOT_NAMES[weapon] ?? SHOT_NAMES[0], { level: silent ? v.level * 0.3 : v.level, at: { x, y }, priority: 2 }, (out) => {
      noiseBurst(out, { filter: silent ? v.filter * 0.5 : v.filter, decay: silent ? v.decay * 0.5 : v.decay, peak: 0.9, sweepTo: v.filter * 0.25 });
      if (!silent) tone(out, { freq: v.thump, to: v.thump * 0.4, decay: v.decay * 0.8, peak: 0.6 });
    });
  },
  reload() {
    effect('recarga', { level: 0.35 }, (out) => {
      noiseBurst(out, { filter: 4500, type: 'highpass', decay: 0.04, peak: 0.6 });
      noiseBurst(out, { filter: 3500, type: 'highpass', decay: 0.05, peak: 0.7, start: 0.35 });
    });
  },
  grenadeThrow() {
    effect('granada', { level: 0.4 }, (out) => noiseBurst(out, { filter: 600, type: 'bandpass', q: 2, attack: 0.05, decay: 0.3, peak: 0.7, sweepTo: 2400 }));
  },
  explosion(x, y) {
    effect('explosion', { level: 1, at: { x, y }, priority: 2 }, (out) => {
      noiseBurst(out, { filter: 1200, decay: 0.9, peak: 1, sweepTo: 90 });
      tone(out, { freq: 70, to: 30, decay: 0.8, peak: 0.9 });
    });
  },
  footstep(x, y) {
    effect('paso', { level: 0.12, at: { x, y }, priority: 0 }, (out) => noiseBurst(out, { filter: 500 + Math.random() * 300, decay: 0.06, peak: 0.6 }));
  },
  lockOpen() {
    effect('candado-abierto', { level: 0.4, priority: 2 }, (out) => {
      [523, 659, 784].forEach((f, i) => tone(out, { type: 'triangle', freq: f, decay: 0.18, peak: 0.5, start: i * 0.09 }));
    });
  },
  lockFail() {
    effect('candado-fallido', { level: 0.35, priority: 2 }, (out) => tone(out, { type: 'square', freq: 110, decay: 0.45, peak: 0.4 }));
  },
  siren() {
    effect('sirena', { level: 0.4, priority: 2 }, (out) => {
      for (let i = 0; i < 3; i++) {
        tone(out, { type: 'sawtooth', freq: 620, to: 920, attack: 0.05, decay: 0.45, peak: 0.25, start: i * 0.6 });
        tone(out, { type: 'sawtooth', freq: 920, to: 620, attack: 0.05, decay: 0.05, peak: 0.25, start: i * 0.6 + 0.5 });
      }
    });
  },
  radio() {
    effect('radio', { level: 0.3, priority: 2 }, (out) => {
      noiseBurst(out, { filter: 2500, type: 'highpass', decay: 0.25, peak: 0.35 });
      tone(out, { type: 'sine', freq: 1050, decay: 0.12, peak: 0.35, start: 0.22 });
    });
  },
  jump() {
    effect('salto', { level: 0.5 }, (out) => noiseBurst(out, { filter: 2400, type: 'bandpass', q: 1.5, attack: 0.05, decay: 0.7, peak: 0.7, sweepTo: 300 }));
  },
  parachute() {
    effect('paracaidas', { level: 0.5 }, (out) => {
      for (let i = 0; i < 3; i++) noiseBurst(out, { filter: 900, type: 'bandpass', q: 1, decay: 0.08, peak: 0.6, start: i * 0.07 });
    });
  },
  // --- Fase 19 ---
  hit(killed = false) {
    effect('impacto', { level: 0.3, priority: 2 }, (out) => tone(out, { type: 'square', freq: killed ? 1500 : 1900, decay: 0.05, peak: 0.35 }));
  },
  kill() {
    effect('baja', { level: 0.45, priority: 2 }, (out) => {
      tone(out, { type: 'triangle', freq: 880, decay: 0.09, peak: 0.45 });
      tone(out, { type: 'triangle', freq: 1320, decay: 0.16, peak: 0.45, start: 0.08 });
    });
  },
  hurt() {
    effect('dano', { level: 0.45, priority: 2 }, (out) => {
      noiseBurst(out, { filter: 300, decay: 0.18, peak: 0.8 });
      tone(out, { freq: 90, to: 55, decay: 0.2, peak: 0.6 });
    });
  },
  healStart() {
    effect('curar', { level: 0.3 }, (out) => noiseBurst(out, { filter: 3000, type: 'bandpass', q: 3, attack: 0.08, decay: 0.4, peak: 0.4 }));
  },
  healEnd() {
    effect('curado', { level: 0.35 }, (out) => [659, 988].forEach((f, i) => tone(out, { type: 'sine', freq: f, decay: 0.2, peak: 0.4, start: i * 0.08 })));
  },
  pickup() {
    effect('tomar', { level: 0.3 }, (out) => {
      noiseBurst(out, { filter: 1800, type: 'bandpass', decay: 0.05, peak: 0.6 });
      tone(out, { type: 'triangle', freq: 740, decay: 0.06, peak: 0.3, start: 0.04 });
    });
  },
  weaponSwitch() {
    effect('cambio-arma', { level: 0.25 }, (out) => noiseBurst(out, { filter: 2600, type: 'highpass', decay: 0.07, peak: 0.6 }));
  },
  dryFire() {
    effect('sin-balas', { level: 0.25 }, (out) => tone(out, { type: 'square', freq: 2400, decay: 0.02, peak: 0.3 }));
  },
  zonePulse() {
    effect('fuera-zona', { level: 0.35, priority: 2 }, (out) => {
      tone(out, { freq: 60, decay: 0.12, peak: 0.8 });
      tone(out, { freq: 55, decay: 0.12, peak: 0.6, start: 0.22 });
    });
  },
  countdown(last = false) {
    effect('cuenta', { level: 0.3, priority: 2 }, (out) => tone(out, { type: 'sine', freq: last ? 1320 : 880, decay: last ? 0.35 : 0.1, peak: 0.45 }));
  },
  question() {
    effect('pregunta', { level: 0.3, priority: 2 }, (out) => [784, 1046].forEach((f, i) => tone(out, { type: 'triangle', freq: f, decay: 0.12, peak: 0.35, start: i * 0.07 })));
  },
  timeWarning() {
    effect('tiempo', { level: 0.25, priority: 2 }, (out) => tone(out, { type: 'square', freq: 1200, decay: 0.04, peak: 0.25 }));
  },
  plane() {
    effect('avion', { level: 0.45, priority: 2 }, (out) => noiseBurst(out, { filter: 200, type: 'lowpass', attack: 1.2, decay: 2.8, peak: 0.8, sweepTo: 600 }));
  },
  landing() {
    effect('aterrizaje', { level: 0.45 }, (out) => {
      noiseBurst(out, { filter: 400, decay: 0.15, peak: 0.8 });
      tone(out, { freq: 80, to: 50, decay: 0.15, peak: 0.6 });
    });
  },
  jeepStart() {
    effect('jeep-arranque', { level: 0.45 }, (out) => {
      tone(out, { type: 'sawtooth', freq: 30, to: 70, attack: 0.05, decay: 0.6, peak: 0.5 });
      noiseBurst(out, { filter: 500, decay: 0.5, peak: 0.4 });
    });
  },
  jeepCrash(x, y) {
    effect('jeep-choque', { level: 0.6, at: { x, y }, priority: 2 }, (out) => {
      noiseBurst(out, { filter: 2000, decay: 0.3, peak: 0.9, sweepTo: 400 });
      tone(out, { type: 'square', freq: 150, to: 60, decay: 0.25, peak: 0.4 });
    });
  },
  radar() {
    effect('radar', { level: 0.3, priority: 2 }, (out) => [0, 0.25, 0.5].forEach((t) => tone(out, { type: 'sine', freq: 1400, decay: 0.15, peak: 0.3, start: t })));
  },
  achievement() {
    effect('logro', { level: 0.45, priority: 2 }, (out) => [523, 659, 784, 1046].forEach((f, i) => tone(out, { type: 'triangle', freq: f, decay: 0.25, peak: 0.4, start: i * 0.1 })));
  },
  click() {
    effect('clic', { level: 0.15 }, (out) => tone(out, { type: 'sine', freq: 1800, decay: 0.02, peak: 0.3 }));
  },
};

// Música del momento (lobby, bus, partida, zona, duelo, victoria, resultados) o null para callar
let pendingMoment = null;
export function setMusicMoment(moment) {
  pendingMoment = moment;
  music?.setMoment(moment);
}

// Voz del Mando: título y texto (las fórmulas se leen en palabras)
export function speak(title, text) {
  if (settings.muted) return;
  speaker.say(`${title}. ${radioToSpeech(text)}`);
}

// Motores continuos: el jeep más cercano que se mueve y el bus mientras vas en él
function continuous() {
  let node = null;
  return {
    update(params) {
      if (!ctx) return;
      if (!params) {
        if (node) {
          node.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          const e = node;
          setTimeout(() => e.osc.stop(), 400);
          node = null;
        }
        return;
      }
      if (!node) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = params.filter ?? 420;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const pan = ctx.createStereoPanner();
        osc.connect(filter).connect(gain).connect(pan).connect(sfxBus);
        osc.start();
        node = { osc, gain, pan };
      }
      node.osc.frequency.setTargetAtTime(params.freq, ctx.currentTime, 0.1);
      node.gain.gain.setTargetAtTime(params.gain, ctx.currentTime, 0.1);
      node.pan.pan.setTargetAtTime(params.pan ?? 0, ctx.currentTime, 0.1);
    },
  };
}

const engine = continuous();
export function updateEngine(nearest) {
  if (!nearest) return engine.update(null);
  const { gain, pan } = spatial(nearest.x - listener.x, nearest.y - listener.y);
  engine.update({ freq: 38 + Math.abs(nearest.speed) * 5, gain: gain * 0.25, pan });
}

const busHum = continuous();
// Zumbido grave del bus de despliegue mientras vas adentro
export function updateBusHum(inBus) {
  busHum.update(inBus ? { freq: 46, gain: 0.12, filter: 260 } : null);
}
