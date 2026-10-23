import { AIM_CANCEL_ZONE, GRENADE } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';

// Al soltar el joystick derecho, el soldado conserva la mira; si camina, la conserva este tiempo
export const RETAIN_AIM_MS = 1000;

// Estado de controles compartido: teclado/mouse y joysticks escriben aquí, el GameClient lee.
export const inputState = {
  keyX: 0,
  keyY: 0,
  stickX: 0,
  stickY: 0,

  stickAim: null, // ángulo del joystick derecho fuera de la zona de cancelación, o null
  stickForce: 0, // qué tan lejos del centro está (0 a 1)
  mouseAim: null, // ángulo hacia el mouse, o null si no se ha usado
  mouseDist: null, // distancia del jugador al punto del mouse
  retainedAim: null, // última mira al soltar el joystick
  retainedAt: 0,
  lastAim: 0,

  adsHeld: false, // PC: clic derecho mantenido (mira)
  grenadeHeld: false, // PC: G mantenida (vista previa de la granada)
  grenadeAiming: false, // PC: granada armada con el botón del HUD (el siguiente clic la lanza)
  grenadeMode: false, // celular: el joystick derecho lanza granadas

  fireHeld: false, // mouse presionado o joystick derecho arrastrado (armas de mantener)
  pressed: 0, // botones de un solo envío pendientes (máscara BUTTONS)
  pendingAim: null, // ángulo fijado al soltar o al tocar
  pendingDist: null, // distancia de lanzamiento de la granada

  weapon: 'pistol', // arma en mano (la fija el GameClient)
};

// Acciones que no van en el input (las conecta el GameClient)
export const actions = {
  switchWeapon: () => {},
  interact: () => {},
  requestAmmo: () => {},
  jump: () => {},
};

function movement() {
  const s = inputState;
  const usingStick = s.stickX !== 0 || s.stickY !== 0;
  return usingStick ? [s.stickX, s.stickY] : [s.keyX, s.keyY];
}

// Ángulo de apuntado actual, sin consumir nada (para dibujar cada cuadro)
export function currentAim(now = performance.now()) {
  const s = inputState;
  const [mx, my] = movement();
  const moving = mx !== 0 || my !== 0;
  let aim = s.pendingAim ?? s.stickAim ?? s.mouseAim;
  if (aim === null && s.retainedAim !== null) {
    if (!moving || now - s.retainedAt < RETAIN_AIM_MS) aim = s.retainedAim;
    else s.retainedAim = null;
  }
  if (aim === null) aim = moving ? Math.atan2(my, mx) : s.lastAim;
  s.lastAim = aim;
  return aim;
}

// Qué vista previa de mira dibujar: 'sniper' (línea larga), 'grenade' (arco) o null.
// Pistola, rifle y escopeta no llevan línea: solo la flecha de dirección bajo el soldado.
export function aimPreview() {
  const s = inputState;
  if (s.grenadeHeld || s.grenadeAiming || (s.grenadeMode && s.stickAim !== null)) return 'grenade';
  if (s.grenadeMode) return null;
  if ((s.stickAim !== null || s.adsHeld) && s.weapon === 'sniper') return 'sniper';
  return null;
}

// Distancia de lanzamiento: con el mouse, hasta el cursor; en celular, según cuánto se arrastra
export function grenadeDistance() {
  const s = inputState;
  const clamp = (v) => Math.max(GRENADE.minRange, Math.min(GRENADE.maxRange, v));
  if (s.grenadeHeld || s.grenadeAiming) return clamp(s.mouseDist ?? GRENADE.maxRange * 0.75);
  const t = Math.max(0, (s.stickForce - AIM_CANCEL_ZONE) / (1 - AIM_CANCEL_ZONE));
  return clamp(GRENADE.minRange + t * (GRENADE.maxRange - GRENADE.minRange));
}

// Celular: el botón de granada entra o sale del modo granada
export function toggleGrenadeMode(hasGrenades) {
  inputState.grenadeMode = !inputState.grenadeMode && hasGrenades;
  return inputState.grenadeMode;
}

// Input completo para enviar: consume los botones de un solo envío
export function readInput(now = performance.now()) {
  const s = inputState;
  const [mx, my] = movement();
  const aim = currentAim(now);
  let buttons = s.pressed | (s.fireHeld ? BUTTONS.FIRE : 0);
  if (aimPreview() === 'sniper') buttons |= BUTTONS.AIM;
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
    keyX: 0, keyY: 0, stickX: 0, stickY: 0, stickAim: null, stickForce: 0,
    retainedAim: null, adsHeld: false, grenadeHeld: false, grenadeAiming: false, grenadeMode: false,
    fireHeld: false, pressed: 0, pendingAim: null, pendingDist: null,
  });
}
