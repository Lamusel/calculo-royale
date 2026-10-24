import { options, randInt } from '../generators/format.js';

// Modo fácil (fase 20): aritmética básica para probar el juego sin saber cálculo.
// La dificultad sube la operación: 1 suma, 2 resta, 3 multiplicación, 4 dos operaciones.
export default {
  name: 'aritmetica',
  tema: 'facil',
  dificultad: 1,
  generar(rand, n = 2, dificultad = 1) {
    let text;
    let value;
    if (dificultad <= 1) {
      const a = randInt(2, 30, rand);
      const b = randInt(2, 30, rand);
      text = `${a} + ${b}`;
      value = a + b;
    } else if (dificultad === 2) {
      const a = randInt(20, 60, rand);
      const b = randInt(2, 19, rand);
      text = `${a} - ${b}`;
      value = a - b;
    } else if (dificultad === 3) {
      const a = randInt(3, 12, rand);
      const b = randInt(3, 12, rand);
      text = `${a} \\times ${b}`;
      value = a * b;
    } else {
      const a = randInt(2, 9, rand);
      const b = randInt(2, 9, rand);
      const c = randInt(2, 20, rand);
      text = `${a} \\times ${b} + ${c}`;
      value = a * b + c;
    }
    const distractors = [value + 1, value - 1, value + 10, value - 10].map(String);
    return {
      id: `facil-${text}`,
      tema: this.tema,
      dificultad,
      enunciado: `¿Cuánto es $${text}$?`,
      opciones: options(String(value), distractors, [String(value + 2)], n),
      correcta: 0,
      explicacion: `$${text} = ${value}$.`,
      valor: value,
    };
  },
};
