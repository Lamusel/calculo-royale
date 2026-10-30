import { ATTACHMENTS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { onSettings, settings } from '../settings.js';
import MANIFEST from './audio-manifest.json' with { type: 'json' };
import { allowVoice, categoryLevel, channelLevel, duckLevel, FADE_MS, maxDurationFor, SHOT_VOICES, spatial, voiceToDrop } from './mix.js';
import { createMusic } from './music.js';

// Audio del juego con Web Audio. El contexto se crea con el primer toque o tecla (los navegadores
// no dejan sonar antes). Tres canales con su volumen (Música, Efectos y Voz) bajo el general y
// "Silenciar todo" (Opciones). Los efectos son sintetizados; si existe un archivo propio
// (client/public/assets/audio/<nombre>.mp3|ogg|wav, con variantes nombre-2…; ver audio-manifest.json)
// se usa ese. Todo lo que suena en el mapa usa la posición del oyente para el volumen y el paneo.
// 7A: bucles (motores, clima, río, fuego, ambiente por zona, radio del camión) y voz grabada del
// Mando (voz/<frase>.mp3) con filtro de radio y ducking. Sin archivo de voz no se habla: solo texto.

let ctx = null;
let sfxBus = null; // canal de efectos (volumen del canal × ducking)
let musicBus = null;
let noise = null;
let music = null;
let speaking = false; // la voz grabada del Mando está sonando (ducking)
let voiceBus = null;
const listener = { x: 0, y: 0 };
const buffers = new Map(); // ruta → Promise<AudioBuffer | null>

function applyLevels(s = settings) {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(channelLevel(s, 'sfx') * duckLevel('sfx', speaking), ctx.currentTime, 0.08);
  musicBus.gain.setTargetAtTime(channelLevel(s, 'music') * duckLevel('music', speaking), ctx.currentTime, 0.2);
  voiceBus?.gain.setTargetAtTime(channelLevel(s, 'voice'), ctx.currentTime, 0.1);
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
  voiceBus = ctx.createGain();
  sfxBus.connect(ctx.destination);
  musicBus.connect(ctx.destination);
  voiceBus.connect(ctx.destination);
  sfxBus.gain.value = 0;
  musicBus.gain.value = 0;
  applyLevels();
  onSettings(applyLevels);
  // Un segundo de ruido blanco que reutilizan todos los sonidos
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  music = createMusic(ctx, musicBus, noise, (moment) => (MANIFEST.music[moment] ? loadBuffer(pick(MANIFEST.music[moment])) : null));
  if (pendingMoment) music.setMoment(pendingMoment);
}

applyLevels();

// Una variante al azar (nombre, nombre-2, nombre-3…)
const pick = (list) => (Array.isArray(list) ? list[Math.floor(Math.random() * list.length)] : list);
export const hasFile = (name) => Boolean(MANIFEST.sfx[name]?.length);
export const hasMusic = (name) => Boolean(MANIFEST.music[name]?.length);

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

// Voces activas (7B): cada sonido suelto queda registrado hasta que termina. Con el cupo lleno se corta
// con fundido el menos importante y más lejano (mix.js: voiceToDrop): un audio largo nunca bloquea a otro.
const active = new Set();

// Baja la ganancia en `ms` y detiene las fuentes (sin clic)
function fadeOut(gainNode, sources, ms = FADE_MS) {
  const t = ctx.currentTime;
  gainNode.gain.cancelScheduledValues(t);
  gainNode.gain.setValueAtTime(gainNode.gain.value, t);
  gainNode.gain.linearRampToValueAtTime(0.0001, t + ms / 1000);
  for (const s of sources) {
    try {
      s.stop(t + ms / 1000 + 0.02);
    } catch {
      // ya estaba detenida
    }
  }
}

// Salida de un sonido en el canal de efectos: ganancia y paneo según dónde ocurre (o centrado si
// es de la interfaz). priority: 0 relleno, 1 normal, 2 importante. Devuelve la voz: { out, stop(ms) }
function output(level, at = null, priority = 1, name = '') {
  if (!ctx) return null;
  level *= categoryLevel(name);
  const { gain, pan } = at ? spatial(at.x - listener.x, at.y - listener.y) : { gain: 1, pan: 0 };
  const loud = gain * level;
  if (loud < 0.01) return null;
  if (!allowVoice(active.size, priority)) {
    const victim = voiceToDrop([...active], { priority, loud });
    if (!victim) return null;
    victim.stop(FADE_MS);
  }
  const g = ctx.createGain();
  g.gain.value = loud;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(sfxBus);
  const voice = {
    priority,
    loud,
    out: g,
    sources: [],
    stop(ms = FADE_MS) {
      if (!active.has(voice)) return;
      active.delete(voice);
      clearTimeout(voice.timer);
      fadeOut(g, voice.sources, ms);
    },
  };
  active.add(voice);
  // Los sintetizados son cortos: se liberan solos a los 1,5 s
  voice.timer = setTimeout(() => active.delete(voice), 1500);
  return voice;
}

// Si hay archivo propio para `name` y ya cargó, suena ese y devuelve true. Los efectos de un instante
// se cortan con fundido en su duración máxima (mix.js: SOUND_MAX_MS)
function playFile(name, voice, rate = 1) {
  const list = MANIFEST.sfx[name];
  if (!list?.length) return false;
  // Todas las variantes se piden la primera vez; suena una al azar de las ya cargadas
  for (const path of list) if (!loaded.has(path)) loadBuffer(path).then((b) => b && loaded.set(path, b));
  const ready = list.filter((p) => loaded.get(p));
  if (!ready.length) return false;
  const src = ctx.createBufferSource();
  src.buffer = loaded.get(pick(ready));
  src.playbackRate.value = rate;
  src.connect(voice.out);
  src.start();
  voice.sources.push(src);
  const length = (src.buffer.duration / rate) * 1000;
  const max = maxDurationFor(name);
  clearTimeout(voice.timer);
  if (max && length > max) voice.timer = setTimeout(() => voice.stop(FADE_MS), max - FADE_MS);
  else {
    voice.timer = null;
    src.onended = () => active.delete(voice);
  }
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
// far: nombre del archivo para cuando suena lejos (disparo-lejano, explosion-lejana), si existe
const FAR = 32;
// Devuelve la voz (para cortarla cuando termina la acción: recarga, humo, aturdidora…) o null
function effect(name, { level = 0.5, at = null, priority = 1, far = null }, synth) {
  const distant = far && at && hasFile(far) && Math.hypot(at.x - listener.x, at.y - listener.y) > FAR;
  const file = distant ? far : name;
  const voice = output(distant ? level * 1.6 : level, at, priority, file);
  if (!voice) return null;
  if (!playFile(file, voice)) synth(voice.out);
  return voice;
}

// Disparos seguidos: cada uno nuevo corta con fundido el anterior del mismo tirador
const lastShotVoice = new Map();

// Nombres de efecto (para los archivos propios): ver la sección "Sonido" del README
export const SFX_NAMES = [
  'disparo-pistola', 'disparo-escopeta', 'disparo-rifle', 'disparo-francotirador', 'recarga', 'granada', 'explosion', 'paso',
  'candado-abierto', 'candado-fallido', 'sirena', 'radio', 'salto', 'paracaidas', 'impacto', 'baja', 'dano', 'curar', 'curado',
  'tomar', 'cambio-arma', 'sin-balas', 'fuera-zona', 'cuenta', 'pregunta', 'tiempo', 'avion', 'aterrizaje', 'jeep-arranque',
  'jeep-choque', 'radar', 'logro', 'clic',
];
// Archivo de disparo por categoría (y las especiales por arma)
const SHOT_FILE = { pistol: 'disparo-pistola', smg: 'disparo-subfusil', ar: 'disparo-rifle', shotgun: 'disparo-escopeta', dmr: 'disparo-tirador', sniper: 'disparo-francotirador', lmg: 'disparo-ametralladora', special: 'disparo-lanzacohetes' };
const shotName = (weapon) => {
  const id = WEAPON_IDS[weapon];
  if (id === 'crossbow') return 'disparo-ballesta';
  return SHOT_FILE[WEAPONS[id]?.category] ?? 'disparo-pistola';
};

export const sound = {
  // Con silenciador: más bajo, más seco y solo se oye de cerca
  // shooter: quien dispara (en las automáticas, el disparo nuevo corta el anterior suyo)
  shot(weapon, x, y, silent = false, shooter = null) {
    const v = SHOT_VOICES[weapon] ?? SHOT_VOICES[0];
    if (silent && Math.hypot(x - listener.x, y - listener.y) > ATTACHMENTS.silencerHearRadius) return;
    if (shooter !== null) lastShotVoice.get(shooter)?.stop(80);
    const voice = effect(silent ? 'disparo-silenciado' : shotName(weapon), { level: silent ? v.level * 0.3 : v.level, at: { x, y }, priority: 2, far: silent ? null : 'disparo-lejano' }, (out) => {
      noiseBurst(out, { filter: silent ? v.filter * 0.5 : v.filter, decay: silent ? v.decay * 0.5 : v.decay, peak: 0.9, sweepTo: v.filter * 0.25 });
      if (!silent) tone(out, { freq: v.thump, to: v.thump * 0.4, decay: v.decay * 0.8, peak: 0.6 });
    });
    if (shooter !== null && voice) lastShotVoice.set(shooter, voice);
    // El casquillo cae un momento después (suave; solo cerca y si hay archivo, para no ensuciar)
    if (hasFile('casquillo') && WEAPONS[WEAPON_IDS[weapon]]?.category !== 'melee' && Math.hypot(x - listener.x, y - listener.y) < 12) {
      setTimeout(() => effect('casquillo', { level: 0.12, at: { x, y }, priority: 0 }, () => {}), 260);
    }
  },
  melee(id, x, y) {
    const name = id === 'fists' ? 'golpe' : id === 'machete' || id === 'katana' ? 'tajo' : 'estocada';
    effect(name, { level: 0.45, at: { x, y }, priority: 1 }, (out) => {
      noiseBurst(out, { filter: id === 'fists' ? 700 : 3200, type: id === 'fists' ? 'lowpass' : 'bandpass', q: 1.5, attack: 0.02, decay: id === 'fists' ? 0.08 : 0.16, peak: 0.8, sweepTo: id === 'fists' ? 200 : 6000 });
      if (id === 'fists') tone(out, { freq: 140, to: 60, decay: 0.08, peak: 0.5 });
    });
  },
  reload(bolt = false) {
    return effect(bolt ? 'recarga-cerrojo' : 'recarga', { level: 0.35 }, (out) => {
      noiseBurst(out, { filter: 4500, type: 'highpass', decay: 0.04, peak: 0.6 });
      noiseBurst(out, { filter: 3500, type: 'highpass', decay: 0.05, peak: 0.7, start: 0.35 });
    });
  },
  grenadeThrow() {
    effect('granada-pin', { level: 0.4 }, (out) => noiseBurst(out, { filter: 600, type: 'bandpass', q: 2, attack: 0.05, decay: 0.3, peak: 0.7, sweepTo: 2400 }));
  },
  explosion(x, y) {
    effect('explosion', { level: 1, at: { x, y }, priority: 2, far: 'explosion-lejana' }, (out) => {
      noiseBurst(out, { filter: 1200, decay: 0.9, peak: 1, sweepTo: 90 });
      tone(out, { freq: 70, to: 30, decay: 0.8, peak: 0.9 });
    });
  },
  // surface: pasto | tierra | madera | asfalto | agua (mix.js: surfaceAt)
  footstep(x, y, surface = 'pasto') {
    effect(surface === 'agua' ? 'salpicar' : `paso-${surface}`, { level: 0.12, at: { x, y }, priority: 0 }, (out) => noiseBurst(out, { filter: 500 + Math.random() * 300, decay: 0.06, peak: 0.6 }));
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
    effect('tic-tac', { level: 0.25, priority: 2 }, (out) => tone(out, { type: 'square', freq: 1200, decay: 0.04, peak: 0.25 }));
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
    effect('arranque', { level: 0.45 }, (out) => {
      tone(out, { type: 'sawtooth', freq: 30, to: 70, attack: 0.05, decay: 0.6, peak: 0.5 });
      noiseBurst(out, { filter: 500, decay: 0.5, peak: 0.4 });
    });
  },
  jeepCrash(x, y) {
    effect('choque-vehiculo', { level: 0.6, at: { x, y }, priority: 2 }, (out) => {
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
  // --- 7A: más nombres de la lista (todos con versión sintetizada) ---
  meleeHit(x, y) {
    effect('filo-impacto', { level: 0.4, at: { x, y }, priority: 2 }, (out) => noiseBurst(out, { filter: 1600, type: 'bandpass', q: 2, decay: 0.07, peak: 0.8 }));
  },
  woodBreak(x, y) {
    effect('madera-rompe', { level: 0.55, at: { x, y }, priority: 1 }, (out) => {
      for (let i = 0; i < 3; i++) noiseBurst(out, { filter: 900 - i * 200, type: 'bandpass', q: 1.2, decay: 0.09, peak: 0.8, start: i * 0.05 });
      tone(out, { freq: 160, to: 70, decay: 0.15, peak: 0.4 });
    });
  },
  // Lanzables al activarse: humo, fuego (el bucle va aparte), aturdidora, muro, sensor y UAV
  tactical(kind, x, y) {
    const name = { smoke: 'humo', fire: 'fuego', flash: 'aturdidora', wall: 'muro-espuma', sensor: 'sensor-pulso', uav: 'uav' }[kind];
    if (!name) return null;
    return effect(name, { level: 0.45, at: x === undefined ? null : { x, y }, priority: 1 }, (out) => {
      if (kind === 'flash') tone(out, { type: 'sine', freq: 3200, decay: 0.6, peak: 0.4 });
      else if (kind === 'sensor' || kind === 'uav') [0, 0.12].forEach((t) => tone(out, { type: 'sine', freq: 1700, decay: 0.08, peak: 0.3, start: t }));
      else noiseBurst(out, { filter: kind === 'wall' ? 500 : 1400, type: 'bandpass', attack: 0.04, decay: 0.5, peak: 0.6, sweepTo: 300 });
    });
  },
  vehicleBoom(x, y) {
    effect('explosion-vehiculo', { level: 1, at: { x, y }, priority: 2, far: 'explosion-lejana' }, (out) => {
      noiseBurst(out, { filter: 900, decay: 1.2, peak: 1, sweepTo: 70 });
      tone(out, { freq: 55, to: 25, decay: 1, peak: 0.9 });
    });
  },
  brake(x, y) {
    effect('frenazo', { level: 0.35, at: { x, y }, priority: 1 }, (out) => noiseBurst(out, { filter: 2600, type: 'bandpass', q: 6, attack: 0.03, decay: 0.45, peak: 0.6, sweepTo: 1800 }));
  },
  padLaunch() {
    effect('plataforma-salto', { level: 0.5, priority: 1 }, (out) => tone(out, { type: 'sine', freq: 180, to: 900, decay: 0.5, peak: 0.5 }));
  },
  grenadeBounce(x, y) {
    effect('granada-rebote', { level: 0.3, at: { x, y }, priority: 0 }, (out) => tone(out, { type: 'square', freq: 900, decay: 0.03, peak: 0.25 }));
  },
  horn(x, y) {
    effect('bocina', { level: 0.55, at: { x, y }, priority: 1 }, (out) => [415, 523].forEach((f) => tone(out, { type: 'square', freq: f, attack: 0.02, decay: 0.5, peak: 0.18 })));
  },
  ant(x, y) {
    effect('hormiga', { level: 0.4, at: { x, y }, priority: 1 }, (out) => [1568, 1976].forEach((f, i) => tone(out, { type: 'triangle', freq: f, decay: 0.07, peak: 0.3, start: i * 0.06 })));
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

// Zumbido continuo del bus mientras vas en él
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

const busHum = continuous();
// Zumbido grave del bus de despliegue mientras vas adentro
export function updateBusHum(inBus) {
  busHum.update(inBus ? { freq: 46, gain: 0.12, filter: 260 } : null);
}

// --- Bucles (7A): volumen, tono y posición los fija el juego en cada cuadro ---
// params: { name, level, at?, rate?, music? (archivo de music/), synth?: { type: 'noise' | 'engine', filter, q, freq } }
// Si existe el archivo (o una variante) suena en bucle; si no, la versión sintetizada (o nada sin synth).
const loops = new Map(); // clave → { src, gain, pan, filter, file, name }

function makeLoop(params) {
  const list = (params.music ? MANIFEST.music : MANIFEST.sfx)[params.name];
  const path = list && pick(list);
  const buffer = path && loaded.get(path);
  if (path && !buffer) loadBuffer(path).then((b) => b && loaded.set(path, b));
  if (!buffer && !params.synth) return null;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const pan = ctx.createStereoPanner();
  gain.connect(pan).connect(sfxBus);
  let src;
  let filter = null;
  if (buffer && params.playlist) {
    // Radio: las canciones en orden aleatorio, una tras otra (sin repetir la que acaba de sonar)
    for (const p of list) if (!loaded.has(p)) loadBuffer(p).then((b) => b && loaded.set(p, b));
    src = playlistSource(list, path, gain);
  } else if (buffer) {
    src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // El mp3 trae un poco de relleno al principio y al final: el bucle lo salta
    if (buffer.duration > 0.5) {
      src.loopStart = 0.03;
      src.loopEnd = buffer.duration - 0.03;
    }
    src.connect(gain);
  } else if (params.synth.type === 'engine') {
    src = ctx.createOscillator();
    src.type = 'sawtooth';
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = params.synth.filter ?? 420;
    src.connect(filter).connect(gain);
  } else {
    src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    filter = ctx.createBiquadFilter();
    filter.type = params.synth.kind ?? 'lowpass';
    filter.frequency.value = params.synth.filter ?? 800;
    filter.Q.value = params.synth.q ?? 0.7;
    src.connect(filter).connect(gain);
  }
  if (!params.playlist || !buffer) src.start();
  const loop = { src, gain, pan, filter, file: Boolean(buffer), path, name: params.name };
  if (params.playlist && buffer) src.loopRef = loop;
  return loop;
}

// Fuente de una lista de reproducción: al terminar una canción arranca otra al azar en la misma salida
function playlistSource(list, first, gain) {
  let current = first;
  const play = (path) => {
    const s = ctx.createBufferSource();
    s.buffer = loaded.get(path);
    s.connect(gain);
    s.onended = () => {
      if (s.stopped) return;
      const ready = list.filter((p) => loaded.get(p) && (list.length === 1 || p !== current));
      current = pick(ready.length ? ready : [current]);
      const next = play(current);
      if (s.loopRef) s.loopRef.src = next;
      next.loopRef = s.loopRef;
    };
    s.start();
    return s;
  };
  return play(current);
}

export function setLoop(key, params) {
  if (!ctx) return;
  let cur = loops.get(key);
  if (cur && params && (cur.name !== params.name || (!cur.file && cur.path && loaded.get(cur.path)))) {
    // Cambió el sonido o ya llegó el archivo: se rehace (el viejo se apaga suave)
    setLoop(key, null);
    cur = null;
  }
  const { gain: g, pan: p } = params?.at ? spatial(params.at.x - listener.x, params.at.y - listener.y) : { gain: 1, pan: 0 };
  const level = params ? params.level * g * categoryLevel(params.name) : 0;
  if (level < 0.003) {
    if (cur) {
      // Corte con fundido corto (al bajarte, apagarse, explotar o alejarte)
      cur.src.stopped = true;
      fadeOut(cur.gain, [cur.src], FADE_MS);
      loops.delete(key);
    }
    return;
  }
  if (!cur) {
    cur = makeLoop(params);
    if (!cur) return;
    loops.set(key, cur);
  }
  cur.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
  cur.pan.pan.setTargetAtTime(p, ctx.currentTime, 0.1);
  const rate = params.rate ?? 1;
  if (cur.file) cur.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.1);
  else if (params.synth?.type === 'engine') cur.src.frequency.setTargetAtTime((params.synth.freq ?? 40) * rate, ctx.currentTime, 0.1);
}

const ENGINE_FREQ = { jeep: 38, moto: 72, truck: 27, boat: 46 };

// Todo lo que suena en bucle según el mundo. w: { engine: vehículo más cercano en marcha | null,
// maxSpeed, weather, outside (fuera de la zona), fire (el más cercano) | null, ambience (mix.js),
// radio (camión con conductor) | null, zipline, swimming, air }
export function updateWorldAudio(w) {
  if (!ctx) return;
  const v = w.engine;
  setLoop('motor', v && { name: `motor-${v.type ?? 'jeep'}`, at: v, level: 0.35, rate: 0.75 + Math.min(1, Math.abs(v.speed) / (w.maxSpeed || 14)) * 0.8, synth: { type: 'engine', freq: ENGINE_FREQ[v.type] ?? 38 } });
  setLoop('lluvia', w.weather === 'lluvia' && { name: 'lluvia', level: 0.45, synth: { kind: 'highpass', filter: 2800 } });
  setLoop('viento', (w.weather === 'arena' || w.air) && { name: 'viento', level: w.air ? 0.5 : 0.4, synth: { kind: 'bandpass', filter: 500, q: 0.6 } });
  setLoop('tormenta', w.outside && { name: 'tormenta-zona', level: 0.55, synth: { kind: 'lowpass', filter: 170 } });
  setLoop('fuego', w.fire && { name: 'fuego', at: w.fire, level: 0.5, synth: { kind: 'bandpass', filter: 1200, q: 0.8 } });
  const a = w.ambience ?? {};
  setLoop('amb-campo', { name: 'ambiente-campo', level: (a.campo ?? 0) * 0.22, synth: { kind: 'lowpass', filter: 380 } });
  setLoop('amb-bosque', { name: 'ambiente-bosque', level: (a.bosque ?? 0) * 0.2, synth: { kind: 'bandpass', filter: 2300, q: 3 } });
  setLoop('amb-ciudad', { name: 'ambiente-ciudad', level: (a.ciudad ?? 0) * 0.28, synth: { kind: 'lowpass', filter: 160 } });
  setLoop('rio', { name: 'rio', level: (a.rio ?? 0) * 0.4, synth: { kind: 'bandpass', filter: 700, q: 0.8 } });
  // Radio de los vehículos: solo con archivo (music/radio-camion-N), en el más cercano con conductor y apagable
  setLoop('radio', w.radio && { name: 'radio-camion', music: true, playlist: true, at: w.radio, level: 0.55 });
  setLoop('tirolina', w.zipline && { name: 'tirolina', level: 0.35, synth: { kind: 'bandpass', filter: 3000, q: 3 } });
  setLoop('nadar', w.swimming && { name: 'nadar', level: 0.3, synth: { kind: 'bandpass', filter: 600, q: 1 } });
}

export function stopWorldAudio() {
  for (const key of [...loops.keys()]) setLoop(key, null);
}

// --- Voz grabada del Mando (7A): voz/<frase>.mp3 con filtro de radio; la música y los efectos bajan
// mientras habla. Sin archivo, no suena nada (la radio sigue siendo texto). Hasta 2 en espera.
const voiceQueue = [];
let radioCurve = null;
export function playVoice(name) {
  const path = MANIFEST.voice?.[name];
  if (!ctx || !path) return false;
  if (speaking) {
    if (voiceQueue.length < 2 && !voiceQueue.includes(name)) voiceQueue.push(name);
    return true;
  }
  speaking = true;
  loadBuffer(path).then((buffer) => {
    if (!buffer) {
      speaking = false;
      return;
    }
    applyLevels();
    radioCurve ??= Float32Array.from({ length: 256 }, (_, i) => Math.tanh(((i / 128 - 1) * 2.2)) / Math.tanh(2.2));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const low = ctx.createBiquadFilter();
    low.type = 'highpass';
    low.frequency.value = 350;
    const high = ctx.createBiquadFilter();
    high.type = 'lowpass';
    high.frequency.value = 3200;
    const shaper = ctx.createWaveShaper();
    shaper.curve = radioCurve;
    src.connect(low).connect(high).connect(shaper).connect(voiceBus);
    noiseBurst(voiceBus, { filter: 2500, type: 'highpass', decay: 0.12, peak: 0.25 });
    src.onended = () => {
      speaking = false;
      applyLevels();
      const next = voiceQueue.shift();
      if (next) playVoice(next);
    };
    src.start(ctx.currentTime + 0.1);
  });
  return true;
}
