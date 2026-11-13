import { options, piFrac, randInt } from './format.js';

// ∭ ρ^m dV sobre la esfera sólida de radio R (o su mitad superior): c π R^(m+3) / (m + 3), c = 4 o 2
export default {
  name: 'triple-esfera',
  tema: 'triples-cilindricas-esfericas',
  dificultad: 4,
  generar(rand, n = 4) {
    const R = randInt(1, 3, rand);
    const m = randInt(1, 2, rand);
    const half = rand() < 0.5;
    const c = half ? 2 : 4;
    const correct = piFrac(c * R ** (m + 3), m + 3);
    // Errores típicos: ρ sen φ en vez de ρ² sen φ; φ mal (hasta 2π da 0 en la esfera; hasta π en la
    // semiesfera da el doble); la otra mitad
    const distractors = [piFrac(c * R ** (m + 2), m + 2), half ? piFrac(4 * R ** (m + 3), m + 3) : '0', piFrac((half ? 1 : 2) * R ** (m + 3), m + 3)];
    const f = m === 1 ? '\\sqrt{x^2 + y^2 + z^2}' : '(x^2 + y^2 + z^2)';
    const region = half ? `semiesfera $x^2 + y^2 + z^2 \\le ${R * R}$, $z \\ge 0$` : `esfera sólida $x^2 + y^2 + z^2 \\le ${R * R}$`;
    return {
      id: `gen-esfera-${R}${m}${half ? 'h' : 'f'}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `$\\displaystyle\\iiint_E ${f}\\,dV$, con $E$: ${region}`,
      opciones: options(correct, distractors, [piFrac(c * R ** (m + 3))], n),
      correcta: 0,
      explicacion:
        `En esféricas: $\\int_0^{2\\pi}\\!\\int_0^{${half ? '\\pi/2' : '\\pi'}}\\!\\int_0^{${R}} \\rho^{${m}} \\cdot \\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta$. ` +
        `$2\\pi \\cdot ${half ? 1 : 2} \\cdot \\frac{${R ** (m + 3)}}{${m + 3}} = ${correct}$.`,
      verifica: { tipo: 'cart3', f: `(x*x+y*y+z*z)**${m / 2}`, cond: `x*x+y*y+z*z<=${R * R}`, box: [-R, R, -R, R, half ? 0 : -R, R] },
    };
  },
};
