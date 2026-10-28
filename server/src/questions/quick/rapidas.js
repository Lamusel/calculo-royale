import { options, pick, randInt, term } from '../generators/format.js';

// Preguntas rápidas de dificultad 1 (2 opciones) para "Obtener balas" y la reanimación en equipo,
// de los cuatro temas del corte: derivada parcial, componente del gradiente, integral doble de una
// constante sobre un rectángulo y punto crítico de una cuadrática simple.
const pair = (u, v) => `(${u}, ${v})`;

// f = a x² y + b y: f_x = 2 a x y en (x₀, y₀)
export const parcialRapida = {
  name: 'parcial-rapida',
  tema: 'derivadas_direccionales',
  dificultad: 1,
  generar(rand, n = 2) {
    const a = randInt(1, 3, rand);
    const b = randInt(1, 4, rand);
    const x = randInt(1, 3, rand);
    const y = randInt(1, 3, rand);
    const fx = 2 * a * x * y;
    return {
      id: `gen-rap-parcial-${a}${b}${x}${y}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `$\\frac{\\partial f}{\\partial x}$ de $f = ${term(a, 'x^2 y')} + ${term(b, 'y')}$ en $(${x}, ${y})$`,
      opciones: options(String(fx), [String(a * x * x + b), String(a * x * y)], [String(fx + 1)], n),
      correcta: 0,
      explicacion: `$f_x = ${term(2 * a, 'xy')} = ${fx}$.`,
      valor: fx,
    };
  },
};

// f = a x + b y²: componente y del gradiente en (x₀, y₀) = 2 b y₀
export const componenteGradiente = {
  name: 'componente-gradiente',
  tema: 'derivadas_direccionales',
  dificultad: 1,
  generar(rand, n = 2) {
    const a = randInt(2, 5, rand);
    const b = randInt(1, 3, rand);
    const x = randInt(1, 3, rand);
    const y = pick([-2, -1, 1, 2, 3], rand);
    const fy = 2 * b * y;
    return {
      id: `gen-rap-grad-${a}${b}${x}${y}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `Componente $y$ de $\\nabla f(${x}, ${y})$ para $f = ${term(a, 'x')} + ${term(b, 'y^2')}$`,
      opciones: options(String(fy), [String(a), String(b * y * y)], [String(fy + 1)], n),
      correcta: 0,
      explicacion: `$f_y = ${term(2 * b, 'y')} = ${fy}$.`,
      valor: fy,
    };
  },
};

// ∫∫ c dA sobre [0, p] × [0, q] = c p q
export const integralConstante = {
  name: 'integral-constante',
  tema: 'integrales_dobles',
  dificultad: 1,
  generar(rand, n = 2) {
    const c = randInt(2, 6, rand);
    const p = randInt(1, 4, rand);
    const q = randInt(2, 5, rand);
    return {
      id: `gen-rap-cte-${c}${p}${q}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `$\\iint_R ${c}\\,dA$ con $R = [0, ${p}] \\times [0, ${q}]$`,
      opciones: options(String(c * p * q), [String(c + p * q), String(p * q)], [String(c * (p + q))], n),
      correcta: 0,
      explicacion: `$${c} \\cdot \\text{área} = ${c} \\cdot ${p * q} = ${c * p * q}$.`,
      valor: c * p * q,
    };
  },
};

// f = (x − h)² + (y − k)²: punto crítico (h, k)
export const criticoRapido = {
  name: 'critico-rapido',
  tema: 'maximos_minimos',
  dificultad: 1,
  generar(rand, n = 2) {
    const h = pick([-3, -2, -1, 1, 2, 3], rand);
    const k = pick([-3, -2, -1, 1, 2, 3], rand);
    const sq = (v, c) => `(${v} ${c > 0 ? '-' : '+'} ${Math.abs(c)})^2`;
    return {
      id: `gen-rap-crit-${h}${k}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `Punto crítico de $f = ${sq('x', h)} + ${sq('y', k)}$`,
      opciones: options(pair(h, k), [pair(-h, -k), pair(k, h)], [pair(h, -k)], n),
      correcta: 0,
      explicacion: `$\\nabla f = \\mathbf 0$ cuando $x = ${h}$ y $y = ${k}$: el punto $${pair(h, k)}$.`,
      valor: [h, k],
    };
  },
};

export const QUICK = [parcialRapida, componenteGradiente, integralConstante, criticoRapido];
