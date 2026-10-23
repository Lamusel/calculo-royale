// Controles de PC (npm test): eventos de teclado y mouse como los entrega el navegador, y el
// input resultante enviado al Game real del servidor.
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { GRENADE, TICK_MS } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { decodeInput, encodeInput } from '@calculo-royale/shared/codec';
import { attachKeyboardMouse } from '../client/src/input/KeyboardMouse.js';
import { actions, aimPreview, inputState, readInput, resetInput } from '../client/src/input/inputState.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';

// Ventana falsa: los listeners del módulo se registran en este EventTarget
const win = new EventTarget();
let detach;
before(() => {
  globalThis.addEventListener = win.addEventListener.bind(win);
  globalThis.removeEventListener = win.removeEventListener.bind(win);
  globalThis.innerWidth = 1000;
  globalThis.innerHeight = 500;
  globalThis.Element ??= class {};
  detach = attachKeyboardMouse();
});
after(() => detach());
beforeEach(() => {
  resetInput();
  inputState.weapon = 'pistol';
  inputState.mouseDist = 9;
});

// target es de solo lectura en Event: se define como propiedad propia
const fire = (type, props) => {
  const e = new Event(type);
  for (const [k, v] of Object.entries({ target: null, ...props })) Object.defineProperty(e, k, { value: v });
  return win.dispatchEvent(e);
};
const keyDown = (code, key, extra = {}) => fire('keydown', { code, key, repeat: false, ...extra });
const keyUp = (code, key) => fire('keyup', { code, key });

function makeServer() {
  const room = { phase: 'playing', players: new Map(), emitTo() {}, broadcast() {}, broadcastState() {}, respawnInLobby() {} };
  room.game = new Game(room);
  const p = new Player({ id: 1, name: 'Ana', color: '#fff', token: 't' });
  p.teleport(0, 0);
  p.connected = true;
  room.players.set(1, p);
  return { room, p };
}
const send = (room, p, input, seq) => {
  p.queueInput(decodeInput(encodeInput({ ...input, seq, viewTick: room.game.tick + 1 })));
  room.game.update();
};

test('granada con G: mantener muestra el arco, soltar la lanza a la distancia del mouse y explota', () => {
  const { room, p } = makeServer();
  p.giveItem('grenade');
  keyDown('KeyG', 'g');
  assert.equal(aimPreview(), 'grenade', 'arco y círculo mientras se mantiene');
  keyDown('KeyG', 'g', { repeat: true });
  keyUp('KeyG', 'g');
  assert.equal(aimPreview(), null);
  const input = readInput();
  assert.equal(input.buttons, BUTTONS.GRENADE);
  assert.equal(input.aimDist, 9);
  send(room, p, input, 1);
  assert.equal(p.grenades, GRENADE.max - 1);
  assert.equal(room.game.grenades.length, 1);
  let exploded = false;
  for (let i = 0; i < (GRENADE.flightMs + GRENADE.fuseMs) / TICK_MS + 4 && !exploded; i++) {
    room.game.update();
    exploded = room.game.explosions.length > 0;
  }
  assert.ok(exploded, 'el servidor la hizo explotar');
});

test('G funciona aunque se pierda la primera pulsación (solo llegan repeticiones) y con la letra en vez del código', () => {
  keyDown('KeyG', 'g', { repeat: true });
  assert.equal(aimPreview(), 'grenade');
  keyUp('KeyG', 'g');
  assert.equal(readInput().buttons, BUTTONS.GRENADE);
  keyDown('', 'G');
  keyUp('', 'G');
  assert.equal(readInput().buttons, BUTTONS.GRENADE);
});

test('granada desde el botón del HUD en PC: el siguiente clic la lanza; clic derecho cancela', () => {
  inputState.grenadeAiming = true;
  assert.equal(aimPreview(), 'grenade');
  fire('mousedown', { button: 0 });
  assert.equal(readInput().buttons, BUTTONS.GRENADE);
  assert.equal(inputState.fireHeld, false, 'ese clic no dispara el arma');
  inputState.grenadeAiming = true;
  fire('mousedown', { button: 2 });
  assert.equal(inputState.grenadeAiming, false);
  assert.equal(readInput().buttons, 0);
});

test('R recarga, B pide balas, E interactúa, 1/2 cambian de arma, clic izquierdo dispara y derecho es la mira', () => {
  const calls = [];
  Object.assign(actions, {
    interact: () => calls.push('E'),
    requestAmmo: () => calls.push('B'),
    switchWeapon: (slot) => calls.push(slot),
  });
  keyDown('KeyR', 'r');
  assert.equal(readInput().buttons & BUTTONS.RELOAD, BUTTONS.RELOAD);
  keyDown('KeyB', 'b');
  keyDown('KeyE', 'e');
  keyDown('Digit1', '1');
  keyDown('Digit2', '2');
  assert.deepEqual(calls, ['B', 'E', 1, 2]);
  fire('mousedown', { button: 0 });
  assert.equal(readInput().buttons & BUTTONS.FIRE, BUTTONS.FIRE);
  fire('mouseup', { button: 0 });
  inputState.weapon = 'sniper';
  fire('mousedown', { button: 2 });
  assert.equal(aimPreview(), 'sniper');
  assert.equal(readInput().buttons & BUTTONS.AIM, BUTTONS.AIM);
  fire('mouseup', { button: 2 });
});

test('mientras se escribe en un campo de texto no se juega; un deslizador con foco no bloquea', () => {
  keyDown('KeyD', 'd', { target: { tagName: 'INPUT', type: 'text' } });
  assert.equal(inputState.keyX, 0);
  keyDown('KeyG', 'g', { target: { tagName: 'INPUT', type: 'range' } });
  assert.equal(aimPreview(), 'grenade');
  keyUp('KeyG', 'g');
});
