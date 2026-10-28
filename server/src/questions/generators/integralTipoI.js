import { frac, options, randInt } from './format.js';

// Región tipo I: ∫₀ᵃ ∫₀^{m x} c dy dx = c · m · a² / 2 (área de un triángulo por c)
export default {
  name: 'integral-tipo-i',
  tema: 'integrales_dobles',
  dificultad: 3,
  generar(rand, n = 4) {
    const a = randInt(1, 4, rand);
    const m = randInt(1, 3, rand);
    const c = randInt(1, 5, rand);
    const twice = c * m * a * a;
    const correct = frac(twice, 2);
    // Errores típicos: olvidar el 1/2 (tratarlo como rectángulo), olvidar c, integrar mal el límite
    const distractors = [frac(twice, 1), frac(m * a * a, 2), frac(c * m * a, 2)];
    const fallback = [frac(twice + 2, 2), frac(twice, 3), frac(twice + 4, 2)];
    const mx = m === 1 ? 'x' : `${m}x`;
    return {
      id: `gen-tipoi-${a}${m}${c}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Evalúe $\\int_0^{${a}} \\int_0^{${mx}} ${c} \\, dy \\, dx$`,
      opciones: options(correct, distractors, fallback, n),
      correcta: 0,
      explicacion: `En $y$: $${c} \\cdot ${mx}$. En $x$: $\\int_0^{${a}} ${c * m}x \\, dx = \\frac{${c * m} \\cdot ${a * a}}{2} = ${correct}$.`,
      valor: twice / 2,
    };
  },
};
