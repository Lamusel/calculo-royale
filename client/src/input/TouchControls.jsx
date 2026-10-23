import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import { AIM_CANCEL_ZONE, WEAPONS } from '@calculo-royale/shared/constants';
import { createAimGesture } from './aimGesture.js';
import { inputState } from './inputState.js';

const STICK_SIZE = 120;
// Zona muerta del joystick de movimiento
const MOVE_DEAD_ZONE = 0.2;

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

// Anillo de la zona de cancelación sobre el joystick derecho
function CancelRing({ ring }) {
  const size = STICK_SIZE * AIM_CANCEL_ZONE;
  const releases = inputState.grenadeMode || WEAPONS[inputState.weapon]?.releaseToFire;
  return (
    <div
      className={`pointer-events-none absolute z-20 flex items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
        ring.cancelling ? 'border-red-400 bg-red-500/40 text-white' : releases ? 'border-white/70' : 'border-white/30'
      }`}
      style={{ left: ring.x - size, top: ring.y - size, width: size * 2, height: size * 2 }}
    >
      {ring.cancelling && '✕'}
    </div>
  );
}

// Twin-stick: mitad izquierda mueve, mitad derecha apunta y dispara (ver aimGesture.js).
// El joystick aparece donde tocas.
export default function TouchControls() {
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const [ring, setRing] = useState(null);

  useEffect(() => {
    const options = { mode: 'dynamic', color: 'white', size: STICK_SIZE, fadeTime: 80 };
    const move = nipplejs.create({ ...options, zone: leftRef.current });
    const aim = nipplejs.create({ ...options, zone: rightRef.current });
    const gesture = createAimGesture();

    // Fuera de la zona muerta se camina a velocidad completa: más fácil en pantalla táctil
    move.on('move', (_e, data) => {
      const { x, y } = data.vector;
      const len = Math.hypot(x, y);
      inputState.stickX = len > MOVE_DEAD_ZONE ? x / len : 0;
      inputState.stickY = len > MOVE_DEAD_ZONE ? y / len : 0;
    });
    move.on('end', () => {
      inputState.stickX = 0;
      inputState.stickY = 0;
    });

    aim.on('start', (_e, data) => {
      gesture.start(performance.now());
      const rect = rightRef.current.parentElement.getBoundingClientRect();
      setRing({ x: data.position.x - rect.left, y: data.position.y - rect.top, cancelling: false });
    });
    aim.on('move', (_e, data) => {
      gesture.move(data.vector.x, data.vector.y);
      const cancelling = gesture.cancelling;
      setRing((r) => (r && r.cancelling !== cancelling ? { ...r, cancelling } : r));
    });
    aim.on('end', () => {
      gesture.end(performance.now());
      setRing(null);
    });

    return () => {
      move.destroy();
      aim.destroy();
      inputState.stickX = 0;
      inputState.stickY = 0;
      inputState.stickAim = null;
      inputState.fireHeld = false;
    };
  }, []);

  return (
    <>
      <div ref={leftRef} className="absolute inset-y-0 left-0 z-10 w-1/2 touch-none" />
      <div ref={rightRef} className="absolute inset-y-0 right-0 z-10 w-1/2 touch-none" />
      {ring && <CancelRing ring={ring} />}
    </>
  );
}
