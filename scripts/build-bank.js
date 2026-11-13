// Genera server/src/questions/bank/*.json (tanda 8: integrales con jacobiano y volumen) desde esta lista.
// Cada pregunta trae `verifica`: el problema en forma que tests/questions.test.js resuelve por su
// cuenta (jacobiano por diferencias finitas, integrales en cartesianas sobre una cuadrícula, integrales
// iteradas con Simpson). La correcta va primero y los distractores de más a menos plausibles (errores
// típicos: olvidar el jacobiano, r² en vez de r, ρ sen φ en vez de ρ² sen φ, φ hasta 2π, signo de J).
// Los 4 temas anteriores (corte 3) quedaron en el historial de git. Uso: node scripts/build-bank.js
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

// --- Formas de verificación (las expresiones usan sin, cos, sqrt, exp, log, max, PI) ---
// Jacobiano numérico del mapa (vars → map). abs: valor absoluto; inv: 1/J; p: punto; dV: la opción trae diferenciales
const JAC = (map, vars, extra = {}) => ({ tipo: 'jac', map, vars, ...extra });
const POLAR = ['r*cos(theta)', 'r*sin(theta)'];
const CIL = ['r*cos(theta)', 'r*sin(theta)', 'z'];
const ESF = ['rho*sin(phi)*cos(theta)', 'rho*sin(phi)*sin(theta)', 'rho*cos(phi)'];
const EV = ['rho', 'phi', 'theta'];
// ∬ f dA en cartesianas sobre { cond } dentro de la caja [x0, x1, y0, y1]
const C2 = (f, cond, box) => ({ tipo: 'cart2', f, cond, box });
// ∭ f dV en cartesianas sobre { cond } dentro de la caja [x0, x1, y0, y1, z0, z1]
const C3 = (f, cond, box) => ({ tipo: 'cart3', f, cond, box });
// Integral iterada tal como está escrita: vars de afuera hacia adentro, con sus límites
const IT = (f, vars, lim) => ({ tipo: 'iter', f, vars, lim });
// Expresión en otro sistema: la opción (en r, θ, z, ρ, φ) debe valer lo mismo que f(x, y, z)
const SYM = (f) => ({ tipo: 'sym', f });
const CON = (contiene) => ({ tipo: 'concepto', contiene });
// Límites: los de la opción correcta (a) deben dar lo mismo que la región en cartesianas (b)
const EQ = (contiene, a, b) => ({ tipo: 'equiv', contiene, a, b });
const AREA = (map, box) => ({ tipo: 'areaimg', map, vars: ['u', 'v'], box });
const disk = (R) => [-R, R, -R, R];
const ball = (R) => [-R, R, -R, R, -R, R];
const TP = '2*PI';

// --- Jacobiano de transformaciones ---
let q = add('jacobiano', 'jc');
q(1, r`Jacobiano de las coordenadas polares $x = r\cos\theta$, $y = r\sin\theta$`, ['r', 'r^2', '1'], r`$\frac{\partial(x,y)}{\partial(r,\theta)} = \cos\theta \cdot r\cos\theta + r\sin\theta \cdot \sin\theta$. Eso es $r(\cos^2\theta + \sin^2\theta) = r$.`, JAC(POLAR, ['r', 'theta']));
q(1, r`En coordenadas cilíndricas, $dV$ es`, [r`$r\,dz\,dr\,d\theta$`, r`$dz\,dr\,d\theta$`, r`$r^2\,dz\,dr\,d\theta$`], r`Las cilíndricas son polares más la altura $z$. El jacobiano es el mismo de polares: $r$.`, JAC(CIL, ['r', 'theta', 'z'], { dV: true }));
q(1, r`$|J|$ de las coordenadas esféricas $(\rho, \phi, \theta)$`, [r`\rho^2\sin\phi`, r`\rho\sin\phi`, r`\rho^2\cos\phi`], r`Con $x = \rho\sin\phi\cos\theta$, $y = \rho\sin\phi\sin\theta$, $z = \rho\cos\phi$ el determinante da $\rho^2\sin\phi$. Por eso $dV = \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$.`, JAC(ESF, EV, { abs: true }));
q(1, r`Jacobiano $\frac{\partial(x,y)}{\partial(u,v)}$ de $x = 2u$, $y = 3v$`, ['6', '5', '1'], r`La matriz es diagonal: $x_u = 2$, $y_v = 3$. El determinante es $2 \cdot 3 = 6$.`, JAC(['2*u', '3*v'], ['u', 'v']));
q(1, r`La transformación $x = 2u$, $y = 2v$ multiplica las áreas por`, ['4', '2', '8'], r`El factor de área es $|J|$. Aquí $J = 2 \cdot 2 = 4$.`, JAC(['2*u', '2*v'], ['u', 'v'], { abs: true }));
q(1, r`En $\iint_R f\,dA = \iint_S f\,(\,?\,)\,du\,dv$, el factor que falta es`, [r`el valor absoluto del jacobiano, $|J|$`, r`el jacobiano con su signo, $J$`, r`el inverso, $\frac{1}{J}$`], r`Un área no puede ser negativa. Por eso se usa $|J|$ y no $J$ con su signo.`, CON('valor absoluto'));
q(1, r`Jacobiano $\frac{\partial(x,y)}{\partial(u,v)}$ de $x = u + v$, $y = v$`, ['1', '2', '0'], r`$x_u = 1$, $x_v = 1$, $y_u = 0$, $y_v = 1$. $J = 1 \cdot 1 - 1 \cdot 0 = 1$.`, JAC(['u+v', 'v'], ['u', 'v']));

