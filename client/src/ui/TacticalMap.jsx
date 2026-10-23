import { useEffect, useRef, useState } from 'react';
import { JEEP, MAP_HALF, MAP_SIZE, NIGHT_REVEAL_MS, SECTORS } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS, VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import { HOUSES, OBSTACLES } from '@calculo-royale/shared/mapLayout';
import { sectorOf, zoneInequality } from '@calculo-royale/shared/zone';
import MathText from './MathText.jsx';

// Mapa táctico: plano cartesiano del mapa con ejes, coordenadas y sectores A1–F6.
// Muestra la zona actual (borde rojo, afuera sombreado) y la siguiente (blanca punteada),
// tu posición, alarmas, el lanzamiento aéreo y, con radar, a los enemigos.
// También: el líder (corona), los jeeps encendidos cercanos (hacen ruido) y, de noche,
// a quien acaba de disparar (el fogonazo lo delata).

const CONTAINERS = OBSTACLES.filter((o) => o.kind === 'container');

export function draw(ctx, size, data, detailed) {
  const s = size / MAP_SIZE;
  const X = (x) => (x + MAP_HALF) * s;
  const Y = (y) => (MAP_HALF - y) * s;
  const now = performance.now();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#2f3a1e';
  ctx.fillRect(0, 0, size, size);

  // Pueblo y contenedores como referencia
  ctx.fillStyle = 'rgba(214, 196, 150, 0.55)';
  for (const h of HOUSES) ctx.fillRect(X(h.x - h.w / 2), Y(h.y + h.h / 2), h.w * s, h.h * s);
  ctx.fillStyle = 'rgba(160, 120, 90, 0.6)';
  for (const c of CONTAINERS) ctx.fillRect(X(c.x - c.w / 2), Y(c.y + c.h / 2), c.w * s, c.h * s);

  // Sectores
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < SECTORS; i++) {
    const t = (i / SECTORS) * size;
    ctx.beginPath();
    ctx.moveTo(t, 0);
    ctx.lineTo(t, size);
    ctx.moveTo(0, t);
    ctx.lineTo(size, t);
    ctx.stroke();
  }

  // Ejes x e y con marcas cada 20
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(0, Y(0));
  ctx.lineTo(size, Y(0));
  ctx.moveTo(X(0), 0);
  ctx.lineTo(X(0), size);
  ctx.stroke();
  if (detailed) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.max(10, size / 45)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    for (let v = -40; v <= 40; v += 20) {
      if (v === 0) continue;
      ctx.fillText(String(v), X(v), Y(0) + 14);
      ctx.fillText(String(v), X(0) - 14, Y(v) + 4);
    }
    ctx.fillText('x', size - 10, Y(0) - 6);
    ctx.fillText('y', X(0) + 10, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < SECTORS; i++) {
      ctx.fillText(String.fromCharCode(65 + i), ((i + 0.5) / SECTORS) * size, size - 6);
      ctx.fillText(String(i + 1), 10, ((i + 0.5) / SECTORS) * size + 4);
    }
  }

  // Zona: afuera sombreado de rojo, borde rojo; la siguiente, blanca punteada
  const zone = data.zone;
  if (zone?.length) {
    const [cx, cy, p, q, nx, ny, np, nq] = zone;
    ctx.save();
    ctx.fillStyle = 'rgba(200, 40, 30, 0.28)';
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.ellipse(X(cx), Y(cy), p * s, q * s, 0, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
    ctx.strokeStyle = '#ff5a36';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(X(cx), Y(cy), p * s, q * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(X(nx), Y(ny), np * s, nq * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Alarmas de cajas falladas
  for (const [x, y] of data.alarms ?? []) {
    const r = 4 + 3 * Math.abs(Math.sin(now / 150));
    ctx.strokeStyle = '#ff2a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(x), Y(y), r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Lanzamiento aéreo
  if (data.airdrop?.length) {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(X(data.airdrop[0]) - 4, Y(data.airdrop[1]) - 4, 8, 8);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(X(data.airdrop[0]) - 4, Y(data.airdrop[1]) - 4, 8, 8);
  }

  // Bombardeo anunciado: el sector en rojo
  if (data.bombing?.length) {
    const name = data.bombing[0];
    const col = name.charCodeAt(0) - 65;
    const row = Number(name.slice(1)) - 1;
    const cell = size / SECTORS;
    ctx.fillStyle = `rgba(255, 30, 30, ${0.35 + 0.25 * Math.sin(now / 100)})`;
    ctx.fillRect(col * cell, row * cell, cell, cell);
  }

  // Centro de la próxima zona, si ganaste una intercepción
  if (data.intel) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    const ix = X(data.intel.cx);
    const iy = Y(data.intel.cy);
    ctx.beginPath();
    ctx.moveTo(ix - 6, iy);
    ctx.lineTo(ix + 6, iy);
    ctx.moveTo(ix, iy - 6);
    ctx.lineTo(ix, iy + 6);
    ctx.stroke();
  }

  // Enemigos (solo con radar)
  if (data.radar) {
    ctx.fillStyle = '#f87171';
    for (const [id, p] of data.others ?? []) {
      if (id === data.myId || p.flags & PLAYER_FLAGS.DEAD) continue;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Jeeps encendidos con conductor a menos de noiseRadius: se oyen
  if (data.me) {
    for (const v of data.vehicles?.values() ?? []) {
      const near = Math.hypot(v.x - data.me.x, v.y - data.me.y) <= JEEP.noiseRadius;
      if (!near || v.state !== VEHICLE_STATE.READY || !v.driver || v.id === data.myVehicleId) continue;
      const r = 5 + 2 * Math.sin(now / 90);
      ctx.strokeStyle = 'rgba(253, 186, 116, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(v.x), Y(v.y), r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(X(v.x) - 3, Y(v.y) - 2, 6, 4);
    }
  }

  // De noche, quien disparó hace poco queda marcado
  if (data.night && data.lastShot) {
    ctx.fillStyle = '#fef08a';
    for (const [id, at] of data.lastShot) {
      const p = data.others?.get(id);
      if (id === data.myId || !p || p.flags & PLAYER_FLAGS.DEAD || now - at > NIGHT_REVEAL_MS) continue;
      ctx.globalAlpha = 1 - (now - at) / NIGHT_REVEAL_MS;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Líder: corona dorada (todos lo ven)
  for (const p of data.others?.values() ?? []) {
    if (!(p.flags & PLAYER_FLAGS.LEADER) || p.flags & PLAYER_FLAGS.DEAD) continue;
    const x = X(p.x);
    const y = Y(p.y);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 4);
    ctx.lineTo(x - 6, y - 3);
    ctx.lineTo(x - 3, y);
    ctx.lineTo(x, y - 5);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x + 6, y - 3);
    ctx.lineTo(x + 6, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Ruta del bus de despliegue (punteada) y el bus
  if (data.deployRoute) {
    const [x0, y0, x1, y1] = data.deployRoute;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(x0), Y(y0));
    ctx.lineTo(X(x1), Y(y1));
    ctx.stroke();
    ctx.setLineDash([]);
    if (data.bus) {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X(data.bus.x), Y(data.bus.y), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Punto elegido para caer (modo elegir punto)
  if (data.pick) {
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    const px = X(data.pick.x);
    const py = Y(data.pick.y);
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.moveTo(px - 12, py);
    ctx.lineTo(px + 12, py);
    ctx.moveTo(px, py - 12);
    ctx.lineTo(px, py + 12);
    ctx.stroke();
  }

  // Tú: flecha amarilla hacia donde apuntas
  if (data.me) {
    const { x, y, aim } = data.me;
    ctx.save();
    ctx.translate(X(x), Y(y));
    ctx.rotate(-aim);
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function useMapCanvas(frameRef, extra, size, detailed) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    let raf;
    let last = 0;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 100) return; // 10 Hz alcanza
      last = t;
      const f = frameRef.current;
      draw(ctx, size, { ...f, ...extra.current }, detailed);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [frameRef, extra, size, detailed]);
  return ref;
}

function BigMap({ frameRef, extra, onClose, radio }) {
  const size = Math.min(window.innerHeight - 24, window.innerWidth - 24, 720);
  const ref = useMapCanvas(frameRef, extra, size, true);
  const zone = frameRef.current.zone;
  const next = zone?.length ? { cx: zone[4], cy: zone[5], p: zone[6], q: zone[7] } : null;
  const me = frameRef.current.me;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center gap-4 bg-black/75 p-3" onPointerUp={onClose}>
      <canvas ref={ref} style={{ width: size, height: size }} className="rounded border border-khaki-dark" />
      <div className="hidden max-w-xs flex-col gap-2 text-sm text-stone-200 md:flex">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-khaki-light">Mapa táctico</p>
        {me && (
          <p>
            Tu posición: <b>({Math.round(me.x)}, {Math.round(me.y)})</b> · sector <b>{sectorOf(me.x, me.y)}</b>
          </p>
        )}
        {next && (
          <p>
            Próxima zona: <MathText text={`$${zoneInequality(next)}$`} />
          </p>
        )}
        <p className="text-xs text-stone-400">
          Rojo: zona actual · blanco punteado: la siguiente · amarillo: lanzamiento aéreo · corona: el líder · naranja: jeep cercano
        </p>
        {radio.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
            {radio.slice(-4).map((m) => (
              <p key={m.at} className="text-xs text-stone-300">
                <b className="text-khaki-light">{m.title}:</b> <MathText text={m.text} />
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-stone-500">Toca para cerrar</p>
      </div>
    </div>
  );
}

export const minimapSize = (isTouch) => (isTouch ? 104 : 140);

// Minimapa en la esquina; al tocarlo se abre el mapa grande
export default function TacticalMap({ frameRef, myId, radar, radio, isTouch, intel, night = false, lastShot = null, deployRoute = null }) {
  const [open, setOpen] = useState(false);
  const extra = useRef({});
  extra.current = { myId, radar, intel, night, lastShot, deployRoute };
  const size = minimapSize(isTouch);
  const ref = useMapCanvas(frameRef, extra, size, false);
  return (
    <>
      <canvas
        ref={ref}
        onPointerUp={() => setOpen(true)}
        style={{ width: size, height: size }}
        className="absolute left-3 top-12 z-20 cursor-pointer rounded border border-khaki-dark/70 opacity-90"
      />
      {open && <BigMap frameRef={frameRef} extra={extra} radio={radio} onClose={() => setOpen(false)} />}
    </>
  );
}
