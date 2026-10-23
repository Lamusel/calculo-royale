import { GRENADE, PLAYER_RADIUS, RADAR_MS, TICK_MS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { decodeInput, decodeShot, encodeInput } from '@calculo-royale/shared/codec';
import { raycastObstacles, rayCircle } from '@calculo-royale/shared/collision';
import { findAutoTarget, pelletAngles } from '@calculo-royale/shared/combat';
import { TRAINING } from '@calculo-royale/shared/mapLayout';
import { seatPosition } from '@calculo-royale/shared/vehicle';
import { actions, currentAim, inputState, readInput, resetInput } from '../input/inputState.js';
import { angleDiff, SnapshotBuffer } from './interpolation.js';
import { Predictor } from './prediction.js';
import { loadProgress, loadSkin, recordEvent, unlockedSkins } from '../achievements.js';

// Contador global: si se recrea el cliente sin recargar, las secuencias siguen creciendo
let seq = 0;

const KILLFEED_MS = 6000;
const vibrate = (pattern) => navigator.vibrate?.(pattern);

// Trazadoras, fogonazos y explosiones de un snapshot (también los usa la repetición)
export function snapshotEffects(snap, effects, lastShot, now, skipShooter = null) {
  for (const raw of snap.shots) {
    const shot = decodeShot(raw);
    if (shot.shooterId === skipShooter) continue; // ya se dibujó al predecir
    for (const { angle, dist } of shot.pellets) {
      effects.push({ type: 'tracer', x: shot.x, y: shot.y, angle, dist, weapon: shot.weaponIndex });
    }
    effects.push({ type: 'muzzle', x: shot.x, y: shot.y, angle: shot.pellets[0]?.angle ?? 0, weapon: shot.weaponIndex });
    lastShot.set(shot.shooterId, now);
  }
  for (const [x, y] of snap.explosions) effects.push({ type: 'explosion', x, y });
}

// Cola de efectos con una copia por vista: el proyector dibuja dos escenas a la vez (duelo)
export class EffectViews {
  constructor() {
    this.views = new Map();
  }

  add(id) {
    this.views.set(id, []);
  }

  remove(id) {
    this.views.delete(id);
  }

  // Reparte lo nuevo de `effects` a todas las vistas y devuelve lo pendiente de `id`
  drain(effects, id) {
    const fresh = effects.splice(0);
    for (const queue of this.views.values()) queue.push(...fresh);
    return this.views.get(id)?.splice(0) ?? fresh;
  }
}

export const selfWeaponId = (self) => (self?.slot === 2 && self.primary ? self.primary.id : 'pistol');
const selfMag = (self) => (selfWeaponId(self) === 'pistol' ? self.pistolMag : self.primary.mag);

// Conecta la red con la escena: envía inputs a 20 Hz, guarda snapshots, predice al
// jugador propio (movimiento y disparos) y deja efectos en cola para la escena.
// Con myId = null es solo espectador (vista para proyector): no envía nada.
export class GameClient {
  constructor(socket, myId, phase) {
    this.socket = socket;
    this.myId = myId;
    this.spectator = myId === null;
    this.followId = null; // a quién sigue la cámara cuando estás caído (o en el proyector)
    this.transmission = null; // pregunta de operador de radio pendiente
    this.intercept = null; // pregunta de intercepción pendiente
    this.transmissionResult = null;
    this.classStats = null;
    this.unlocks = []; // skins de honor recién desbloqueadas: [{ id, at }]
    this.operatorStreak = 0;
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
    this.vehicleId = null; // jeep en el que voy
    this.seat = null; // 'driver' | 'passenger'
    this.duel = null; // { ids, introMs, at } duelo final
    this.ammoQuestion = null; // "Obtener balas" pendiente
    this.ammoResult = null;
    this.replay = null; // repetición de la mejor jugada (llega justo antes de los resultados)
    this.effectViews = new EffectViews();

    this.handlers = {
      [EVENTS.STATE]: ([tick, players, grenades, dummies, shots, explosions, crates, alarms, zone, airdrop, bombing, vehicles = []]) => {
        this.buffer.push(tick, players, grenades, dummies, shots, explosions, crates, alarms, zone, airdrop, bombing, vehicles);
        // Jeep propio: [id, x, y, heading, speed, hp, conductor, pasajero, estado]
        const driving = vehicles.find((v) => v[6] === this.myId);
        const riding = vehicles.find((v) => v[7] === this.myId);
        this.vehicleId = (driving ?? riding)?.[0] ?? null;
        this.seat = driving ? 'driver' : riding ? 'passenger' : null;
        const me = players.find((p) => p[0] === this.myId);
        if (me) {
          const jeep = driving && { x: driving[1], y: driving[2], heading: driving[3], speed: driving[4] };
          this.predictor.reconcile(me[1], me[2], me[4], jeep);
        }
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
        this.lastCrateRarity = question.rarity;
        this.crateResult = null;
        resetInput();
        vibrate(20);
      },
      [EVENTS.CRATE_RESULT]: (result) => {
        this.question = null;
        this.crateResult = { ...result, at: performance.now() };
        if (result.outcome === 'correct') {
          this.achieve('correct');
          if (this.lastCrateRarity === 3) this.achieve('legendary');
          vibrate([20, 40, 20]);
        }
        else if (result.outcome !== 'cancelled') vibrate(150);
      },
      [EVENTS.RADIO_MESSAGE]: (message) => {
        this.radio.push({ ...message, at: performance.now() });
        if (this.radio.length > 6) this.radio.shift();
        vibrate(25);
      },
      [EVENTS.TRANSMISSION]: (t) => {
        const entry = { ...t, receivedAt: performance.now() };
        if (t.kind === 'operator') this.transmission = entry;
        else this.intercept = entry;
        vibrate(15);
      },
      [EVENTS.TRANSMISSION_RESULT]: (r) => {
        if (r.kind === 'operator' && this.transmission?.id === r.id) this.transmission = null;
        if (r.kind === 'intercept' && this.intercept?.id === r.id) this.intercept = null;
        this.transmissionResult = { ...r, at: performance.now() };
        if (r.correct) this.achieve('correct');
        if (r.kind === 'operator') {
          this.operatorStreak = r.correct ? this.operatorStreak + 1 : 0;
          this.achieve('operatorStreak', this.operatorStreak);
        }
        vibrate(r.correct ? [20, 30, 20] : 120);
      },
      [EVENTS.CLASS_STATS]: (stats) => {
        this.classStats = stats;
      },
      [EVENTS.GAME_OVER]: (results) => {
        this.results = results;
      },
      [EVENTS.AMMO_QUESTION]: (q) => {
        this.ammoQuestion = { ...q, receivedAt: performance.now() };
        this.ammoResult = null;
        vibrate(15);
      },
      [EVENTS.AMMO_RESULT]: (r) => {
        if (this.ammoQuestion?.id === r.id) this.ammoQuestion = null;
        this.ammoResult = { ...r, at: performance.now() };
        if (r.correct) this.achieve('correct');
        if (!r.cancelled) vibrate(r.correct ? [20, 30, 20] : 120);
      },
      [EVENTS.MATCH_DUEL]: (duel) => {
        this.duel = { ...duel, at: performance.now() };
        vibrate([40, 60, 40]);
      },
      [EVENTS.MATCH_REPLAY]: (replay) => {
        this.replay = replay;
      },
      [EVENTS.RESULTS_SELF]: (mine) => {
        this.privateResults = mine;
        // Ganar sin fallar ninguna pregunta (y habiendo respondido al menos una)
        const answered = Object.values(mine.byTopic ?? {}).reduce((n, t) => n + t.total, 0);
        if (this.results?.winnerId === this.myId && answered > 0 && mine.failed.length === 0) this.achieve('flawlessWin');
      },
      [EVENTS.COMBAT_KILL]: ([killer, victim, weapon]) => {
        this.killfeed.push({ killer, victim, weapon, at: performance.now() });
        if (this.killfeed.length > 5) this.killfeed.shift();
      },
    };
    for (const [event, handler] of Object.entries(this.handlers)) socket.on(event, handler);

    actions.switchWeapon = (slot) => socket.emit(EVENTS.WEAPON_SWITCH, slot);
    actions.interact = () => socket.emit(EVENTS.INTERACT);
    actions.requestAmmo = () => this.requestAmmo();

    this.pingTimer = setInterval(() => socket.emit(EVENTS.PING, Date.now()), 2000);
    socket.emit(EVENTS.PING, Date.now());
    if (this.spectator) return;
    this.sendSkin(loadSkin());
    this.inputTimer = setInterval(() => this.sendInput(), TICK_MS);
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
    this.ammoCooldownEndsAt = self.ammoCooldownLeft ? now + self.ammoCooldownLeft : 0;
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
    // Presentación del duelo final: quietos (el servidor ignora los inputs)
    if (this.duelIntro(now)) {
      input.mx = 0;
      input.my = 0;
      input.buttons = 0;
    }
    // El pasajero no camina: solo apunta y dispara
    if (this.seat === 'passenger') {
      input.mx = 0;
      input.my = 0;
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
    // Quieto, sin girar y sin botones: no hace falta enviar nada (salvo al manejar: el jeep frena con inputs)
    if (!moving && !aimChanged && !input.buttons && this.seat !== 'driver') {
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
    if (this.seat === 'driver') return; // el conductor no dispara
    if (this.ammoQuestion) return; // respondiendo "Obtener balas"
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
    // De pasajero voy sentado en el jeep tal como se ve (interpolado)
    const ride = this.seat === 'passenger' ? frame.vehicles.get(this.vehicleId) : null;
    if (ride && frame.me) Object.assign(frame.me, seatPosition(ride, 'passenger'));
    frame.myVehicleId = this.vehicleId;
    frame.mySeat = this.seat;
    // Caído (o en el proyector): la cámara sigue a quien te eliminó o a otro vivo
    const dead = this.self && !this.self.alive && this.phase === 'playing';
    if (dead || (this.spectator && this.followId !== null)) {
      const followed = frame.others.get(this.followId);
      if (!followed || followed.flags & PLAYER_FLAGS.DEAD) {
        const killer = frame.others.get(this.self?.killedBy);
        this.followId = killer && !(killer.flags & PLAYER_FLAGS.DEAD) ? this.self.killedBy : (this.followable(frame)[0] ?? null);
      }
      frame.follow = frame.others.get(this.followId) ?? null;
    } else {
      frame.follow = null;
    }
    this.buffer.drainEvents(now, (snap) => snapshotEffects(snap, this.effects, this.lastShot, now, this.myId));
    this.lastFrame = frame;
    this.killfeed = this.killfeed.filter((k) => now - k.at < KILLFEED_MS);
  }

  drainEffects(viewId) {
    return this.effectViews.drain(this.effects, viewId);
  }

  // ¿Está corriendo la presentación del duelo final?
  duelIntro(now = performance.now()) {
    return Boolean(this.duel && now - this.duel.at < this.duel.introMs);
  }

  // Cámara de cine: durante la presentación del duelo gira alrededor de cada finalista (mitad del tiempo cada uno)
  cinematic(now, frame) {
    if (!this.duelIntro(now)) return null;
    const elapsed = now - this.duel.at;
    const id = this.duel.ids[elapsed < this.duel.introMs / 2 ? 0 : 1];
    const pos = id === this.myId && frame.me ? frame.me : frame.others.get(id);
    if (!pos) return null;
    return { id, x: pos.x, y: pos.y, angle: elapsed / 700, distance: 6.5, height: 3 };
  }

  // Avisa al servidor qué skin usar (con las de honor desbloqueadas en este navegador)
  sendSkin(skin) {
    this.socket.emit(EVENTS.PLAYER_SKIN, { skin, unlocked: unlockedSkins(loadProgress()) });
  }

  achieve(type, value) {
    for (const id of recordEvent(type, value)) this.unlocks.push({ id, at: performance.now() });
  }

  answerTransmission(id, index) {
    this.socket.emit(EVENTS.TRANSMISSION_ANSWER, { id, index });
  }

  voteSector(sector) {
    this.socket.emit(EVENTS.VOTE_SECTOR, sector);
  }

  // Jugadores vivos que se pueden seguir con la cámara
  followable(frame = this.lastFrame) {
    if (!frame) return [];
    return [...frame.others].filter(([id, p]) => id !== this.myId && !(p.flags & PLAYER_FLAGS.DEAD)).map(([id]) => id);
  }

  // Cambia a quién sigue la cámara (+1 siguiente, −1 anterior)
  cycleFollow(step) {
    const ids = this.followable();
    if (ids.length === 0) return;
    const i = ids.indexOf(this.followId);
    this.followId = ids[(i + step + ids.length) % ids.length];
  }

  requestAmmo() {
    if (!this.ammoQuestion && this.alive) this.socket.emit(EVENTS.AMMO_REQUEST);
  }

  answerAmmo(index) {
    if (this.ammoQuestion) this.socket.emit(EVENTS.AMMO_ANSWER, { id: this.ammoQuestion.id, index });
  }

  answer(index) {
    if (this.question) this.socket.emit(EVENTS.CRATE_ANSWER, { crateId: this.question.crateId, index });
  }

  cancelQuestion() {
    this.socket.emit(EVENTS.CRATE_CANCEL);
  }

  setPhase(phase) {
    this.phase = phase;
    // El duelo y la repetición son de la partida que terminó
    if (phase !== 'results') {
      this.duel = null;
      this.replay = null;
    }
    this.ammoQuestion = null;
  }

  dispose() {
    clearInterval(this.inputTimer);
    clearInterval(this.pingTimer);
    for (const [event, handler] of Object.entries(this.handlers)) this.socket.off(event, handler);
    actions.switchWeapon = () => {};
    actions.interact = () => {};
    actions.requestAmmo = () => {};
  }
}
