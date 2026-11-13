import { options, piFrac, randInt } from './format.js';

// Volumen bajo z = c (R² − x² − y²) sobre el plano xy: c π R⁴ / 2
export default {
  name: 'volumen-paraboloide',
  tema: 'volumen',
  dificultad: 3,
  generar(rand, n = 4) {
    const R = randInt(1, 3, rand);
    const c = randInt(1, 2, rand);
    const correct = piFrac(c * R ** 4, 2);
    // Errores típicos: olvidar la r del jacobiano, olvidar el 1/2, dividir de más
    const distractors = [piFrac(4 * c * R ** 3, 3), piFrac(c * R ** 4), piFrac(c * R ** 4, 4)];
    const z = c === 1 ? `${R * R} - x^2 - y^2` : `${c}(${R * R} - x^2 - y^2)`;
    return {
      id: `gen-volpar-${R}${c}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Volumen bajo $z = ${z}$ y sobre el plano $xy$`,
      opciones: options(correct, distractors, [piFrac(2 * c * R ** 4)], n),
      correcta: 0,
      explicacion: `La base es el disco $r \\le ${R}$: $\\int_0^{2\\pi}\\!\\int_0^{${R}} ${c === 1 ? '' : c}(${R * R} - r^2)\\,r\\,dr\\,d\\theta$. $2\\pi \\cdot \\frac{${c * R ** 4}}{4} = ${correct}$.`,
      verifica: { tipo: 'cart2', f: `${c}*(${R * R}-x*x-y*y)`, cond: `x*x+y*y<=${R * R}`, box: [-R, R, -R, R], n: 500 },
    };
  },
};
