import { useEffect, useRef } from 'react';
import nipplejs from 'nipplejs';
import { inputState } from './inputState.js';

// Por debajo de esto el joystick se considera suelto
const DEAD_ZONE = 0.2;

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

// Twin-stick: mitad izquierda mueve, mitad derecha apunta. El joystick aparece donde tocas.
export default function TouchControls() {
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    const options = { mode: 'dynamic', color: 'white', size: 120, fadeTime: 80 };
    const move = nipplejs.create({ ...options, zone: leftRef.current });
    const aim = nipplejs.create({ ...options, zone: rightRef.current });

    // Fuera de la zona muerta se camina a velocidad completa: más fácil en pantalla táctil
    move.on('move', (_e, data) => {
      const { x, y } = data.vector;
      const len = Math.hypot(x, y);
      inputState.stickX = len > DEAD_ZONE ? x / len : 0;
      inputState.stickY = len > DEAD_ZONE ? y / len : 0;
    });
    move.on('end', () => {
      inputState.stickX = 0;
      inputState.stickY = 0;
    });

    aim.on('move', (_e, data) => {
      const { x, y } = data.vector;
      if (Math.hypot(x, y) > DEAD_ZONE) inputState.stickAim = Math.atan2(y, x);
    });
    aim.on('end', () => {
      inputState.stickAim = null;
    });

    return () => {
      move.destroy();
      aim.destroy();
      inputState.stickX = 0;
      inputState.stickY = 0;
      inputState.stickAim = null;
    };
  }, []);

  return (
    <>
      <div ref={leftRef} className="absolute inset-y-0 left-0 z-10 w-1/2 touch-none" />
      <div ref={rightRef} className="absolute inset-y-0 right-0 z-10 w-1/2 touch-none" />
    </>
  );
}
