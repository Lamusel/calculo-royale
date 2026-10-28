import { useEffect, useRef, useState } from 'react';
import { DEPLOY, MAP_HALF, MAP_SIZE } from '@calculo-royale/shared/constants';
import { actions } from '../input/inputState.js';
import { TouchButton } from './CombatHUD.jsx';
import { sectorOf } from '@calculo-royale/shared/zone';
import { draw } from './TacticalMap.jsx';

// Interfaz del despliegue: en el bus (cuenta regresiva y ¡Saltar!), cayendo (altímetro) y,
// en el modo elegir punto, el mapa táctico para tocar dónde caer.

function useTick(ms = 200) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function PickPoint({ client, frameRef }) {
  const ref = useRef(null);
  const size = Math.min(innerHeight - 90, innerWidth - 24, 640);
  const info = client.deployInfo;
  useEffect(() => {
    const canvas = ref.current;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      draw(ctx, size, { ...frameRef.current, me: null, pick: client.deployInfo?.myPick }, true);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [client, frameRef, size]);
  const left = Math.max(0, Math.ceil(((info?.pickUntil ?? 0) - performance.now()) / 1000));
  const onPick = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MAP_SIZE - MAP_HALF;
    const y = MAP_HALF - ((e.clientY - rect.top) / rect.height) * MAP_SIZE;
    client.chooseDeployPoint(Math.round(x), Math.round(y));
  };
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-black/80 p-3 text-stone-100">
      <p className="text-center text-lg font-black uppercase tracking-wider text-khaki">Toca dónde quieres caer · {left} s</p>
      <canvas ref={ref} onPointerUp={onPick} style={{ width: size, height: size }} className="cursor-crosshair rounded border border-khaki-dark" />
      <p className="text-xs text-stone-400">{info?.myPick ? `Caerás en (${info.myPick.x}, ${info.myPick.y})` : 'Si no eliges, caes donde te tocó'}</p>
    </div>
  );
}

export default function DeployHUD({ client, frameRef, isTouch }) {
  useTick();
  const state = client.deploying;
  const info = client.deployInfo;
  if (!state || !info) return null;
  if (info.mode === 'punto' && state === 'bus') return <PickPoint client={client} frameRef={frameRef} />;

  if (state === 'bus') {
    const wait = Math.max(0, Math.ceil(((info.departAt ?? 0) - performance.now()) / 1000));
    return (
      <div className="absolute inset-x-0 bottom-[22%] z-30 flex flex-col items-center gap-2">
        {wait > 0 ? (
          <p className="rounded bg-black/65 px-4 py-2 text-lg font-black uppercase tracking-wider text-khaki">El bus sale en {wait} s · mira la ruta en el mapa</p>
        ) : isTouch ? (
          <TouchButton onPress={() => actions.jump()} className="rounded-full border-4 border-green-800 bg-yellow-400 px-10 py-5 text-2xl font-black uppercase text-green-900 shadow-xl">
            ¡Saltar!
          </TouchButton>
        ) : (
          <button onClick={() => actions.jump()} className="rounded-full border-4 border-green-800 bg-yellow-400 px-8 py-3 text-xl font-black uppercase text-green-900 shadow-xl">
            <kbd className="mr-2 rounded bg-green-900 px-2 text-yellow-300">Espacio</kbd>¡Saltar!
          </button>
        )}
      </div>
    );
  }

  const z = Math.max(0, Math.round(frameRef.current.altitude ?? 0));
  const landing = frameRef.current.landing;
  return (
    <>
      <div className="pointer-events-none absolute right-3 top-1/3 z-30 rounded bg-black/65 px-3 py-2 text-center font-mono text-stone-100">
        <p className="text-[10px] uppercase tracking-widest text-khaki-light">Altura</p>
        <p className="text-3xl font-black">{z} m</p>
        <p className="text-[10px] text-stone-300">{state === 'fall' ? `Paracaídas solo a ${DEPLOY.chuteAltitude} m` : 'Paracaídas abierto'}</p>
        {landing && <p className="mt-1 text-[11px] text-yellow-300">Caes en ≈ {sectorOf(landing.x, landing.y)}</p>}
        <p className="mt-1 text-[10px] text-stone-400">{isTouch ? 'Joystick: inclinarse (cae más rápido y avanza)' : 'WASD: inclinarse (cae más rápido y avanza)'}</p>
      </div>
      {state === 'fall' && (
        <div className="absolute inset-x-0 bottom-[18%] z-30 flex justify-center">
          {isTouch ? (
            <TouchButton onPress={() => actions.jump()} className="rounded-full border-2 border-green-800 bg-yellow-400/90 px-5 py-2 text-sm font-black uppercase text-green-900 shadow">
              🪂 Abrir paracaídas
            </TouchButton>
          ) : (
            <p className="pointer-events-none rounded bg-black/60 px-3 py-1 text-xs text-stone-200">
              <kbd className="mr-1 rounded bg-green-900 px-1.5 text-yellow-300">Espacio</kbd> abrir el paracaídas antes: llegas más lejos, pero más lento
            </p>
          )}
        </div>
      )}
    </>
  );
}
