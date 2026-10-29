import { useEffect, useMemo, useRef, useState } from 'react';
import IMAGES from './loading-manifest.json' with { type: 'json' };
import Logo from './Logo.jsx';
import MathText from './MathText.jsx';

// Pantalla de carga (7A): todas las imágenes de client/public/assets/loading/ (loading-manifest.json)
// en orden aleatorio cada 6 s, con acercamiento lento, leve paralaje y partículas; sin imágenes, un
// fondo generado con el mismo efecto. Encima, un dato de cálculo que rota con la imagen.
//   needClick: se queda al menos minMs y después aparece "Continuar" (al abrir y al entrar a una sala)
//   sin needClick: avanza sola cuando ready y pasaron minMs (al entrar a la partida)
const SLIDE_MS = 6_000;

export const FACTS = [
  '¿Sabías que el gradiente apunta hacia donde la función crece más rápido?',
  'La derivada direccional en la dirección unitaria $\\mathbf u$ es $D_{\\mathbf u}f=\\nabla f\\cdot\\mathbf u$.',
  'La derivada direccional más grande vale $\\lVert\\nabla f\\rVert$ y va en la dirección del gradiente.',
  'Perpendicular al gradiente la derivada direccional es $0$: ahí caminas por una curva de nivel.',
  'El gradiente siempre es perpendicular a las curvas de nivel.',
  'Para usar $\\nabla f\\cdot\\mathbf u$, el vector $\\mathbf u$ tiene que ser unitario: divídelo por su norma.',
  'En un extremo con restricción $g=k$ se cumple $\\nabla f=\\lambda\\nabla g$.',
  'En el óptimo de Lagrange, los gradientes de $f$ y de $g$ son paralelos.',
  '$\\lambda$ dice cuánto cambia el valor óptimo si la restricción cambia un poquito.',
  'Con dos restricciones: $\\nabla f=\\lambda\\nabla g+\\mu\\nabla h$.',
  'Lagrange da candidatos: evalúa $f$ en todos y compara cuál es el mayor y el menor.',
  'Por el teorema de Fubini, en un rectángulo puedes integrar en el orden que quieras.',
  '$\\iint_R 1\\,dA$ es el área de la región $R$.',
  'Si $f\\ge 0$, $\\iint_R f\\,dA$ es el volumen bajo la superficie.',
  'En polares $dA=r\\,dr\\,d\\theta$: no olvides la $r$.',
  'El valor promedio de $f$ en $R$ es $\\frac{1}{\\text{Área}(R)}\\iint_R f\\,dA$.',
  'En un punto crítico $\\nabla f=\\mathbf 0$ (o alguna derivada parcial no existe).',
  'Si $D=f_{xx}f_{yy}-f_{xy}^2>0$ y $f_{xx}>0$, hay un mínimo local.',
  'Si $D<0$ en un punto crítico, es un punto de silla.',
  'Si $D=0$, la prueba de la segunda derivada no decide nada.',
  'En una región cerrada y acotada, una función continua alcanza máximo y mínimo absolutos: revisa también el borde.',
];

