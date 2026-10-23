import { useEffect, useRef } from 'react';
import nipplejs from 'nipplejs';
import { GRENADE } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { currentAim, inputState, press } from './inputState.js';

// Por debajo de esto el joystick se considera suelto
const DEAD_ZONE = 0.2;
// Arrastrar más allá de esto empieza a disparar (armas de mantener)
const FIRE_THRESHOLD = 0.45;
// Un toque más corto que esto y sin arrastrar = disparo con auto apuntado
const TAP_MS = 250;

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;

// Twin-stick: mitad izquierda mueve, mitad derecha apunta y dispara. El joystick aparece donde tocas.
//  - Toque rápido sin arrastrar: dispara solo al enemigo visible más cercano (decide el servidor).
//  - Arrastrar: apuntado manual. Pistola, escopeta y rifle disparan mientras arrastras;
//    francotirador y granada disparan al soltar (volver al centro antes de soltar cancela).
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

    let gesture = null;
    aim.on('start', () => {
      gesture = { startedAt: performance.now(), maxForce: 0, force: 0 };
    });
    aim.on('move', (_e, data) => {
      if (!gesture) return;
      const { x, y } = data.vector;
      const force = Math.min(Math.hypot(x, y), 1);
      gesture.force = force;
      gesture.maxForce = Math.max(gesture.maxForce, force);
      if (force > DEAD_ZONE) inputState.stickAim = Math.atan2(y, x);
      const holdFire = inputState.weaponMode === 'hold' && !inputState.grenadeMode;
      inputState.fireHeld = holdFire && force > FIRE_THRESHOLD;
    });
    aim.on('end', () => {
      inputState.fireHeld = false;
      if (gesture) {
        const isTap = gesture.maxForce < DEAD_ZONE && performance.now() - gesture.startedAt < TAP_MS;
        const releaseFires = inputState.grenadeMode || inputState.weaponMode === 'release';
        if (isTap) {
          press((inputState.grenadeMode ? BUTTONS.GRENADE : BUTTONS.FIRE) | BUTTONS.AUTO, currentAim());
          inputState.grenadeMode = false;
        } else if (releaseFires && gesture.force > FIRE_THRESHOLD) {
          const angle = currentAim();
          if (inputState.grenadeMode) {
            const dist = GRENADE.minRange + gesture.force * (GRENADE.maxRange - GRENADE.minRange);
            press(BUTTONS.GRENADE, angle, dist);
            inputState.grenadeMode = false;
          } else {
            press(BUTTONS.FIRE, angle);
          }
        }
      }
      gesture = null;
      inputState.stickAim = null;
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
    </>
  );
}