q(2, r`$\frac{\partial(x,y)}{\partial(u,v)}$ para $x = 2u + v$, $y = u + 3v$`, ['5', '7', '-5'], r`$J = x_u y_v - x_v y_u$. $J = 2 \cdot 3 - 1 \cdot 1 = 5$.`, JAC(['2*u+v', 'u+3*v'], ['u', 'v']));
q(2, r`$\frac{\partial(x,y)}{\partial(u,v)}$ para $x = u + v$, $y = u - v$`, ['-2', '2', '0'], r`$J = (1)(-1) - (1)(1) = -2$. El jacobiano lleva signo; en la integral se usa $|J| = 2$.`, JAC(['u+v', 'u-v'], ['u', 'v']));
q(2, r`$\frac{\partial(x,y)}{\partial(u,v)}$ para $x = uv$, $y = v$`, ['v', 'u', '$uv$'], r`$x_u = v$, $x_v = u$, $y_u = 0$, $y_v = 1$. $J = v \cdot 1 - u \cdot 0 = v$.`, JAC(['u*v', 'v'], ['u', 'v']));
q(2, r`Jacobiano de las cilíndricas, $\frac{\partial(x,y,z)}{\partial(r,\theta,z)}$`, ['r', 'r^2', r`r\sin\theta`], r`$z$ no cambia, así que queda el determinante $2 \times 2$ de polares. $J = r$.`, JAC(CIL, ['r', 'theta', 'z']));
q(2, r`$\frac{\partial(x,y,z)}{\partial(u,v,w)}$ para $x = 2u$, $y = 3v$, $z = 4w$`, ['24', '9', '12'], r`Matriz diagonal: el determinante es el producto de la diagonal. $2 \cdot 3 \cdot 4 = 24$.`, JAC(['2*u', '3*v', '4*w'], ['u', 'v', 'w']));
q(2, r`Bajo $x = 3u$, $y = 2v$, el cuadrado $0 \le u \le 1$, $0 \le v \le 1$ va a una región de área`, ['6', '5', '1'], r`Área de la imagen $= |J| \cdot$ área original. $|J| = 6$ y el cuadrado mide $1$: área $6$.`, AREA(['3*u', '2*v'], [0, 1, 0, 1]));
q(2, r`Si $\frac{\partial(x,y)}{\partial(u,v)} = 4$, entonces $\frac{\partial(u,v)}{\partial(x,y)}$ vale`, [r`\frac{1}{4}`, '4', '-4'], r`Los jacobianos de una transformación y de su inversa son recíprocos. $\frac{1}{4}$.`, JAC(['4*u', 'v'], ['u', 'v'], { inv: true }));

q(3, r`$\frac{\partial(x,y)}{\partial(u,v)}$ para $x = u^2 - v^2$, $y = 2uv$`, [r`4(u^2 + v^2)`, r`4(u^2 - v^2)`, r`2(u^2 + v^2)`], r`$x_u = 2u$, $x_v = -2v$, $y_u = 2v$, $y_v = 2u$. $J = 4u^2 + 4v^2 = 4(u^2 + v^2)$.`, JAC(['u*u-v*v', '2*u*v'], ['u', 'v']));
q(3, r`$\frac{\partial(x,y)}{\partial(u,v)}$ si $u = x + y$, $v = x - y$`, [r`-\frac{1}{2}`, '-2', r`\frac{1}{2}`], r`Despejando: $x = \frac{u + v}{2}$, $y = \frac{u - v}{2}$. $J = \frac12 \cdot \left(-\frac12\right) - \frac12 \cdot \frac12 = -\frac12$. Ojo: $-2$ es $\frac{\partial(u,v)}{\partial(x,y)}$, el inverso.`, JAC(['(u+v)/2', '(u-v)/2'], ['u', 'v']));
q(3, r`Área de la imagen del rectángulo $0 \le u \le 2$, $0 \le v \le 1$ bajo $x = 2u + v$, $y = u - v$`, ['6', '-6', '2'], r`$J = (2)(-1) - (1)(1) = -3$, así que $|J| = 3$. Área $= 3 \cdot 2 = 6$ (un área nunca es negativa).`, AREA(['2*u+v', 'u-v'], [0, 2, 0, 1]));
q(3, r`$\frac{\partial(x,y)}{\partial(u,v)}$ para $x = e^{u}\cos v$, $y = e^{u}\sin v$`, [r`e^{2u}`, r`e^{u}`, r`2e^{u}`], r`$J = e^u\cos v \cdot e^u\cos v + e^u\sin v \cdot e^u\sin v$. $J = e^{2u}(\cos^2 v + \sin^2 v) = e^{2u}$.`, JAC(['exp(u)*cos(v)', 'exp(u)*sin(v)'], ['u', 'v']));
q(3, r`Valor de $|J|$ de las esféricas en $\rho = 2$, $\phi = \frac{\pi}{2}$`, ['4', '2', '0'], r`$|J| = \rho^2\sin\phi$. $2^2 \cdot \sin\frac{\pi}{2} = 4$.`, JAC(ESF, EV, { abs: true, p: [2, Math.PI / 2, 0.7] }));
q(3, r`Con $x = 3u$, $y = 2v$ la elipse $\frac{x^2}{9} + \frac{y^2}{4} \le 1$ pasa al disco $u^2 + v^2 \le 1$. Su área es`, [r`6\pi`, r`\pi`, r`5\pi`], r`$|J| = 3 \cdot 2 = 6$. Área $= 6 \cdot$ área del disco unitario $= 6\pi$.`, C2('1', 'x*x/9+y*y/4<=1', [-3, 3, -2, 2]));

q(4, r`$\frac{\partial(x,y)}{\partial(u,v)}$ si $u = xy$, $v = \frac{y}{x}$ (con $x, y > 0$)`, [r`\frac{1}{2v}`, '2v', r`\frac{1}{2u}`], r`Es más fácil al revés: $\frac{\partial(u,v)}{\partial(x,y)} = y \cdot \frac{1}{x} + x \cdot \frac{y}{x^2} = \frac{2y}{x} = 2v$. El pedido es el recíproco: $\frac{1}{2v}$.`, JAC(['sqrt(u/v)', 'sqrt(u*v)'], ['u', 'v']));
q(4, r`$\frac{\partial(x,y,z)}{\partial(u,v,w)}$ para $x = u + v$, $y = v + w$, $z = u + w$`, ['2', '0', '1'], r`Filas $(1,1,0)$, $(0,1,1)$, $(1,0,1)$. Por la primera fila: $1(1 - 0) - 1(0 - 1) + 0 = 2$.`, JAC(['u+v', 'v+w', 'u+w'], ['u', 'v', 'w']));
q(4, r`Área de la región del primer cuadrante entre $xy = 1$, $xy = 4$, $y = x$, $y = 4x$ (use $u = xy$, $v = \frac{y}{x}$)`, [r`3\ln 2`, r`6\ln 2`, '9'], r`La región es $1 \le u \le 4$, $1 \le v \le 4$ con $|J| = \frac{1}{2v}$. $\int_1^4\!\int_1^4 \frac{1}{2v}\,dv\,du = 3 \cdot \frac{\ln 4}{2} = 3\ln 2$.`, C2('1', 'x*y>=1 && x*y<=4 && y>=x && y<=4*x', [0, 2.2, 0, 4.2]));
q(4, r`$|J|$ de $x = r\cos\theta$, $y = 2r\sin\theta$`, ['2r', 'r', '2r^2'], r`$J = \cos\theta \cdot 2r\cos\theta + r\sin\theta \cdot 2\sin\theta$. $J = 2r(\cos^2\theta + \sin^2\theta) = 2r$.`, JAC(['r*cos(theta)', '2*r*sin(theta)'], ['r', 'theta'], { abs: true }));
q(4, r`Volumen del elipsoide $\frac{x^2}{4} + \frac{y^2}{9} + z^2 \le 1$ (use $x = 2u$, $y = 3v$, $z = w$)`, [r`8\pi`, r`\frac{4\pi}{3}`, r`6\pi`], r`$|J| = 2 \cdot 3 \cdot 1 = 6$ y el elipsoide pasa a la esfera unitaria. $V = 6 \cdot \frac{4\pi}{3} = 8\pi$.`, C3('1', 'x*x/4+y*y/9+z*z<=1', [-2, 2, -3, 3, -1, 1]));

