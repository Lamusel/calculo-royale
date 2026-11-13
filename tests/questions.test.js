// Banco de preguntas y generadores (npm test): formato, KaTeX, número de opciones y verificación
// de cada respuesta. Cada pregunta (del banco, de los generadores y las rápidas) describe su problema
// en `verifica`; aquí se resuelve por cuenta propia, sin mirar la respuesta escrita, y se exige que la
// marcada coincida y ningún distractor:
//   - jacobianos: determinante por diferencias finitas, comparado con la opción en varios puntos
//   - integrales con cambio de variables: la misma integral en cartesianas, sobre una cuadrícula
//   - integrales iteradas ya planteadas: Simpson anidado
import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { optionCount, TOPICS } from '@calculo-royale/shared/constants';
import { BANK, drawQuestion, drawQuickQuestion, GENERATORS, QUICK_GENERATORS, shuffleOptions } from '../server/src/questions/QuestionBank.js';

const SLUGS = ['cambio-variables-dobles', 'jacobiano', 'triples-cilindricas-esfericas', 'volumen'];

// --- Evaluador de opciones en LaTeX (números, fracciones, π, e, raíces, ln, sen, cos y variables) ---
const GREEK = { pi: 'PI', rho: 'rho', phi: 'phi', theta: 'theta' };
const FUNCS = { sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan', ln: 'Math.log' };
function texToJs(src) {
  const s = src.replace(/\$|\\left|\\right|\\displaystyle|\\[,!;:]/g, '').replace(/\\(cdot|times)/g, '*').trim();
  let i = 0;
  const skip = () => {
    while (s[i] === ' ') i++;
  };
  const group = () => {
    i++;
    const inner = expr('}');
    i++;
    return inner;
  };
  function atom() {
    skip();
    const c = s[i];
    let a;
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (/[0-9.]/.test(s[j] ?? '')) j++;
      a = s.slice(i, j);
      i = j;
    } else if (c === '(') {
      i++;
      a = `(${expr(')')})`;
      i++;
    } else if (c === '{') a = `(${group()})`;
    else if (c === '\\') {
      const name = /^\\([A-Za-z]+)/.exec(s.slice(i))?.[1];
      if (!name) throw new Error(`comando en ${s.slice(i)}`);
      i += name.length + 1;
      if (name === 'frac') {
        skip();
        const n = group();
        skip();
        a = `((${n})/(${group()}))`;
      } else if (name === 'sqrt') {
        skip();
        a = `Math.sqrt(${group()})`;
      } else if (FUNCS[name]) a = `${FUNCS[name]}(${atom()})`;
      else if (GREEK[name]) a = GREEK[name];
      else throw new Error(`\\${name}`);
    } else if (/[A-Za-z]/.test(c ?? '')) {
      a = c === 'e' ? 'E' : c;
      i++;
    } else throw new Error(`símbolo ${c}`);
    skip();
    if (s[i] === '^') {
      i++;
      skip();
      const e = s[i] === '{' ? group() : s[i++];
      a = `(${a}**(${e}))`;
    }
    return a;
  }
  function expr(end) {
    let js = '';
    let prevAtom = false;
    for (;;) {
      skip();
      if (i >= s.length || s[i] === end) return js;
      if ('+-*/'.includes(s[i])) {
        js += s[i++];
        prevAtom = false;
      } else {
        js += (prevAtom ? '*' : '') + atom();
        prevAtom = true;
      }
    }
  }
  return expr(undefined) || '1';
}
function evalTex(tex, env = {}) {
  return new Function('PI', 'E', ...Object.keys(env), `return (${texToJs(tex)})`)(Math.PI, Math.E, ...Object.values(env));
}
const close = (a, b, tol = 2e-3) => Number.isFinite(a) && Math.abs(a - b) < tol * Math.max(1, Math.abs(b));

