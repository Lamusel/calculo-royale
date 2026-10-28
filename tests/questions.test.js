// Banco de preguntas y generadores (npm test): formato, KaTeX, número de opciones y verificación
// numérica de cada respuesta. Cada pregunta del banco describe su problema en `verifica`; aquí se
// resuelve por cuenta propia (Simpson, gradientes numéricos, muestreo de la restricción) sin mirar
// la respuesta escrita, y se exige que la marcada coincida y ningún distractor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { optionCount, TOPICS } from '@calculo-royale/shared/constants';
import { BANK, drawQuestion, drawQuickQuestion, GENERATORS, QUICK_GENERATORS, shuffleOptions } from '../server/src/questions/QuestionBank.js';

// --- Evaluador numérico de opciones LaTeX sencillas (números, fracciones, π, e, raíces, tuplas) ---
function toJs(tex) {
  let s = tex.replace(/\$/g, '').replace(/\\left|\\right|\\,/g, '').replace(/\s+/g, '');
  const frac = /\\frac\{([^{}]*)\}\{([^{}]*)\}/;
  const sqrt = /\\sqrt\{([^{}]*)\}/;
  // Raíces y fracciones anidadas (\frac{3}{\sqrt{2}}): se resuelven de adentro hacia afuera
  while (frac.test(s) || sqrt.test(s)) s = s.replace(sqrt, 'Math.sqrt($1)').replace(frac, '(($1)/($2))');
  s = s.replace(/e\^\{([^{}]*)\}/g, 'Math.exp($1)').replace(/\\pi/g, 'PI').replace(/\^\{([^{}]*)\}/g, '**($1)');
  s = s.replace(/(?<![A-Za-z.])e(?![A-Za-z(])/g, 'E');
  s = s.replace(/(\d|\)|PI|E)(?=\(|Math|PI|E)/g, '$1*');
  return s;
}
function splitTuple(s) {
  if (!(s.startsWith('(') && s.endsWith(')'))) return null;
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
  if (!parts.length) return null;
  parts.push(s.slice(start, -1));
  return parts;
}
function evalOption(tex) {
  const s = toJs(tex);
  const parts = splitTuple(s);
  const run = (p) => new Function('PI', 'E', `return (${p})`)(Math.PI, Math.E);
  return parts ? parts.map(run) : run(s);
}
// Expresiones simbólicas en x, y ("2x", "3y^2", "x^2"): multiplicación implícita
function evalSym(tex, x, y) {
  let s = tex.replace(/\$/g, '').replace(/\s+/g, '').replace(/\^(\d)/g, '**$1');
  s = s.replace(/(\d|x|y|\))(?=x|y|\()/g, '$1*');
  return new Function('x', 'y', `return (${s})`)(x, y);
}
const close = (a, b, tol = 1e-3) =>
  Array.isArray(b) ? Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < tol) : !Array.isArray(a) && Math.abs(a - b) < tol * Math.max(1, Math.abs(b));

