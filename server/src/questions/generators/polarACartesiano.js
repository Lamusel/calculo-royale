import { options, pick, surd } from './format.js';

// (r, θ) → (r cos θ, r sin θ) con ángulos notables. Cada ángulo guarda cos y sin como
// [signo, k], que vale signo·√k / 2 (k = 1 → ±1/2, k = 3 → ±√3/2).
// Con r par, r/2 es entero y el resultado queda entero·√k.
const ANGLES = [
  { tex: '\\frac{\\pi}{6}', cos: [1, 3], sin: [1, 1] },
  { tex: '\\frac{\\pi}{4}', cos: [1, 2], sin: [1, 2] },
  { tex: '\\frac{\\pi}{3}', cos: [1, 1], sin: [1, 3] },
  { tex: '\\frac{2\\pi}{3}', cos: [-1, 1], sin: [1, 3] },
  { tex: '\\frac{3\\pi}{4}', cos: [-1, 2], sin: [1, 2] },
  { tex: '\\frac{5\\pi}{6}', cos: [-1, 3], sin: [1, 1] },
  { tex: '\\frac{7\\pi}{6}', cos: [-1, 3], sin: [-1, 1] },
  { tex: '\\frac{5\\pi}{4}', cos: [-1, 2], sin: [-1, 2] },
  { tex: '\\frac{4\\pi}{3}', cos: [-1, 1], sin: [-1, 3] },
  { tex: '\\frac{5\\pi}{3}', cos: [1, 1], sin: [-1, 3] },
  { tex: '\\frac{7\\pi}{4}', cos: [1, 2], sin: [-1, 2] },
  { tex: '\\frac{11\\pi}{6}', cos: [1, 3], sin: [-1, 1] },
];

// r · (signo · √k / 2) con r par
const value = (r, [sign, k]) => ({ coef: sign * (r / 2), k });
const tex = ({ coef, k }) => surd(coef, k);
const num = ({ coef, k }) => coef * Math.sqrt(k);

export default {
  name: 'polar-cartesiano',
  tema: 'polares',
  dificultad: 1,
  generar(rand) {
    const r = pick([2, 4, 6], rand);
    const angle = pick(ANGLES, rand);
    const x = value(r, angle.cos);
    const y = value(r, angle.sin);
    const pair = (a, b) => `(${tex(a)}, ${tex(b)})`;
    const neg = (v) => ({ ...v, coef: -v.coef });
    // Errores típicos: intercambiar cos y sin, equivocar el cuadrante (signos)
    const distractors = [pair(y, x), pair(neg(x), y), pair(x, neg(y))];
    const fallback = [pair(neg(x), neg(y)), pair(neg(y), x), pair(y, neg(x))];
    return {
      id: `gen-pol-${r}-${ANGLES.indexOf(angle)}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `El punto con coordenadas polares $(r, \\theta) = \\left(${r}, ${angle.tex}\\right)$ en cartesianas es`,
      opciones: options(pair(x, y), distractors, fallback),
      correcta: 0,
      explicacion: `$x = r\\cos\\theta = ${r}\\cos ${angle.tex} = ${tex(x)}$, $y = r\\sin\\theta = ${r}\\sin ${angle.tex} = ${tex(y)}$.`,
      valor: [num(x), num(y)],
    };
  },
};
