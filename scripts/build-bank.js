// Genera server/src/questions/bank/*.json (los 4 temas del corte 3) desde esta lista.
// Cada pregunta trae `verifica`: el problema en forma que tests/questions.test.js recalcula por su
// cuenta (cuadraturas, gradientes numéricos, muestreo sobre la restricción). La correcta va primero
// y los distractores de más a menos plausibles (errores típicos). Uso: node scripts/build-bank.js
import fs from 'node:fs';

const r = String.raw;
const out = {};
const add = (tema, prefix) => {
  out[tema] = [];
  let n = 0;
  return (dificultad, enunciado, opciones, explicacion, verifica) => {
    n++;
    out[tema].push({ id: `${prefix}-${String(n).padStart(2, '0')}`, tema, dificultad, enunciado, opciones: opciones.map((o) => (o.startsWith('$') || /^[A-Za-záéíóúñ]{2,}/.test(o) ? o : `$${o}$`)), correcta: 0, explicacion, verifica });
  };
};

// --- Derivadas direccionales (incluye gradiente) ---
let q = add('derivadas_direccionales', 'dd');
q(1, r`Gradiente de $f(x,y) = x^2 + 3y$`, [r`(2x, 3)`, r`(2x, 3y)`, r`(x^2, 3)`], r`$f_x = 2x$, $f_y = 3$.`, { tipo: 'gradsym', f: 'x*x+3*y' });
q(1, r`$\frac{\partial f}{\partial x}$ de $f(x,y) = x^2 y$ en $(1, 3)$`, ['6', '1', '3'], r`$f_x = 2xy = 2(1)(3) = 6$.`, { tipo: 'parcial', f: 'x*x*y', p: [1, 3], var: 'x' });
q(1, r`$\nabla f(1, 2)$ para $f(x,y) = xy$`, ['(2, 1)', '(1, 2)', '(2, 2)'], r`$\nabla f = (y, x) = (2, 1)$.`, { tipo: 'grad', f: 'x*y', p: [1, 2] });
q(1, r`$\frac{\partial f}{\partial y}$ de $f(x,y) = 3x + y^2$ en $(2, 1)$`, ['2', '3', '5'], r`$f_y = 2y = 2$.`, { tipo: 'parcial', f: '3*x+y*y', p: [2, 1], var: 'y' });
q(1, r`En $D_{\mathbf u} f = \nabla f \cdot \mathbf u$, el vector $\mathbf u$ debe ser`, ['unitario', 'cualquier vector', r`perpendicular a $\nabla f$`], r`La derivada direccional usa un vector unitario: si no lo es, hay que dividir entre su norma.`, { tipo: 'concepto', contiene: 'unitario' });
q(1, r`La dirección de máximo crecimiento de $f$ en un punto es la de`, [r`la misma de $\nabla f$`, r`la de $-\nabla f$`, r`una perpendicular a $\nabla f$`], r`$D_{\mathbf u} f = |\nabla f|\cos\theta$ es máxima con $\theta = 0$: en la dirección de $\nabla f$.`, { tipo: 'concepto', contiene: 'la misma de' });
q(1, r`$\nabla f(0, 0)$ para $f(x,y) = 5x - 2y + 7$`, ['(5, -2)', '(5, 2)', '(-2, 5)'], r`$\nabla f = (5, -2)$ en todo punto.`, { tipo: 'grad', f: '5*x-2*y+7', p: [0, 0] });
q(2, r`$D_{\mathbf u} f$ de $f(x,y) = x^2 + y^2$ en $(1, 2)$ con $\mathbf u = (1, 0)$`, ['2', '4', '6'], r`$\nabla f(1,2) = (2, 4)$; $\nabla f \cdot (1,0) = 2$.`, { tipo: 'dir', f: 'x*x+y*y', p: [1, 2], v: [1, 0] });
q(2, r`$D_{\mathbf u} f$ de $f(x,y) = xy$ en $(2, 3)$ con $\mathbf u = (0, 1)$`, ['2', '3', '5'], r`$\nabla f = (y, x) = (3, 2)$; $D_{\mathbf u} f = 2$.`, { tipo: 'dir', f: 'x*y', p: [2, 3], v: [0, 1] });
q(2, r`$D_{\mathbf u} f$ de $f(x,y) = x^2 y$ en $(1, 1)$ con $\mathbf u = \left(\frac{3}{5}, \frac{4}{5}\right)$`, ['2', '3', r`\frac{6}{5}`], r`$\nabla f = (2xy, x^2) = (2, 1)$; $\frac{6}{5} + \frac{4}{5} = 2$.`, { tipo: 'dir', f: 'x*x*y', p: [1, 1], v: [3, 4] });
q(2, r`Valor máximo de $D_{\mathbf u} f$ para $f(x,y) = 3x + 4y$`, ['5', '7', '25'], r`Es $|\nabla f| = |(3, 4)| = 5$.`, { tipo: 'maxdir', f: '3*x+4*y', p: [0, 0] });
q(2, r`Máxima tasa de cambio de $f(x,y) = x^2 + y^2$ en $(3, 4)$`, ['10', '14', '100'], r`$\nabla f = (6, 8)$, $|\nabla f| = 10$.`, { tipo: 'maxdir', f: 'x*x+y*y', p: [3, 4] });
q(2, r`$\nabla f(3, 0)$ para $f(x,y) = x e^{y}$`, ['(1, 3)', '(3, 1)', '(1, 0)'], r`$\nabla f = (e^y, x e^y) = (1, 3)$.`, { tipo: 'grad', f: 'x*Math.exp(y)', p: [3, 0] });
q(2, r`$D_{\mathbf u} f$ de $f(x,y) = x^2 + y^2$ en $(1, 1)$ en la dirección de $-\nabla f$`, [r`-2\sqrt{2}`, r`2\sqrt{2}`, '0'], r`Hacia $-\nabla f$ la derivada vale $-|\nabla f| = -|(2,2)| = -2\sqrt{2}$.`, { tipo: 'dir', f: 'x*x+y*y', p: [1, 1], v: [-2, -2] });
q(3, r`Derivada direccional de $f(x,y) = x^2 + y^2$ en $(1, 2)$ en la dirección de $\mathbf v = (3, 4)$`, [r`\frac{22}{5}`, '22', r`\frac{22}{25}`], r`$\mathbf v$ no es unitario: $\mathbf u = \frac{1}{5}(3,4)$. $\nabla f = (2,4)$, $D_{\mathbf u} f = \frac{6 + 16}{5} = \frac{22}{5}$.`, { tipo: 'dir', f: 'x*x+y*y', p: [1, 2], v: [3, 4] });
q(3, r`Derivada direccional de $f(x,y) = xy$ en $(1, 2)$ en la dirección de $\mathbf v = (1, 1)$`, [r`\frac{3}{\sqrt{2}}`, '3', r`\frac{3}{2}`], r`$\nabla f = (2, 1)$, $|\mathbf v| = \sqrt 2$: $D_{\mathbf u} f = \frac{3}{\sqrt 2}$.`, { tipo: 'dir', f: 'x*y', p: [1, 2], v: [1, 1] });
q(3, r`Derivada direccional de $f(x,y) = x^2 - y^2$ en $(2, 1)$ en la dirección de $\mathbf v = (1, -1)$`, [r`3\sqrt{2}`, '6', r`\sqrt{2}`], r`$\nabla f = (4, -2)$; $\frac{4 + 2}{\sqrt 2} = 3\sqrt 2$.`, { tipo: 'dir', f: 'x*x-y*y', p: [2, 1], v: [1, -1] });
q(3, r`Dirección unitaria de máximo crecimiento de $f(x,y) = x^2 + 2y$ en $(1, 1)$`, [r`\left(\frac{1}{\sqrt{2}}, \frac{1}{\sqrt{2}}\right)`, '(2, 2)', r`\left(-\frac{1}{\sqrt{2}}, -\frac{1}{\sqrt{2}}\right)`], r`$\nabla f = (2, 2)$; dividido entre $|\nabla f| = 2\sqrt2$.`, { tipo: 'unitgrad', f: 'x*x+2*y', p: [1, 1] });
q(3, r`Máxima tasa de cambio de $f(x,y) = x^3 y$ en $(1, 2)$`, [r`\sqrt{37}`, '7', '37'], r`$\nabla f = (3x^2 y, x^3) = (6, 1)$; $|\nabla f| = \sqrt{37}$.`, { tipo: 'maxdir', f: 'x**3*y', p: [1, 2] });
q(3, r`Derivada direccional de $f(x,y) = x^2 + xy$ en $(1, 0)$ en la dirección de $\mathbf v = (4, 3)$`, [r`\frac{11}{5}`, '11', '2'], r`$\nabla f = (2x + y, x) = (2, 1)$; $\frac{8 + 3}{5} = \frac{11}{5}$.`, { tipo: 'dir', f: 'x*x+x*y', p: [1, 0], v: [4, 3] });
q(4, r`Derivada direccional de $f(x,y) = x^2 y + y^3$ en $(1, 1)$ en la dirección de $\mathbf v = (1, 2)$`, [r`2\sqrt{5}`, '10', '2'], r`$\nabla f = (2xy, x^2 + 3y^2) = (2, 4)$; $\frac{2 + 8}{\sqrt 5} = 2\sqrt 5$.`, { tipo: 'dir', f: 'x*x*y+y**3', p: [1, 1], v: [1, 2] });
q(4, r`Una dirección unitaria en la que $f(x,y) = x^2 + y^2$ no cambia en $(3, 4)$`, [r`\left(\frac{4}{5}, -\frac{3}{5}\right)`, r`\left(\frac{3}{5}, \frac{4}{5}\right)`, r`\left(-\frac{3}{5}, -\frac{4}{5}\right)`], r`Debe ser perpendicular a $\nabla f = (6, 8)$: $(4, -3)/5$.`, { tipo: 'zerodir', f: 'x*x+y*y', p: [3, 4] });
q(4, r`Derivada direccional de $f(x,y) = e^{xy}$ en $(0, 1)$ en la dirección de $\mathbf v = (3, 4)$`, [r`\frac{3}{5}`, '3', '1'], r`$\nabla f = (y e^{xy}, x e^{xy}) = (1, 0)$; $\frac{3}{5}$.`, { tipo: 'dir', f: 'Math.exp(x*y)', p: [0, 1], v: [3, 4] });
q(4, r`Derivada direccional de $f(x,y) = x^2 y - 2y$ en $(2, 1)$ hacia el punto $(5, 5)$`, ['4', '20', r`\frac{4}{5}`], r`$\mathbf v = (3, 4)$, $|\mathbf v| = 5$; $\nabla f = (2xy, x^2 - 2) = (4, 2)$; $\frac{12 + 8}{5} = 4$.`, { tipo: 'dir', f: 'x*x*y-2*y', p: [2, 1], v: [3, 4] });
q(4, r`Máxima tasa de cambio de $f(x,y) = x^2 + 4xy + y^2$ en $(1, 1)$`, [r`6\sqrt{2}`, '12', '72'], r`$\nabla f = (2x + 4y, 4x + 2y) = (6, 6)$; $|\nabla f| = 6\sqrt 2$.`, { tipo: 'maxdir', f: 'x*x+4*x*y+y*y', p: [1, 1] });

