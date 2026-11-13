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
  '¿Sabías que el jacobiano dice cuánto se estira o se encoge un área al cambiar de variables?',
  'Al cambiar de variables: $\\iint_R f\\,dA=\\iint_S f\\,|J|\\,du\\,dv$. Va el valor absoluto de $J$.',
  'En polares $dA=r\\,dr\\,d\\theta$: no olvides la $r$.',
  'En cilíndricas $dV=r\\,dz\\,dr\\,d\\theta$: son polares con altura.',
  'En esféricas $dV=\\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta$.',
  'En esféricas $\\phi$ va de $0$ a $\\pi$; el que da la vuelta completa es $\\theta$, de $0$ a $2\\pi$.',
  'Los jacobianos de una transformación y de su inversa son recíprocos: $\\frac{\\partial(x,y)}{\\partial(u,v)}=1\\Big/\\frac{\\partial(u,v)}{\\partial(x,y)}$.',
  'Con $u=x+y$, $v=x-y$ un paralelogramo se vuelve rectángulo, y $|J|=\\frac{1}{2}$.',
  'Una transformación lineal multiplica todas las áreas por $|ad-bc|$.',
  '$\\iint_R 1\\,dA$ es el área de $R$ y $\\iiint_E 1\\,dV$ es el volumen de $E$.',
  'Si $f\\ge 0$, $\\iint_R f\\,dA$ es el volumen bajo la superficie $z=f(x,y)$.',
  'El volumen entre dos superficies es $\\iint_R(\\text{techo}-\\text{piso})\\,dA$.',
  'Esfera: usa esféricas. Cilindro, cono o paraboloide: usa cilíndricas.',
  'La masa de un sólido es $\\iiint_E \\delta\\,dV$, con $\\delta$ la densidad.',
  'El volumen de la esfera sale de una triple: $\\int_0^{2\\pi}\\!\\int_0^{\\pi}\\!\\int_0^R \\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta=\\frac{4}{3}\\pi R^3$.',
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
      <LoadingBackdrop slide={slide} image={image} tilt={tilt} />
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

// Fondo animado (también el de la portada): imagen con acercamiento lento o fondo generado, paralaje y polvo
export function LoadingBackdrop({ slide, image, tilt }) {
  return (
    <>
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

    </>
  );
}

// Fondo de la portada: rota solo las imágenes cada 6 s y sigue el puntero
export function MenuBackdrop() {
  const order = useMemo(() => shuffled(IMAGES.length), []);
  const [slide, setSlide] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => s + 1), SLIDE_MS);
    const move = (e) => setTilt({ x: e.clientX / innerWidth - 0.5, y: e.clientY / innerHeight - 0.5 });
    addEventListener('pointermove', move);
    return () => {
      clearInterval(id);
      removeEventListener('pointermove', move);
    };
  }, []);
  const image = IMAGES.length ? IMAGES[order[slide % IMAGES.length]] : null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <LoadingBackdrop slide={slide} image={image} tilt={tilt} />
    </div>
  );
}
