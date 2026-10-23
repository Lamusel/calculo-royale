import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';

// Radar de la racha: flechas en el borde de la pantalla hacia cada enemigo vivo.
// La cámara mira desde el sur, así que "arriba en pantalla" es +y del mapa.
export default function RadarOverlay({ me, others, myId, secondsLeft }) {
  if (!me) return null;
  const arrows = [];
  for (const [id, p] of others) {
    if (id === myId || p.flags & PLAYER_FLAGS.DEAD) continue;
    const dx = p.x - me.x;
    const dy = p.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) continue; // ya se ve en pantalla
    const a = Math.atan2(dy, dx);
    arrows.push({ id, a, dist, left: 50 + Math.cos(a) * 45, top: 50 - Math.sin(a) * 40 });
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <p className="absolute left-1/2 top-16 -translate-x-1/2 rounded bg-sky-900/70 px-3 py-0.5 font-mono text-xs uppercase tracking-widest text-sky-200">
        Radar {secondsLeft} s
      </p>
      {arrows.map((r) => (
        <div
          key={r.id}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: `${r.left}%`, top: `${r.top}%` }}
        >
          <div className="text-xl leading-none text-red-400 drop-shadow" style={{ transform: `rotate(${-r.a}rad)` }}>
            ➤
          </div>
          <span className="font-mono text-[10px] text-red-200">{Math.round(r.dist)} m</span>
        </div>
      ))}
    </div>
  );
}
