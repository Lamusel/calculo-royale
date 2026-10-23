import { BUTTONS } from '@calculo-royale/shared/protocol';
import { actions, inputState, press } from './inputState.js';

const MOVE_KEYS = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

// Posición del mouse en coordenadas normalizadas (-1 a 1); la escena la convierte en ángulo
export const mousePointer = { x: 0, y: 0, active: false };

export function attachKeyboardMouse() {
  const pressed = new Set();

  const update = () => {
    let x = 0;
    let y = 0;
    for (const code of pressed) {
      x += MOVE_KEYS[code][0];
      y += MOVE_KEYS[code][1];
    }
    inputState.keyX = x;
    inputState.keyY = y;
  };

  const onKeyDown = (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (MOVE_KEYS[e.code]) {
      e.preventDefault();
      pressed.add(e.code);
      update();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyR') press(BUTTONS.RELOAD);
    else if (e.code === 'KeyG') press(BUTTONS.GRENADE);
    else if (e.code === 'KeyE') actions.interact();
    else if (e.code === 'Digit1') actions.switchWeapon(1);
    else if (e.code === 'Digit2') actions.switchWeapon(2);
  };
  const onKeyUp = (e) => {
    if (pressed.delete(e.code)) update();
  };
  const onBlur = () => {
    pressed.clear();
    update();
    inputState.fireHeld = false;
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    mousePointer.x = (e.clientX / innerWidth) * 2 - 1;
    mousePointer.y = -(e.clientY / innerHeight) * 2 + 1;
    mousePointer.active = true;
  };
  // Dispara con cualquier clic que no sea sobre un control de la interfaz (botones, campos)
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest('button, input, a')) return;
    inputState.fireHeld = true;
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) inputState.fireHeld = false;
  };

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  addEventListener('pointermove', onPointerMove);
  addEventListener('pointerdown', onPointerDown);
  addEventListener('pointerup', onPointerUp);
  return () => {
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    removeEventListener('pointermove', onPointerMove);
    removeEventListener('pointerdown', onPointerDown);
    removeEventListener('pointerup', onPointerUp);
    onBlur();
  };
}
