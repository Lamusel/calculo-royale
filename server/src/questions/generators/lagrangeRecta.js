import { frac, options, pick, randInt, term } from './format.js';

// Mínimo de x² + y² sobre a x + b y = c: c² / (a² + b²), en el punto c(a, b)/(a² + b²)
export default {
  name: 'lagrange-recta',
  tema: 'lagrange',
  dificultad: 3,
  generar(rand, n = 4) {
    const a = randInt(1, 3, rand);
    const b = pick([1, 2, 3], rand);
    const c = randInt(2, 6, rand);
    const s = a * a + b * b;
    const correct = frac(c * c, s);
    // Errores típicos: dar la distancia (sin elevar), olvidar un cuadrado, dividir entre a + b
    const distractors = [frac(c, s), frac(c * c, a + b), frac(c * c, s * s)];
    const fallback = [frac(c * c + 1, s), frac(2 * c * c, s), frac(c * c, s + 1)];
    return {
      id: `gen-lagrec-${a}${b}${c}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Mínimo de $f(x,y) = x^2 + y^2$ sobre la recta $${term(a, 'x')} + ${term(b, 'y')} = ${c}$`,
      opciones: options(correct, distractors, fallback, n),
      correcta: 0,
      explicacion: `$(2x, 2y) = \\lambda(${a}, ${b})$: el punto es $\\frac{${c}}{${s}}(${a}, ${b})$ y $f = \\frac{${c}^2}{${s}} = ${correct}$.`,
      valor: (c * c) / s,
    };
  },
};