// --- Multiplicadores de Lagrange ---
q = add('lagrange', 'lg');
const circ = (rad) => ({ tipo: 'circ', r: rad });
const elip = (a, b) => ({ tipo: 'elip', a, b });
const recta = (x0, y0, dx, dy) => ({ tipo: 'recta', x0, y0, dx, dy });
q(1, r`En el método de Lagrange para optimizar $f$ sujeta a $g = k$ se resuelve`, [r`$\nabla f = \lambda \nabla g$`, r`$\nabla f = \lambda g$`, r`$\nabla f \cdot \nabla g = 0$`], r`En el óptimo los gradientes son paralelos: $\nabla f = \lambda \nabla g$, junto con $g = k$.`, { tipo: 'concepto', contiene: r`\nabla f = \lambda \nabla g` });
q(1, r`Sistema de Lagrange para $f = x + y$ con $x^2 + y^2 = 1$`, [r`$1 = 2\lambda x,\ 1 = 2\lambda y,\ x^2 + y^2 = 1$`, r`$1 = \lambda x,\ 1 = \lambda y,\ x^2 + y^2 = 1$`, r`$x + y = 2\lambda,\ x^2 + y^2 = 1$`], r`$\nabla f = (1, 1)$ y $\nabla g = (2x, 2y)$.`, { tipo: 'concepto', contiene: r`1 = 2\lambda x` });
q(1, r`Ecuaciones del sistema de Lagrange con 2 variables y 1 restricción`, ['3', '2', '4'], r`Dos de $\nabla f = \lambda \nabla g$ y la restricción.`, { tipo: 'valor', valor: 3 });
q(1, r`Máximo de $f(x,y) = x$ sobre $x^2 + y^2 = 4$`, ['2', '4', '1'], r`$1 = 2\lambda x$, $0 = 2\lambda y$: $y = 0$, $x = \pm 2$. El máximo es $2$.`, { tipo: 'lag', f: 'x', curva: circ(2), modo: 'max' });
q(1, r`Mínimo de $f(x,y) = y$ sobre $x^2 + y^2 = 9$`, ['-3', '0', '-9'], r`Con $x = 0$, $y = \pm 3$: el mínimo es $-3$.`, { tipo: 'lag', f: 'y', curva: circ(3), modo: 'min' });
q(1, r`Máximo de $f(x,y) = xy$ sujeto a $x + y = 10$`, ['25', '50', '20'], r`$(y, x) = \lambda(1, 1)$ da $x = y = 5$; $f = 25$.`, { tipo: 'lag', f: 'x*y', curva: recta(0, 10, 1, -1), modo: 'max' });
q(1, r`El multiplicador $\lambda$ indica`, [r`cuánto cambia el óptimo de $f$ si cambia $k$ en $g = k$`, r`el valor máximo de $f$`, r`la pendiente de la restricción`], r`$\lambda$ es la sensibilidad del valor óptimo respecto de $k$.`, { tipo: 'concepto', contiene: 'cambia el óptimo' });
q(2, r`Máximo de $f(x,y) = 3x + 4y$ sobre $x^2 + y^2 = 1$`, ['5', '7', '1'], r`$(3, 4) = 2\lambda(x, y)$: el punto es $(3, 4)/5$ y $f = 5$.`, { tipo: 'lag', f: '3*x+4*y', curva: circ(1), modo: 'max' });
q(2, r`Mínimo de $f(x,y) = x^2 + y^2$ sobre $x + y = 2$`, ['2', '4', '1'], r`$2x = \lambda = 2y$: $(1, 1)$ y $f = 2$.`, { tipo: 'lag', f: 'x*x+y*y', curva: recta(0, 2, 1, -1), modo: 'min' });
q(2, r`Punto donde $f(x,y) = x^2 + y^2$ es mínima sobre $x + 2y = 5$`, ['(1, 2)', '(2, 1)', '(5, 0)'], r`$(2x, 2y) = \lambda(1, 2)$: $y = 2x$, $5x = 5$, punto $(1, 2)$.`, { tipo: 'lagpunto', f: 'x*x+y*y', curva: recta(5, 0, -2, 1), modo: 'min' });
q(2, r`Máximo de $f(x,y) = xy$ sobre $x^2 + y^2 = 8$`, ['4', '8', '2'], r`$y = 2\lambda x$, $x = 2\lambda y$: $x = \pm y$, $x^2 = 4$; el máximo es $4$.`, { tipo: 'lag', f: 'x*y', curva: circ(Math.sqrt(8)), modo: 'max' });
q(2, r`Máximo de $f(x,y) = x + y$ sobre $x^2 + y^2 = 2$`, ['2', r`2\sqrt{2}`, r`\sqrt{2}`], r`$x = y = 1$: $f = 2$.`, { tipo: 'lag', f: 'x+y', curva: circ(Math.SQRT2), modo: 'max' });
q(2, r`Mínimo de $f(x,y) = x - y$ sobre $x^2 + y^2 = 2$`, ['-2', r`-\sqrt{2}`, '0'], r`$(1, -1) = 2\lambda(x, y)$: el mínimo está en $(-1, 1)$ y vale $-2$.`, { tipo: 'lag', f: 'x-y', curva: circ(Math.SQRT2), modo: 'min' });
q(2, r`Mínimo de $f(x,y) = 2x + y$ sobre $x^2 + y^2 = 5$`, ['-5', r`-\sqrt{5}`, '-3'], r`El punto es $-(2, 1)$: $f = -5$.`, { tipo: 'lag', f: '2*x+y', curva: circ(Math.sqrt(5)), modo: 'min' });
q(3, r`Máximo de $f(x,y) = x^2 + y^2$ sobre la elipse $\frac{x^2}{4} + y^2 = 1$`, ['4', '2', '5'], r`En $(\pm 2, 0)$: $f = 4$ (los extremos están en los ejes de la elipse).`, { tipo: 'lag', f: 'x*x+y*y', curva: elip(2, 1), modo: 'max' });
q(3, r`Mínimo de $f(x,y) = x^2 + y^2$ sobre la elipse $\frac{x^2}{9} + \frac{y^2}{4} = 1$`, ['4', '9', '2'], r`En $(0, \pm 2)$: $f = 4$.`, { tipo: 'lag', f: 'x*x+y*y', curva: elip(3, 2), modo: 'min' });
q(3, r`Valor de $\lambda$ en el máximo de $f = x + y$ con $g = x^2 + y^2 = 2$`, [r`\frac{1}{2}`, '2', '1'], r`En $(1, 1)$: $(1, 1) = \lambda(2, 2)$, $\lambda = \frac12$.`, { tipo: 'lambda', f: 'x+y', g: 'x*x+y*y', curva: circ(Math.SQRT2), modo: 'max' });
q(3, r`Máximo de $f(x,y) = xy$ sobre $\frac{x^2}{8} + \frac{y^2}{2} = 1$`, ['2', '4', '1'], r`$x = 2\sqrt2\cos t$, $y = \sqrt2 \sin t$: $f = 2\sin 2t$, máximo $2$.`, { tipo: 'lag', f: 'x*y', curva: elip(Math.sqrt(8), Math.SQRT2), modo: 'max' });
q(3, r`Mínimo de $f(x,y) = x^2 + 2y^2$ sobre $x + y = 3$`, ['6', r`\frac{9}{2}`, '9'], r`$2x = \lambda$, $4y = \lambda$: $x = 2y$, $y = 1$, $x = 2$; $f = 6$.`, { tipo: 'lag', f: 'x*x+2*y*y', curva: recta(0, 3, 1, -1), modo: 'min' });
q(3, r`Distancia mínima del origen a la recta $x + y = 4$`, [r`2\sqrt{2}`, '4', '8'], r`Se minimiza $x^2 + y^2$: punto $(2, 2)$, distancia $2\sqrt 2$.`, { tipo: 'lag', f: 'Math.hypot(x,y)', curva: recta(0, 4, 1, -1), modo: 'min' });
q(4, r`Máximo de $f(x,y) = x^2 y$ sobre $x^2 + y^2 = 3$`, ['2', '3', r`\sqrt{3}`], r`$x^2 = 3 - y^2$: $f = (3 - y^2) y$, máximo en $y = 1$: $f = 2$.`, { tipo: 'lag', f: 'x*x*y', curva: circ(Math.sqrt(3)), modo: 'max' });
q(4, r`Máximo de $f = xyz$ con $x, y, z > 0$ y $x + y + z = 6$`, ['8', '6', '12'], r`Por simetría $x = y = z = 2$: $f = 8$.`, { tipo: 'max2d', f: 'x*y*(6-x-y)', dom: [0, 6], cond: 'x+y<6' });
q(4, r`Valor de $\lambda$ en el mínimo de $f = x^2 + y^2$ con $g = x + y = 2$`, ['2', '1', r`\frac{1}{2}`], r`En $(1, 1)$: $(2, 2) = \lambda(1, 1)$, $\lambda = 2$.`, { tipo: 'lambda', f: 'x*x+y*y', g: 'x+y', curva: recta(0, 2, 1, -1), modo: 'min' });
q(4, r`Máximo de $f(x,y) = 2x + 3y$ sobre $\frac{x^2}{4} + \frac{y^2}{9} = 1$`, [r`\sqrt{97}`, '13', r`\sqrt{13}`], r`$x = 2\cos t$, $y = 3\sin t$: $4\cos t + 9\sin t$, máximo $\sqrt{16 + 81} = \sqrt{97}$.`, { tipo: 'lag', f: '2*x+3*y', curva: elip(2, 3), modo: 'max' });
q(4, r`Punto de $2x + y = 5$ más cercano al origen`, ['(2, 1)', '(1, 2)', r`\left(\frac{5}{2}, 0\right)`], r`$(2x, 2y) = \lambda(2, 1)$: $x = 2y$, $5y = 5$: $(2, 1)$.`, { tipo: 'lagpunto', f: 'x*x+y*y', curva: recta(0, 5, 1, -2), modo: 'min' });