// --- Integrales dobles con cambio de variables ---
q = add('cambio-variables-dobles', 'cv');
const LIN = (f, cond, box) => C2(f, cond, box);
q(1, r`$\displaystyle\int_0^{2\pi}\!\int_0^1 r\,dr\,d\theta$`, [r`\pi`, r`2\pi`, r`\frac{\pi}{2}`], r`$\int_0^1 r\,dr = \frac12$. Por $2\pi$: $\pi$ (el área del disco unitario).`, IT('r', ['theta', 'r'], [[0, TP], [0, 1]]));
q(1, r`Área del disco $x^2 + y^2 \le 9$ con polares`, [r`9\pi`, r`6\pi`, r`3\pi`], r`$\int_0^{2\pi}\!\int_0^3 r\,dr\,d\theta = 2\pi \cdot \frac92 = 9\pi$. Sin la $r$ del jacobiano saldría $6\pi$.`, C2('1', 'x*x+y*y<=9', disk(3)));
q(1, r`En polares, $x^2 + y^2$ es`, ['r^2', 'r', '2r'], r`$x^2 + y^2 = r^2\cos^2\theta + r^2\sin^2\theta = r^2$.`, SYM('x*x+y*y'));
q(1, r`El disco $x^2 + y^2 \le 4$ en polares es`, [r`$0 \le r \le 2,\ 0 \le \theta \le 2\pi$`, r`$0 \le r \le 4,\ 0 \le \theta \le 2\pi$`, r`$0 \le r \le 2,\ 0 \le \theta \le \pi$`], r`$r^2 \le 4$ da $r \le 2$. Para la vuelta completa, $\theta$ va de $0$ a $2\pi$.`, EQ(r`r \le 2,\ 0 \le \theta \le 2\pi`, IT('r', ['theta', 'r'], [[0, TP], [0, 2]]), C2('1', 'x*x+y*y<=4', disk(2))));
q(1, r`$\displaystyle\int_0^{\pi}\!\int_0^2 r\,dr\,d\theta$`, [r`2\pi`, r`4\pi`, r`\pi`], r`$\int_0^2 r\,dr = 2$. Por $\pi$: $2\pi$ (un semidisco de radio $2$).`, IT('r', ['theta', 'r'], [[0, 'PI'], [0, 2]]));
q(1, r`Con $u = x + y$, $v = x - y$, la región $0 \le x + y \le 2$, $0 \le x - y \le 2$ del plano $uv$ es`, [r`un rectángulo`, r`un disco`, r`un triángulo`], r`Las condiciones quedan $0 \le u \le 2$, $0 \le v \le 2$: un rectángulo. Esa es la gracia del cambio.`, CON('rectángulo'));
q(1, r`Área del semidisco $x^2 + y^2 \le 4$, $y \ge 0$`, [r`2\pi`, r`4\pi`, r`\pi`], r`$\int_0^{\pi}\!\int_0^2 r\,dr\,d\theta = \pi \cdot 2 = 2\pi$.`, C2('1', 'x*x+y*y<=4 && y>=0', [-2, 2, 0, 2]));

q(2, r`$\displaystyle\iint_D (x^2 + y^2)\,dA$, con $D$: $x^2 + y^2 \le 4$`, [r`8\pi`, r`\frac{16\pi}{3}`, r`4\pi`], r`$\int_0^{2\pi}\!\int_0^2 r^2 \cdot r\,dr\,d\theta$. $\int_0^2 r^3\,dr = 4$, por $2\pi$: $8\pi$.`, C2('x*x+y*y', 'x*x+y*y<=4', disk(2)));
q(2, r`Área del anillo $1 \le x^2 + y^2 \le 9$`, [r`8\pi`, r`4\pi`, r`2\pi`], r`$\int_0^{2\pi}\!\int_1^3 r\,dr\,d\theta$. $\int_1^3 r\,dr = 4$, por $2\pi$: $8\pi$.`, C2('1', 'x*x+y*y>=1 && x*x+y*y<=9', disk(3)));
q(2, r`$\displaystyle\iint_D \sqrt{x^2 + y^2}\,dA$, con $D$: disco de radio $3$`, [r`18\pi`, r`9\pi`, r`\frac{81\pi}{2}`], r`$\int_0^{2\pi}\!\int_0^3 r \cdot r\,dr\,d\theta$. $\int_0^3 r^2\,dr = 9$, por $2\pi$: $18\pi$.`, C2('sqrt(x*x+y*y)', 'x*x+y*y<=9', disk(3)));
q(2, r`Área del sector $0 \le r \le 4$, $0 \le \theta \le \frac{\pi}{4}$`, [r`2\pi`, r`\pi`, r`4\pi`], r`$\int_0^{\pi/4}\!\int_0^4 r\,dr\,d\theta$. $\int_0^4 r\,dr = 8$, por $\frac{\pi}{4}$: $2\pi$.`, C2('1', 'x*x+y*y<=16 && y<=x', [0, 4, 0, 4]));
q(2, r`Área de $R$: $0 \le x + y \le 2$, $0 \le x - y \le 4$ (use $u = x + y$, $v = x - y$)`, ['4', '8', '16'], r`$|J| = \frac12$. $\int_0^2\!\int_0^4 \frac12\,dv\,du = \frac12 \cdot 8 = 4$.`, LIN('1', 'x+y>=0 && x+y<=2 && x-y>=0 && x-y<=4', [0, 3, -2, 1]));
q(2, r`Con $u = x + y$, $v = x - y$, el elemento $dA = dx\,dy$ es`, [r`$\frac{1}{2}\,du\,dv$`, r`$2\,du\,dv$`, r`$du\,dv$`], r`$\frac{\partial(u,v)}{\partial(x,y)} = -2$, así que $\frac{\partial(x,y)}{\partial(u,v)} = -\frac12$. Se usa $|J| = \frac12$.`, JAC(['(u+v)/2', '(u-v)/2'], ['u', 'v'], { abs: true, dV: true }));
q(2, r`$\displaystyle\iint_D x\,dA$, con $D$: cuarto de disco $x^2 + y^2 \le 4$, $x \ge 0$, $y \ge 0$`, [r`\frac{8}{3}`, '2', r`\frac{4}{3}`], r`$\int_0^{\pi/2}\!\int_0^2 r\cos\theta \cdot r\,dr\,d\theta$. $\int_0^2 r^2\,dr = \frac83$ y $\int_0^{\pi/2}\cos\theta\,d\theta = 1$: $\frac83$.`, C2('x', 'x*x+y*y<=4', [0, 2, 0, 2]));

