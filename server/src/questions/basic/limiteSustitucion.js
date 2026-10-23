import { frac, options, pick, randInt } from '../generators/format.js';

// lím_{x→x₀} (x² + b) / (x + c) con x₀ + c ≠ 0: basta sustituir
export default {
  name: 'limite-sustitucion',
  tema: 'basicas',
  dificultad: 1,
  generar(rand, n = 4) {
    const b = randInt(-4, 6, rand);
    let c = pick([-3, -1, 1, 2, 3, 4], rand);
    const x0 = pick([-2, -1, 0, 1, 2, 3], rand);
    if (x0 + c === 0) c += 1;
    const num = x0 * x0 + b;
    const den = x0 + c;
    const correct = frac(num, den);
    // Errores típicos: quedarse con el numerador, signo cambiado en el denominador, decir 0
    const distractors = [String(num), den - 2 * c === 0 ? frac(num, den + 1) : frac(num, x0 - c), '0'];
    const fallback = [frac(num + 1, den), frac(num, den + 1), String(den)];
    const signed = (k) => `${k < 0 ? '-' : '+'} ${Math.abs(k)}`;
    return {
      id: `bas-lim-${b}${c}${x0}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Calcule $\\displaystyle\\lim_{x \\to ${x0}} \\frac{x^2 ${signed(b)}}{x ${signed(c)}}$`,
      opciones: options(correct, distractors, fallback, n),
      correcta: 0,
      // Solo se muestra la simplificación si cambia algo
      explicacion: `El denominador no se anula en $x = ${x0}$: se sustituye y da $\\frac{${num}}{${den}}${correct === `\\frac{${num}}{${den}}` ? '' : ` = ${correct}`}$.`,
      valor: num / den,
    };
  },
};
