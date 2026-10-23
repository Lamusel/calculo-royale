// Flujos táctiles del joystick derecho (npm test): se simula el gesto como lo entrega nipplejs
// y el input resultante se envía al Game real del servidor.
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { AIM_CANCEL_ZONE, GRENADE, PLAYER_SPEED, TICK_MS } from '@calculo-royale/shared/constants';
import { BUTTONS } from '@calculo-royale/shared/protocol';
import { decodeInput, encodeInput } from '@calculo-royale/shared/codec';
import { applyInput } from '@calculo-royale/shared/movement';
import { createAimGesture } from '../client/src/input/aimGesture.js';
import {
  aimPreview, currentAim, grenadeDistance, inputState, readInput, resetInput, RETAIN_AIM_MS, toggleGrenadeMode,
} from '../client/src/input/inputState.js';
import { Game } from '../server/src/game/Game.js';
import { Player } from '../server/src/game/Player.js';

beforeEach(() => {
  resetInput();
  inputState.weapon = 'pistol';
  inputState.retainedAim = null;
  inputState.mouseAim = null;
});

// Arrastre en varios pasos, como llegan los eventos 'move' de nipplejs
function drag(gesture, points) {
  for (const [x, y] of points) gesture.move(x, y);
}

function makeServer() {
  const room = {
    phase: 'playing',
    players: new Map(),
    emitTo() {},
    broadcast() {},
    broadcastState() {},
    respawnInLobby() {},
  };
  room.game = new Game(room);
  const p = new Player({ id: 1, name: 'Ana', color: '#fff', token: 't' });
  p.teleport(0, 0); // campo de entrenamiento: sin obstáculos cerca
  p.connected = true;
  room.players.set(1, p);
  return { room, p };
}

// El input pasa por el mismo codec que en la red
function send(room, p, input, seq) {
  const packet = encodeInput({ ...input, seq, viewTick: room.game.tick + 1 });
  p.queueInput(decodeInput(packet));
  room.game.update();
}

test('granada táctil: botón, arrastre con arco, soltar lanza y cae donde se apuntó', () => {
  const { room, p } = makeServer();
  p.giveItem('grenade');
  const gesture = createAimGesture();

  assert.equal(toggleGrenadeMode(p.grenades > 0), true);
  gesture.start(0);
  drag(gesture, [[0.1, 0.1], [0.3, 0.3], [0.48, 0.64]]); // fuerza 0.8 hacia el noreste
  assert.equal(aimPreview(), 'grenade', 'se dibuja el arco mientras arrastra');
  const expectedDist = grenadeDistance();
  const t = (0.8 - AIM_CANCEL_ZONE) / (1 - AIM_CANCEL_ZONE);
  assert.ok(Math.abs(expectedDist - (GRENADE.minRange + t * (GRENADE.maxRange - GRENADE.minRange))) < 1e-9);
  gesture.end(600);

  const input = readInput(600);
  assert.equal(input.buttons, BUTTONS.GRENADE);
  assert.ok(Math.abs(input.aim - Math.atan2(0.64, 0.48)) < 1e-9);
  assert.equal(input.aimDist, expectedDist);
  assert.equal(inputState.grenadeMode, false, 'tras lanzar sale del modo granada');

  send(room, p, input, 1);
  assert.equal(p.grenades, GRENADE.max - 1);
  assert.equal(room.game.grenades.length, 1);
  for (let i = 0; i < GRENADE.flightMs / TICK_MS + 2; i++) room.game.update();
  const g = room.game.grenades[0];
  const landed = Math.hypot(g.x, g.y);
  assert.ok(Math.abs(landed - expectedDist) < 0.6, `cayó a ${landed.toFixed(2)}, se apuntó a ${expectedDist.toFixed(2)}`);
  for (let i = 0; i < GRENADE.fuseMs / TICK_MS; i++) room.game.update();
  assert.equal(room.game.grenades.length, 0, 'explotó');
});

test('granada táctil: volver al centro cancela y el modo sigue; tocar el botón otra vez sale', () => {
  const gesture = createAimGesture();
  toggleGrenadeMode(true);
  gesture.start(0);
  drag(gesture, [[0.5, 0.5], [0.8, 0]]);
  drag(gesture, [[0.4, 0], [0.1, 0]]);
  assert.equal(gesture.cancelling, true, 'se marca la zona de cancelación');
  assert.equal(aimPreview(), null, 'el arco desaparece al cancelar');
  gesture.end(800);
  assert.equal(readInput().buttons, 0);
  assert.equal(inputState.grenadeMode, true);
  assert.equal(toggleGrenadeMode(true), false);
});