q(3, r`$\displaystyle\iint_D e^{-(x^2 + y^2)}\,dA$, con $D$: $x^2 + y^2 \le 4$`, [r`\pi(1 - e^{-4})`, r`2\pi(1 - e^{-4})`, r`\pi e^{-4}`], r`$\int_0^{2\pi}\!\int_0^2 e^{-r^2} r\,dr\,d\theta$. $\int_0^2 r e^{-r^2}\,dr = \frac{1 - e^{-4}}{2}$, por $2\pi$: $\pi(1 - e^{-4})$.`, C2('exp(-(x*x+y*y))', 'x*x+y*y<=4', disk(2)));
q(3, r`$\displaystyle\iint_R (x + y)\,dA$, con $R$: $0 \le x + y \le 2$, $0 \le x - y \le 2$`, ['2', '4', '8'], r`Con $u = x + y$, $v = x - y$: $|J| = \frac12$. $\int_0^2\!\int_0^2 \frac{u}{2}\,dv\,du = \frac12 \cdot 2 \cdot 2 = 2$.`, LIN('x+y', 'x+y>=0 && x+y<=2 && x-y>=0 && x-y<=2', [0, 2, -1, 1]));
q(3, r`$\displaystyle\iint_R (x + y)(x - y)\,dA$, con $R$: $1 \le x + y \le 3$, $0 \le x - y \le 2$`, ['4', '8', '2'], r`$|J| = \frac12$. $\frac12\int_1^3 u\,du \int_0^2 v\,dv = \frac12 \cdot 4 \cdot 2 = 4$.`, LIN('(x+y)*(x-y)', 'x+y>=1 && x+y<=3 && x-y>=0 && x-y<=2', [0.5, 2.5, -0.5, 1.5]));
q(3, r`$\displaystyle\int_0^2\!\int_0^{\sqrt{4 - x^2}} (x^2 + y^2)\,dy\,dx$ (pase a polares)`, [r`2\pi`, r`\frac{4\pi}{3}`, r`4\pi`], r`Es un cuarto de disco de radio $2$: $\int_0^{\pi/2}\!\int_0^2 r^3\,dr\,d\theta$. $\frac{\pi}{2} \cdot 4 = 2\pi$.`, C2('x*x+y*y', 'x*x+y*y<=4', [0, 2, 0, 2]));
q(3, r`$\displaystyle\iint_D \frac{1}{\sqrt{x^2 + y^2}}\,dA$, con $D$: anillo $1 \le x^2 + y^2 \le 9$`, [r`4\pi`, r`2\pi\ln 3`, r`8\pi`], r`$\int_0^{2\pi}\!\int_1^3 \frac{1}{r} \cdot r\,dr\,d\theta$. La $r$ del jacobiano cancela: $\int_1^3 1\,dr = 2$, por $2\pi$: $4\pi$.`, C2('1/sqrt(x*x+y*y)', 'x*x+y*y>=1 && x*x+y*y<=9', disk(3)));
q(3, r`Área de la región encerrada por $r = 2\cos\theta$`, [r`\pi`, r`2\pi`, r`\frac{\pi}{2}`], r`$\int_{-\pi/2}^{\pi/2}\!\int_0^{2\cos\theta} r\,dr\,d\theta = \int_{-\pi/2}^{\pi/2} 2\cos^2\theta\,d\theta = \pi$. Es el círculo $(x - 1)^2 + y^2 = 1$.`, C2('1', '(x-1)**2+y*y<=1', [0, 2, -1, 1]));

q(4, r`$\displaystyle\iint_R \frac{x - y}{x + y}\,dA$, con $R$: $1 \le x + y \le 2$, $0 \le x - y \le 2$`, [r`\ln 2`, r`2\ln 2`, r`4\ln 2`], r`Con $u = x + y$, $v = x - y$: $|J| = \frac12$. $\frac12\int_1^2 \frac{du}{u}\int_0^2 v\,dv = \frac12 \cdot \ln 2 \cdot 2 = \ln 2$.`, LIN('(x-y)/(x+y)', 'x+y>=1 && x+y<=2 && x-y>=0 && x-y<=2', [0.5, 2, -0.5, 1]));
q(4, r`$\displaystyle\iint_D \cos(x^2 + y^2)\,dA$, con $D$: $x^2 + y^2 \le \frac{\pi}{2}$`, [r`\pi`, r`2\pi`, r`\frac{\pi}{2}`], r`$\int_0^{2\pi}\!\int_0^{\sqrt{\pi/2}} \cos(r^2)\,r\,dr\,d\theta$. $\int r\cos(r^2)\,dr = \frac12\sin(r^2)$, que da $\frac12$; por $2\pi$: $\pi$.`, C2('cos(x*x+y*y)', 'x*x+y*y<=PI/2', disk(1.26)));
q(4, r`$\displaystyle\iint_R e^{\frac{x - y}{x + y}}\,dA$, con $R$: triángulo de vértices $(0,0)$, $(1,0)$, $(0,1)$`, [r`\frac{e - e^{-1}}{4}`, r`\frac{e - e^{-1}}{2}`, r`e - e^{-1}`], r`Con $u = x - y$, $v = x + y$: $0 \le v \le 1$, $-v \le u \le v$, $|J| = \frac12$. $\frac12\int_0^1\!\int_{-v}^{v} e^{u/v}\,du\,dv = \frac12\int_0^1 v(e - e^{-1})\,dv = \frac{e - e^{-1}}{4}$.`, LIN('exp((x-y)/(x+y))', 'x+y<=1', [0, 1, 0, 1]));
q(4, r`$\displaystyle\iint_D y\,dA$, con $D$: semidisco $x^2 + y^2 \le 9$, $y \ge 0$`, ['18', '9', '0'], r`$\int_0^{\pi}\!\int_0^3 r\sin\theta \cdot r\,dr\,d\theta$. $\int_0^3 r^2\,dr = 9$ y $\int_0^{\pi}\sin\theta\,d\theta = 2$: $18$. Con $\theta$ hasta $2\pi$ daría $0$.`, C2('y', 'x*x+y*y<=9', [-3, 3, 0, 3]));
q(4, r`$\displaystyle\iint_R (x - y)\,dA$, con $R$: $0 \le 2x + y \le 4$, $0 \le x - y \le 3$ (use $u = 2x + y$, $v = x - y$)`, ['6', '18', '-6'], r`$\frac{\partial(u,v)}{\partial(x,y)} = (2)(-1) - (1)(1) = -3$, así que $|J| = \frac13$. $\frac13\int_0^4 du\int_0^3 v\,dv = \frac13 \cdot 4 \cdot \frac92 = 6$.`, LIN('x-y', '2*x+y>=0 && 2*x+y<=4 && x-y>=0 && x-y<=3', [0, 2.34, -2, 1.34]));