// --- Herramientas numéricas independientes ---
const fn = (expr) => new Function('x', 'y', `return (${expr})`);
function simpson(f, a, b, n = 200) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}
const H = 1e-4;
const grad = (f, x, y) => [(f(x + H, y) - f(x - H, y)) / (2 * H), (f(x, y + H) - f(x, y - H)) / (2 * H)];
const hessian = (f, x, y) => {
  const h = 1e-3;
  const fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h);
  const fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h);
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h);
  return { fxx, fyy, fxy, D: fxx * fyy - fxy * fxy };
};
// Puntos de la restricción (círculo, elipse o tramo de recta)
function curvePoints({ tipo, r, a, b, x0, y0, dx, dy }, n = 40000) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    if (tipo === 'circ') return [r * Math.cos(2 * Math.PI * t), r * Math.sin(2 * Math.PI * t)];
    if (tipo === 'elip') return [a * Math.cos(2 * Math.PI * t), b * Math.sin(2 * Math.PI * t)];
    const s = -20 + 40 * t; // recta: x0 + s dx, y0 + s dy
    return [x0 + s * dx, y0 + s * dy];
  });
}
function optimum(v) {
  const f = fn(v.f);
  let best = null;
  for (const [x, y] of curvePoints(v.curva)) {
    const val = f(x, y);
    if (!best || (v.modo === 'max' ? val > best.val : val < best.val)) best = { x, y, val };
  }
  return best;
}
const int2 = (f, [a, b], [lo, hi], n = 200) => simpson((x) => simpson((y) => f(x, y), fn(lo)(x, 0), fn(hi)(x, 0), n), a, b, n);
const int2y = (f, [c, d], [lo, hi], n = 200) => simpson((y) => simpson((x) => f(x, y), fn(lo)(0, y), fn(hi)(0, y), n), c, d, n);
const KIND = (f, [x, y]) => {
  const { fxx, D } = hessian(f, x, y);
  assert.ok(Math.hypot(...grad(f, x, y)) < 1e-4, 'el punto es crítico');
  return D < 0 ? 'silla' : fxx > 0 ? 'Mínimo' : 'Máximo';
};

// Valor real (número o tupla) del problema, o { contiene } si se verifica por texto,
// o { prueba } si se revisa cada opción con un criterio
function solve(v) {
  const f = v.f ? fn(v.f) : null;
  switch (v.tipo) {
    case 'valor': return v.valor;
    case 'grad': return grad(f, ...v.p);
    case 'parcial': return grad(f, ...v.p)[v.var === 'x' ? 0 : 1];
    case 'dir': {
      const [gx, gy] = grad(f, ...v.p);
      return (gx * v.v[0] + gy * v.v[1]) / Math.hypot(...v.v);
    }
    case 'maxdir': return Math.hypot(...grad(f, ...v.p));
    case 'unitgrad': {
      const g = grad(f, ...v.p);
      const len = Math.hypot(...g);
      return g.map((c) => c / len);
    }
    case 'gradsym': return { prueba: (o) => [[1, 2], [-1.5, 0.5], [3, -2]].every(([x, y]) => close(splitTuple(o.replace(/\$/g, '').replace(/\s+/g, '')).map((c) => evalSym(c, x, y)), grad(f, x, y), 1e-3)) };
    case 'zerodir': {
      const g = grad(f, ...v.p);
      return { prueba: (o) => { const u = evalOption(o); return Math.abs(Math.hypot(...u) - 1) < 1e-6 && Math.abs(u[0] * g[0] + u[1] * g[1]) < 1e-4; } };
    }
    case 'lag': return optimum(v).val;
    case 'lagpunto': { const b = optimum(v); return [b.x, b.y]; }
    case 'lambda': {
      const b = optimum(v);
      const gf = grad(f, b.x, b.y);
      const gg = grad(fn(v.g), b.x, b.y);
      return (gf[0] * gg[0] + gf[1] * gg[1]) / (gg[0] ** 2 + gg[1] ** 2);
    }
    case 'max2d': {
      const cond = fn(v.cond);
      let best = -Infinity;
      const [lo, hi] = v.dom;
      for (let x = lo + 0.01; x < hi; x += 0.01) for (let y = lo + 0.01; y < hi; y += 0.01) if (cond(x, y)) best = Math.max(best, f(x, y));
      return best;
    }
    case 'int2': return int2(f, v.x, v.y, v.n);
    case 'int2y': return int2y(f, v.y, v.x, v.n);
    case 'polar': return simpson((t) => simpson((r) => f(r * Math.cos(t), r * Math.sin(t)) * r, fn(v.r[0])(0, 0), fn(v.r[1])(0, 0)), v.t[0], v.t[1]);
    case 'orden': {
      const g = fn(v.f);
      const value = (w) => (w.tipo === 'int2' ? int2(g, w.x, w.y, 400) : int2y(g, w.y, w.x, 400));
      assert.ok(close(value(v.original), value(v.cambiada), 5e-3), 'el cambio de orden da lo mismo');
      return { contiene: v.contiene };
    }
    case 'critico': return { prueba: (o) => { const p = evalOption(o); return Math.hypot(...grad(f, ...p)) < 1e-4; } };
    case 'clasif': return { contiene: KIND(f, v.p) };
    case 'D': return hessian(f, ...v.p).D;
    case 'valcrit': {
      assert.ok(Math.hypot(...grad(f, ...v.p)) < 1e-4, 'el punto es crítico');
      return f(...v.p);
    }
    case 'concepto': return { contiene: v.contiene };
    default: throw new Error(`tipo ${v.tipo}`);
  }
}

