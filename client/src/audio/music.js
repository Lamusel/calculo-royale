// Música procedural por momento (fase 19): un secuenciador con anticipación que arma acordes,
// bajo, batería y un arpegio según el momento (lobby, bus, partida, zona, duelo, victoria y
// resultados). Si existe client/public/assets/audio/music/<momento>.mp3 (ver audio-manifest.json)
// se usa ese archivo en bucle. Al cambiar de momento, fundido de 1,5 s.

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};

// root: nota MIDI de la tónica · prog: grados de la escala por compás · drums: patrón
export const MOMENTS = {
  lobby: { bpm: 92, root: 50, scale: 'dorian', prog: [0, 3, 4, 3], drums: 'light', lead: 0.35, level: 0.7 },
  bus: { bpm: 104, root: 45, scale: 'minor', prog: [0, 5, 3, 4], drums: 'pulse', lead: 0.2, level: 0.75 },
  partida: { bpm: 96, root: 45, scale: 'minor', prog: [0, 0, 5, 6], drums: 'sparse', lead: 0.15, level: 0.55 },
  zona: { bpm: 124, root: 43, scale: 'phrygian', prog: [0, 1, 0, 1], drums: 'driving', lead: 0.3, level: 0.75 },
  duelo: { bpm: 140, root: 41, scale: 'harmonic', prog: [0, 1, 4, 0], drums: 'heavy', lead: 0.45, level: 0.85 },
  victoria: { bpm: 112, root: 48, scale: 'major', prog: [0, 4, 5, 3], drums: 'pulse', lead: 0.6, level: 0.85 },
  resultados: { bpm: 84, root: 45, scale: 'minor', prog: [0, 5, 3, 4], drums: 'light', lead: 0.25, level: 0.6 },
};

// Golpes por paso de 16 (k bombo, s caja, h platillo)
const DRUMS = {
  light: { k: [0, 8], s: [], h: [4, 12] },
  sparse: { k: [0, 10], s: [8], h: [] },
  pulse: { k: [0, 4, 8, 12], s: [], h: [2, 6, 10, 14] },
  driving: { k: [0, 3, 8, 11], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  heavy: { k: [0, 2, 8, 10, 11], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
};

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

// Nota MIDI del grado `deg` (puede pasar de 7: sube de octava) en la escala del momento
export function degreeNote(moment, deg) {
  const scale = SCALES[moment.scale];
  const oct = Math.floor(deg / scale.length);
  return moment.root + scale[((deg % scale.length) + scale.length) % scale.length] + 12 * oct;
}

// Acorde (tríada) del compás `bar`
export const chordOf = (moment, bar) => {
  const d = moment.prog[bar % moment.prog.length];
  return [d, d + 2, d + 4].map((x) => degreeNote(moment, x));
};

export function createMusic(ctx, destination, noise, loadBuffer) {
  let current = null; // { name, gain, timer, source }
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function voice(out, { type = 'triangle', freq, at, dur, peak, attack = 0.01, filter = null }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node = osc.connect(f);
    }
    node.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function drum(out, kind, at) {
    if (kind === 'k') {
      voice(out, { type: 'sine', freq: 110, at, dur: 0.25, peak: 0.55 });
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'h' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'h' ? 7000 : 1800;
    const g = ctx.createGain();
    const dur = kind === 'h' ? 0.05 : 0.14;
    g.gain.setValueAtTime(kind === 'h' ? 0.12 : 0.3, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(out);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  function startProcedural(name, out) {
    const m = MOMENTS[name];
    const step = 60 / m.bpm / 4; // semicorchea
    let next = ctx.currentTime + 0.1;
    let index = 0;
    const pattern = DRUMS[m.drums];
    const schedule = () => {
      while (next < ctx.currentTime + 0.25) {
        const bar = Math.floor(index / 16);
        const s = index % 16;
        const chord = chordOf(m, bar);
        if (s === 0) {
          // Colchón: el acorde completo durante el compás
          for (const n of chord) voice(out, { type: 'sine', freq: midiHz(n), at: next, dur: step * 16, peak: 0.07, attack: 0.4 });
        }
        if (s % 4 === 0) voice(out, { type: 'triangle', freq: midiHz(chord[0] - 12), at: next, dur: step * 3, peak: 0.22, filter: 600 });
        if (pattern.k.includes(s)) drum(out, 'k', next);
        if (pattern.s.includes(s)) drum(out, 's', next);
        if (pattern.h.includes(s)) drum(out, 'h', next);
        if (s % 2 === 0 && rand() < m.lead) {
          const n = chord[Math.floor(rand() * 3)] + 12;
          voice(out, { type: 'square', freq: midiHz(n), at: next, dur: step * 1.6, peak: 0.035, filter: 2200 });
        }
        next += step;
        index++;
      }
    };
    schedule();
    return setInterval(schedule, 100);
  }

  function stopCurrent() {
    if (!current) return;
    const old = current;
    old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    setTimeout(() => {
      clearInterval(old.timer);
      old.source?.stop();
      old.gain.disconnect();
    }, 2000);
    current = null;
  }

  return {
    get moment() {
      return current?.name ?? null;
    },
    setMoment(name) {
      if (current?.name === name || (name && !MOMENTS[name])) return;
      stopCurrent();
      if (!name) return;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(destination);
      gain.gain.setTargetAtTime(MOMENTS[name].level, ctx.currentTime, 0.5);
      const entry = { name, gain, timer: null, source: null };
      current = entry;
      seed = name.length * 97 + 13;
      // Archivo propio del momento (si existe y se pudo cargar); si no, procedural
      const file = loadBuffer?.(name);
      if (file) {
        file.then((buffer) => {
          if (current !== entry) return;
          if (!buffer) {
            entry.timer = startProcedural(name, gain);
            return;
          }
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.loop = true;
          src.connect(gain);
          src.start();
          entry.source = src;
        });
      } else {
        entry.timer = startProcedural(name, gain);
      }
    },
    stop: stopCurrent,
  };
}
