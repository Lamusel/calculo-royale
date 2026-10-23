import { frac, options, pick, randInt, surd, term } from './format.js';

// f(x, y) = a x² + b y², en (x₀, y₀), dirección v (no unitario): D_u f = ∇f · v / |v|
const DIRECTIONS = [[3, 4], [4, 3], [-3, 4], [4, -3], [5, 12], [12, 5], [6, 8], [-8, 6]];

// |(u, v)| en forma exacta: entero·√k con k libre de cuadrados
function norm(u, v) {
  let n = u * u + v * v;
  let coef = 1;
  for (let f = 2; f * f <= n; f++) {
    while (n % (f * f) === 0) {
      n /= f * f;
      coef *= f;
    }
  }
  return surd(coef, n);
}

export default {
  name: 'derivada-direccional',
  tema: 'gradiente_direccional',
  dificultad: 3,
  generar(rand) {
    const a = randInt(1, 3, rand);
    const b = randInt(1, 3, rand);
    const x = pick([-2, -1, 1, 2], rand);
    const y = pick([-2, -1, 1, 2, 3], rand);
    const [vx, vy] = pick(DIRECTIONS, rand);
    const len = Math.hypot(vx, vy); // entero en todas las direcciones de la lista
    const gx = 2 * a * x;
    const gy = 2 * b * y;
    const dot = gx * vx + gy * vy;
    const correct = frac(dot, len);
    // Errores típicos: no normalizar, dividir entre |v|², dar |∇f| en vez de la derivada direccional
    const distractors = [frac(dot, 1), frac(dot, len * len), norm(gx, gy)];
    const fallback = [frac(-dot, len), frac(dot + len, len), frac(dot - len, len)];
    return {
      id: `gen-dir-${a}${b}${x}${y}${vx}${vy}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Derivada direccional de $f(x,y) = ${term(a, 'x^2')} + ${term(b, 'y^2')}$ en $(${x}, ${y})$ en la dirección de $\\mathbf v = (${vx}, ${vy})$`,
      opciones: options(correct, distractors, fallback),
      correcta: 0,
      explicacion:
        `$\\nabla f(${x}, ${y}) = (${gx}, ${gy})$, $|\\mathbf v| = ${len}$, ` +
        `$D_{\\mathbf u} f = \\frac{(${gx})(${vx}) + (${gy})(${vy})}{${len}} = ${correct}$.`,
      valor: dot / len,
    };
  },
};
