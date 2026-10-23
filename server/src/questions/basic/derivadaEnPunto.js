import { options, pick, randInt } from '../generators/format.js';

// f(x) = a x² + b x + c  →  f'(x₀) = 2 a x₀ + b
export default {
  name: 'derivada-en-punto',
  tema: 'basicas',
  dificultad: 1,
  generar(rand, n = 4) {
    const a = randInt(1, 4, rand);
    const b = pick([-3, -2, -1, 1, 2, 3, 4], rand);
    const c = randInt(-5, 5, rand);
    const x0 = pick([-2, -1, 1, 2, 3], rand);
    const value = 2 * a * x0 + b;
    const poly = `${a === 1 ? '' : a}x^2 ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}`;
    // Errores típicos: evaluar f en vez de f', no multiplicar por el exponente, olvidar x₀
    const distractors = [a * x0 * x0 + b * x0 + c, a * x0 + b, 2 * a + b];
    const fallback = [value + 1, value - 1, -value, value + 2];
    return {
      id: `bas-der-${a}${b}${c}${x0}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Si $f(x) = ${poly}$, ¿cuánto vale $f'(${x0})$?`,
      opciones: options(String(value), distractors.map(String), fallback.map(String), n),
      correcta: 0,
      explicacion: `$f'(x) = ${2 * a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)}$, así que $f'(${x0}) = ${value}$.`,
      valor: value,
    };
  },
};