function renders(tex) {
  for (const [, math] of tex.matchAll(/\$([^$]+)\$/g)) katex.renderToString(math, { throwOnError: true });
}

test('banco: solo los 4 temas, ≥ 25 por tema (7/7/6/5) y opciones suficientes por dificultad', () => {
  assert.deepEqual(Object.keys(TOPICS).sort(), ['derivadas_direccionales', 'integrales_dobles', 'lagrange', 'maximos_minimos']);
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
  for (const tema of Object.keys(TOPICS)) {
    const list = BANK.filter((q) => q.tema === tema);
    assert.ok(list.length >= 25, `${tema}: ${list.length}`);
    for (const [d, min] of [[1, 7], [2, 7], [3, 6], [4, 5]]) assert.ok(list.filter((q) => q.dificultad === d).length >= min, `${tema} dificultad ${d}`);
    assert.equal(GENERATORS.filter((g) => g.tema === tema).length, 2, `${tema}: 2 generadores`);
  }
});

test('cada respuesta del banco está bien calculada y ningún distractor también lo está', () => {
  for (const q of BANK) {
    assert.ok(q.verifica, `${q.id}: sin verificación`);
    const truth = solve(q.verifica);
    const marked = q.opciones[q.correcta];
    const others = q.opciones.filter((_, i) => i !== q.correcta);
    if (truth?.contiene) {
      assert.ok(marked.includes(truth.contiene), `${q.id}: se esperaba «${truth.contiene}» en ${marked}`);
      for (const o of others) assert.ok(!o.includes(truth.contiene), `${q.id}: el distractor ${o} también dice «${truth.contiene}»`);
    } else if (truth?.prueba) {
      assert.ok(truth.prueba(marked), `${q.id}: la marcada ${marked} no cumple`);
      for (const o of others) assert.ok(!truth.prueba(o), `${q.id}: el distractor ${o} también cumple`);
    } else {
      let value;
      try {
        value = evalOption(marked);
      } catch (e) {
        assert.fail(`${q.id}: no se pudo evaluar ${marked} (${e.message})`);
      }
      assert.ok(close(value, truth, 2e-3), `${q.id}: marcada ${marked} = ${value}, real ${truth}`);
      for (const o of others) {
        let v;
        try {
          v = evalOption(o);
        } catch {
          continue;
        }
        assert.ok(!close(v, truth, 2e-3), `${q.id}: el distractor ${o} también es correcto`);
      }
    }
  }
});

