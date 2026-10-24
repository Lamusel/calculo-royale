// Voz del Mando (fase 19): el texto de la radio leído en español con speechSynthesis.
// Las fórmulas (LaTeX entre $) se leen en palabras: "(x - 39)^2 + (y - 14)^2 \le 8464" →
// "equis menos treinta y nueve al cuadrado, más ye menos catorce al cuadrado, menor o igual que
// ocho mil cuatrocientos sesenta y cuatro". Las funciones de texto son puras (se prueban sin navegador).

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function below1000(n) {
  if (n === 100) return 'cien';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(HUNDREDS[h]);
  if (rest) {
    if (rest < 30) parts.push(UNITS[rest]);
    else parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? ` y ${UNITS[rest % 10]}` : ''));
  }
  return parts.join(' ');
}

// Entero o decimal en palabras ("-12.5" → "menos doce coma cinco")
export function numberToWords(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n < 0) return `menos ${numberToWords(-n)}`;
  if (!Number.isInteger(n)) {
    const [int, dec] = String(n).split('.');
    return `${numberToWords(Number(int))} coma ${dec.split('').map((d) => UNITS[Number(d)]).join(' ')}`;
  }
  if (n === 0) return 'cero';
  if (n >= 1e6) {
    const m = Math.floor(n / 1e6);
    const rest = n % 1e6;
    const head = m === 1 ? 'un millón' : `${numberToWords(m).replace(/uno$/, 'un')} millones`;
    return rest ? `${head} ${numberToWords(rest)}` : head;
  }
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts = [];
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${below1000(thousands).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} mil`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

const SYMBOLS = [
  [/\\le(q)?\b/g, ' menor o igual que '],
  [/\\ge(q)?\b/g, ' mayor o igual que '],
  [/</g, ' menor que '],
  [/>/g, ' mayor que '],
  [/=/g, ' igual a '],
  [/\\cdot/g, ' por '],
  [/\\times/g, ' por '],
  [/\\pi/g, ' pi '],
  [/\\sqrt\{([^{}]*)\}/g, ' raíz de $1 '],
];

// Lee una fórmula LaTeX en palabras (lo que sale en la radio: desigualdades de zona, elipses)
export function latexToSpeech(tex) {
  let s = ` ${tex} `;
  // Fracciones: \frac{a}{b} → a sobre b
  for (let i = 0; i < 4; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, ' $1 sobre $2 ');
  for (const [re, words] of SYMBOLS) s = s.replace(re, words);
  // Potencias: ^2 al cuadrado, ^3 al cubo, ^n a la n
  s = s.replace(/\^\{?2\}?/g, ' al cuadrado ').replace(/\^\{?3\}?/g, ' al cubo ').replace(/\^\{?(\d+)\}?/g, ' a la $1 ');
  // Paréntesis: se leen como pausas cortas
  s = s.replace(/[()]/g, ' ').replace(/[{}]/g, ' ');
  s = s.replace(/\+/g, ' más ').replace(/(\s)-(\s)/g, '$1menos$2').replace(/(^|\s)-(?=\d)/g, '$1menos ');
  s = s.replace(/\bx\b/g, ' equis ').replace(/\by\b/g, ' ye ').replace(/\bz\b/g, ' zeta ');
  s = s.replace(/\d+(\.\d+)?/g, (m) => ` ${numberToWords(m)} `);
  s = s.replace(/\\[a-zA-Z]+/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

// Letras de los sectores (A1–H8) como se dicen: "sector E4" → "sector e cuatro"
const LETTERS = { A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'efe', G: 'ge', H: 'hache' };

// Texto de la radio (con fórmulas entre $) listo para decir en voz alta
export function radioToSpeech(text) {
  return text
    .replace(/\$([^$]+)\$/g, (_, tex) => latexToSpeech(tex))
    .replace(/\b([A-H])([1-8])\b/g, (_, l, n) => `${LETTERS[l]} ${n}`)
    .replace(/\bs\b(?=[.,]|$)/g, 'segundos')
    .replace(/(\d+) s\b/g, '$1 segundos')
    .replace(/\d+(\.\d+)?/g, (m) => numberToWords(m))
    .replace(/\s+/g, ' ')
    .trim();
}

// Voz en español: Colombia, si no México, si no España, si no cualquier español
export const VOICE_LANGS = ['es-CO', 'es-MX', 'es-ES'];
export function pickVoice(voices) {
  const norm = (l) => (l ?? '').replace('_', '-').toLowerCase();
  for (const lang of VOICE_LANGS) {
    const v = voices.find((x) => norm(x.lang) === lang.toLowerCase());
    if (v) return v;
  }
  return voices.find((x) => norm(x.lang).startsWith('es')) ?? null;
}

// Locutor: una sola transmisión a la vez y como mucho una esperando (la más nueva gana).
// onStart / onEnd avisan para bajar la música y los efectos mientras habla (ducking).
export class Speaker {
  constructor({ onStart = () => {}, onEnd = () => {} } = {}) {
    this.synth = globalThis.speechSynthesis ?? null;
    this.voice = null;
    this.pending = null;
    this.speaking = false;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.volume = 1;
    if (this.synth) {
      const load = () => (this.voice = pickVoice(this.synth.getVoices()));
      load();
      this.synth.addEventListener?.('voiceschanged', load);
    }
  }

  say(text) {
    if (!this.synth || !text || this.volume <= 0.001) return;
    if (this.speaking) {
      this.pending = text;
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    try {
      if (this.voice) u.voice = this.voice;
    } catch {
      // Voz no válida en este navegador: queda el idioma
    }
    u.lang = this.voice?.lang ?? VOICE_LANGS[0];
    u.rate = 1.08;
    u.pitch = 0.9;
    u.volume = Math.max(0, Math.min(1, this.volume));
    this.speaking = true;
    u.onstart = () => this.onStart();
    u.onend = u.onerror = () => {
      this.speaking = false;
      this.onEnd();
      const next = this.pending;
      this.pending = null;
      if (next) this.say(next);
    };
    try {
      this.synth.speak(u);
    } catch {
      // La voz nunca debe romper el juego
      this.speaking = false;
    }
  }

  stop() {
    this.pending = null;
    this.synth?.cancel();
    this.speaking = false;
    this.onEnd();
  }
}
