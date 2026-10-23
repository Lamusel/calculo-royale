import { options, randInt } from '../generators/format.js';

// d/dx (a xⁿ) = n a xⁿ⁻¹
const mono = (k, e) => (e === 0 ? String(k) : `${k === 1 ? '' : k}x${e === 1 ? '' : `^{${e}}`}`);

export default {
  name: 'regla-potencia',
  tema: 'basicas',
  dificultad: 1,
  generar(rand, n = 4) {
    const a = randInt(2, 6, rand);
    const e = randInt(3, 7, rand);
    const correct = mono(a * e, e - 1);
    // Errores típicos: no bajar el exponente, no restarle uno, sumarle uno
    const distractors = [mono(a, e - 1), mono(a * e, e), mono(a * e, e + 1)];
    const fallback = [mono(a * (e - 1), e - 1), mono(e, e - 1)];
    return {
      id: `bas-pot-${a}${e}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `¿Cuál es la derivada de $${mono(a, e)}$?`,
      opciones: options(correct, distractors, fallback, n),
      correcta: 0,
      explicacion: `Regla de la potencia: $\\frac{d}{dx}\\,x^{n} = n\\,x^{n-1}$, así que da $${correct}$.`,
      // Coeficiente y exponente de la respuesta (para verificarla en las pruebas)
      valor: [a * e, e - 1],
    };
  },
};
