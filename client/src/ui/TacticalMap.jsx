import { useEffect, useRef, useState } from 'react';
import { MAP_HALF, MAP_SIZE, NIGHT_REVEAL_MS, SECTORS, vehicleType } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS, VEHICLE_STATE } from '@calculo-royale/shared/protocol';
import {
  AREAS, BRIDGES, DAM, HOUSES, OBSTACLES, PATHS, RAILWAY, RESERVOIR, RIVER, ROADS, RUNWAY, TOWERS, TREES, riverY,
} from '@calculo-royale/shared/mapLayout';
import { sectorOf, zoneInequality } from '@calculo-royale/shared/zone';
import MathText from './MathText.jsx';

// Mapa táctico: plano cartesiano del mapa con ejes, coordenadas y sectores A1–J10.
// Se dibuja desde el plano (mapLayout), no desde la escena 3D: funciona con los bloques lejanos sin cargar.
// El minimapa muestra un acercamiento alrededor del jugador; el mapa grande, todo.
// Muestra la zona actual (borde rojo, afuera sombreado) y la siguiente (blanca punteada),
// tu posición, alarmas, el lanzamiento aéreo y, con radar, a los enemigos.
// También: el líder (corona), los jeeps encendidos cercanos (hacen ruido) y, de noche,
// a quien acaba de disparar (el fogonazo lo delata).

const CONTAINERS = OBSTACLES.filter((o) => o.kind === 'container');
const SANDBAGS = OBSTACLES.filter((o) => o.kind === 'sandbag');
// Piezas del anillo exterior: buses, tribunas, puestos y paredes del cañón
const RING_COLORS = {
  bus: 'rgba(214, 162, 38, 0.8)', stand: 'rgba(181, 178, 164, 0.75)', stall: 'rgba(192, 57, 43, 0.7)', cliff: 'rgba(125, 95, 69, 0.95)',
  silo: 'rgba(200, 200, 195, 0.9)', dam: 'rgba(220, 218, 210, 0.95)', antenna: 'rgba(230, 60, 50, 0.95)', logs: 'rgba(122, 86, 52, 0.9)',
};
const RING_PIECES = OBSTACLES.filter((o) => RING_COLORS[o.kind]);
const NAMED = Object.values(AREAS).filter((a) => a.name);
const NAMED_KEYS = Object.keys(AREAS).filter((k) => AREAS[k].name);
const AREA_TINT = {
  city: 'rgba(160, 155, 140, 0.3)', base: 'rgba(150, 150, 130, 0.22)', forest: 'rgba(20, 50, 20, 0.45)', terminal: 'rgba(150, 150, 140, 0.25)',
  market: 'rgba(170, 150, 120, 0.25)', airfield: 'rgba(90, 90, 85, 0.3)', stadium: 'rgba(95, 154, 60, 0.35)', canyon: 'rgba(155, 122, 90, 0.35)',
  industrial: 'rgba(140, 130, 120, 0.3)', quarry: 'rgba(155, 122, 90, 0.35)', farm: 'rgba(170, 150, 80, 0.25)', hospital: 'rgba(220, 220, 215, 0.2)',
  university: 'rgba(170, 160, 140, 0.22)', suburb: 'rgba(170, 150, 120, 0.2)', dam: 'rgba(200, 200, 195, 0.2)',
};
// Píxeles por metro de la capa fija (se dibuja una sola vez)
const PXM = 2;
const FULL = { cx: 0, cy: 0, span: MAP_SIZE };