// --- Integrales dobles (incluye cambio de orden, área y polares) ---
q = add('integrales_dobles', 'id');
const I = (f, x, y, extra = {}) => ({ tipo: 'int2', f, x, y, ...extra }); // dy dx
const IY = (f, y, x, extra = {}) => ({ tipo: 'int2y', f, y, x, ...extra }); // dx dy
const P = (f, t, rr) => ({ tipo: 'polar', f, t, r: rr });
const DISK = ['-Math.sqrt(Math.max(0,1-x*x))', 'Math.sqrt(Math.max(0,1-x*x))'];
q(1, r`$\displaystyle\int_0^2\!\int_0^3 1\,dy\,dx$`, ['6', '5', '3'], r`Es el área del rectángulo $2 \times 3 = 6$.`, I('1', [0, 2], ['0', '3']));
q(1, r`$\displaystyle\int_0^1\!\int_0^2 xy\,dy\,dx$`, ['1', '2', r`\frac{1}{2}`], r`$\int_0^2 y\,dy = 2$ y $\int_0^1 2x\,dx = 1$.`, I('x*y', [0, 1], ['0', '2']));
q(1, r`$\displaystyle\int_0^1\!\int_0^1 (x + y)\,dy\,dx$`, ['1', '2', r`\frac{1}{2}`], r`$\int_0^1 (x + \frac12)\,dx = 1$.`, I('x+y', [0, 1], ['0', '1']));
q(1, r`$\displaystyle\iint_R 5\,dA$ con $R = [0, 2] \times [0, 4]$`, ['40', '8', '20'], r`$5 \cdot \text{área} = 5 \cdot 8 = 40$.`, I('5', [0, 2], ['0', '4']));
q(1, r`Área de la región $0 \le x \le 3$, $0 \le y \le x$`, [r`\frac{9}{2}`, '9', '3'], r`$\int_0^3 x\,dx = \frac92$ (un triángulo).`, I('1', [0, 3], ['0', 'x']));
q(1, r`En coordenadas polares, $dA$ es`, [r`$r\,dr\,d\theta$`, r`$dr\,d\theta$`, r`$r^2\,dr\,d\theta$`], r`El jacobiano de $(r, \theta) \to (x, y)$ es $r$.`, { tipo: 'concepto', contiene: r`$r\,dr` });
q(1, r`$\displaystyle\int_0^1\!\int_0^2 2x\,dy\,dx$`, ['2', '4', '1'], r`$\int_0^2 2x\,dy = 4x$; $\int_0^1 4x\,dx = 2$.`, I('2*x', [0, 1], ['0', '2']));
q(2, r`$\displaystyle\int_0^2\!\int_1^3 x^2 y\,dy\,dx$`, [r`\frac{32}{3}`, r`\frac{16}{3}`, '8'], r`$\int_1^3 y\,dy = 4$; $\int_0^2 4x^2\,dx = \frac{32}{3}$.`, I('x*x*y', [0, 2], ['1', '3']));
q(2, r`$\displaystyle\int_0^1\!\int_0^x x\,dy\,dx$`, [r`\frac{1}{3}`, r`\frac{1}{2}`, '1'], r`$\int_0^x x\,dy = x^2$; $\int_0^1 x^2\,dx = \frac13$.`, I('x', [0, 1], ['0', 'x']));
q(2, r`$\displaystyle\int_0^{\pi}\!\int_0^1 y \sin x\,dy\,dx$`, ['1', '2', r`\frac{1}{2}`], r`$\int_0^1 y\,dy = \frac12$, $\int_0^\pi \sin x\,dx = 2$.`, I('y*Math.sin(x)', [0, Math.PI], ['0', '1']));
q(2, r`Área del disco $x^2 + y^2 \le 4$ con polares`, [r`4\pi`, r`2\pi`, r`8\pi`], r`$\int_0^{2\pi}\!\int_0^2 r\,dr\,d\theta = 2\pi \cdot 2 = 4\pi$.`, P('1', [0, 2 * Math.PI], ['0', '2']));
q(2, r`$\displaystyle\int_0^1\!\int_0^2 (x + 2y)\,dy\,dx$`, ['5', '3', '6'], r`$\int_0^2 (x + 2y)\,dy = 2x + 4$; $\int_0^1 (2x + 4)\,dx = 5$.`, I('x+2*y', [0, 1], ['0', '2']));
q(2, r`$\displaystyle\int_0^1\!\int_y^1 1\,dx\,dy$ (región tipo II)`, [r`\frac{1}{2}`, '1', r`\frac{1}{3}`], r`$\int_0^1 (1 - y)\,dy = \frac12$.`, IY('1', [0, 1], ['y', '1']));
q(2, r`Área entre $y = x^2$ y $y = x$ para $0 \le x \le 1$`, [r`\frac{1}{6}`, r`\frac{1}{3}`, r`\frac{1}{2}`], r`$\int_0^1 (x - x^2)\,dx = \frac12 - \frac13 = \frac16$.`, I('1', [0, 1], ['x*x', 'x']));
q(3, r`Al cambiar el orden, $\displaystyle\int_0^1\!\int_x^1 f\,dy\,dx$ es`, [r`$\int_0^1\!\int_0^y f\,dx\,dy$`, r`$\int_0^1\!\int_y^1 f\,dx\,dy$`, r`$\int_0^1\!\int_0^1 f\,dx\,dy$`], r`La región es $0 \le x \le y \le 1$: para cada $y$, $x$ va de $0$ a $y$.`, { tipo: 'orden', contiene: r`\int_0^y`, f: 'x*x+3*y+1', original: I('', [0, 1], ['x', '1']), cambiada: IY('', [0, 1], ['0', 'y']) });
q(3, r`$\displaystyle\int_0^1\!\int_y^1 e^{x^2}\,dx\,dy$ (cambia el orden)`, [r`\frac{e-1}{2}`, 'e-1', r`\frac{e}{2}`], r`$= \int_0^1\!\int_0^x e^{x^2}\,dy\,dx = \int_0^1 x e^{x^2}\,dx = \frac{e - 1}{2}$.`, IY('Math.exp(x*x)', [0, 1], ['y', '1']));
q(3, r`$\displaystyle\iint_D (x^2 + y^2)\,dA$ con $D$ el disco unitario`, [r`\frac{\pi}{2}`, r`\pi`, r`2\pi`], r`$\int_0^{2\pi}\!\int_0^1 r^2 \cdot r\,dr\,d\theta = 2\pi \cdot \frac14 = \frac{\pi}{2}$.`, I('x*x+y*y', [-1, 1], DISK, { n: 1000 }));
q(3, r`$\displaystyle\int_0^2\!\int_0^x xy\,dy\,dx$`, ['2', '4', '1'], r`$\int_0^x xy\,dy = \frac{x^3}{2}$; $\int_0^2 \frac{x^3}{2}\,dx = 2$.`, I('x*y', [0, 2], ['0', 'x']));
q(3, r`Área de la región $0 \le y \le 2$, $y^2 \le x \le 4$`, [r`\frac{16}{3}`, '8', r`\frac{8}{3}`], r`$\int_0^2 (4 - y^2)\,dy = 8 - \frac83 = \frac{16}{3}$.`, IY('1', [0, 2], ['y*y', '4']));
q(3, r`Al cambiar el orden, $\displaystyle\int_0^4\!\int_{\sqrt y}^2 f\,dx\,dy$ es`, [r`$\int_0^2\!\int_0^{x^2} f\,dy\,dx$`, r`$\int_0^2\!\int_{x^2}^4 f\,dy\,dx$`, r`$\int_0^4\!\int_0^{x^2} f\,dy\,dx$`], r`La región es $\sqrt y \le x \le 2$: para cada $x \in [0, 2]$, $y$ va de $0$ a $x^2$.`, { tipo: 'orden', contiene: r`\int_0^2\!\int_0^{x^2}`, f: 'x+y*y', original: IY('', [0, 4], ['Math.sqrt(y)', '2']), cambiada: I('', [0, 2], ['0', 'x*x']) });
q(4, r`$\displaystyle\iint_D e^{-(x^2 + y^2)}\,dA$ con $D$ el disco unitario`, [r`\pi(1 - e^{-1})`, r`\pi`, r`1 - e^{-1}`], r`$\int_0^{2\pi}\!\int_0^1 e^{-r^2} r\,dr\,d\theta = 2\pi \cdot \frac{1 - e^{-1}}{2}$.`, I('Math.exp(-(x*x+y*y))', [-1, 1], DISK, { n: 1000 }));
q(4, r`$\displaystyle\int_0^1\!\int_0^{\sqrt{1 - x^2}} (x^2 + y^2)\,dy\,dx$`, [r`\frac{\pi}{8}`, r`\frac{\pi}{4}`, r`\frac{\pi}{2}`], r`Un cuarto de disco: $\int_0^{\pi/2}\!\int_0^1 r^3\,dr\,d\theta = \frac{\pi}{8}$.`, I('x*x+y*y', [0, 1], ['0', 'Math.sqrt(Math.max(0,1-x*x))'], { n: 1000 }));
q(4, r`$\displaystyle\int_0^1\!\int_{\sqrt y}^1 \sqrt{x^3 + 1}\,dx\,dy$ (cambia el orden)`, [r`\frac{2}{9}(2\sqrt{2} - 1)`, r`\frac{2}{3}(2\sqrt{2} - 1)`, r`2\sqrt{2} - 1`], r`$= \int_0^1 x^2\sqrt{x^3 + 1}\,dx = \frac{2}{9}(x^3 + 1)^{3/2}\Big|_0^1$.`, IY('Math.sqrt(x**3+1)', [0, 1], ['Math.sqrt(y)', '1'], { n: 2000 }));
q(4, r`Volumen bajo $z = 4 - x^2 - y^2$ sobre el disco $x^2 + y^2 \le 4$`, [r`8\pi`, r`16\pi`, r`4\pi`], r`$\int_0^{2\pi}\!\int_0^2 (4 - r^2) r\,dr\,d\theta = 2\pi(8 - 4) = 8\pi$.`, P('4-x*x-y*y', [0, 2 * Math.PI], ['0', '2']));
q(4, r`$\displaystyle\int_0^1\!\int_0^{1-x} (x + y)\,dy\,dx$`, [r`\frac{1}{3}`, r`\frac{1}{2}`, r`\frac{1}{6}`], r`$\int_0^1 \left[x(1 - x) + \frac{(1 - x)^2}{2}\right] dx = \frac12 - \frac16 = \frac13$.`, I('x+y', [0, 1], ['0', '1-x']));