// --- Herramientas numéricas independientes ---
const MATH = ['sin', 'cos', 'tan', 'sqrt', 'exp', 'log', 'abs', 'max', 'min', 'PI'];
const withMath = (params, body) => new Function(...MATH, `return function (${params.join(',')}) { ${body} }`)(...MATH.map((k) => Math[k]));
const fn = (vars, expr) => withMath(vars, `return (${expr});`);
function simpson(f, a, b, n) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}
// Determinante del jacobiano del mapa en un punto, por diferencias centrales
function jacobian(v, point) {
  const fs = v.map.map((e) => fn(v.vars, e));
  const h = 1e-5;
  const m = fs.map((f) => point.map((_, j) => {
    const up = point.map((x, k) => (k === j ? x + h : x));
    const down = point.map((x, k) => (k === j ? x - h : x));
    return (f(...up) - f(...down)) / (2 * h);
  }));
  let det = m.length === 2
    ? m[0][0] * m[1][1] - m[0][1] * m[1][0]
    : m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  if (v.abs) det = Math.abs(det);
  return v.inv ? 1 / det : det;
}
// Integral iterada tal como está escrita (variables de afuera hacia adentro)
function iterated(v) {
  const f = fn(v.vars, v.f);
  const lims = v.lim.map((l, i) => l.map((e) => fn(v.vars.slice(0, i), String(e))));
  const n = v.vars.length === 3 ? 40 : 200;
  const rec = (i, args) => (i === v.vars.length ? f(...args) : simpson((t) => rec(i + 1, [...args, t]), lims[i][0](...args), lims[i][1](...args), n));
  return rec(0, []);
}
// ∬ f dA en cartesianas: suma de puntos medios sobre la caja, solo donde se cumple la condición
function cart2(v) {
  const run = withMath(['x0', 'x1', 'y0', 'y1', 'n'], `
    const hx = (x1 - x0) / n, hy = (y1 - y0) / n; let s = 0;
    for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * hx;
      for (let j = 0; j < n; j++) { const y = y0 + (j + 0.5) * hy; if (${v.cond}) s += (${v.f}); } }
    return s * hx * hy;`);
  return run(...v.box, v.n ?? 1000);
}
// ∭ f dV en cartesianas, igual que cart2
function cart3(v) {
  const run = withMath(['x0', 'x1', 'y0', 'y1', 'z0', 'z1', 'n'], `
    const hx = (x1 - x0) / n, hy = (y1 - y0) / n, hz = (z1 - z0) / n; let s = 0;
    for (let i = 0; i < n; i++) { const x = x0 + (i + 0.5) * hx;
      for (let j = 0; j < n; j++) { const y = y0 + (j + 0.5) * hy;
        for (let k = 0; k < n; k++) { const z = z0 + (k + 0.5) * hz; if (${v.cond}) s += (${v.f}); } } }
    return s * hx * hy * hz;`);
  return run(...v.box, v.n ?? 110);
}

// Puntos de muestra para comparar expresiones (ángulos entre 0 y π/2: sen φ > 0)
const SAMPLES = [[1.3, 0.7, 0.4], [0.6, 1.1, 0.9], [2.1, 0.5, 1.2]];
const XYZ = [[0.8, 0.5, 0.6], [-0.4, 1.2, 0.9], [1.1, -0.7, 0.3]];
const noDifferentials = (o) => o.replace(/d(\\theta|\\rho|\\phi|[zruvwAV])/g, '');
const safe = (f) => {
  try {
    return f();
  } catch {
    return NaN;
  }
};

// Resuelve el problema: devuelve { valor, tol } (número), { contiene } (se revisa el texto) o
// { prueba } (criterio que debe cumplir la marcada y ningún distractor)
function solve(v) {
  switch (v.tipo) {
    case 'jac': {
      if (v.p) return { valor: jacobian(v, v.p), tol: 2e-3 };
      const env = (pt) => Object.fromEntries(v.vars.map((name, i) => [name, pt[i]]));
      return { prueba: (o) => SAMPLES.every((pt) => close(safe(() => evalTex(v.dV ? noDifferentials(o) : o, env(pt))), jacobian(v, pt.slice(0, v.vars.length)), 1e-4)) };
    }
    case 'areaimg': {
      const [u0, u1, v0, v1] = v.box;
      return { valor: simpson((u) => simpson((w) => Math.abs(jacobian(v, [u, w])), v0, v1, 10), u0, u1, 10), tol: 2e-3 };
    }
    case 'sym': {
      // La opción, en las coordenadas del otro sistema, debe valer lo mismo que f(x, y, z)
      const f = fn(['x', 'y', 'z'], v.f);
      return {
        prueba: (o) => XYZ.every(([x, y, z]) => {
          const rho = Math.hypot(x, y, z);
          const env = { x, y, z, r: Math.hypot(x, y), theta: Math.atan2(y, x), rho, phi: Math.acos(z / rho) };
          return close(safe(() => evalTex(o, env)), f(x, y, z), 1e-6);
        }),
      };
    }
    case 'iter': return { valor: iterated(v), tol: 2e-3 };
    case 'cart2': return { valor: cart2(v), tol: 1e-2 };
    case 'cart3': return { valor: cart3(v), tol: 1e-2 };
    case 'equiv': {
      const a = solve(v.a).valor;
      const b = solve(v.b).valor;
      assert.ok(close(a, b, 1e-2), `los límites de la opción correcta dan ${a} y la región mide ${b}`);
      return { contiene: v.contiene };
    }
    case 'concepto': return { contiene: v.contiene };
    default: throw new Error(`tipo ${v.tipo}`);
  }
}