// --- Integrales triples en cilíndricas y esféricas ---
q = add('triples-cilindricas-esfericas', 'tr');
const CV = ['theta', 'r', 'z'];
const SV = ['theta', 'phi', 'rho'];
const S2 = '(x*x+y*y+z*z)';
q(1, r`$\displaystyle\int_0^{2\pi}\!\int_0^1\!\int_0^2 r\,dz\,dr\,d\theta$`, [r`2\pi`, r`4\pi`, r`\pi`], r`$\int_0^2 dz = 2$ y $\int_0^1 r\,dr = \frac12$. $2\pi \cdot \frac12 \cdot 2 = 2\pi$.`, IT('r', CV, [[0, TP], [0, 1], [0, 2]]));
q(1, r`Para integrar sobre una esfera sólida centrada en el origen conviene usar coordenadas`, ['esféricas', 'cilíndricas', 'cartesianas'], r`En esféricas la esfera es simplemente $0 \le \rho \le R$: todos los límites son constantes.`, CON('esféricas'));
q(1, r`En esféricas, para cubrir toda la esfera el ángulo $\phi$ (medido desde el eje $z$) varía en`, [r`$0 \le \phi \le \pi$`, r`$0 \le \phi \le 2\pi$`, r`$0 \le \phi \le \frac{\pi}{2}$`], r`$\phi$ baja del polo norte ($0$) al polo sur ($\pi$). El que da la vuelta completa es $\theta$, de $0$ a $2\pi$.`, EQ(r`\phi \le \pi$`, IT('rho*rho*sin(phi)', SV, [[0, TP], [0, 'PI'], [0, 1]]), C3('1', `${S2}<=1`, ball(1))));
q(1, r`En cilíndricas, $x^2 + y^2 + z^2$ es`, ['r^2 + z^2', 'r + z', 'r^2'], r`$x^2 + y^2 = r^2$ y $z$ queda igual: $r^2 + z^2$.`, SYM(S2));
q(1, r`En esféricas, $x^2 + y^2 + z^2$ es`, [r`\rho^2`, r`\rho`, r`\rho^2\sin\phi`], r`$\rho$ es la distancia al origen: $\rho^2 = x^2 + y^2 + z^2$.`, SYM(S2));
q(1, r`$\displaystyle\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^1 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$`, [r`\frac{4\pi}{3}`, r`2\pi`, r`\frac{2\pi}{3}`], r`$\int_0^1 \rho^2\,d\rho = \frac13$ y $\int_0^{\pi}\sin\phi\,d\phi = 2$. $2\pi \cdot 2 \cdot \frac13 = \frac{4\pi}{3}$ (la esfera unitaria).`, IT('rho*rho*sin(phi)', SV, [[0, TP], [0, 'PI'], [0, 1]]));
q(1, r`El cilindro sólido $x^2 + y^2 \le 4$, $0 \le z \le 5$ en cilíndricas es`, [r`$0 \le r \le 2,\ 0 \le \theta \le 2\pi,\ 0 \le z \le 5$`, r`$0 \le r \le 4,\ 0 \le \theta \le 2\pi,\ 0 \le z \le 5$`, r`$0 \le r \le 2,\ 0 \le \theta \le \pi,\ 0 \le z \le 5$`], r`$r^2 \le 4$ da $r \le 2$. $\theta$ da la vuelta completa y $z$ no cambia.`, EQ(r`r \le 2,\ 0 \le \theta \le 2\pi`, IT('r', CV, [[0, TP], [0, 2], [0, 5]]), C3('1', 'x*x+y*y<=4', [-2, 2, -2, 2, 0, 5])));

q(2, r`$\displaystyle\int_0^{2\pi}\!\int_0^1\!\int_0^3 z\,r\,dz\,dr\,d\theta$`, [r`\frac{9\pi}{2}`, r`9\pi`, r`\frac{9\pi}{4}`], r`$\int_0^3 z\,dz = \frac92$ y $\int_0^1 r\,dr = \frac12$. $2\pi \cdot \frac12 \cdot \frac92 = \frac{9\pi}{2}$.`, IT('z*r', CV, [[0, TP], [0, 1], [0, 3]]));
q(2, r`Masa del cilindro $x^2 + y^2 \le 1$, $0 \le z \le 2$ con densidad $\delta = z$`, [r`2\pi`, r`4\pi`, r`\pi`], r`$\int_0^{2\pi}\!\int_0^1\!\int_0^2 z\,r\,dz\,dr\,d\theta$. $2\pi \cdot \frac12 \cdot 2 = 2\pi$.`, C3('z', 'x*x+y*y<=1', [-1, 1, -1, 1, 0, 2]));
q(2, r`$\displaystyle\iiint_E 1\,dV$, con $E$: esfera sólida de radio $3$`, [r`36\pi`, r`18\pi`, r`12\pi`], r`$\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^3 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$. $2\pi \cdot 2 \cdot 9 = 36\pi$.`, C3('1', `${S2}<=9`, ball(3)));
q(2, r`La semiesfera sólida $x^2 + y^2 + z^2 \le 4$, $z \ge 0$ en esféricas tiene`, [r`$0 \le \phi \le \frac{\pi}{2}$`, r`$0 \le \phi \le \pi$`, r`$0 \le \phi \le 2\pi$`], r`$z \ge 0$ es la mitad de arriba: $\phi$ va del polo norte ($0$) al ecuador ($\frac{\pi}{2}$).`, EQ(r`\frac{\pi}{2}`, IT('rho*rho*sin(phi)', SV, [[0, TP], [0, 'PI/2'], [0, 2]]), C3('1', `${S2}<=4`, [-2, 2, -2, 2, 0, 2])));
q(2, r`$\displaystyle\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^2 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$`, [r`\frac{32\pi}{3}`, r`8\pi`, r`\frac{16\pi}{3}`], r`$\int_0^2 \rho^2\,d\rho = \frac83$ y $\int_0^{\pi}\sin\phi\,d\phi = 2$. $2\pi \cdot 2 \cdot \frac83 = \frac{32\pi}{3}$.`, IT('rho*rho*sin(phi)', SV, [[0, TP], [0, 'PI'], [0, 2]]));
q(2, r`$\displaystyle\iiint_E (x^2 + y^2)\,dV$, con $E$: $x^2 + y^2 \le 1$, $0 \le z \le 4$`, [r`2\pi`, r`\frac{8\pi}{3}`, r`4\pi`], r`$\int_0^{2\pi}\!\int_0^1\!\int_0^4 r^2 \cdot r\,dz\,dr\,d\theta$. $2\pi \cdot \frac14 \cdot 4 = 2\pi$.`, C3('x*x+y*y', 'x*x+y*y<=1', [-1, 1, -1, 1, 0, 4]));
q(2, r`En esféricas, $z$ es`, [r`\rho\cos\phi`, r`\rho\sin\phi`, r`\rho\cos\theta`], r`$\phi$ se mide desde el eje $z$, así que $z = \rho\cos\phi$ (y $r = \rho\sin\phi$).`, SYM('z'));

