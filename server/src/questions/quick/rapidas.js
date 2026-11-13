import { options, piFrac, pick, randInt, term } from '../generators/format.js';

// Preguntas rápidas de dificultad 1 (2 opciones) para "Obtener balas" y la reanimación en equipo,
// de los cuatro temas (tanda 8): jacobiano de una transformación diagonal y de los tres sistemas,
// área de un disco en polares, un cilindro en cilíndricas y el volumen de una esfera.
// Cada una trae `verifica` (como el banco) para que las pruebas la resuelvan por su cuenta.

// x = a u, y = b v: |J| = a b
export const jacobianoDiagonal = {
  name: 'jacobiano-diagonal',
  tema: 'jacobiano',
  dificultad: 1,
  generar(rand, n = 2) {
    const a = randInt(2, 5, rand);
    const b = randInt(2, 5, rand);
    return {
      id: `gen-rap-jacdiag-${a}${b}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `$|J|$ de $x = ${term(a, 'u')}$, $y = ${term(b, 'v')}$`,
      opciones: options(String(a * b), [String(a + b)], [String(a * b + 1)], n),
      correcta: 0,
      explicacion: `Matriz diagonal: $J = ${a} \\cdot ${b} = ${a * b}$.`,
      verifica: { tipo: 'jac', map: [`${a}*u`, `${b}*v`], vars: ['u', 'v'], abs: true },
    };
  },
};

// Jacobiano de polares, cilíndricas o esféricas
const SYSTEMS = [
  { id: 'pol', name: 'polares', ok: 'r', bad: 'r^2', map: ['r*cos(theta)', 'r*sin(theta)'], vars: ['r', 'theta'], why: 'Por eso $dA = r\\,dr\\,d\\theta$.' },
  { id: 'cil', name: 'cilíndricas', ok: 'r', bad: 'r^2', map: ['r*cos(theta)', 'r*sin(theta)', 'z'], vars: ['r', 'theta', 'z'], why: 'Por eso $dV = r\\,dz\\,dr\\,d\\theta$.' },
  { id: 'esf', name: 'esféricas', ok: '\\rho^2\\sin\\phi', bad: '\\rho\\sin\\phi', map: ['rho*sin(phi)*cos(theta)', 'rho*sin(phi)*sin(theta)', 'rho*cos(phi)'], vars: ['rho', 'phi', 'theta'], why: 'Por eso $dV = \\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta$.' },
];
export const jacobianoSistema = {
  name: 'jacobiano-sistema',
  tema: 'jacobiano',
  dificultad: 1,
  generar(rand, n = 2) {
    const s = pick(SYSTEMS, rand);
    return {
      id: `gen-rap-jacsis-${s.id}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `¿Cuál es el jacobiano de las coordenadas ${s.name}?`,
      opciones: options(s.ok, [s.bad], ['1'], n),
      correcta: 0,
      explicacion: `El jacobiano de las ${s.name} es $${s.ok}$. ${s.why}`,
      verifica: { tipo: 'jac', map: s.map, vars: s.vars, abs: true },
    };
  },
};

// ∫₀^{2π} ∫₀^R r dr dθ = π R² (R ≠ 2: ahí olvidar la r daría lo mismo)
export const discoPolar = {
  name: 'disco-polar',
  tema: 'cambio-variables-dobles',
  dificultad: 1,
  generar(rand, n = 2) {
    const R = pick([1, 3, 4, 5], rand);
    return {
      id: `gen-rap-disco-${R}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `$\\displaystyle\\int_0^{2\\pi}\\!\\int_0^{${R}} r\\,dr\\,d\\theta$`,
      opciones: options(piFrac(R * R), [piFrac(2 * R)], [piFrac(R * R, 2)], n),
      correcta: 0,
      explicacion: `$\\int_0^{${R}} r\\,dr = \\frac{${R * R}}{2}$, por $2\\pi$: $${piFrac(R * R)}$ (el área del disco).`,
      verifica: { tipo: 'iter', f: 'r', vars: ['theta', 'r'], lim: [[0, '2*PI'], [0, R]] },
    };
  },
};

// ∫₀^{2π} ∫₀^R ∫₀^h r dz dr dθ = π R² h
export const cilindroRapido = {
  name: 'cilindro-rapido',
  tema: 'triples-cilindricas-esfericas',
  dificultad: 1,
  generar(rand, n = 2) {
    const R = pick([1, 3], rand);
    const h = randInt(1, 4, rand);
    return {
      id: `gen-rap-cil-${R}${h}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `$\\displaystyle\\int_0^{2\\pi}\\!\\int_0^{${R}}\\!\\int_0^{${h}} r\\,dz\\,dr\\,d\\theta$`,
      opciones: options(piFrac(R * R * h), [piFrac(2 * R * h)], [piFrac(R * R * h, 2)], n),
      correcta: 0,
      explicacion: `$2\\pi \\cdot \\frac{${R * R}}{2} \\cdot ${h} = ${piFrac(R * R * h)}$ (el volumen del cilindro).`,
      verifica: { tipo: 'iter', f: 'r', vars: ['theta', 'r', 'z'], lim: [[0, '2*PI'], [0, R], [0, h]] },
    };
  },
};

// Volumen de la esfera de radio R: 4 π R³ / 3
export const volumenEsfera = {
  name: 'volumen-esfera',
  tema: 'volumen',
  dificultad: 1,
  generar(rand, n = 2) {
    const R = randInt(1, 3, rand);
    const correct = piFrac(4 * R ** 3, 3);
    return {
      id: `gen-rap-esfera-${R}`,
      tema: this.tema,
      dificultad: 1,
      enunciado: `Volumen de la esfera de radio $${R}$`,
      opciones: options(correct, [piFrac(4 * R * R)], [piFrac(2 * R ** 3, 3)], n),
      correcta: 0,
      explicacion: `$\\int_0^{2\\pi}\\!\\int_0^{\\pi}\\!\\int_0^{${R}} \\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta = \\frac43\\pi \\cdot ${R ** 3} = ${correct}$.`,
      verifica: { tipo: 'cart2', f: `2*sqrt(max(0,${R * R}-x*x-y*y))`, cond: `x*x+y*y<=${R * R}`, box: [-R, R, -R, R], n: 500 },
    };
  },
};

export const QUICK = [jacobianoDiagonal, jacobianoSistema, discoPolar, cilindroRapido, volumenEsfera];
