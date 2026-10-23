import { frac, options, randInt, term } from './format.js';

// ∫₀ᵖ ∫₀^q (a x + b y) dy dx = (a p² q + b p q²) / 2
export default {
  name: 'integral-doble-rect',
  tema: 'integrales_dobles',
  dificultad: 2,
  generar(rand, n = 4) {
    const a = randInt(1, 4, rand);
    const b = randInt(1, 4, rand);
    const p = randInt(1, 3, rand);
    const q = randInt(2, 4, rand);
    const twice = a * p * p * q + b * p * q * q;
    const correct = frac(twice, 2);
    // Errores típicos: olvidar el 1/2 de las integrales, dividir de más, integrar solo una variable
    const distractors = [frac(twice, 1), frac(twice, 4), frac(a * p * p + b * q * q, 2)];
    const fallback = [frac(twice + 2, 2), frac(twice - 2, 2), frac(twice + 4, 2)];
    return {
      id: `gen-dob-${a}${b}${p}${q}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Evalúe $\\int_0^{${p}} \\int_0^{${q}} (${term(a, 'x')} + ${term(b, 'y')}) \\, dy \\, dx$`,
      opciones: options(correct, distractors, fallback, n),
      correcta: 0,
      explicacion:
        `Integrando en $y$: $${term(a, 'x')} \\cdot ${q} + ${term(b, '')}${b === 1 ? '' : '\\cdot '}\\frac{${q * q}}{2}$. ` +
        `Luego en $x$ de $0$ a $${p}$: $${frac(a * q * p * p, 2)} + ${frac(b * q * q * p, 2)} = ${correct}$.`,
      valor: twice / 2,
    };
  },
};
