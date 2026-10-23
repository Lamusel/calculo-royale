import { GRENADE, PLAYER_RADIUS, RADAR_MS, TICK_MS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { decodeInput, decodeShot, encodeInput } from '@calculo-royale/shared/codec';
import { raycastObstacles, rayCircle } from '@calculo-royale/shared/collision';
import { findAutoTarget, pelletAngles } from '@calculo-royale/shared/combat';
import { TRAINING } from '@calculo-royale/shared/mapLayout';
import { seatPosition } from '@calculo-royale/shared/vehicle';
import { actions, currentAim, inputState, press, readInput, resetInput } from '../input/inputState.js';
import { angleDiff, SnapshotBuffer } from './interpolation.js';
import { Predictor } from './prediction.js';
import { loadProgress, loadSkin, recordEvent, unlockedSkins } from '../achievements.js';
import { setListener, sound, updateEngine } from '../audio/sound.js';

// Contador global: si se recrea el cliente sin recargar, las secuencias siguen creciendo
let seq = 0;

const KILLFEED_MS = 6000;
const vibrate = (pattern) => navigator.vibrate?.(pattern);

// Trazadoras, fogonazos y explosiones de un snapshot (también los usa la repetición)
export function snapshotEffects(snap, effects, lastShot, now, skipShooter = null, audible = false) {
  for (const raw of snap.shots) {
    const shot = decodeShot(raw);
    if (shot.shooterId === skipShooter) continue; // ya se dibujó al predecir
    if (audible) sound.shot(shot.weaponIndex, shot.x, shot.y);
    for (const { angle, dist } of shot.pellets) {
      effects.push({ type: 'tracer', x: shot.x, y: shot.y, angle, dist, weapon: shot.weaponIndex });
    }
    effects.push({ type: 'muzzle', x: shot.x, y: shot.y, angle: shot.pellets[0]?.angle ?? 0, weapon: shot.weaponIndex });
    lastShot.set(shot.shooterId, now);
  }
  for (const [x, y] of snap.explosions) {
    effects.push({ type: 'explosion', x, y });
    if (audible) sound.explosion(x, y);
  }
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
    this.deploying = null; // 'bus' | 'fall' | 'chute' mientras dura el despliegue
    this.altitude = 0;
    this.deployInfo = null; // { mode, route, departAt, durationMs, pickUntil } de la partida
    this.ammoResult = null;
    this.replay = null; // repetición de la mejor jugada (llega justo antes de los resultados)
    this.effectViews = new EffectViews();

    this.handlers = {
      [EVENTS.STATE]: ([tick, players, grenades, dummies, shots, explosions, crates, alarms, zone, airdrop, bombing, vehicles = [], bus = []]) => {
        this.buffer.push(tick, players, grenades, dummies, shots, explosions, crates, alarms, zone, airdrop, bombing, vehicles, bus);
        // Jeep propio: [id, x, y, heading, speed, hp, conductor, pasajero, estado]
        const driving = vehicles.find((v) => v[6] === this.myId);
        const riding = vehicles.find((v) => v[7] === this.myId);
        this.vehicleId = (driving ?? riding)?.[0] ?? null;
        this.seat = driving ? 'driver' : riding ? 'passenger' : null;
        const me = players.find((p) => p[0] === this.myId);
        if (me) {
          const flags = me[8];
          // Despliegue: en el bus (o eligiendo punto), en caída libre o con paracaídas
          const deploying = flags & PLAYER_FLAGS.IN_BUS ? 'bus' : flags & PLAYER_FLAGS.FALLING ? 'fall' : flags & PLAYER_FLAGS.PARACHUTE ? 'chute' : null;
          if (deploying !== this.deploying) {
            if (deploying === 'fall') sound.jump();
            if (deploying === 'chute') sound.parachute();
          }
          this.deploying = deploying;
          this.altitude = me[9] ?? 0;
          const jeep = driving && { x: driving[1], y: driving[2], heading: driving[3], speed: driving[4] };
          const air = this.deploying === 'fall' || this.deploying === 'chute' ? this.deploying : null;
          this.predictor.reconcile(me[1], me[2], me[4], jeep, air);
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
        if (result.outcome === 'correct') sound.lockOpen();
        else if (result.outcome !== 'cancelled') sound.lockFail();
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
        if (message.kind === 'bombing') sound.siren();
        else sound.radio();
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
        if (r.correct) sound.reload();
        else if (!r.cancelled) sound.lockFail();
        this.ammoResult = { ...r, at: performance.now() };
        if (r.correct) this.achieve('correct');
        if (!r.cancelled) vibrate(r.correct ? [20, 30, 20] : 120);
      },
      [EVENTS.MATCH_DEPLOY]: (info) => {
        const now = performance.now();
        this.deployInfo = {
          ...info,
          departAt: info.departInMs !== undefined ? now + info.departInMs : null,
          pickUntil: info.pickMs !== undefined ? now + info.pickMs : null,
          myPick: null,
        };
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
    actions.jump = () => this.deploying === 'bus' && press(BUTTONS.JUMP);

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
    if (self.reloadLeft && !(prev?.reloadLeft > 0)) sound.reload();
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
    // En el bus no se camina; en el aire no se dispara (el servidor tampoco lo permite)
    if (this.deploying === 'bus') {
      input.mx = 0;
      input.my = 0;
      input.buttons &= BUTTONS.JUMP;
    } else if (this.deploying) {
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
    if (this.deploying === 'bus' && !input.buttons) {
      this.predictor.idle(now);
      return;
    }
    if (!moving && !aimChanged && !input.buttons && this.seat !== 'driver') {
      this.predictor.idle(now);
      return;
    }
    const packet = encodeInput({ ...input, seq: ++seq, viewTick: this.buffer.renderTick(now) });
    // Se predice con los mismos valores redondeados que recibe el servidor
    const sent = decodeInput(packet);
    if (sent.buttons & BUTTONS.GRENADE && this.self?.grenades > 0) sound.grenadeThrow();
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
    if (this.ammoQuestion || this.deploying) return; // respondiendo "Obtener balas" o en el aire
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
    sound.shot(weapon, me.x, me.y);
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
    // En el bus voy donde va el bus (interpolado)
    frame.deploying = this.deploying;
    if (this.deploying === 'bus' && frame.bus && frame.me) Object.assign(frame.me, { x: frame.bus.x, y: frame.bus.y });
    frame.altitude = frame.meInfo?.z ?? 0;
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
    this.buffer.drainEvents(now, (snap) => snapshotEffects(snap, this.effects, this.lastShot, now, this.myId, !this.spectator));
    this.updateAudio(frame);
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

  // Oyente donde está el jugador (o a quien sigue la cámara) y motor del jeep más cercano en marcha
  updateAudio(frame) {
    const at = frame.follow ?? frame.me;
    if (!at || this.spectator) return;
    setListener(at.x, at.y);
    let nearest = null;
    let best = Infinity;
    for (const v of frame.vehicles?.values() ?? []) {
      if (!v.driver || Math.abs(v.speed) < 0.5) continue;
      const d = Math.hypot(v.x - at.x, v.y - at.y);
      if (d < best) {
        best = d;
        nearest = v;
      }
    }
    updateEngine(nearest);
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

  chooseDeployPoint(x, y) {
    if (!this.deployInfo || this.deployInfo.mode !== 'punto') return;
    this.deployInfo.myPick = { x, y };
    this.socket.emit(EVENTS.DEPLOY_POINT, { x, y });
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
    if (phase !== 'playing') this.deployInfo = null;
    this.ammoQuestion = null;
  }

  dispose() {
    clearInterval(this.inputTimer);
    clearInterval(this.pingTimer);
    for (const [event, handler] of Object.entries(this.handlers)) this.socket.off(event, handler);
    actions.switchWeapon = () => {};
    actions.interact = () => {};
    actions.requestAmmo = () => {};
    actions.jump = () => {};
  }
}