// Orden aleatorio sin repetir hasta dar la vuelta
const shuffled = (n) => {
  const out = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Partículas de polvo o luz: posiciones fijas por pantalla (CSS anima el resto)
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 100}%`,
  size: 2 + (i % 4),
  delay: `${-(i * 0.7) % 9}s`,
  duration: `${8 + (i % 5) * 2}s`,
}));

export default function LoadingScreen({ minMs = 8_000, needClick = true, ready = true, onDone, title = 'Cargando' }) {
  const [start] = useState(() => performance.now());
  const [now, setNow] = useState(start);
  const order = useMemo(() => ({ images: shuffled(IMAGES.length), facts: shuffled(FACTS.length) }), []);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const done = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, []);
  const elapsed = now - start;
  const slide = Math.floor(elapsed / SLIDE_MS);
  const canGo = elapsed >= minMs && ready;
  useEffect(() => {
    if (!needClick && canGo && !done.current) {
      done.current = true;
      onDone?.();
    }
  }, [needClick, canGo, onDone]);

  // Las imágenes se piden antes de que toquen (la siguiente ya está en caché al cambiar)
  useEffect(() => {
    const next = IMAGES[order.images[(slide + 1) % Math.max(1, IMAGES.length)]];
    if (next) new Image().src = next;
  }, [slide, order]);

  const image = IMAGES.length ? IMAGES[order.images[slide % IMAGES.length]] : null;
  const fact = FACTS[order.facts[slide % FACTS.length]];
  // Barra: avanza con el tiempo mínimo y se completa cuando todo está listo
  const progress = Math.min(ready ? 1 : 0.9, elapsed / minMs);

  return (
    <div
      role="dialog"
      aria-label="Pantalla de carga"
      className="fixed inset-0 z-[100] overflow-hidden bg-olive-950 text-stone-100"
      onPointerMove={(e) => setTilt({ x: e.clientX / innerWidth - 0.5, y: e.clientY / innerHeight - 0.5 })}
    >
      {/* Fondo: imagen con acercamiento lento (o uno generado), con un leve paralaje */}
      <div className="absolute -inset-[4%]" style={{ transform: `translate(${tilt.x * -18}px, ${tilt.y * -12}px)`, transition: 'transform 0.6s ease-out' }}>
        <div key={slide} className="absolute inset-0 animate-[loadzoom_6s_linear_forwards]">
          {image ? (
            <img src={image} alt="" className="h-full w-full animate-[loadfade_0.8s_ease-out] object-cover" draggable={false} />
          ) : (
            <div
              className="h-full w-full animate-[loadfade_0.8s_ease-out]"
              style={{
                background: [
                  `radial-gradient(ellipse at ${30 + (slide * 17) % 40}% ${35 + (slide * 23) % 30}%, rgba(249,115,22,0.28), transparent 45%)`,
                  'radial-gradient(ellipse at 70% 80%, rgba(168,144,96,0.25), transparent 50%)',
                  'repeating-radial-gradient(circle at 60% 40%, rgba(255,255,255,0.05) 0 1px, transparent 1px 28px)',
                  'linear-gradient(160deg, #2c3418, #10140a 70%)',
                ].join(','),
              }}
            />
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />
      {/* Partículas de polvo o luz */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: `translate(${tilt.x * 10}px, ${tilt.y * 8}px)` }}>
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute animate-[loaddust_10s_ease-in-out_infinite] rounded-full bg-amber-100/50"
            style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDelay: p.delay, animationDuration: p.duration }}
          />
        ))}
      </div>

      <div className="relative flex h-full flex-col justify-between p-[max(1rem,env(safe-area-inset-top))_max(1rem,env(safe-area-inset-right))_max(1rem,env(safe-area-inset-bottom))_max(1rem,env(safe-area-inset-left))]">
        <div className="flex items-center gap-3">
          <Logo className="h-12 w-12 sm:h-16 sm:w-16" />
          <p className="text-2xl font-black uppercase tracking-tight sm:text-4xl">
            Cálculo <span className="text-khaki">Royale</span>
          </p>
        </div>
        <div className="mx-auto w-full max-w-2xl">
          <div key={slide} className="mb-4 animate-[loadfade_0.8s_ease-out] rounded-lg border-l-4 border-orange-400 bg-black/55 px-4 py-3 backdrop-blur-sm">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-orange-300">Dato de cálculo</p>
            <MathText text={fact} className="block text-[clamp(0.95rem,2.6vw,1.25rem)] leading-snug" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded bg-black/60">
              <div className="h-full bg-gradient-to-r from-khaki to-orange-400 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
            </div>
            {needClick && canGo ? (
              <button onClick={() => !done.current && ((done.current = true), onDone?.())} className="animate-[loadfade_0.4s_ease-out] rounded-lg bg-khaki px-5 py-2 font-black uppercase tracking-wider text-olive-950 shadow-lg">
                Continuar ▸
              </button>
            ) : (
              <span className="w-28 text-right font-mono text-xs uppercase tracking-widest text-stone-300">{title}…</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
