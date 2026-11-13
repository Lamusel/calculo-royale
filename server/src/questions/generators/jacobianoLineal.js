import { lin, options, randInt } from './format.js';

// x = a u + b v, y = c u + d v: ∂(x, y)/∂(u, v) = a d − b c (con su signo)
export default {
  name: 'jacobiano-lineal',
  tema: 'jacobiano',
  dificultad: 2,
  generar(rand, n = 4) {
    let a = randInt(1, 5, rand);
    const b = randInt(1, 3, rand);
    const c = randInt(1, 3, rand);
    const d = randInt(1, 5, rand);
    if (a * d === b * c) a += 1;
    const det = a * d - b * c;
    // Errores típicos: sumar los productos, restar al revés (signo), quedarse con la diagonal
    const distractors = [String(a * d + b * c), String(-det), String(a * d)];
    return {
      id: `gen-jaclin-${a}${b}${c}${d}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `$\\frac{\\partial(x,y)}{\\partial(u,v)}$ para $x = ${lin(a, 'u', b, 'v')}$, $y = ${lin(c, 'u', d, 'v')}$`,
      opciones: options(String(det), distractors, [String(det + 1), String(det - 1)], n),
      correcta: 0,
      explicacion: `$J = x_u y_v - x_v y_u$. $J = ${a} \\cdot ${d} - ${b} \\cdot ${c} = ${det}$.`,
      verifica: { tipo: 'jac', map: [`${a}*u+${b}*v`, `${c}*u+${d}*v`], vars: ['u', 'v'] },
    };
  },
};