q(3, r`Masa de la esfera sólida de radio $2$ con densidad $\delta = \sqrt{x^2 + y^2 + z^2}$`, [r`16\pi`, r`\frac{32\pi}{3}`, r`8\pi`], r`$\delta = \rho$: $\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^2 \rho \cdot \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$. $2\pi \cdot 2 \cdot 4 = 16\pi$.`, C3(`sqrt(${S2})`, `${S2}<=4`, ball(2)));
q(3, r`$\displaystyle\iiint_E z\,dV$, con $E$: semiesfera $x^2 + y^2 + z^2 \le 1$, $z \ge 0$`, [r`\frac{\pi}{4}`, r`\frac{\pi}{3}`, r`\frac{\pi}{2}`], r`$z = \rho\cos\phi$: $\int_0^{2\pi}\!\int_0^{\pi/2}\!\int_0^1 \rho\cos\phi \cdot \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$. $2\pi \cdot \frac12 \cdot \frac14 = \frac{\pi}{4}$.`, C3('z', `${S2}<=1`, [-1, 1, -1, 1, 0, 1]));
q(3, r`Masa del cilindro $x^2 + y^2 \le 4$, $0 \le z \le 3$ con densidad $\delta = \sqrt{x^2 + y^2}$`, [r`16\pi`, r`12\pi`, r`24\pi`], r`$\delta = r$: $\int_0^{2\pi}\!\int_0^2\!\int_0^3 r \cdot r\,dz\,dr\,d\theta$. $2\pi \cdot \frac83 \cdot 3 = 16\pi$.`, C3('sqrt(x*x+y*y)', 'x*x+y*y<=4', [-2, 2, -2, 2, 0, 3]));
q(3, r`$\displaystyle\iiint_E (x^2 + y^2 + z^2)\,dV$, con $E$: esfera sólida de radio $1$`, [r`\frac{4\pi}{5}`, r`\pi`, r`\frac{4\pi}{3}`], r`$\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^1 \rho^2 \cdot \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$. $2\pi \cdot 2 \cdot \frac15 = \frac{4\pi}{5}$.`, C3(S2, `${S2}<=1`, ball(1)));
q(3, r`La región sobre el cono $z = \sqrt{x^2 + y^2}$ y dentro de la esfera $x^2 + y^2 + z^2 = 4$ en esféricas es`, [r`$0 \le \rho \le 2,\ 0 \le \phi \le \frac{\pi}{4}$`, r`$0 \le \rho \le 2,\ 0 \le \phi \le \frac{\pi}{2}$`, r`$0 \le \rho \le 4,\ 0 \le \phi \le \frac{\pi}{4}$`], r`La esfera es $\rho = 2$. El cono $z = r$ es $\phi = \frac{\pi}{4}$, y "sobre el cono" es $\phi$ menor.`, EQ(r`\rho \le 2,\ 0 \le \phi \le \frac{\pi}{4}`, IT('rho*rho*sin(phi)', SV, [[0, TP], [0, 'PI/4'], [0, 2]]), C3('1', `${S2}<=4 && z>=sqrt(x*x+y*y)`, [-2, 2, -2, 2, 0, 2])));
q(3, r`$\displaystyle\int_0^{2\pi}\!\int_0^1\!\int_r^1 r\,dz\,dr\,d\theta$`, [r`\frac{\pi}{3}`, r`\pi`, r`\frac{2\pi}{3}`], r`$\int_r^1 dz = 1 - r$. $\int_0^1 r(1 - r)\,dr = \frac12 - \frac13 = \frac16$, por $2\pi$: $\frac{\pi}{3}$ (un cono).`, IT('r', CV, [[0, TP], [0, 1], ['r', 1]]));

q(4, r`Masa del sólido entre las esferas $\rho = 1$ y $\rho = 2$ con densidad $\delta = \frac{1}{x^2 + y^2 + z^2}$`, [r`4\pi`, r`4\pi\ln 2`, r`2\pi`], r`$\delta = \frac{1}{\rho^2}$ cancela el $\rho^2$ del jacobiano: $\int_0^{2\pi}\!\int_0^{\pi}\!\int_1^2 \sin\phi\,d\rho\,d\phi\,d\theta$. $2\pi \cdot 2 \cdot 1 = 4\pi$.`, C3(`1/(${S2})`, `${S2}>=1 && ${S2}<=4`, ball(2)));
q(4, r`$\displaystyle\iiint_E z\,dV$, con $E$: sobre el cono $z = \sqrt{x^2 + y^2}$ y bajo el plano $z = 2$`, [r`4\pi`, r`\frac{16\pi}{3}`, r`8\pi`], r`En cilíndricas: $\int_0^{2\pi}\!\int_0^2\!\int_r^2 z\,r\,dz\,dr\,d\theta$. $\int_r^2 z\,dz = \frac{4 - r^2}{2}$ y $\int_0^2 \frac{r(4 - r^2)}{2}\,dr = 2$: $4\pi$.`, C3('z', 'z>=sqrt(x*x+y*y)', [-2, 2, -2, 2, 0, 2]));
q(4, r`$\displaystyle\iiint_E \sqrt{x^2 + y^2 + z^2}\,dV$, con $E$: la parte de la esfera de radio $2$ en el primer octante`, [r`2\pi`, r`\frac{4\pi}{3}`, r`16\pi`], r`Primer octante: $0 \le \theta \le \frac{\pi}{2}$, $0 \le \phi \le \frac{\pi}{2}$. $\frac{\pi}{2} \cdot \int_0^{\pi/2}\sin\phi\,d\phi \cdot \int_0^2 \rho^3\,d\rho = \frac{\pi}{2} \cdot 1 \cdot 4 = 2\pi$.`, C3(`sqrt(${S2})`, `${S2}<=4`, [0, 2, 0, 2, 0, 2]));
q(4, r`$\displaystyle\iiint_E e^{(x^2 + y^2 + z^2)^{3/2}}\,dV$, con $E$: esfera sólida de radio $1$`, [r`\frac{4\pi}{3}(e - 1)`, r`4\pi(e - 1)`, r`\frac{4\pi}{3}e`], r`$\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^1 e^{\rho^3}\rho^2\sin\phi\,d\rho\,d\phi\,d\theta$. $\int_0^1 \rho^2 e^{\rho^3}\,d\rho = \frac{e - 1}{3}$, por $4\pi$: $\frac{4\pi}{3}(e - 1)$.`, C3(`exp((${S2})**1.5)`, `${S2}<=1`, ball(1)));
q(4, r`$\displaystyle\iiint_E (x^2 + y^2)\,dV$, con $E$: esfera sólida de radio $1$`, [r`\frac{8\pi}{15}`, r`\frac{4\pi}{5}`, r`\frac{2\pi}{3}`], r`$x^2 + y^2 = \rho^2\sin^2\phi$: $\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^1 \rho^4\sin^3\phi\,d\rho\,d\phi\,d\theta$. $\int_0^{\pi}\sin^3\phi\,d\phi = \frac43$, así que $2\pi \cdot \frac43 \cdot \frac15 = \frac{8\pi}{15}$.`, C3('x*x+y*y', `${S2}<=1`, ball(1)));