// La marcada debe ser la solución y ningún distractor puede serlo
function checkAnswer(q, label = q.id) {
  assert.ok(q.verifica, `${label}: sin verificación`);
  const truth = solve(q.verifica);
  const marked = q.opciones[q.correcta];
  const others = q.opciones.filter((_, i) => i !== q.correcta);
  if (truth.contiene) {
    assert.ok(marked.includes(truth.contiene), `${label}: se esperaba «${truth.contiene}» en ${marked}`);
    for (const o of others) assert.ok(!o.includes(truth.contiene), `${label}: el distractor ${o} también dice «${truth.contiene}»`);
  } else if (truth.prueba) {
    assert.ok(truth.prueba(marked), `${label}: la marcada ${marked} no cumple`);
    for (const o of others) assert.ok(!truth.prueba(o), `${label}: el distractor ${o} también cumple`);
  } else {
    const value = safe(() => evalTex(marked));
    assert.ok(close(value, truth.valor, truth.tol), `${label}: marcada ${marked} = ${value}, real ${truth.valor}`);
    // Un distractor a menos del 3 % de la respuesta sería injusto (y no se distinguiría de la cuadrícula)
    for (const o of others) assert.ok(!close(safe(() => evalTex(o)), truth.valor, 3e-2), `${label}: el distractor ${o} también es correcto`);
  }
}

function renders(tex) {
  for (const [, math] of tex.matchAll(/\$([^$]+)\$/g)) katex.renderToString(math, { throwOnError: true });
}
const seeded = (s) => {
  let seed = s;
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
};

test('el evaluador de LaTeX entiende las formas exactas del banco', () => {
  assert.ok(close(evalTex('$\\frac{8\\pi}{3}(2 - \\sqrt{2})$'), (8 * Math.PI / 3) * (2 - Math.SQRT2), 1e-9));
  assert.ok(close(evalTex('$\\pi(1 - e^{-4})$'), Math.PI * (1 - Math.exp(-4)), 1e-9));
  assert.ok(close(evalTex('$3\\ln 2$'), 3 * Math.log(2), 1e-9));
  assert.ok(close(evalTex('$-\\frac{1}{2}$'), -0.5, 1e-9));
  assert.ok(close(evalTex('$\\rho^2\\sin\\phi$', { rho: 2, phi: 0.5 }), 4 * Math.sin(0.5), 1e-9));
  assert.ok(close(evalTex('$4(u^2 + v^2)$', { u: 2, v: 3 }), 52, 1e-9));
});

test('banco: solo los 4 temas nuevos, 25 por tema (7/7/6/5) y opciones 2/2/3/3 por dificultad', () => {
  assert.deepEqual(Object.keys(TOPICS).sort(), SLUGS);
  const ids = new Set();
  for (const q of BANK) {
    assert.ok(!ids.has(q.id), `id repetido ${q.id}`);
    ids.add(q.id);
    assert.ok(TOPICS[q.tema], `${q.id}: tema ${q.tema}`);
    assert.ok([1, 2, 3, 4].includes(q.dificultad), q.id);
    assert.ok(q.opciones.length >= optionCount(q.dificultad), `${q.id}: pocas opciones`);
    assert.equal(new Set(q.opciones).size, q.opciones.length, `${q.id}: opciones repetidas`);
    assert.ok(q.correcta >= 0 && q.correcta < q.opciones.length, q.id);
    assert.ok(q.explicacion.length > 10, q.id);
    for (const t of [q.enunciado, ...q.opciones, q.explicacion]) renders(t);
  }
  assert.deepEqual([1, 2, 3, 4].map(optionCount), [2, 2, 3, 3]);
  for (const tema of SLUGS) {
    const list = BANK.filter((q) => q.tema === tema);
    assert.equal(list.length, 25, `${tema}: ${list.length}`);
    assert.deepEqual([1, 2, 3, 4].map((d) => list.filter((q) => q.dificultad === d).length), [7, 7, 6, 5], tema);
    assert.equal(GENERATORS.filter((g) => g.tema === tema).length, 2, `${tema}: 2 generadores`);
    assert.ok(QUICK_GENERATORS.some((g) => g.tema === tema), `${tema}: sin pregunta rápida`);
  }
});

