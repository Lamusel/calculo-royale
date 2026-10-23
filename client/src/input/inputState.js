// Estado de controles compartido: teclado/mouse y joysticks escriben aquí, el GameClient lee.
export const inputState = {
  keyX: 0,
  keyY: 0,
  stickX: 0,
  stickY: 0,
  stickAim: null, // ángulo del joystick derecho, o null si está suelto
  mouseAim: null, // ángulo hacia el mouse, o null si no se ha usado
  lastAim: 0,
};

// Movimiento en coordenadas del plano (y hacia arriba en pantalla) y ángulo de apuntado
export function readInput() {
  const s = inputState;
  const usingStick = s.stickX !== 0 || s.stickY !== 0;
  const mx = usingStick ? s.stickX : s.keyX;
  const my = usingStick ? s.stickY : s.keyY;

  let aim = s.stickAim ?? s.mouseAim;
  if (aim === null) aim = mx !== 0 || my !== 0 ? Math.atan2(my, mx) : s.lastAim;
  s.lastAim = aim;
  return { mx, my, aim };
}

export function resetInput() {
  Object.assign(inputState, { keyX: 0, keyY: 0, stickX: 0, stickY: 0, stickAim: null });
}