// --- Volumen ---
q = add('volumen', 'vo');
const R2 = '(x*x+y*y)';
q(1, r`Volumen del cilindro $x^2 + y^2 \le 9$, $0 \le z \le 2$`, [r`18\pi`, r`12\pi`, r`6\pi`], r`$\int_0^{2\pi}\!\int_0^3\!\int_0^2 r\,dz\,dr\,d\theta = 2\pi \cdot \frac92 \cdot 2 = 18\pi$. Es $\pi R^2 h$.`, C2('2', `${R2}<=9`, disk(3)));
q(1, r`Volumen bajo $z = 3$ sobre el rectángulo $[0, 2] \times [0, 4]$`, ['24', '8', '12'], r`$\iint_R 3\,dA = 3 \cdot \text{área} = 3 \cdot 8 = 24$.`, C2('3', 'true', [0, 2, 0, 4]));
q(1, r`Si $f \ge 0$, el volumen bajo $z = f(x, y)$ sobre la región $R$ es`, [r`$\iint_R f\,dA$`, r`$\iint_R 1\,dA$`, r`$\iint_R f^2\,dA$`], r`Se suma altura por área de la base: $\iint_R f\,dA$. Con $1$ en vez de $f$ sale el área de $R$.`, CON(r`\iint_R f\,dA`));
q(1, r`Volumen de la esfera de radio $1$`, [r`\frac{4\pi}{3}`, r`4\pi`, r`\frac{2\pi}{3}`], r`$\int_0^{2\pi}\!\int_0^{\pi}\!\int_0^1 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta = 2\pi \cdot 2 \cdot \frac13 = \frac{4\pi}{3}$.`, C2(`2*sqrt(max(0,1-${R2}))`, `${R2}<=1`, disk(1)));
q(1, r`Volumen bajo $z = x + y$ sobre $[0, 1] \times [0, 1]$`, ['1', '2', r`\frac{1}{2}`], r`$\int_0^1\!\int_0^1 (x + y)\,dy\,dx = \int_0^1 \left(x + \frac12\right)dx = 1$.`, C2('x+y', 'true', [0, 1, 0, 1]));
q(1, r`Volumen del cono de radio $3$ y altura $1$`, [r`3\pi`, r`9\pi`, r`\frac{9\pi}{2}`], r`$V = \frac13\pi R^2 h = \frac13 \cdot \pi \cdot 9 \cdot 1 = 3\pi$. El cilindro que lo contiene mide $9\pi$.`, C2(`1-sqrt(${R2})/3`, `${R2}<=9`, disk(3)));
q(1, r`$\displaystyle\int_0^{2\pi}\!\int_0^3\!\int_0^1 r\,dz\,dr\,d\theta$ (volumen de un cilindro)`, [r`9\pi`, r`6\pi`, r`3\pi`], r`$\int_0^1 dz = 1$ y $\int_0^3 r\,dr = \frac92$. $2\pi \cdot \frac92 = 9\pi$.`, IT('r', CV, [[0, TP], [0, 3], [0, 1]]));

q(2, r`Volumen bajo $z = 4 - x^2 - y^2$ y sobre el plano $xy$`, [r`8\pi`, r`\frac{32\pi}{3}`, r`16\pi`], r`La base es el disco $r \le 2$: $\int_0^{2\pi}\!\int_0^2 (4 - r^2)\,r\,dr\,d\theta$. $\int_0^2 (4r - r^3)\,dr = 4$, por $2\pi$: $8\pi$.`, C2(`4-${R2}`, `${R2}<=4`, disk(2)));
q(2, r`Volumen bajo $z = x^2 + y^2$ sobre el disco $x^2 + y^2 \le 1$`, [r`\frac{\pi}{2}`, r`\frac{2\pi}{3}`, r`\pi`], r`$\int_0^{2\pi}\!\int_0^1 r^2 \cdot r\,dr\,d\theta = 2\pi \cdot \frac14 = \frac{\pi}{2}$.`, C2(R2, `${R2}<=1`, disk(1)));
q(2, r`Volumen de la semiesfera de radio $3$`, [r`18\pi`, r`36\pi`, r`9\pi`], r`$\int_0^{2\pi}\!\int_0^{\pi/2}\!\int_0^3 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta = 2\pi \cdot 1 \cdot 9 = 18\pi$. La esfera completa mide $36\pi$.`, C2(`sqrt(max(0,9-${R2}))`, `${R2}<=9`, disk(3)));
q(2, r`Volumen bajo $z = xy$ sobre $[0, 2] \times [0, 2]$`, ['4', '2', '8'], r`$\int_0^2 x\,dx \cdot \int_0^2 y\,dy = 2 \cdot 2 = 4$.`, C2('x*y', 'true', [0, 2, 0, 2]));
q(2, r`Volumen del sólido $x^2 + y^2 \le 1$, $0 \le z \le 2 - x^2 - y^2$`, [r`\frac{3\pi}{2}`, r`\frac{10\pi}{3}`, r`3\pi`], r`$\int_0^{2\pi}\!\int_0^1 (2 - r^2)\,r\,dr\,d\theta$. $\int_0^1 (2r - r^3)\,dr = \frac34$, por $2\pi$: $\frac{3\pi}{2}$.`, C2(`2-${R2}`, `${R2}<=1`, disk(1)));
q(2, r`Volumen bajo el plano $z = 6 - 2x - 3y$ en el primer octante`, ['6', '18', '36'], r`Es un tetraedro que corta los ejes en $3$, $2$ y $6$. $V = \frac16 \cdot 3 \cdot 2 \cdot 6 = 6$.`, C2('max(0,6-2*x-3*y)', 'true', [0, 3, 0, 2]));
q(2, r`Volumen bajo $z = \sqrt{x^2 + y^2}$ sobre el disco $x^2 + y^2 \le 9$`, [r`18\pi`, r`9\pi`, r`27\pi`], r`$\int_0^{2\pi}\!\int_0^3 r \cdot r\,dr\,d\theta = 2\pi \cdot 9 = 18\pi$.`, C2(`sqrt(${R2})`, `${R2}<=9`, disk(3)));