// Capa fija: terreno, agua, carreteras, árboles y edificios (desde el plano)
let staticLayer = null;
function buildStatic() {
  const size = MAP_SIZE * PXM;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const s = PXM;
  const X = (x) => (x + MAP_HALF) * s;
  const Y = (y) => (MAP_HALF - y) * s;
  ctx.fillStyle = '#2f3a1e';
  ctx.fillRect(0, 0, size, size);
  const line = (pts, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.stroke();
  };
  for (const k of NAMED_KEYS) {
    const a = AREAS[k];
    if (!AREA_TINT[k]) continue;
    ctx.fillStyle = AREA_TINT[k];
    ctx.fillRect(X(a.x - a.w / 2), Y(a.y + a.h / 2), a.w * s, a.h * s);
  }
  // Río, embalse, vía del tren, caminos, carreteras, pista y puentes
  const river = [];
  for (let x = DAM.x; x <= MAP_HALF; x += 5) river.push([x, riverY(x)]);
  line(river, '#3f7fb0', RIVER.halfWidth * 2 * s);
  ctx.fillStyle = '#3f7fb0';
  ctx.beginPath();
  ctx.ellipse(X(RESERVOIR.x), Y(RESERVOIR.y), RESERVOIR.rx * s, RESERVOIR.ry * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash([3 * s, 2 * s]);
  line([[RAILWAY.x0, RAILWAY.y], [RAILWAY.x1, RAILWAY.y]], 'rgba(70, 55, 40, 0.9)', 2.5 * s);
  ctx.setLineDash([]);
  for (const path of PATHS) line(path, 'rgba(180, 150, 100, 0.55)', 1.6 * s);
  for (const road of ROADS) line(road, 'rgba(70, 70, 66, 0.95)', 6 * s);
  ctx.fillStyle = 'rgba(70, 70, 66, 0.95)';
  ctx.fillRect(X(RUNWAY.x - RUNWAY.w / 2), Y(RUNWAY.y + RUNWAY.h / 2), RUNWAY.w * s, RUNWAY.h * s);
  ctx.fillStyle = 'rgba(205, 200, 185, 0.95)';
  for (const b of [...BRIDGES, DAM]) ctx.fillRect(X(b.x - b.w / 2), Y(b.y + b.h / 2), b.w * s, b.h * s);
  ctx.fillStyle = 'rgba(20, 45, 18, 0.9)';
  for (const t of TREES) ctx.fillRect(X(t.x) - 2, Y(t.y) - 2, 4, 4);
  ctx.fillStyle = 'rgba(190, 165, 110, 0.85)';
  for (const b of SANDBAGS) ctx.fillRect(X(b.x - b.w / 2), Y(b.y + b.h / 2), Math.max(1, b.w * s), Math.max(1, b.h * s));
  ctx.fillStyle = 'rgba(110, 86, 54, 0.95)';
  for (const t of TOWERS) ctx.fillRect(X(t.x) - 4, Y(t.y) - 4, 8, 8);
  ctx.fillStyle = 'rgba(214, 196, 150, 0.7)';
  for (const h of HOUSES) ctx.fillRect(X(h.x - h.w / 2), Y(h.y + h.h / 2), h.w * s, h.h * s);
  ctx.fillStyle = 'rgba(160, 120, 90, 0.7)';
  for (const c of CONTAINERS) ctx.fillRect(X(c.x - c.w / 2), Y(c.y + c.h / 2), c.w * s, c.h * s);
  for (const o of RING_PIECES) {
    ctx.fillStyle = RING_COLORS[o.kind];
    const w = o.shape === 'circle' ? o.r * 2 : o.w;
    const h = o.shape === 'circle' ? o.r * 2 : o.h;
    ctx.fillRect(X(o.x - w / 2), Y(o.y + h / 2), Math.max(1, w * s), Math.max(1, h * s));
  }
  return canvas;
}

// view: { cx, cy, span } en metros (el minimapa sigue al jugador; el mapa grande muestra todo)
export function draw(ctx, size, data, detailed, view = FULL) {
  const span = view.span;
  const s = size / span;
  const ox = view.cx - span / 2;
  const oy = view.cy + span / 2;
  const X = (x) => (x - ox) * s;
  const Y = (y) => (oy - y) * s;
  const now = performance.now();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#2f3a1e';
  ctx.fillRect(0, 0, size, size);
  staticLayer ??= buildStatic();
  ctx.drawImage(staticLayer, (ox + MAP_HALF) * PXM, (MAP_HALF - oy) * PXM, span * PXM, span * PXM, 0, 0, size, size);

  // Sectores
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < SECTORS; i++) {
    const v = -MAP_HALF + (i * MAP_SIZE) / SECTORS;
    ctx.beginPath();
    ctx.moveTo(X(v), 0);
    ctx.lineTo(X(v), size);
    ctx.moveTo(0, Y(v));
    ctx.lineTo(size, Y(v));
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
    for (let v = -400; v <= 400; v += 200) {
      if (v === 0) continue;
      ctx.fillText(String(v), X(v), Y(0) + 14);
      ctx.fillText(String(v), X(0) - 14, Y(v) + 4);
    }
    ctx.fillText('x', size - 10, Y(0) - 6);
    ctx.fillText('y', X(0) + 10, 14);
    // Nombres de las zonas
    ctx.fillStyle = 'rgba(253, 230, 138, 0.9)';
    // 28 zonas: las grandes en mayúsculas y más grandes, las pequeñas discretas
    const FONT = { big: 48, mid: 62, small: 78 };
    for (const a of NAMED) {
      ctx.font = `bold ${Math.max(8, size / FONT[a.size])}px system-ui, sans-serif`;
      ctx.fillText(a.size === 'small' ? a.name : a.name.toUpperCase(), X(a.x), Y(a.y + a.h / 2) - 3);
    }
    ctx.font = `${Math.max(10, size / 45)}px ui-monospace, monospace`;
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
    // Zona que se desplaza: flecha del centro actual al final y la posición final marcada
    if (zone[11] === 1 && Math.hypot(nx - cx, ny - cy) > 2) {
      const ax = X(cx);
      const ay = Y(cy);
      const bx = X(nx);
      const by = Y(ny);
      const ang = Math.atan2(by - ay, bx - ax);
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 9 * Math.cos(ang - 0.45), by - 9 * Math.sin(ang - 0.45));
      ctx.lineTo(bx - 9 * Math.cos(ang + 0.45), by - 9 * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
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

  // Marcados por un UAV (rombo amarillo) o un sensor de movimiento (rombo rojo que late)
  if (data.marks?.ids?.length) {
    ctx.fillStyle = data.marks.kind === 'uav' ? '#facc15' : `rgba(248, 113, 113, ${0.6 + 0.4 * Math.sin(now / 120)})`;
    for (const id of data.marks.ids) {
      const p = data.others?.get(id);
      if (!p) continue;
      ctx.beginPath();
      ctx.moveTo(X(p.x), Y(p.y) - 6);
      ctx.lineTo(X(p.x) + 5, Y(p.y));
      ctx.lineTo(X(p.x), Y(p.y) + 6);
      ctx.lineTo(X(p.x) - 5, Y(p.y));
      ctx.closePath();
      ctx.fill();
    }
  }

  // Compañeros de equipo (siempre) y sus marcadores (30 s)
  if (data.mates?.size) {
    for (const id of data.mates) {
      const p = data.others?.get(id);
      if (!p || p.flags & PLAYER_FLAGS.DEAD) continue;
      // Derribado: cruz roja; vivo: punto con el color del equipo
      if (p.flags & PLAYER_FLAGS.DOWNED) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(X(p.x) - 5, Y(p.y) - 5);
        ctx.lineTo(X(p.x) + 5, Y(p.y) + 5);
        ctx.moveTo(X(p.x) + 5, Y(p.y) - 5);
        ctx.lineTo(X(p.x) - 5, Y(p.y) + 5);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = data.teamColor ?? '#4ade80';
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Marcador propio: punto naranja con línea guía desde el jugador
  if (data.marker) {
    const me = data.me;
    ctx.strokeStyle = 'rgba(251,146,60,0.85)';
    ctx.lineWidth = 1.5;
    if (me) {
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(X(me.x), Y(me.y));
      ctx.lineTo(X(data.marker.x), Y(data.marker.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(X(data.marker.x), Y(data.marker.y), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pg of data.pings ?? []) {
    if (now - pg.at > 30_000) continue;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(pg.x), Y(pg.y) - 9);
    ctx.lineTo(X(pg.x) + 6, Y(pg.y));
    ctx.lineTo(X(pg.x), Y(pg.y) + 9);
    ctx.lineTo(X(pg.x) - 6, Y(pg.y));
    ctx.closePath();
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
      const near = Math.hypot(v.x - data.me.x, v.y - data.me.y) <= vehicleType(v).noiseRadius;
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

// Minimapa: 300 m alrededor del jugador (sin salirse del mapa); sin jugador, todo el mapa
const MINIMAP_SPAN = 300;
function minimapView(me) {
  if (!me) return FULL;
  // En el Gulag (fuera del mapa): la arena de cerca
  if (Math.abs(me.x) > MAP_HALF) return { cx: me.x, cy: me.y, span: 50 };
  const lim = MAP_HALF - MINIMAP_SPAN / 2;
  return { cx: Math.max(-lim, Math.min(lim, me.x)), cy: Math.max(-lim, Math.min(lim, me.y)), span: MINIMAP_SPAN };
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
      const x = extra.current;
      draw(ctx, size, { ...f, ...x, mates: x.client?.mates, pings: x.client?.pings, teamColor: x.client?.teamColor, marker: x.client?.myMarker }, detailed, detailed ? FULL : minimapView(f.follow ?? f.me));
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
      <canvas
        ref={ref}
        style={{ width: size, height: size }}
        className="rounded border border-khaki-dark"
        onPointerUp={(e) => {
          // Tocar el mapa pone (o quita) tu marcador; en equipo también lo ven tus compañeros (no cierra)
          const c = extra.current.client;
          if (!c) return;
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          c.toggleMarker(((e.clientX - rect.left) / rect.width) * MAP_SIZE - MAP_HALF, MAP_HALF - ((e.clientY - rect.top) / rect.height) * MAP_SIZE);
        }}
      />
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
export default function TacticalMap({ frameRef, myId, radar, radio, isTouch, marks = null, night = false, lastShot = null, deployRoute = null, client = null }) {
  const [open, setOpen] = useState(false);
  const extra = useRef({});
  extra.current = { myId, radar, marks, night, lastShot, deployRoute, client };
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
