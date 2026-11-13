import { frac, options, randInt } from './format.js';

// ∬ (x + y)^m dA sobre 0 ≤ x + y ≤ p, 0 ≤ x − y ≤ q, con u = x + y, v = x − y (|J| = 1/2):
// p^(m+1) q / (2 (m + 1))
export default {
  name: 'doble-lineal',
  tema: 'cambio-variables-dobles',
  dificultad: 3,
  generar(rand, n = 4) {
    const p = randInt(1, 4, rand);
    const q = randInt(1, 4, rand);
    const m = randInt(1, 2, rand);
    const num = p ** (m + 1) * q;
    const correct = frac(num, 2 * (m + 1));
    // Errores típicos: olvidar el jacobiano, usar 2 en vez de 1/2, dejar el signo de J = −1/2
    const distractors = [frac(num, m + 1), frac(2 * num, m + 1), frac(-num, 2 * (m + 1))];
    const f = m === 1 ? '(x + y)' : '(x + y)^2';
    return {
      id: `gen-doblin-${p}${q}${m}`,
      tema: this.tema,
      dificultad: this.dificultad,
      enunciado: `$\\displaystyle\\iint_R ${f}\\,dA$, con $R$: $0 \\le x + y \\le ${p}$, $0 \\le x - y \\le ${q}$`,
      opciones: options(correct, distractors, [frac(num, 4 * (m + 1))], n),
      correcta: 0,
      explicacion: `Con $u = x + y$, $v = x - y$: $|J| = \\frac12$. $\\frac12\\int_0^{${p}} u${m === 2 ? '^2' : ''}\\,du \\int_0^{${q}} dv = \\frac12 \\cdot ${frac(p ** (m + 1), m + 1)} \\cdot ${q} = ${correct}$.`,
      verifica: { tipo: 'cart2', f: `(x+y)**${m}`, cond: `x+y>=0 && x+y<=${p} && x-y>=0 && x-y<=${q}`, box: [0, (p + q) / 2, -q / 2, p / 2], n: 500 },
    };
  },
};