q(3, r`Volumen entre el paraboloide $z = x^2 + y^2$ y el plano $z = 9$`, [r`\frac{81\pi}{2}`, r`36\pi`, r`81\pi`], r`Se cortan en $r = 3$: $\int_0^{2\pi}\!\int_0^3 (9 - r^2)\,r\,dr\,d\theta$. $\int_0^3 (9r - r^3)\,dr = \frac{81}{4}$, por $2\pi$: $\frac{81\pi}{2}$.`, C2(`9-${R2}`, `${R2}<=9`, disk(3)));
q(3, r`Volumen dentro de la esfera $\rho = 2$ y sobre el cono $\phi = \frac{\pi}{4}$`, [r`\frac{8\pi}{3}(2 - \sqrt{2})`, r`2\pi(2 - \sqrt{2})`, r`\frac{16\pi}{3}`], r`$\int_0^{2\pi}\!\int_0^{\pi/4}\!\int_0^2 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$. $2\pi \cdot \left(1 - \frac{\sqrt2}{2}\right) \cdot \frac83 = \frac{8\pi}{3}(2 - \sqrt2)$.`, C2(`sqrt(max(0,4-${R2}))-sqrt(${R2})`, `${R2}<=2`, disk(1.42)));
q(3, r`Volumen entre $z = x^2 + y^2$ y $z = 2 - x^2 - y^2$`, [r`\pi`, r`\frac{8\pi}{3}`, r`2\pi`], r`Se cortan en $r = 1$: $\int_0^{2\pi}\!\int_0^1 (2 - 2r^2)\,r\,dr\,d\theta$. $\int_0^1 (2r - 2r^3)\,dr = \frac12$, por $2\pi$: $\pi$.`, C2(`2-2*(${R2})`, `${R2}<=1`, disk(1)));
q(3, r`Volumen del sólido $x^2 + y^2 \le 4$ entre $z = 0$ y $z = y + 2$`, [r`8\pi`, r`4\pi`, r`16\pi`], r`$\iint_D (y + 2)\,dA$. Por simetría $\iint_D y\,dA = 0$ y queda $2 \cdot \text{área} = 2 \cdot 4\pi = 8\pi$.`, C2('y+2', `${R2}<=4`, disk(2)));
q(3, r`Volumen dentro del cilindro $x^2 + y^2 = 1$ y de la esfera $x^2 + y^2 + z^2 = 4$`, [r`\frac{4\pi}{3}(8 - 3\sqrt{3})`, r`\frac{2\pi}{3}(8 - 3\sqrt{3})`, r`\frac{32\pi}{3}`], r`$\int_0^{2\pi}\!\int_0^1 2\sqrt{4 - r^2}\,r\,dr\,d\theta$. $\int_0^1 r\sqrt{4 - r^2}\,dr = \frac{8 - 3\sqrt3}{3}$, por $4\pi$: $\frac{4\pi}{3}(8 - 3\sqrt3)$. No olvides la mitad de abajo.`, C2(`2*sqrt(4-${R2})`, `${R2}<=1`, disk(1)));
q(3, r`Volumen del cono sólido $\sqrt{x^2 + y^2} \le z \le 2$`, [r`\frac{8\pi}{3}`, r`4\pi`, r`8\pi`], r`$\int_0^{2\pi}\!\int_0^2 (2 - r)\,r\,dr\,d\theta$. $\int_0^2 (2r - r^2)\,dr = \frac43$, por $2\pi$: $\frac{8\pi}{3}$.`, C2(`2-sqrt(${R2})`, `${R2}<=4`, disk(2)));

q(4, r`Volumen del sólido limitado por $z = x^2 + y^2$ y $z = 2x$`, [r`\frac{\pi}{2}`, r`\pi`, r`2\pi`], r`Se cortan sobre $(x - 1)^2 + y^2 = 1$. Con el centro en $(1, 0)$: $\int_0^{2\pi}\!\int_0^1 (1 - r^2)\,r\,dr\,d\theta = 2\pi \cdot \frac14 = \frac{\pi}{2}$.`, C2(`2*x-${R2}`, '(x-1)**2+y*y<=1', [0, 2, -1, 1]));
q(4, r`Volumen del casquete de la esfera $x^2 + y^2 + z^2 \le 4$ sobre el plano $z = 1$`, [r`\frac{5\pi}{3}`, r`3\pi`, r`\frac{16\pi}{3}`], r`Por discos de radio $\sqrt{4 - z^2}$: $\int_1^2 \pi(4 - z^2)\,dz = \pi\left(4 - \frac73\right) = \frac{5\pi}{3}$.`, C2(`sqrt(max(0,4-${R2}))-1`, `${R2}<=3`, disk(1.74)));
q(4, r`Volumen entre las esferas $\rho = 1$ y $\rho = 2$, sobre el cono $\phi = \frac{\pi}{3}$`, [r`\frac{7\pi}{3}`, r`\frac{3\pi}{2}`, r`\frac{14\pi}{3}`], r`$\int_0^{2\pi}\!\int_0^{\pi/3}\!\int_1^2 \rho^2\sin\phi\,d\rho\,d\phi\,d\theta$. $2\pi \cdot \left(1 - \frac12\right) \cdot \frac73 = \frac{7\pi}{3}$.`, C3('1', `${S2}>=1 && ${S2}<=4 && z>=0.5*sqrt(${S2})`, [-2, 2, -2, 2, 0, 2]));
q(4, r`Volumen bajo $z = x^2 + y^2$ sobre el anillo $1 \le x^2 + y^2 \le 4$`, [r`\frac{15\pi}{2}`, r`\frac{14\pi}{3}`, r`15\pi`], r`$\int_0^{2\pi}\!\int_1^2 r^2 \cdot r\,dr\,d\theta$. $\int_1^2 r^3\,dr = \frac{15}{4}$, por $2\pi$: $\frac{15\pi}{2}$.`, C2(R2, `${R2}>=1 && ${R2}<=4`, disk(2)));
q(4, r`Volumen dentro de la esfera $x^2 + y^2 + z^2 = 4z$ y sobre el cono $z = \sqrt{x^2 + y^2}$`, [r`8\pi`, r`\frac{32\pi}{3}`, r`\frac{16\pi}{3}`], r`La esfera es $\rho = 4\cos\phi$ y el cono $\phi = \frac{\pi}{4}$. $\int_0^{2\pi}\!\int_0^{\pi/4}\!\int_0^{4\cos\phi} \rho^2\sin\phi\,d\rho\,d\phi\,d\theta = 2\pi \cdot \frac{64}{3} \cdot \frac{3}{16} = 8\pi$.`, C3('1', `${S2}<=4*z && z>=sqrt(${R2})`, [-2, 2, -2, 2, 0, 4]));

const dir = new URL('../server/src/questions/bank/', import.meta.url);
for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) fs.unlinkSync(new URL(f, dir));
for (const [tema, list] of Object.entries(out)) {
  fs.writeFileSync(new URL(`${tema}.json`, dir), `${JSON.stringify(list, null, 2)}\n`);
  console.log(tema, list.length, [1, 2, 3, 4].map((d) => list.filter((x) => x.dificultad === d).length).join('/'));
}