// Valor independiente de cada generador a partir de sus parámetros
const GEN_CHECK = {
  'gradiente-punto': (q) => {
    const [, a, b, x, y] = q.enunciado.match(/= (\d*)x\^2 y \+ (\d*)y\^3\$.*\((-?\d+), (-?\d+)\)/).map((v) => (v === '' ? 1 : Number(v)));
    return grad((px, py) => a * px * px * py + b * py ** 3, x, y);
  },
  'derivada-direccional': (q) => {
    const [, a, b, x, y, vx, vy] = q.enunciado.match(/= (\d*)x\^2 \+ (\d*)y\^2\$ en \$\((-?\d+), (-?\d+)\)\$.*\((-?\d+), (-?\d+)\)/).map((v) => (v === '' ? 1 : Number(v)));
    const [gx, gy] = grad((px, py) => a * px * px + b * py * py, x, y);
    return (gx * vx + gy * vy) / Math.hypot(vx, vy);
  },
  'lagrange-lineal': (q) => {
    const [, a, b, r2] = q.enunciado.match(/= (\d*)x \+ (\d*)y\$ sobre \$x\^2 \+ y\^2 = (\d+)/).map((v) => (v === '' ? 1 : Number(v)));
    return optimum({ f: `${a}*x+${b}*y`, curva: { tipo: 'circ', r: Math.sqrt(r2) }, modo: 'max' }).val;
  },
  'lagrange-recta': (q) => {
    const [, a, b, c] = q.enunciado.match(/\$(\d*)x \+ (\d*)y = (\d+)\$/).map((v) => (v === '' ? 1 : Number(v)));
    // Recta a x + b y = c: punto (0, c/b) y dirección (b, −a)
    return optimum({ f: 'x*x+y*y', curva: { tipo: 'recta', x0: 0, y0: c / b, dx: b, dy: -a }, modo: 'min' }).val;
  },
  'integral-doble-rect': (q) => {
    const [, p, qq, a, b] = q.enunciado.match(/\\int_0\^\{(\d+)\} \\int_0\^\{(\d+)\} \((\d*)x \+ (\d*)y\)/).map((v) => (v === '' ? 1 : Number(v)));
    return int2((x, y) => a * x + b * y, [0, p], ['0', String(qq)]);
  },
  'integral-tipo-i': (q) => {
    const [, a, m, c] = q.enunciado.match(/\\int_0\^\{(\d+)\} \\int_0\^\{(\d*)x\} (\d+)/).map((v) => (v === '' ? 1 : Number(v)));
    return int2(() => c, [0, a], ['0', `${m}*x`]);
  },
  'punto-critico': (q) => {
    const { a, h, c, k } = q.f;
    const f = (x, y) => a * x * x - 2 * a * h * x + c * y * y - 2 * c * k * y;
    return { prueba: (o) => Math.hypot(...grad(f, ...evalOption(o))) < 1e-4 };
  },
  clasificar: (q) => {
    const { a, b, c } = q.f;
    return { contiene: KIND((x, y) => a * x * x + b * x * y + c * y * y, [0, 0]) };
  },
};

function checkGenerated(g, q, n) {
  assert.equal(q.opciones.length, n, `${g.name}: ${q.opciones}`);
  assert.equal(new Set(q.opciones).size, n, `${g.name}: opciones repetidas ${q.opciones}`);
  for (const t of [q.enunciado, ...q.opciones, q.explicacion]) renders(t);
  const truth = GEN_CHECK[g.name]?.(q);
  const marked = q.opciones[q.correcta];
  if (truth?.contiene) assert.ok(marked.includes(truth.contiene), `${g.name}: ${marked}`);
  else if (truth?.prueba) {
    assert.ok(truth.prueba(marked), `${g.name}: ${marked}`);
    for (const o of q.opciones.filter((x) => x !== marked)) assert.ok(!truth.prueba(o), `${g.name}: distractor ${o}`);
  } else if (truth !== undefined) assert.ok(close(evalOption(marked), truth, 2e-3), `${g.name}: ${marked} ≠ ${truth}`);
  if (typeof q.valor !== 'string') assert.ok(close(evalOption(marked), q.valor, 1e-9), `${g.name}: ${marked} ≠ ${q.valor}`);
}

test('cada generador, con 50 semillas: opciones según dificultad, KaTeX válido y la correcta bien calculada', () => {
  for (const g of GENERATORS) {
    assert.ok(GEN_CHECK[g.name], `${g.name}: sin verificación independiente`);
    for (let s = 1; s <= 50; s++) {
      let seed = s * 7919;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      checkGenerated(g, g.generar(rand, optionCount(g.dificultad)), optionCount(g.dificultad));
    }
  }
});

