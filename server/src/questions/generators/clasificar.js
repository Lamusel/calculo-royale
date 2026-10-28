import { pick, randInt } from './format.js';

// f = a x² + b xy + c y² en (0, 0): D = 4ac − b². Nunca D = 0 (el criterio no decide)
const KINDS = ['Mínimo local', 'Máximo local', 'Punto de silla'];

export default {
  name: 'clasificar',
  tema: 'maximos_minimos',
  dificultad: 3,
  generar(rand, n = 4) {
    let a;
    let b;
    let c;
    do {
      a = pick([-3, -2, -1, 1, 2, 3], rand);
      b = randInt(-4, 4, rand);
      c = pick([-3, -2, -1, 1, 2, 3], rand);
    } while (4 * a * c - b * b === 0);
    const D = 4 * a * c - b * b;
    const kind = D < 0 ? 'Punto de silla' : a > 0 ? 'Mínimo local' : 'Máximo local';
    // Error típico primero: confundir máximo con mínimo (o ignorar el signo de D)
    const order = [kind, ...(kind === 'Mínimo local' ? ['Máximo local', 'Punto de silla'] : kind === 'Máximo local' ? ['Mínimo local', 'Punto de silla'] : ['Mínimo local', 'Máximo local'])];
    const t = (k, v, first) => (k === 0 ? '' : `${k < 0 ? (first ? '-' : ' - ') : first ? '' : ' + '}${Math.abs(k) === 1 ? '' : Math.abs(k)}${v}`);
    const f = `${t(a, 'x^2', true)}${t(b, 'xy')}${t(c, 'y^2')}`;
    return {
      id: `gen-clas-${a}${b}${c}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `$f(x,y) = ${f}$ en $(0, 0)$ tiene un`,
      opciones: order.slice(0, Math.min(n, KINDS.length)),
      correcta: 0,
      explicacion: `$f_{xx} = ${2 * a}$, $f_{yy} = ${2 * c}$, $f_{xy} = ${b}$: $D = ${4 * a * c} - ${b * b} = ${D}$.`,
      valor: kind,
      f: { a, b, c },
    };
  },
};
