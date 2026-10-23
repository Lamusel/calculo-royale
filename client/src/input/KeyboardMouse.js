import { BUTTONS } from '@calculo-royale/shared/protocol';
import { actions, grenadeDistance, inputState, press } from './inputState.js';

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

// PC: WASD mueve, mouse apunta, clic izquierdo dispara, clic derecho mantenido = mira,
// G mantenida muestra el arco de la granada y al soltarla la lanza.
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
    else if (e.code === 'KeyG') inputState.grenadeHeld = true;
    else if (e.code === 'KeyE') actions.interact();
    else if (e.code === 'Digit1') actions.switchWeapon(1);
    else if (e.code === 'Digit2') actions.switchWeapon(2);
  };
  const onKeyUp = (e) => {
    if (pressed.delete(e.code)) update();
    if (e.code === 'KeyG' && inputState.grenadeHeld) {
      press(BUTTONS.GRENADE, null, grenadeDistance());
      inputState.grenadeHeld = false;
    }
  };
  const onBlur = () => {
    pressed.clear();
    update();
    inputState.fireHeld = false;
    inputState.adsHeld = false;
    inputState.grenadeHeld = false;
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    mousePointer.x = (e.clientX / innerWidth) * 2 - 1;
    mousePointer.y = -(e.clientY / innerHeight) * 2 + 1;
    mousePointer.active = true;
  };
  // Dispara con cualquier clic que no sea sobre un control de la interfaz (botones, campos).
  // Eventos de mouse (no pointer): así clic izquierdo y derecho a la vez se registran los dos.
  const onMouseDown = (e) => {
    // Los toques generan mousedown de compatibilidad: esos los maneja TouchControls
    if (e.sourceCapabilities?.firesTouchEvents) return;
    if (e.target instanceof Element && e.target.closest('button, input, a')) return;
    if (e.button === 0) inputState.fireHeld = true;
    if (e.button === 2) inputState.adsHeld = true;
  };
  const onMouseUp = (e) => {
    if (e.button === 0) inputState.fireHeld = false;
    if (e.button === 2) inputState.adsHeld = false;
  };
  // El clic derecho es la mira: sin menú contextual dentro del juego
  const onContextMenu = (e) => e.preventDefault();

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  addEventListener('pointermove', onPointerMove);
  addEventListener('mousedown', onMouseDown);
  addEventListener('mouseup', onMouseUp);
  addEventListener('contextmenu', onContextMenu);
  return () => {
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    removeEventListener('pointermove', onPointerMove);
    removeEventListener('mousedown', onMouseDown);
    removeEventListener('mouseup', onMouseUp);
    removeEventListener('contextmenu', onContextMenu);
    onBlur();
  };
}
