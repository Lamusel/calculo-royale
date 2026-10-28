import { options, pick, randInt, term } from './format.js';

// f(x, y) = a x² y + b y³  →  ∇f = (2 a x y, a x² + 3 b y²)
export default {
  name: 'gradiente-punto',
  tema: 'derivadas_direccionales',
  dificultad: 2,
  generar(rand, n = 4) {
    const a = randInt(1, 3, rand);
    const b = randInt(1, 2, rand);
    const x = pick([-2, -1, 1, 2, 3], rand);
    const y = pick([-2, -1, 1, 2], rand);
    const fx = 2 * a * x * y;
    const fy = a * x * x + 3 * b * y * y;
    const pair = (u, v) => `(${u}, ${v})`;
    // Errores típicos: componentes invertidas, olvidar bajar el exponente, signo cambiado
    const distractors = [pair(fy, fx), pair(a * x * y, a * x * x + b * y * y), pair(fx, a * x * x - 3 * b * y * y)];
    const fallback = [pair(-fx, fy), pair(fx + 1, fy), pair(fx, fy + 1)];
    return {
      id: `gen-gra-${a}${b}${x}${y}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Para $f(x,y) = ${term(a, 'x^2 y')} + ${term(b, 'y^3')}$, calcule $\\nabla f(${x}, ${y})$`,
      opciones: options(pair(fx, fy), distractors, fallback, n),
      correcta: 0,
      explicacion: `$\\nabla f = (${term(2 * a, 'xy')}, ${term(a, 'x^2')} + ${term(3 * b, 'y^2')})$; en $(${x}, ${y})$: $${pair(fx, fy)}$.`,
      valor: [fx, fy],
    };
  },
};