test('cada respuesta del banco se resuelve aparte: la marcada es la correcta y ningún distractor lo es', () => {
  for (const q of BANK) checkAnswer(q);
});

test('cada generador, con 50 semillas: opciones según dificultad, KaTeX válido y la correcta bien calculada', () => {
  for (const g of GENERATORS) {
    const n = optionCount(g.dificultad);
    const ids = new Set();
    for (let s = 1; s <= 50; s++) {
      const q = g.generar(seeded(s * 7919), n);
      ids.add(q.id);
      assert.equal(q.tema, g.tema);
      assert.equal(q.opciones.length, n, `${g.name}: ${q.opciones}`);
      assert.equal(new Set(q.opciones).size, n, `${g.name}: opciones repetidas ${q.opciones}`);
      for (const t of [q.enunciado, ...q.opciones, q.explicacion]) renders(t);
      checkAnswer(q, `${g.name} (${q.enunciado})`);
    }
    assert.ok(ids.size >= 4, `${g.name}: los parámetros casi no cambian`);
  }
});

test('preguntas rápidas (balas y reanimación): dificultad 1, 2 opciones, de los temas de la sala y bien calculadas', () => {
  for (const g of QUICK_GENERATORS) {
    for (let s = 1; s <= 50; s++) {
      const q = g.generar(seeded(s * 104729), 2);
      assert.equal(q.dificultad, 1);
      assert.ok(TOPICS[q.tema], q.tema);
      assert.equal(new Set(q.opciones).size, 2, `${g.name}: ${q.opciones}`);
      for (const t of [q.enunciado, ...q.opciones, q.explicacion]) renders(t);
      checkAnswer(q, `${g.name} (${q.enunciado})`);
    }
  }
  // Con un solo tema válido en la sala, la rápida es de ese tema; un tema viejo ya no cuenta
  for (let i = 0; i < 20; i++) assert.equal(drawQuickQuestion(Math.random, false, ['lagrange', 'volumen']).tema, 'volumen');
  assert.equal(drawQuickQuestion(Math.random, false, ['jacobiano']).opciones.length, 2);
  // Modo fácil: aritmética, también en las rápidas
  assert.equal(drawQuickQuestion(Math.random, true, ['jacobiano']).tema, 'facil');
});

test('drawQuestion respeta los temas, la dificultad y el número de opciones, y baraja por jugador', () => {
  for (const tema of SLUGS) {
    for (const d of [1, 2, 3, 4]) {
      const q = drawQuestion({ topics: [tema], difficulty: d });
      assert.equal(q.tema, tema);
      assert.equal(q.dificultad, d);
      assert.equal(q.opciones.length, optionCount(d), `${tema} d${d}`);
    }
  }
  // Sin dificultad 5: usa la más cercana (4). Modo fácil: aritmética con las mismas opciones
  assert.equal(drawQuestion({ topics: ['volumen'], difficulty: 5 }).dificultad, 4);
  assert.equal(drawQuestion({ topics: ['volumen'], difficulty: 3, easy: true }).tema, 'facil');
  const positions = new Set();
  const base = BANK.find((x) => x.id === 'vo-08');
  for (let i = 0; i < 40; i++) positions.add(shuffleOptions(base).correcta);
  assert.ok(positions.size > 1, 'la correcta cambia de lugar');
  const shuffled = shuffleOptions(base);
  assert.equal(shuffled.opciones[shuffled.correcta], base.opciones[base.correcta]);
});

test('no repite preguntas del banco al mismo jugador mientras haya otras', () => {
  const seen = new Set();
  const ids = [];
  for (let i = 0; i < 12; i++) {
    const q = drawQuestion({ topics: ['volumen'], difficulty: 4, seen });
    if (!q.id.startsWith('gen-')) ids.push(q.id);
  }
  assert.equal(new Set(ids).size, ids.length);
});
