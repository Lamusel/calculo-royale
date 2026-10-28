import { options, pick, randInt, term } from './format.js';

// Máximo de a x + b y sobre x² + y² = R²: R·√(a² + b²) (pares pitagóricos: sale entero)
const PAIRS = [[3, 4], [4, 3], [5, 12], [12, 5], [6, 8], [8, 6]];

export default {
  name: 'lagrange-lineal',
  tema: 'lagrange',
  dificultad: 2,
  generar(rand, n = 4) {
    const [a, b] = pick(PAIRS, rand);
    const R = randInt(1, 3, rand);
    const len = Math.hypot(a, b);
    const max = R * len;
    // Errores típicos: sumar coeficientes, olvidar el radio, dar el mínimo
    const distractors = [String(R * (a + b)), String(len), String(-max)];
    const fallback = [String(max + 1), String(max * R), String(max + R)];
    return {
      id: `gen-laglin-${a}${b}${R}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Máximo de $f(x,y) = ${term(a, 'x')} + ${term(b, 'y')}$ sobre $x^2 + y^2 = ${R * R}$`,
      opciones: options(String(max), distractors, fallback, n),
      correcta: 0,
      explicacion: `$(${a}, ${b}) = 2\\lambda(x, y)$: el punto es $\\frac{${R}}{${len}}(${a}, ${b})$ y $f = ${R} \\cdot ${len} = ${max}$.`,
      valor: max,
    };
  },
};
