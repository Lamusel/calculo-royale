import { BUTTONS } from '@calculo-royale/shared/protocol';

// Estado de controles compartido: teclado/mouse y joysticks escriben aquí, el GameClient lee.
export const inputState = {
  keyX: 0,
  keyY: 0,
  stickX: 0,
  stickY: 0,
  stickAim: null, // ángulo del joystick derecho, o null si está suelto
  mouseAim: null, // ángulo hacia el mouse, o null si no se ha usado
  mouseDist: null, // distancia del jugador al punto del mouse
  lastAim: 0,

  fireHeld: false, // mouse presionado o joystick derecho arrastrado (armas de mantener)
  pressed: 0, // botones de un solo envío pendientes (máscara BUTTONS)
  pendingAim: null, // ángulo fijado al soltar el joystick o al tocar (auto apuntado)
  pendingDist: null, // distancia de lanzamiento de la granada desde el joystick

  // 'hold': mantener = disparar · 'release': apuntar y soltar = disparar (francotirador)
  weaponMode: 'hold',
  grenadeMode: false, // celular: el próximo gesto del joystick derecho lanza una granada
};

// Acciones que no van en el input (las conecta el GameClient)
export const actions = {
  switchWeapon: () => {},
  interact: () => {},
};

function movement() {
  const s = inputState;
  const usingStick = s.stickX !== 0 || s.stickY !== 0;
  return usingStick ? [s.stickX, s.stickY] : [s.keyX, s.keyY];
}

// Ángulo de apuntado actual, sin consumir nada (para dibujar cada cuadro)
export function currentAim() {
  const s = inputState;
  let aim = s.pendingAim ?? s.stickAim ?? s.mouseAim;
  if (aim === null) {
    const [mx, my] = movement();
    aim = mx !== 0 || my !== 0 ? Math.atan2(my, mx) : s.lastAim;
  }
  s.lastAim = aim;
  return aim;
}

// Input completo para enviar: consume los botones de un solo envío
export function readInput() {
  const s = inputState;
  const [mx, my] = movement();
  const aim = currentAim();
  const buttons = s.pressed | (s.fireHeld ? BUTTONS.FIRE : 0);
  const aimDist = s.pendingDist ?? s.mouseDist ?? 0;
  s.pressed = 0;
  s.pendingAim = null;
  s.pendingDist = null;
  return { mx, my, aim, buttons, aimDist };
}

export function press(buttons, aim = null, dist = null) {
  inputState.pressed |= buttons;
  if (aim !== null) inputState.pendingAim = aim;
  if (dist !== null) inputState.pendingDist = dist;
}

export function resetInput() {
  Object.assign(inputState, {
    keyX: 0, keyY: 0, stickX: 0, stickY: 0, stickAim: null,
    fireHeld: false, pressed: 0, pendingAim: null, pendingDist: null, grenadeMode: false,
  });
}
