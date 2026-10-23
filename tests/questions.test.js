// Banco de preguntas y generadores (npm test): formato, KaTeX y verificación numérica de
// cada respuesta correcta, calculada aquí de forma independiente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { TOPICS } from '@calculo-royale/shared/constants';
import { BANK, drawQuestion, GENERATORS, shuffleOptions } from '../server/src/questions/QuestionBank.js';

// --- Evaluador numérico de opciones LaTeX sencillas (números, fracciones, π, e, raíces, tuplas) ---
function toJs(tex) {
  let s = tex.replace(/\$/g, '').replace(/\\left|\\right|\\,/g, '').replace(/\s+/g, '');
  const frac = /\\frac\{([^{}]*)\}\{([^{}]*)\}/;
  while (frac.test(s)) s = s.replace(frac, '(($1)/($2))');
  const sqrt = /\\sqrt\{([^{}]*)\}/;
  while (sqrt.test(s)) s = s.replace(sqrt, 'Math.sqrt($1)');
  s = s.replace(/e\^\{([^{}]*)\}/g, 'Math.exp($1)').replace(/\\pi/g, 'PI').replace(/\^\{([^{}]*)\}/g, '**($1)');
  s = s.replace(/(?<![A-Za-z.])e(?![A-Za-z(])/g, 'E');
  s = s.replace(/(\d|\)|PI|E)(?=\(|Math|PI|E)/g, '$1*');
  return s;
}
function evalOption(tex) {
  const s = toJs(tex);
  // Tupla (a, b, ...): se separa por las comas del primer nivel
  if (s.startsWith('(') && s.endsWith(')')) {
    const parts = [];
    let depth = 0;
    let start = 1;
    for (let i = 1; i < s.length - 1; i++) {
      if (s[i] === '(') depth++;
      if (s[i] === ')') depth--;
      if (s[i] === ',' && depth === 0) {
        parts.push(s.slice(start, i));
        start = i + 1;
      }
    }
    if (parts.length) {
      parts.push(s.slice(start, -1));
      return parts.map((p) => new Function('PI', 'E', `return (${p})`)(Math.PI, Math.E));
    }
  }
  return new Function('PI', 'E', `return (${s})`)(Math.PI, Math.E);
}
const close = (a, b, tol = 1e-3) =>
  Array.isArray(b) ? a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < tol) : Math.abs(a - b) < tol * Math.max(1, Math.abs(b));

// --- Cuadraturas independientes (Simpson) ---
function simpson(f, a, b, n = 400) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}
const int2 = (f, a, b, lo, hi, n = 200) => simpson((x) => simpson((y) => f(x, y), lo(x), hi(x), n), a, b, n);
const int3 = (f, a, b, lo, hi, zlo, zhi, n = 60) =>
  simpson((x) => simpson((y) => simpson((z) => f(x, y, z), zlo(x, y), zhi(x, y), n), lo(x), hi(x), n), a, b, n);
const c = (k) => () => k;
const grad = (f, x, y, h = 1e-5) => [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
const disk = (x) => Math.sqrt(Math.max(0, 1 - x * x));

// Máximo/mínimo de f sobre una curva parametrizada, por muestreo fino
const extreme = (values, kind) => (kind === 'max' ? Math.max(...values) : Math.min(...values));
const sample = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));