test('granada táctil: un toque sin arrastrar no lanza', () => {
  const gesture = createAimGesture();
  toggleGrenadeMode(true);
  gesture.start(0);
  gesture.end(80);
  assert.equal(readInput().buttons, 0);
  assert.equal(inputState.grenadeMode, true);
});

test('sin granadas no se entra al modo granada', () => {
  assert.equal(toggleGrenadeMode(false), false);
});

test('francotirador: arrastrar apunta (camina lento), soltar dispara, volver al centro cancela', () => {
  inputState.weapon = 'sniper';
  const gesture = createAimGesture();

  gesture.start(0);
  drag(gesture, [[0, 0.5], [0, 0.9]]);
  assert.equal(aimPreview(), 'sniper');
  const aiming = readInput();
  assert.equal(aiming.buttons, BUTTONS.AIM, 'apunta sin disparar');
  gesture.end(700);
  const fired = readInput();
  assert.equal(fired.buttons & BUTTONS.FIRE, BUTTONS.FIRE);
  assert.ok(Math.abs(fired.aim - Math.PI / 2) < 1e-9);

  gesture.start(1000);
  drag(gesture, [[0.9, 0], [0.2, 0]]);
  gesture.end(1500);
  assert.equal(readInput().buttons & BUTTONS.FIRE, 0, 'cancelado');
});

test('apuntar con el francotirador reduce la velocidad a la mitad', () => {
  const free = { x: 0, y: 0, aim: 0 };
  const aiming = { x: 0, y: 0, aim: 0 };
  applyInput(free, { mx: 0, my: 1, aim: 0, buttons: 0 }, 0.05);
  applyInput(aiming, { mx: 0, my: 1, aim: 0, buttons: BUTTONS.AIM }, 0.05);
  assert.ok(Math.abs(aiming.y / free.y - 0.5) < 1e-9);
  assert.ok(free.y > PLAYER_SPEED * 0.05 * 0.79);
});

test('armas de mantener: la zona muerta del 30 % no dispara; fuera de ella sí', () => {
  inputState.weapon = 'rifle';
  const gesture = createAimGesture();
  gesture.start(0);
  gesture.move(AIM_CANCEL_ZONE - 0.05, 0);
  assert.equal(inputState.fireHeld, false);
  assert.equal(aimPreview(), null);
  gesture.move(0.5, 0);
  assert.equal(inputState.fireHeld, true);
  assert.equal(aimPreview(), null, 'sin línea de mira: solo la flecha bajo el soldado');
  gesture.end(400);
  assert.equal(inputState.fireHeld, false);
});

test('solo el francotirador y la granada muestran vista previa', () => {
  for (const weapon of ['pistol', 'rifle', 'shotgun']) {
    inputState.weapon = weapon;
    const gesture = createAimGesture();
    gesture.start(0);
    gesture.move(0.7, 0);
    assert.equal(aimPreview(), null, weapon);
    gesture.end(300);
  }
  inputState.weapon = 'sniper';
  inputState.adsHeld = true;
  assert.equal(aimPreview(), 'sniper');
});

test('al soltar, el soldado conserva la última dirección de mira', () => {
  const gesture = createAimGesture();
  gesture.start(0);
  gesture.move(-0.8, 0); // apunta al oeste
  gesture.end(300);
  readInput(300);
  // Camina al norte: durante RETAIN_AIM_MS sigue mirando al oeste
  inputState.stickY = 1;
  assert.ok(Math.abs(currentAim(300 + RETAIN_AIM_MS / 2) - Math.PI) < 1e-9);
  // Pasado ese tiempo mira hacia donde camina
  assert.ok(Math.abs(currentAim(300 + RETAIN_AIM_MS + 1) - Math.PI / 2) < 1e-9);
  // Quieto conserva la mira sin límite de tiempo
  inputState.stickY = 0;
  gesture.start(5000);
  gesture.move(0, -0.9);
  gesture.end(5200);
  assert.ok(Math.abs(currentAim(60000) + Math.PI / 2) < 1e-9);
});

test('un toque rápido dispara con auto apuntado', () => {
  const gesture = createAimGesture();
  gesture.start(0);
  gesture.move(0.1, 0);
  gesture.end(120);
  assert.equal(readInput().buttons, BUTTONS.FIRE | BUTTONS.AUTO);
});
