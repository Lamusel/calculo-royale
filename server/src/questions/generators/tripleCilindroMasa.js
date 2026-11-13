import { options, piFrac, pick, randInt, term } from './format.js';

// Masa del cilindro x² + y² ≤ R², 0 ≤ z ≤ h con densidad δ = k z: k π R² h² / 2.
// R = 2 no entra: ahí ∫ r dr = ∫ dr y olvidar la r daría lo mismo.
export default {
  name: 'triple-cilindro-masa',
  tema: 'triples-cilindricas-esfericas',
  dificultad: 3,
  generar(rand, n = 4) {
    const R = pick([1, 3], rand);
    const h = randInt(1, 4, rand);
    const k = randInt(1, 3, rand);
    const correct = piFrac(k * R * R * h * h, 2);
    // Errores típicos: olvidar la r del jacobiano, poner r² en vez de r, olvidar el 1/2 de ∫ z dz
    const distractors = [piFrac(k * R * h * h), piFrac(k * R ** 3 * h * h, 3), piFrac(k * R * R * h * h)];
    return {
      id: `gen-cilmasa-${R}${h}${k}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Masa del cilindro $x^2 + y^2 \\le ${R * R}$, $0 \\le z \\le ${h}$ con densidad $\\delta = ${term(k, 'z')}$`,
      opciones: options(correct, distractors, [piFrac(k * R * R * h * h, 4)], n),
      correcta: 0,
      explicacion: `En cilíndricas: $\\int_0^{2\\pi}\\!\\int_0^{${R}}\\!\\int_0^{${h}} ${term(k, 'z')}\\,r\\,dz\\,dr\\,d\\theta$. $2\\pi \\cdot \\frac{${R * R}}{2} \\cdot \\frac{${k * h * h}}{2} = ${correct}$.`,
      verifica: { tipo: 'cart3', f: `${k}*z`, cond: `x*x+y*y<=${R * R}`, box: [-R, R, -R, R, 0, h] },
    };
  },
};
