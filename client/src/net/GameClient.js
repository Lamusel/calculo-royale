import { GRENADE, PLAYER_RADIUS, RADAR_MS, TICK_MS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { decodeInput, decodeShot, encodeInput } from '@calculo-royale/shared/codec';
import { raycastObstacles, rayCircle } from '@calculo-royale/shared/collision';
import { findAutoTarget, pelletAngles } from '@calculo-royale/shared/combat';
import { TRAINING } from '@calculo-royale/shared/mapLayout';
import { actions, currentAim, inputState, readInput, resetInput } from '../input/inputState.js';
import { angleDiff, SnapshotBuffer } from './interpolation.js';
import { Predictor } from './prediction.js';

// Contador global: si se recrea el cliente sin recargar, las secuencias siguen creciendo
let seq = 0;

const KILLFEED_MS = 6000;
const vibrate = (pattern) => navigator.vibrate?.(pattern);

export const selfWeaponId = (self) => (self?.slot === 2 && self.primary ? self.primary.id : 'pistol');
const selfMag = (self) => (selfWeaponId(self) === 'pistol' ? self.pistolMag : self.primary.mag);

// Conecta la red con la escena: envía inputs a 20 Hz, guarda snapshots, predice al
// jugador propio (movimiento y disparos) y deja efectos en cola para la escena.
export class GameClient {
  constructor(socket, myId, phase) {
    this.socket = socket;
    this.myId = myId;
    this.phase = phase;
    this.buffer = new SnapshotBuffer();
    this.predictor = new Predictor();
    this.lastSentAim = null;
    this.latency = null;

    this.self = null; // estado privado (munición, vida exacta)
    this.reloadEndsAt = 0;
    this.predictedMag = 0;
    this.localNextFire = 0;
    this.lastFrame = null;

    this.effects = []; // la escena los consume cada cuadro
    this.killfeed = [];
    this.damageFlashAt = 0;
    this.question = null; // pregunta de la caja que se está abriendo
    this.crateResult = null; // último resultado (se muestra unos segundos)
    this.radarEndsAt = 0;
    this.radio = []; // transmisiones del mando recientes
    this.results = null; // ranking al terminar la partida
    this.privateResults = null; // aciertos por tema y preguntas falladas (solo mías)
    this.lastShot = new Map(); // id → momento del último disparo (retroceso del soldado)
    this.trauma = 0; // sacudida de cámara (0 a 1), sube al recibir daño

    this.handlers = {
      [EVENTS.STATE]: ([tick, players, grenades, dummies, shots, explosions, crates, alarms, zone, airdrop]) => {
        this.buffer.push(tick, players, grenades, dummies, shots, explosions, crates, alarms, zone, airdrop);
        const me = players.find((p) => p[0] === this.myId);
        if (me) this.predictor.reconcile(me[1], me[2], me[4]);
      },
      [EVENTS.PONG]: ({ clientTime }) => {
        this.latency = Date.now() - clientTime;
      },
      [EVENTS.PLAYER_SELF]: (self) => this.onSelf(self),
      [EVENTS.COMBAT_HIT]: ([, amount, x, y, killed]) => {
        this.effects.push({ type: 'damage', x, y, amount, killed: Boolean(killed) });
        vibrate(killed ? [30, 40, 30] : 12);
      },
      [EVENTS.CRATE_QUESTION]: (question) => {
        this.question = { ...question, receivedAt: performance.now() };
        this.crateResult = null;
        resetInput();
        vibrate(20);
      },
      [EVENTS.CRATE_RESULT]: (result) => {
        this.question = null;
        this.crateResult = { ...result, at: performance.now() };
        if (result.outcome === 'correct') vibrate([20, 40, 20]);
        else if (result.outcome !== 'cancelled') vibrate(150);
      },
      [EVENTS.RADIO_MESSAGE]: (message) => {
        this.radio.push({ ...message, at: performance.now() });
        if (this.radio.length > 6) this.radio.shift();
        vibrate(25);
      },
      [EVENTS.GAME_OVER]: (results) => {
        this.results = results;
      },
      [EVENTS.RESULTS_SELF]: (mine) => {
        this.privateResults = mine;
      },
      [EVENTS.COMBAT_KILL]: ([killer, victim, weapon]) => {
        this.killfeed.push({ killer, victim, weapon, at: performance.now() });
        if (this.killfeed.length > 5) this.killfeed.shift();
      },
    };
    for (const [event, handler] of Object.entries(this.handlers)) socket.on(event, handler);

    actions.switchWeapon = (slot) => socket.emit(EVENTS.WEAPON_SWITCH, slot);
    actions.interact = () => socket.emit(EVENTS.INTERACT);

    this.inputTimer = setInterval(() => this.sendInput(), TICK_MS);
    this.pingTimer = setInterval(() => socket.emit(EVENTS.PING, Date.now()), 2000);
    socket.emit(EVENTS.PING, Date.now());
    // El primer estado privado pudo llegar antes de que este cliente escuchara
    socket.emit(EVENTS.PLAYER_SELF);
  }

  onSelf(self) {
    const prev = this.self;
    const now = performance.now();
    if (prev) {
      const before = prev.hp + prev.armor;
      if (self.hp + self.armor < before && self.alive) {
        this.damageFlashAt = now;
        this.trauma = Math.min(1, this.trauma + (before - self.hp - self.armor) / 35);
        vibrate(40);
      }
      if (prev.alive && !self.alive) vibrate([80, 60, 220]);
      if (!prev.alive && self.alive) this.predictor.forceSnap();
    }
    if (self.radar && !prev?.radar) this.radarEndsAt = now + RADAR_MS;
    if (!self.radar) this.radarEndsAt = 0;
    this.self = self;
    this.reloadEndsAt = self.reloadLeft ? now + self.reloadLeft : 0;
    this.predictedMag = selfMag(self);
    inputState.weapon = selfWeaponId(self);
    if (self.grenades === 0) inputState.grenadeMode = false;
  }

  get alive() {
    return this.self?.alive ?? true;
  }

  // Candidatos visibles para el auto apuntado, tal como se ven en pantalla
  autoTargets() {
    const frame = this.lastFrame;
    if (!frame) return [];
    const targets = [];
    for (const [id, p] of frame.others) {
      if (id !== this.myId && !(p.flags & PLAYER_FLAGS.DEAD)) targets.push({ id, x: p.x, y: p.y });
    }
    if (this.phase === 'lobby') TRAINING.dummies.forEach((d) => targets.push(d));
    return targets;
  }

  sendInput() {
    const input = readInput();
    const now = performance.now();
    if (!this.alive) {
      input.mx = 0;
      input.my = 0;
      input.buttons = 0;
    }

    // Toque rápido: se apunta localmente al mismo objetivo que elegirá el servidor
    const me = this.predictor.state;
    if (input.buttons & BUTTONS.AUTO && me) {
      const range = input.buttons & BUTTONS.GRENADE ? GRENADE.maxRange : WEAPONS[selfWeaponId(this.self)].range;
      const target = findAutoTarget(me.x, me.y, range, this.autoTargets());
      if (target) {
        input.aim = Math.atan2(target.y - me.y, target.x - me.x);
        inputState.lastAim = input.aim;
      }
    }

    const moving = input.mx !== 0 || input.my !== 0;
    const aimChanged = this.lastSentAim === null || Math.abs(angleDiff(input.aim, this.lastSentAim)) > 0.02;
    // Quieto, sin girar y sin botones: no hace falta enviar nada
    if (!moving && !aimChanged && !input.buttons) {
      this.predictor.idle(now);
      return;
    }
    const packet = encodeInput({ ...input, seq: ++seq, viewTick: this.buffer.renderTick(now) });
    // Se predice con los mismos valores redondeados que recibe el servidor
    const sent = decodeInput(packet);
    this.predictor.step(sent, now);
    this.predictFire(sent, now);
    this.lastSentAim = input.aim;
    this.socket.emit(EVENTS.INPUT, packet);
  }

  // Trazadoras y fogonazo inmediatos para los disparos propios (el daño lo decide el servidor)
  predictFire(input, now) {
    const me = this.predictor.state;
    if (!me || !this.self || !(input.buttons & BUTTONS.FIRE) || input.buttons & BUTTONS.GRENADE) return;
    if (now < this.localNextFire || now < this.reloadEndsAt || this.predictedMag <= 0) return;
    const id = selfWeaponId(this.self);
    const w = WEAPONS[id];
    this.localNextFire = now + w.intervalMs;
    this.predictedMag -= 1;

    const targets = this.autoTargets();
    const weapon = WEAPON_IDS.indexOf(id);
    for (const angle of pelletAngles(w, input.aim)) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let dist = raycastObstacles(me.x, me.y, dx, dy, w.range);
      for (const t of targets) dist = Math.min(dist, rayCircle(me.x, me.y, dx, dy, t.x, t.y, PLAYER_RADIUS));
      this.effects.push({ type: 'tracer', x: me.x, y: me.y, angle, dist, weapon });
    }
    this.effects.push({ type: 'muzzle', x: me.x, y: me.y, angle: input.aim, weapon });
    this.lastShot.set(this.myId, now);
  }

  // Se llama una vez por cuadro; escribe en `frame` para no crear objetos nuevos
  frame(now, frame) {
    frame.me = this.predictor.render(now, currentAim());
    this.buffer.sample(now, frame);
    frame.meInfo = frame.others.get(this.myId) ?? null;
    this.buffer.drainEvents(now, (snap) => {
      for (const raw of snap.shots) {
        const shot = decodeShot(raw);
        if (shot.shooterId === this.myId) continue; // ya se dibujó al predecir
        for (const { angle, dist } of shot.pellets) {
          this.effects.push({ type: 'tracer', x: shot.x, y: shot.y, angle, dist, weapon: shot.weaponIndex });
        }
        this.effects.push({ type: 'muzzle', x: shot.x, y: shot.y, angle: shot.pellets[0]?.angle ?? 0, weapon: shot.weaponIndex });
        this.lastShot.set(shot.shooterId, now);
      }
      for (const [x, y] of snap.explosions) this.effects.push({ type: 'explosion', x, y });
    });
    this.lastFrame = frame;
    this.killfeed = this.killfeed.filter((k) => now - k.at < KILLFEED_MS);
  }

  answer(index) {
    if (this.question) this.socket.emit(EVENTS.CRATE_ANSWER, { crateId: this.question.crateId, index });
  }

  cancelQuestion() {
    this.socket.emit(EVENTS.CRATE_CANCEL);
  }

  setPhase(phase) {
    this.phase = phase;
  }

  dispose() {
    clearInterval(this.inputTimer);
    clearInterval(this.pingTimer);
    for (const [event, handler] of Object.entries(this.handlers)) this.socket.off(event, handler);
    actions.switchWeapon = () => {};
    actions.interact = () => {};
  }
}
