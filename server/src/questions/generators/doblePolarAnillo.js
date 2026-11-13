import { options, piFrac, pick, randInt } from './format.js';

// ∬ (x² + y²) dA sobre el disco o anillo a ≤ r ≤ b: 2π (b⁴ − a⁴)/4
export default {
  name: 'doble-polar-anillo',
  tema: 'cambio-variables-dobles',
  dificultad: 2,
  generar(rand, n = 4) {
    const a = pick([0, 0, 1, 2], rand);
    const b = a + randInt(1, 2, rand);
    const correct = piFrac(b ** 4 - a ** 4, 2);
    // Errores típicos: olvidar la r del jacobiano, poner r² en vez de r, olvidar el 1/4 de la integral
    const distractors = [piFrac(2 * (b ** 3 - a ** 3), 3), piFrac(2 * (b ** 5 - a ** 5), 5), piFrac(2 * (b ** 4 - a ** 4))];
    const region = a === 0 ? `disco $x^2 + y^2 \\le ${b * b}$` : `anillo $${a * a} \\le x^2 + y^2 \\le ${b * b}$`;
    return {
      id: `gen-polanillo-${a}${b}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `$\\displaystyle\\iint_D (x^2 + y^2)\\,dA$, con $D$: ${region}`,
      opciones: options(correct, distractors, [piFrac(b ** 4 - a ** 4, 4)], n),
      correcta: 0,
      explicacion: `En polares: $\\int_0^{2\\pi}\\!\\int_{${a}}^{${b}} r^2 \\cdot r\\,dr\\,d\\theta$. $\\int_{${a}}^{${b}} r^3\\,dr = \\frac{${b ** 4 - a ** 4}}{4}$, por $2\\pi$: $${correct}$.`,
      verifica: { tipo: 'cart2', f: 'x*x+y*y', cond: `x*x+y*y>=${a * a} && x*x+y*y<=${b * b}`, box: [-b, b, -b, b], n: 500 },
    };
  },
};
