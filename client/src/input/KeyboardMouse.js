import { inputState } from './inputState.js';

const KEYS = {
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
      x += KEYS[code][0];
      y += KEYS[code][1];
    }
    inputState.keyX = x;
    inputState.keyY = y;
  };

  const onKeyDown = (e) => {
    if (!KEYS[e.code] || e.target instanceof HTMLInputElement) return;
    e.preventDefault();
    pressed.add(e.code);
    update();
  };
  const onKeyUp = (e) => {
    if (pressed.delete(e.code)) update();
  };
  const onBlur = () => {
    pressed.clear();
    update();
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    mousePointer.x = (e.clientX / innerWidth) * 2 - 1;
    mousePointer.y = -(e.clientY / innerHeight) * 2 + 1;
    mousePointer.active = true;
  };

  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  addEventListener('pointermove', onPointerMove);
  return () => {
    removeEventListener('keydown', onKeyDown);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    removeEventListener('pointermove', onPointerMove);
    onBlur();
  };
}