test('preguntas rápidas (balas y reanimación): dificultad 1, 2 opciones, de los temas de la sala y bien calculadas', () => {
  const check = {
    'parcial-rapida': (q) => {
      const [, a, b, x, y] = q.enunciado.match(/f = (\d*)x\^2 y \+ (\d*)y\$ en \$\((\d+), (\d+)\)/).map((v) => (v === '' ? 1 : Number(v)));
      return grad((px, py) => a * px * px * py + b * py, x, y)[0];
    },
    'componente-gradiente': (q) => {
      const [, x, y, a, b] = q.enunciado.match(/\\nabla f\((\d+), (-?\d+)\)\$ para \$f = (\d*)x \+ (\d*)y\^2/).map((v) => (v === '' ? 1 : Number(v)));
      return grad((px, py) => a * px + b * py * py, x, y)[1];
    },
    'integral-constante': (q) => {
      const [, c, p, qq] = q.enunciado.match(/\\iint_R (\d+)\\,dA\$ con \$R = \[0, (\d+)\] \\times \[0, (\d+)\]/).map(Number);
      return int2(() => c, [0, p], ['0', String(qq)]);
    },
    'critico-rapido': (q) => q.valor,
  };
  for (const g of QUICK_GENERATORS) {
    for (let s = 1; s <= 50; s++) {
      let seed = s * 104729;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const q = g.generar(rand, 2);
      assert.equal(q.dificultad, 1);
      assert.ok(TOPICS[q.tema], q.tema);
      assert.equal(new Set(q.opciones).size, 2, `${g.name}: ${q.opciones}`);
      for (const t of [q.enunciado, ...q.opciones, q.explicacion]) renders(t);
      assert.ok(close(evalOption(q.opciones[q.correcta]), check[g.name](q), 2e-3), `${g.name}: ${q.opciones[q.correcta]}`);
    }
  }
  // Con un solo tema en la sala, la rápida es de ese tema
  for (let i = 0; i < 20; i++) assert.equal(drawQuickQuestion(Math.random, false, ['lagrange', 'integrales_dobles']).tema, 'integrales_dobles');
  assert.equal(drawQuickQuestion(Math.random, false, ['maximos_minimos']).opciones.length, 2);
});

test('drawQuestion respeta los temas, la dificultad y el número de opciones, y baraja por jugador', () => {
  for (const tema of Object.keys(TOPICS)) {
    for (const d of [1, 2, 3, 4]) {
      const q = drawQuestion({ topics: [tema], difficulty: d });
      assert.equal(q.tema, tema);
      assert.equal(q.dificultad, d);
      assert.equal(q.opciones.length, optionCount(d), `${tema} d${d}`);
    }
  }
  // Sin dificultad 5: usa la más cercana (4)
  assert.equal(drawQuestion({ topics: ['lagrange'], difficulty: 5 }).dificultad, 4);
  const positions = new Set();
  const base = BANK.find((x) => x.id === 'id-08');
  for (let i = 0; i < 40; i++) positions.add(shuffleOptions(base).correcta);
  assert.ok(positions.size > 1, 'la correcta cambia de lugar');
  const shuffled = shuffleOptions(base);
  assert.equal(shuffled.opciones[shuffled.correcta], base.opciones[base.correcta]);
});

test('no repite preguntas del banco al mismo jugador mientras haya otras', () => {
  const seen = new Set();
  const ids = [];
  for (let i = 0; i < 12; i++) {
    const q = drawQuestion({ topics: ['maximos_minimos'], difficulty: 4, seen });
    if (!q.id.startsWith('gen-')) ids.push(q.id);
  }
  assert.equal(new Set(ids).size, ids.length);
});
