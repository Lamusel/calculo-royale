import { ZONE_PHASES } from '@calculo-royale/shared/constants';
import { insideZone, zoneInequality } from '@calculo-royale/shared/zone';
import MathText from './MathText.jsx';
import { currentMessage } from './messageQueue.js';

const KIND_STYLE = {
  zone: 'border-orange-400',
  closing: 'border-red-500',
  final: 'border-red-500',
  airdrop: 'border-yellow-400',
};

// Banner grande solo para la zona (6.5); los demás avisos del Mando son toasts de 2,5 s en una esquina
const BANNER = new Set(['zone', 'closing', 'final']);
const TOAST_MS = 2_500;

export function RadioFeed({ radio }) {
  const now = performance.now();
  const toasts = radio.filter((m) => !BANNER.has(m.kind) && now - m.at < TOAST_MS).slice(-3);
  return (
    <>
      <ZoneBanner radio={radio.filter((m) => BANNER.has(m.kind))} now={now} />
      {toasts.length > 0 && (
        <div className="pointer-events-none absolute bottom-[45%] right-3 z-30 flex w-[min(44vw,18rem)] flex-col items-end gap-1">
          {toasts.map((m, i) => (
            <div key={`${m.at}-${i}`} className={`rounded border-l-4 bg-black/75 px-2 py-1 text-xs text-stone-100 shadow ${KIND_STYLE[m.kind] ?? 'border-khaki'}`}>
              <b className="text-khaki-light">📻 {m.title}:</b> <MathText text={m.text} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Transmisión de zona: una a la vez, por prioridad (messageQueue.js), bajo la barra superior
function ZoneBanner({ radio, now }) {
  const current = currentMessage(radio, now);
  if (!current) return null;
  const last = current.message;
  const fading = now > current.end - 800;
  return (
    <div
      className={`pointer-events-none absolute left-1/2 z-30 w-[min(64vw,36rem)] -translate-x-1/2 transition-opacity duration-700 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ top: `calc(max(0.5rem, env(safe-area-inset-top)) + 2.6rem)` }}
    >
      <div className={`rounded border-l-4 bg-black/75 px-3 py-2 text-stone-100 shadow-lg ${KIND_STYLE[last.kind] ?? 'border-khaki'}`}>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-khaki-light">📻 Centro de mando · {last.title}</p>
        <MathText text={last.text} className="block max-h-[4.5em] overflow-hidden text-[clamp(0.75rem,2.2vw,1rem)] leading-snug" />
      </div>
    </div>
  );
}

const clock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Estado de la zona bajo el GPS y aviso grande si estás afuera
export function ZoneStatus({ zone, me, alive, mapSize }) {
  if (!zone?.length) return null;
  const [cx, cy, p, q, nx, ny, np, nq, phase, msLeft, closing, moving, msToEnd] = zone;
  // Antes de la primera zona: cuenta regresiva; en las finales la zona se desplaza
  const verb = moving ? (closing ? 'se desplaza' : 'se mueve en') : closing ? 'se cierra' : 'cierra en';
  const label = phase < 0 ? `Primera zona en ${clock(msLeft)}` : `Zona ${phase + 1}/${ZONE_PHASES.length} · ${verb} ${clock(msLeft)}`;
  const outside = me && alive && !insideZone({ cx, cy, p, q }, me.x, me.y);
  const next = { cx: nx, cy: ny, p: np, q: nq };
  return (
    <>
      <p
        className="pointer-events-none absolute z-20 rounded bg-black/55 px-2 py-0.5 font-mono text-[11px] text-stone-200"
        style={{ top: 48, left: 12 + mapSize + 8 }}
      >
        {label}
        {msToEnd > 0 && <span className="text-stone-400"> · fin ≈ {clock(msToEnd)}</span>}
      </p>
      {outside && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 animate-pulse shadow-[inset_0_0_90px_rgba(220,38,38,0.55)]" />
          <div className="pointer-events-none absolute bottom-[8.5rem] left-1/2 z-20 -translate-x-1/2 rounded bg-red-950/85 px-3 py-1 text-center text-sm text-red-100">
            <b>FUERA DE LA ZONA</b> · vuelve a <MathText text={`$${zoneInequality(next)}$`} />
          </div>
        </>
      )}
    </>
  );
}
