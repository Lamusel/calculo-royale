import { lin, options, randInt } from './format.js';

// Imagen del rectángulo [0, p] × [0, q] bajo x = a u + b v, y = c u − d v: área = |J| p q,
// con J = −(a d + b c) < 0 (el signo es la trampa)
export default {
  name: 'jacobiano-area',
  tema: 'jacobiano',
  dificultad: 3,
  generar(rand, n = 4) {
    const a = randInt(1, 3, rand);
    const b = randInt(1, 3, rand);
    const c = randInt(1, 3, rand);
    const d = randInt(1, 3, rand);
    const p = randInt(1, 3, rand);
    const q = randInt(1, 3, rand);
    const j = a * d + b * c;
    const area = j * p * q;
    // Errores típicos: dejar el signo de J, olvidar el jacobiano, no multiplicar por el área original
    const distractors = [String(-area), String(p * q), String(j)];
    return {
      id: `gen-jacarea-${a}${b}${c}${d}${p}${q}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `Área de la imagen del rectángulo $0 \\le u \\le ${p}$, $0 \\le v \\le ${q}$ bajo $x = ${lin(a, 'u', b, 'v')}$, $y = ${lin(c, 'u', -d, 'v')}$`,
      opciones: options(String(area), distractors, [String(area + 1), String(area * 2)], n),
      correcta: 0,
      explicacion: `$J = ${a} \\cdot (${-d}) - ${b} \\cdot ${c} = ${-j}$, así que $|J| = ${j}$. Área $= ${j} \\cdot ${p * q} = ${area}$ (un área nunca es negativa).`,
      verifica: { tipo: 'areaimg', map: [`${a}*u+${b}*v`, `${c}*u-${d}*v`], vars: ['u', 'v'], box: [0, p, 0, q] },
    };
  },
};
