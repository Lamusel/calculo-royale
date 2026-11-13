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

// Múltiplo racional de π: piFrac(3, 2) → "\frac{3\pi}{2}", piFrac(4) → "4\pi", piFrac(1, 3) → "\frac{\pi}{3}"
export function piFrac(n, d = 1) {
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (n === 0) return '0';
  const c = Math.abs(n) === 1 ? '' : String(Math.abs(n));
  const sign = n < 0 ? '-' : '';
  return d === 1 ? `${sign}${c}\\pi` : `${sign}\\frac{${c}\\pi}{${d}}`;
}

// "a u + b v" o "a u − b v" legible: lin(2, 'u', -1, 'v') → "2u - v"
export const lin = (a, u, b, v) => `${term(a, u)} ${b < 0 ? '-' : '+'} ${term(Math.abs(b), v)}`;

export const pick =(list, rand) => list[Math.floor(rand() * list.length)];
export const randInt = (min, max, rand) => min + Math.floor(rand() * (max - min + 1));

// n opciones distintas (4 por defecto): la correcta primero y luego los distractores en orden
// (los de errores típicos van primero), sin repetir. Si faltan, se completan con `fallback`.
export function options(correct, distractors, fallback, n = 4) {
  const out = [correct];
  for (const d of [...distractors, ...fallback]) {
    if (out.length === n) break;
    if (!out.includes(d)) out.push(d);
  }
  return out.map((o) => `$${o}$`);
}
