import { useEffect, useRef, useState } from 'react';
import nipplejs from 'nipplejs';
import { AIM_CANCEL_ZONE, CAMERA, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { createAimGesture, TAP_MS } from './aimGesture.js';
import { grenadeDistance, inputState, lookBy, press } from './inputState.js';
import { onSettings, settings } from '../settings.js';

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

const lookSpeed = () => CAMERA.third.touchSensitivity * (settings.lookSensitivity ?? 1);

// Arrastre que gira la cámara (tercera persona); devuelve los manejadores de pointer
function useLookDrag({ onTap } = {}) {
  const drag = useRef(null);
  return {
    onPointerDown: (e) => {
      if (drag.current) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), moved: 0 };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      lookBy(dx, dy, lookSpeed());
    },
    onPointerUp: (e) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      if (d.moved < 12 && performance.now() - d.at < TAP_MS) onTap?.();
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  };
}

// Botón de disparo de la tercera persona: mantener dispara; arrastrar desde él también gira la cámara.
// Francotirador, ballesta y granadas disparan al soltar.
function FireButton() {
  const look = useLookDrag();
  const [down, setDown] = useState(false);
  const releases = () => inputState.grenadeMode || Boolean(WEAPONS[inputState.weapon]?.releaseToFire);
  return (
    <div
      className={`absolute z-20 flex touch-none select-none items-center justify-center rounded-full border-2 font-mono text-sm font-bold tracking-widest ${
        down ? 'border-amber-300 bg-amber-500/45 text-white' : 'border-amber-200/70 bg-black/35 text-amber-100'
      }`}
      style={{ right: 64, bottom: 92, width: 84, height: 84 }}
      onPointerDown={(e) => {
        look.onPointerDown(e);
        setDown(true);
        if (!releases()) inputState.fireHeld = true;
      }}
      onPointerMove={look.onPointerMove}
      onPointerUp={(e) => {
        look.onPointerUp(e);
        setDown(false);
        inputState.fireHeld = false;
        if (inputState.grenadeMode) {
          inputState.stickForce = 0.75;
          press(BUTTONS.GRENADE, inputState.camYaw, grenadeDistance());
          inputState.stickForce = 0;
          inputState.grenadeMode = false;
        } else if (releases()) press(BUTTONS.FIRE, inputState.camYaw);
      }}
      onPointerCancel={() => {
        look.onPointerCancel();
        setDown(false);
        inputState.fireHeld = false;
      }}
    >
      FUEGO
    </div>
  );
}

// Botón de mira: alterna apuntar (acerca la vista; con mira 2x o 4x, más)
function AimButton() {
  const [on, setOn] = useState(false);
  useEffect(() => () => {
    inputState.adsHeld = false;
  }, []);
  return (
    <button
      className={`absolute z-20 flex touch-none select-none items-center justify-center rounded-full border-2 font-mono text-xs font-bold tracking-widest ${
        on ? 'border-amber-300 bg-amber-500/45 text-white' : 'border-white/50 bg-black/35 text-stone-100'
      }`}
      style={{ right: 160, bottom: 64, width: 60, height: 60 }}
      onPointerDown={(e) => {
        e.preventDefault();
        inputState.adsHeld = !inputState.adsHeld;
        setOn(inputState.adsHeld);
      }}
    >
      MIRA
    </button>
  );
}

// Tercera persona: mitad izquierda mueve (joystick), mitad derecha gira la cámara; un toque rápido
// dispara con auto apuntado al enemigo visible más cercano. Botones FUEGO y MIRA a la derecha.
function ThirdPersonTouch() {
  const leftRef = useRef(null);
  const look = useLookDrag({ onTap: () => press(BUTTONS.FIRE | BUTTONS.AUTO, inputState.camYaw) });
  useEffect(() => {
    const move = nipplejs.create({ mode: 'dynamic', color: 'white', size: STICK_SIZE, fadeTime: 80, zone: leftRef.current });
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
    return () => {
      move.destroy();
      inputState.stickX = 0;
      inputState.stickY = 0;
      inputState.fireHeld = false;
    };
  }, []);
  return (
    <>
      <div ref={leftRef} className="absolute inset-y-0 left-0 z-10 w-1/2 touch-none" />
      <div className="absolute inset-y-0 right-0 z-10 w-1/2 touch-none" {...look} />
      <FireButton />
      <AimButton />
    </>
  );
}

// Elige los controles según la vista (Opciones)
export default function TouchControls() {
  const [view, setView] = useState(settings.view);
  useEffect(() => onSettings((s) => setView(s.view)), []);
  return view === 'third' ? <ThirdPersonTouch /> : <TwinStickControls />;
}

// Twin-stick: mitad izquierda mueve, mitad derecha apunta y dispara (ver aimGesture.js).
// El joystick aparece donde tocas.
function TwinStickControls() {
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
