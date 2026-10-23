// Formato LaTeX de números exactos para los generadores paramétricos.

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

// Fracción reducida: frac(6, 4) → "\frac{3}{2}", frac(-4, 2) → "-2"
export function frac(n, d = 1) {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (d === 1) return String(n);
  return `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`;
}

// Entero por raíz: surd(2, 3) → "2\sqrt{3}", surd(-1, 2) → "-\sqrt{2}", surd(5, 1) → "5"
export function surd(coef, k) {
  if (coef === 0) return '0';
  if (k === 1) return String(coef);
  const c = coef === 1 ? '' : coef === -1 ? '-' : String(coef);
  return `${c}\\sqrt{${k}}`;
}

// Término "a·x" legible: term(1, 'x') → "x", term(3, 'y') → "3y"
export const term = (a, v) => (a === 1 ? v : `${a}${v}`);

export const pick = (list, rand) => list[Math.floor(rand() * list.length)];
export const randInt = (min, max, rand) => min + Math.floor(rand() * (max - min + 1));

// Cuatro opciones distintas: la correcta primero y luego los distractores sin repetir.
// Si faltan, se completan con variantes de la correcta (`fallback`).
export function options(correct, distractors, fallback) {
  const out = [correct];
  for (const d of [...distractors, ...fallback]) {
    if (out.length === 4) break;
    if (!out.includes(d)) out.push(d);
  }
  return out.map((o) => `$${o}$`);
}