const TRUTH = {
  'dob-01': () => int2((x, y) => x * y, 0, 1, c(0), c(2)),
  'dob-02': () => int2(() => 1, 0, 2, c(0), c(3)),
  'dob-03': () => int2((x, y) => x + y, 0, 1, c(0), c(1)),
  'dob-04': () => int2((x, y) => y * Math.sin(x), 0, Math.PI, c(0), c(1)),
  'dob-05': () => int2((x, y) => x * x * y, 0, 2, c(1), c(3)),
  'dob-06': () => int2((x) => x, 0, 1, c(0), (x) => x),
  'tri-01': () => int3(() => 1, 0, 1, c(0), c(2), c(0), c(3)),
  'tri-02': () => int3((x, y, z) => x * y * z, 0, 1, c(0), c(1), c(0), c(1)),
  'tri-03': () => int3(() => 1, 0, 1, c(0), (x) => x, c(0), (x, y) => y),
  'tri-04': () => int3(() => 1, 0, 2, c(0), (x) => 2 - x, c(0), (x, y) => 2 - x - y),
  // Se integra en el orden original (no en el que sugiere la respuesta)
  'ord-03': () => simpson((y) => simpson((x) => Math.exp(x * x), y, 1), 0, 1),
  'ord-04': () => simpson((y) => simpson((x) => Math.sqrt(x ** 3 + 1), Math.sqrt(y), 1), 0, 1, 2000),
  'pol-02': () => int2((t, r) => r, 0, 2 * Math.PI, c(0), c(2)),
  // En cartesianas, independiente del cambio a polares
  'pol-03': () => int2((x, y) => x * x + y * y, -1, 1, (x) => -disk(x), disk, 1000),
  'pol-04': () => int2((x, y) => Math.exp(-(x * x + y * y)), -1, 1, (x) => -disk(x), disk, 1000),
  'esf-02': () => [2 * Math.cos(Math.PI / 2), 2 * Math.sin(Math.PI / 2), 3],
  'esf-03': () => (4 / 3) * Math.PI * 27,
  'esf-04': () => simpson((x) => simpson((y) => simpson((z) => z, 0, 2, 20), -disk(x), disk(x), 400), -1, 1, 400),
  'jac-02': () => Math.abs(2 * -1 - 1 * 1),
  // Región del paralelogramo descrita en x, y
  'jac-04': () => int2((x, y) => x + y, 0, 2, (x) => Math.max(x - 2, -x), (x) => Math.min(2 - x, x), 1000),
  'max-01': () => {
    const g = grad((x, y) => x * x + y * y, 0, 0);
    assert.ok(Math.hypot(...g) < 1e-6);
    return [0, 0];
  },
  'max-04': () => {
    const f = (x, y) => 4 + x ** 3 + y ** 3 - 3 * x * y;
    assert.ok(Math.hypot(...grad(f, 1, 1)) < 1e-6);
    return f(1, 1);
  },
  'lag-02': () => extreme(sample(10000, (t) => (10 * t) * (10 - 10 * t)), 'max'),
  'lag-03': () => extreme(sample(10000, (t) => (4 * t - 1) ** 2 + (2 - (4 * t - 1)) ** 2), 'min'),
  'lag-04': () => extreme(sample(10000, (t) => Math.SQRT2 * (Math.cos(2 * Math.PI * t) + Math.sin(2 * Math.PI * t))), 'max'),
  'lag-05': () => {
    let best = 0;
    for (let x = 0.01; x < 6; x += 0.01) for (let y = 0.01; x + y < 6; y += 0.01) best = Math.max(best, x * y * (6 - x - y));
    return best;
  },
  'gra-03': () => grad((x, y) => x * x + 3 * y, 1, 2),
  'gra-04': () => {
    const [gx, gy] = grad((x, y) => x * y, 1, 2);
    return (gx * 3 + gy * 4) / 5;
  },
  'gra-05': () => Math.hypot(2, 4, 4),
};

// Respuestas conceptuales: se verifica el razonamiento con una comprobación directa
const CONCEPT = {
  'ord-01': () => {
    const f = (x, y) => x * x + 3 * y + 1;
    const original = int2(f, 0, 1, (x) => x, c(1));
    const swapped = simpson((y) => simpson((x) => f(x, y), 0, y), 0, 1);
    assert.ok(close(original, swapped));
    return '\\int_0^y';
  },
  'ord-02': () => {
    const f = (x, y) => x + y * y;
    const original = int2(f, 0, 2, (x) => x * x, c(4), 400);
    const swapped = simpson((y) => simpson((x) => f(x, y), 0, Math.sqrt(y)), 0, 4, 2000);
    assert.ok(close(original, swapped, 5e-3));
    return '\\int_0^{\\sqrt{y}}';
  },
  'pol-01': () => 'r \\, dr',
  'esf-01': () => '\\rho^2 \\sin\\phi',
  'jac-01': () => {
    const [r, t] = [2, 0.7];
    assert.ok(close(Math.cos(t) * (r * Math.cos(t)) - (-r * Math.sin(t)) * Math.sin(t), r));
    return '$r$';
  },
  'jac-03': () => '$-u$',
  'max-02': () => {
    assert.ok(2 * -2 - 0 < 0);
    return 'silla';
  },
  'max-03': () => {
    assert.ok(6 * 1 * 2 - 0 > 0 && 6 * 1 > 0);
    return 'mínimo';
  },
  'lag-01': () => '\\nabla f = \\lambda \\nabla g',
  'gra-01': () => '(2xy, x^2)',
  'gra-02': () => '$\\nabla f$',
};

function renders(tex) {
  for (const [, math] of tex.matchAll(/\$([^$]+)\$/g)) katex.renderToString(math, { throwOnError: true });
}

