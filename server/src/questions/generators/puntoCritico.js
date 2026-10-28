import { options, pick, randInt } from './format.js';

// f = a(x − h)² + c(y − k)² desarrollada: a x² − 2ah x + c y² − 2ck y. Punto crítico (h, k)
const t = (coef, v) => (coef === 0 ? '' : `${coef > 0 ? ' + ' : ' - '}${Math.abs(coef) === 1 ? '' : Math.abs(coef)}${v}`);
const poly = (a, h, c, k) => `${a === 1 ? '' : a}x^2${t(-2 * a * h, 'x')}${t(c, 'y^2')}${t(-2 * c * k, 'y')}`;
const sign = (v) => (v < 0 ? `- ${-v}` : `+ ${v}`);

export default {
  name: 'punto-critico',
  tema: 'maximos_minimos',
  dificultad: 2,
  generar(rand, n = 4) {
    const a = randInt(1, 3, rand);
    const c = randInt(1, 3, rand);
    const h = pick([-3, -2, -1, 1, 2, 3], rand);
    const k = pick([-3, -2, -1, 1, 2, 3], rand);
    const pair = (u, v) => `(${u}, ${v})`;
    // Errores típicos: signos cambiados, coordenadas invertidas, olvidar dividir entre 2a
    const distractors = [pair(-h, -k), pair(k, h), pair(2 * a * h, 2 * c * k)];
    const fallback = [pair(h, -k), pair(-h, k), pair(h + 1, k)];
    return {
      id: `gen-crit-${a}${c}${h}${k}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Punto crítico de $f(x,y) = ${poly(a, h, c, k)}$`,
      opciones: options(pair(h, k), distractors, fallback, n),
      correcta: 0,
      explicacion: `$f_x = ${2 * a}x ${sign(-2 * a * h)} = 0$ y $f_y = ${2 * c}y ${sign(-2 * c * k)} = 0$: $${pair(h, k)}$.`,
      valor: [h, k],
      f: { a, h, c, k },
    };
  },
};
