import { options, piFrac, randInt } from './format.js';

// Volumen de un cilindro (π R² h) o de un cono (π R² h / 3) de radio R y altura h
export default {
  name: 'volumen-solido',
  tema: 'volumen',
  dificultad: 2,
  generar(rand, n = 4) {
    const cone = rand() < 0.5;
    const R = randInt(1, 4, rand);
    const h = randInt(1, 6, rand);
    const base = R * R * h;
    const correct = cone ? piFrac(base, 3) : piFrac(base);
    // Errores típicos. Cono: dar el cilindro, usar 1/2. Cilindro: olvidar la r del jacobiano, dar el cono
    const distractors = cone ? [piFrac(base), piFrac(base, 2)] : [piFrac(2 * R * h), piFrac(base, 3)];
    return {
      id: `gen-volsol-${cone ? 'c' : 'k'}${R}${h}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Volumen del ${cone ? 'cono' : 'cilindro'} de radio $${R}$ y altura $${h}$`,
      opciones: options(correct, distractors, [piFrac(2 * base), piFrac(base, 4)], n),
      correcta: 0,
      explicacion: cone
        ? `En cilíndricas: $\\int_0^{2\\pi}\\!\\int_0^{${R}} ${h}\\left(1 - \\frac{r}{${R}}\\right) r\\,dr\\,d\\theta$. Eso es $\\frac13\\pi R^2 h = ${correct}$.`
        : `En cilíndricas: $\\int_0^{2\\pi}\\!\\int_0^{${R}}\\!\\int_0^{${h}} r\\,dz\\,dr\\,d\\theta$. $2\\pi \\cdot \\frac{${R * R}}{2} \\cdot ${h} = ${correct}$.`,
      verifica: { tipo: 'cart2', f: cone ? `${h}*(1-sqrt(x*x+y*y)/${R})` : String(h), cond: `x*x+y*y<=${R * R}`, box: [-R, R, -R, R], n: 500 },
    };
  },
};