// --- Máximos y mínimos ---
q = add('maximos_minimos', 'mm');
const C = (f, extra = {}) => ({ tipo: 'critico', f, ...extra });
const K = (f, p) => ({ tipo: 'clasif', f, p });
const KINDS = ['Mínimo local', 'Máximo local', 'Punto de silla'];
const rot = (first) => [first, ...KINDS.filter((k) => k !== first)];
q(1, r`Punto crítico de $f(x,y) = x^2 + y^2$`, ['(0, 0)', '(1, 1)', '(1, 0)'], r`$\nabla f = (2x, 2y) = \mathbf 0$ en $(0, 0)$.`, C('x*x+y*y'));
q(1, r`Punto crítico de $f(x,y) = (x - 1)^2 + (y + 2)^2$`, ['(1, -2)', '(-1, 2)', '(1, 2)'], r`$2(x - 1) = 0$, $2(y + 2) = 0$.`, C('(x-1)**2+(y+2)**2'));
q(1, r`$f(x,y) = x^2 + y^2$ en $(0, 0)$ tiene un`, rot('Mínimo local'), r`$D = 4 > 0$ y $f_{xx} = 2 > 0$.`, K('x*x+y*y', [0, 0]));
q(1, r`$f(x,y) = 3 - x^2 - y^2$ en $(0, 0)$ tiene un`, rot('Máximo local'), r`$D = 4 > 0$ y $f_{xx} = -2 < 0$.`, K('3-x*x-y*y', [0, 0]));
q(1, r`$f(x,y) = x^2 - y^2$ en $(0, 0)$ tiene un`, rot('Punto de silla'), r`$D = (2)(-2) - 0 = -4 < 0$.`, K('x*x-y*y', [0, 0]));
q(1, r`Un punto crítico de $f$ es donde`, [r`$\nabla f = \mathbf 0$ (o no existe)`, r`$f = 0$`, r`$f_{xx} = 0$`], r`Se anulan (o no existen) las derivadas parciales.`, { tipo: 'concepto', contiene: r`\nabla f = \mathbf 0` });
q(1, r`El discriminante del criterio de la segunda derivada es $D =$`, [r`$f_{xx} f_{yy} - f_{xy}^2$`, r`$f_{xx} f_{yy} + f_{xy}^2$`, r`$f_{xx} + f_{yy}$`], r`$D = f_{xx} f_{yy} - f_{xy}^2$ evaluado en el punto crítico.`, { tipo: 'concepto', contiene: r`f_{xx} f_{yy} - f_{xy}^2` });
q(2, r`Punto crítico de $f(x,y) = x^2 + 4x + y^2 - 6y$`, ['(-2, 3)', '(2, -3)', '(4, -6)'], r`$2x + 4 = 0$, $2y - 6 = 0$.`, C('x*x+4*x+y*y-6*y'));
q(2, r`$D$ en $(0, 0)$ para $f(x,y) = x^2 + 3xy + y^2$`, ['-5', '13', '4'], r`$f_{xx} = 2$, $f_{yy} = 2$, $f_{xy} = 3$: $D = 4 - 9 = -5$.`, { tipo: 'D', f: 'x*x+3*x*y+y*y', p: [0, 0] });
q(2, r`$f(x,y) = x^2 + xy + y^2$ en $(0, 0)$ tiene un`, rot('Mínimo local'), r`$D = 4 - 1 = 3 > 0$, $f_{xx} = 2 > 0$.`, K('x*x+x*y+y*y', [0, 0]));
q(2, r`Si en un punto crítico $D > 0$ y $f_{xx} < 0$, hay un`, rot('Máximo local'), r`$D > 0$ con $f_{xx} < 0$: máximo local.`, { tipo: 'concepto', contiene: 'Máximo' });
q(2, r`Si en un punto crítico $D < 0$, hay un`, rot('Punto de silla'), r`$D < 0$: punto de silla.`, { tipo: 'concepto', contiene: 'silla' });
q(2, r`Valor mínimo de $f(x,y) = x^2 + y^2 - 2x + 5$`, ['4', '5', '6'], r`El punto crítico es $(1, 0)$ y $f(1, 0) = 4$.`, { tipo: 'valcrit', f: 'x*x+y*y-2*x+5', p: [1, 0] });
q(2, r`Punto crítico de $f(x,y) = 3x^2 - 6x + 2y^2 + 8y$`, ['(1, -2)', '(-1, 2)', '(2, -1)'], r`$6x - 6 = 0$, $4y + 8 = 0$.`, C('3*x*x-6*x+2*y*y+8*y'));
q(3, r`$f(x,y) = x^3 - 3x + y^2$ en $(1, 0)$ tiene un`, rot('Mínimo local'), r`$f_{xx} = 6x = 6$, $f_{yy} = 2$, $D = 12 > 0$.`, K('x**3-3*x+y*y', [1, 0]));
q(3, r`$f(x,y) = x^3 - 3x + y^2$ en $(-1, 0)$ tiene un`, rot('Punto de silla'), r`$f_{xx} = -6$, $f_{yy} = 2$, $D = -12 < 0$.`, K('x**3-3*x+y*y', [-1, 0]));
q(3, r`Valor de $f(x,y) = 4 + x^3 + y^3 - 3xy$ en su mínimo local $(1, 1)$`, ['3', '4', '5'], r`$f(1, 1) = 4 + 1 + 1 - 3 = 3$.`, { tipo: 'valcrit', f: '4+x**3+y**3-3*x*y', p: [1, 1] });
q(3, r`$D$ en $(1, 1)$ para $f(x,y) = x^3 + y^3 - 3xy$`, ['27', '45', '9'], r`$f_{xx} = 6$, $f_{yy} = 6$, $f_{xy} = -3$: $D = 36 - 9 = 27$.`, { tipo: 'D', f: 'x**3+y**3-3*x*y', p: [1, 1] });
q(3, r`Punto crítico de $f(x,y) = 2x^2 + y^2 - xy - 7y$`, ['(1, 4)', '(4, 1)', '(0, 7)'], r`$4x - y = 0$ y $2y - x - 7 = 0$: $y = 4x$, $7x = 7$.`, C('2*x*x+y*y-x*y-7*y'));
q(3, r`$f(x,y) = xy$ en $(0, 0)$ tiene un`, rot('Punto de silla'), r`$f_{xx} = f_{yy} = 0$, $f_{xy} = 1$: $D = -1 < 0$.`, K('x*y', [0, 0]));
q(4, r`Valor de $f(x,y) = x^4 + y^4 - 4xy$ en su mínimo local $(1, 1)$`, ['-2', '0', '2'], r`$D = 144 - 16 > 0$, $f_{xx} = 12 > 0$; $f(1, 1) = 1 + 1 - 4 = -2$.`, { tipo: 'valcrit', f: 'x**4+y**4-4*x*y', p: [1, 1] });
q(4, r`Valor mínimo local de $f(x,y) = x^3 - 12x + y^2 - 2y$`, ['-17', '15', '-16'], r`Críticos en $(\pm 2, 1)$; el mínimo es $(2, 1)$: $8 - 24 + 1 - 2 = -17$.`, { tipo: 'valcrit', f: 'x**3-12*x+y*y-2*y', p: [2, 1] });
q(4, r`$f(x,y) = x^3 - 12x + y^2 - 2y$ en $(-2, 1)$ tiene un`, rot('Punto de silla'), r`$f_{xx} = 6x = -12$, $f_{yy} = 2$: $D = -24 < 0$.`, K('x**3-12*x+y*y-2*y', [-2, 1]));
q(4, r`Valor mínimo de $f(x,y) = x^2 + y^2 + xy - 3x$`, ['-3', '3', r`-\frac{9}{4}`], r`$2x + y = 3$, $2y + x = 0$: $(2, -1)$ y $f = 4 + 1 - 2 - 6 = -3$.`, { tipo: 'valcrit', f: 'x*x+y*y+x*y-3*x', p: [2, -1] });
q(4, r`$f(x,y) = x^3 - 3x + y^3 - 3y$ en $(-1, -1)$ tiene un`, rot('Máximo local'), r`$f_{xx} = -6$, $f_{yy} = -6$, $f_{xy} = 0$: $D = 36 > 0$ con $f_{xx} < 0$.`, K('x**3-3*x+y**3-3*y', [-1, -1]));

const dir = new URL('../server/src/questions/bank/', import.meta.url);
for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) fs.unlinkSync(new URL(f, dir));
for (const [tema, list] of Object.entries(out)) {
  fs.writeFileSync(new URL(`${tema}.json`, dir), `${JSON.stringify(list, null, 2)}\n`);
  console.log(tema, list.length, [1, 2, 3, 4].map((d) => list.filter((x) => x.dificultad === d).length).join('/'));
}