test('el banco tiene ~40 preguntas válidas en los 9 temas y las 4 dificultades', () => {
  assert.ok(BANK.length >= 40, `${BANK.length} preguntas`);
  const ids = new Set();
  for (const q of BANK) {
    assert.ok(!ids.has(q.id), `id repetido ${q.id}`);
    ids.add(q.id);
    assert.ok(TOPICS[q.tema], `${q.id}: tema ${q.tema}`);
    assert.ok([1, 2, 3, 4].includes(q.dificultad), q.id);
    assert.equal(q.opciones.length, 4, q.id);
    assert.equal(new Set(q.opciones).size, 4, `${q.id}: opciones repetidas`);
    assert.ok(q.correcta >= 0 && q.correcta < 4, q.id);
    assert.ok(q.explicacion.length > 10, q.id);
    for (const t of [q.enunciado, ...q.opciones, q.explicacion]) renders(t);
  }
  for (const tema of Object.keys(TOPICS)) assert.ok(BANK.filter((q) => q.tema === tema).length >= 4, tema);
  for (const d of [1, 2, 3, 4]) assert.ok(BANK.filter((q) => q.dificultad === d).length >= 7, `dificultad ${d}`);
});

test('cada respuesta correcta del banco está bien calculada (y ningún distractor también lo está)', () => {
  const checked = new Set();
  for (const q of BANK) {
    if (TRUTH[q.id]) {
      const truth = TRUTH[q.id]();
      const marked = evalOption(q.opciones[q.correcta]);
      assert.ok(close(marked, truth, 2e-3), `${q.id}: marcada ${q.opciones[q.correcta]} = ${marked}, real ${truth}`);
      q.opciones.forEach((o, i) => {
        if (i === q.correcta) return;
        let v;
        try {
          v = evalOption(o);
        } catch {
          return;
        }
        assert.ok(!close(v, truth, 2e-3), `${q.id}: el distractor ${o} también es correcto`);
      });
      checked.add(q.id);
    } else if (CONCEPT[q.id]) {
      const expected = CONCEPT[q.id]();
      assert.ok(q.opciones[q.correcta].includes(expected), `${q.id}: se esperaba ${expected}`);
      checked.add(q.id);
    }
  }
  const missing = BANK.filter((q) => !checked.has(q.id)).map((q) => q.id);
  assert.deepEqual(missing, [], 'preguntas sin verificar');
});

test('los generadores dan 4 opciones distintas, KaTeX válido y la correcta bien calculada', () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const g of GENERATORS) {
    for (let i = 0; i < 300; i++) {
      const q = g.generar(rand);
      assert.equal(new Set(q.opciones).size, 4, `${g.name}: ${q.opciones}`);
      assert.ok(close(evalOption(q.opciones[q.correcta]), q.valor, 1e-9), `${g.name}: ${q.opciones[q.correcta]} ≠ ${q.valor}`);
      for (const t of [q.enunciado, ...q.opciones, q.explicacion]) renders(t);
    }
  }
});

test('el generador de derivada direccional calcula ∇f·v/|v| de forma independiente', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const g = GENERATORS.find((x) => x.name === 'derivada-direccional');
  for (let i = 0; i < 100; i++) {
    const q = g.generar(rand);
    const [, a, b, x, y, vx, vy] = q.enunciado.match(/= (\d*)x\^2 \+ (\d*)y\^2\$ en \$\((-?\d+), (-?\d+)\)\$.*\((-?\d+), (-?\d+)\)/).map((v) => (v === '' ? 1 : Number(v)));
    const f = (px, py) => a * px * px + b * py * py;
    const [gx, gy] = grad(f, x, y);
    assert.ok(close(evalOption(q.opciones[0]), (gx * vx + gy * vy) / Math.hypot(vx, vy), 1e-4));
  }
});

test('drawQuestion respeta los temas, busca la dificultad más cercana y baraja por jugador', () => {
  for (let i = 0; i < 50; i++) {
    const q = drawQuestion({ topics: ['polares'], difficulty: 3 });
    assert.equal(q.tema, 'polares');
    assert.equal(q.dificultad, 3);
  }
  const q = drawQuestion({ topics: ['jacobiano'], difficulty: 4 });
  assert.equal(q.dificultad, 4);
  // Integrales triples no tiene dificultad 5: usa la más cercana (4)
  assert.equal(drawQuestion({ topics: ['integrales_triples'], difficulty: 5 }).dificultad, 4);
  const positions = new Set();
  const base = BANK.find((x) => x.id === 'dob-05');
  for (let i = 0; i < 40; i++) positions.add(shuffleOptions(base).correcta);
  assert.ok(positions.size > 1, 'la correcta cambia de lugar');
  const shuffled = shuffleOptions(base);
  assert.equal(shuffled.opciones[shuffled.correcta], base.opciones[base.correcta]);
});

test('no repite preguntas del banco al mismo jugador mientras haya otras', () => {
  const seen = new Set();
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(drawQuestion({ topics: ['integrales_triples'], difficulty: 2, seen }).id);
  // Dificultad 2 de triples: una sola exacta; después pasa a las más cercanas sin repetir (hay 4)
  assert.equal(new Set(ids).size, ids.length);
});
