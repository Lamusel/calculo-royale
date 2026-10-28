import { setDynamicObstacles } from '@calculo-royale/shared/collision';
import { wallPieces } from '@calculo-royale/shared/throwables';
import { GRENADE, LOOT, MAP_HALF, PLAYER_RADIUS, RADAR_MS, THROWABLE_IDS, TICK_MS, WEAPON_IDS, WEAPONS } from '@calculo-royale/shared/constants';
import { weaponWith } from '@calculo-royale/shared/inventory';
import { RECOIL } from '@calculo-royale/shared/constants';
import { GEAR_INFO } from '@calculo-royale/shared/gear';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { decodeInput, decodeShot, encodeInput } from '@calculo-royale/shared/codec';
import { raycastObstacles, rayCircle } from '@calculo-royale/shared/collision';
import { findAutoTarget, pelletAngles } from '@calculo-royale/shared/combat';
import { TRAINING } from '@calculo-royale/shared/mapLayout';
import { seatPosition } from '@calculo-royale/shared/vehicle';
import { actions, currentAim, inputState, press, readInput, resetInput } from '../input/inputState.js';
import { angleDiff, SnapshotBuffer } from './interpolation.js';
import { Predictor } from './prediction.js';
import { LootStore } from './lootStore.js';
import { loadProgress, loadSkin, recordEvent, unlockedSkins } from '../achievements.js';
import { setListener, sound, updateBusHum, updateEngine } from '../audio/sound.js';
import { insideZone } from '@calculo-royale/shared/zone';

// Contador global: si se recrea el cliente sin recargar, las secuencias siguen creciendo
let seq = 0;

const KILLFEED_MS = 6000;
const vibrate = (pattern) => navigator.vibrate?.(pattern);

// Trazadoras, fogonazos y explosiones de un snapshot (también los usa la repetición)
// heardShot: solo los disparos sin silenciador (el minimapa nocturno los marca)
export function snapshotEffects(snap, effects, lastShot, now, skipShooter = null, audible = false, heardShot = null) {
  for (const raw of snap.shots) {
    const shot = decodeShot(raw);
    if (shot.shooterId === skipShooter) continue; // ya se dibujó al predecir
    if (audible) sound.shot(shot.weaponIndex, shot.x, shot.y, shot.silent);
    if (!shot.silent) heardShot?.set(shot.shooterId, now);
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

// Arma en mano y su cargador según el estado privado (fase 29: tres ranuras)
export const selfHand = (self) => self?.weapons?.[self.active] ?? null;
export const selfWeaponId = (self) => selfHand(self)?.id ?? 'fists';
const selfMag = (self) => selfHand(self)?.mag ?? 0;
// Munición de reserva del arma en mano (en la mochila, por tipo)
export const selfReserve = (self) => self?.ammo?.[WEAPONS[selfWeaponId(self)]?.ammo] ?? 0;

// Conecta la red con la escena: envía inputs a 20 Hz, guarda snapshots, predice al
// jugador propio (movimiento y disparos) y deja efectos en cola para la escena.
// Con myId = null es solo espectador (vista para proyector): no envía nada.
export class GameClient {
  constructor(socket, myId, phase) {
    this.socket = socket;
    this.myId = myId;
    this.spectator = myId === null;
    this.followId = null; // a quién sigue la cámara cuando estás caído (o en el proyector)
    this.transmission = null; // pregunta de práctica (espectador) o del Gulag pendiente
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
    this.heardShot = new Map(); // lo mismo, sin los disparos con silenciador (minimapa de noche)
    this.lootStore = new LootStore(); // botín en el suelo (ver lootStore.js)
    this.lootToast = null; // { names } o { full, name } al tomar algo
    this.phrases = []; // frases rápidas recientes: { id, index, at }
    this.csv = null; // CSV de la última partida (anfitrión y proyector)
    this.easy = false; // modo fácil de la sala: no cuenta para los logros
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
      [EVENTS.STATE]: ([tick, players, grenades, dummies, shots, explosions, crates, alarms, zone, airdrop, gulag, vehicles = [], bus = [], effects = []]) => {
        // Cajas: llegan solo cuando cambian ('' = igual que antes)
        if (crates) this.lastCrates = crates;
        this.buffer.push(tick, players, grenades, dummies, shots, explosions, this.lastCrates ?? '', alarms, zone, airdrop, gulag, vehicles, bus, effects);
        // Muros de las granadas muro: obstáculos para predecir el movimiento igual que el servidor
        setDynamicObstacles(effects.filter((e) => e[0] === 3).flatMap((e) => wallPieces(e[2], e[3], e[4])));
        // Jeep propio: [id, x, y, heading, speed, hp, conductor, pasajero, estado]
        const driving = vehicles.find((v) => v[6] === this.myId);
        const riding = vehicles.find((v) => v[7] === this.myId);
        const wasDriving = this.seat === 'driver';
        this.vehicleId = (driving ?? riding)?.[0] ?? null;
        this.seat = driving ? 'driver' : riding ? 'passenger' : null;
        if (this.seat === 'driver' && !wasDriving) sound.jeepStart();
        const mine = driving ?? riding;
        if (mine && this.vehicleHp !== undefined && this.vehicleHp - mine[5] >= 25) sound.jeepCrash(mine[1], mine[2]);
        this.vehicleHp = mine ? mine[5] : undefined;
        const me = players.find((p) => p[0] === this.myId);
        if (me) {
          const flags = me[8];
          // Despliegue: en el bus (o eligiendo punto), en caída libre o con paracaídas
          const deploying = flags & PLAYER_FLAGS.IN_BUS ? 'bus' : flags & PLAYER_FLAGS.FALLING ? 'fall' : flags & PLAYER_FLAGS.PARACHUTE ? 'chute' : null;
          if (deploying !== this.deploying) {
            if (deploying === 'fall') sound.jump();
            if (deploying === 'chute') sound.parachute();
            if (!deploying && this.deploying === 'chute') sound.landing();
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
        sound.hit(Boolean(killed));
        if (killed) sound.kill();
        vibrate(killed ? [30, 40, 30] : 12);
      },
      [EVENTS.CRATE_QUESTION]: (question) => {
        this.question = { ...question, receivedAt: performance.now() };
        this.lastCrateRarity = question.rarity;
        sound.question();
        this.crateResult = null;
        resetInput();
        vibrate(20);
      },
      [EVENTS.CRATE_RESULT]: (result) => {
        this.question = null;
        // Premio a elegir (fase 29): se abre la tarjeta con las opciones
        this.offer = result.options ? { crateId: result.crateId, options: result.options, at: performance.now() } : null;
        if (result.outcome === 'correct') sound.lockOpen();
        else if (result.outcome !== 'cancelled') sound.lockFail();
        this.crateResult = { ...result, at: performance.now() };
        this.showGear(result.items);
        if (result.outcome === 'correct') {
          this.achieve('correct');
          if (this.lastCrateRarity === 3) this.achieve('legendary');
          vibrate([20, 40, 20]);
        }
        else if (result.outcome !== 'cancelled') vibrate(150);
      },
      [EVENTS.RADIO_MESSAGE]: (message) => {
        this.radio.push({ ...message, at: performance.now() });
        sound.radio();
        if (message.kind === 'airdrop') sound.plane();
        if (this.radio.length > 6) this.radio.shift();
        vibrate(25);
      },
      [EVENTS.TRANSMISSION]: (t) => {
        const entry = { ...t, receivedAt: performance.now() };
        sound.question();
        this.transmission = entry;
        vibrate(15);
      },
      [EVENTS.TRANSMISSION_RESULT]: (r) => {
        if (this.transmission?.id === r.id) this.transmission = null;
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
        sound.question();
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
      [EVENTS.PHRASE]: ({ id, index }) => {
        this.phrases.push({ id, index, at: performance.now() });
        if (this.phrases.length > 6) this.phrases.shift();
        sound.click();
      },
      [EVENTS.RESULTS_CSV]: (csv) => {
        this.csv = csv;
      },
      [EVENTS.LOOT_SYNC]: (list) => this.lootStore.sync(list),
      [EVENTS.LOOT_ADD]: (list) => this.lootStore.add(list),
      [EVENTS.LOOT_REMOVE]: (ids) => this.lootStore.remove(ids),
      [EVENTS.CRATE_CHOSEN]: (result) => {
        this.offer = null;
        this.lootToast = { names: result.loot, items: result.items, at: performance.now() };
        this.showGear(result.items);
      },
      [EVENTS.LOOT_TAKEN]: (result) => {
        // Caja de botín: abre su lista. Arma sin lugar: pregunta cuál reemplazar
        if (result.box) {
          this.openBox = result.box;
          const e = this.lootStore.items.get(result.box);
          this.openBoxAt = e ? { x: e.x, y: e.y } : null;
          return;
        }
        if (result.need) {
          this.replacePrompt = { ...result, at: performance.now() };
          return;
        }
        this.lootToast = { ...result, at: performance.now() };
        this.showGear(result.items);
        if (!result.full) sound.pickup();
        vibrate(result.full ? 60 : 15);
      },
      [EVENTS.COMBAT_KILL]: ([killer, victim, weapon]) => {
        this.killfeed.push({ killer, victim, weapon, at: performance.now() });
        if (this.killfeed.length > 5) this.killfeed.shift();
      },
    };
    for (const [event, handler] of Object.entries(this.handlers)) socket.on(event, handler);

    actions.switchWeapon = (slot) => socket.emit(EVENTS.WEAPON_SWITCH, slot);
    // Con varias cosas cerca, la zona de acción elige cuál (kind); si no, la más cercana
    actions.interact = (kind = null) => socket.emit(EVENTS.INTERACT, kind);
    actions.selectThrowable = (item) => this.self?.throwables?.[item] > 0 && this.selectThrowable(item);
    actions.cycleThrowable = (step) => {
      const have = THROWABLE_IDS.filter((id) => this.self?.throwables?.[id] > 0);
      if (!have.length) return;
      const i = have.indexOf(this.self.throwSel);
      this.selectThrowable(have[(i + step + have.length) % have.length]);
    };
    actions.requestAmmo = () => this.requestAmmo();
    actions.useItem = (item) => this.useItem(item);
    actions.phrase = (index) => this.socket.emit(EVENTS.QUICK_PHRASE, index);
    // En el bus salta; cayendo, abre el paracaídas antes
    actions.jump = () => (this.deploying === 'bus' || this.deploying === 'fall') && press(BUTTONS.JUMP);

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
        sound.hurt();
        this.damageFlashAt = now;
        this.trauma = Math.min(1, this.trauma + (before - self.hp - self.armor) / 35);
        vibrate(40);
      }
      if (prev.alive && !self.alive) vibrate([80, 60, 220]);
      if (!prev.alive && self.alive) this.predictor.forceSnap();
    }
    if (self.radar && !prev?.radar) {
      this.radarEndsAt = now + RADAR_MS;
      sound.radar();
    }
    if (self.healing && !prev?.healing) sound.healStart();
    if (!self.healing && prev?.healing && self.alive) {
      const item = prev.healing.item;
      if ((self.heals?.[item] ?? 0) < (prev.heals?.[item] ?? 0)) sound.healEnd();
    }
    if (prev && (self.active !== prev.active || selfWeaponId(self) !== selfWeaponId(prev))) sound.weaponSwitch();
    if (!self.radar) this.radarEndsAt = 0;
    if (self.reloadLeft && !(prev?.reloadLeft > 0)) sound.reload();
    this.self = self;
    this.reloadEndsAt = self.reloadLeft ? now + self.reloadLeft : 0;
    this.ammoCooldownEndsAt = self.ammoCooldownLeft ? now + self.ammoCooldownLeft : 0;
    this.predictedMag = selfMag(self);
    this.predictor.speedFactor = self.speedFactor ?? 1;
    this.healingEndsAt = self.healing ? now + self.healing.left : 0;
    this.drinkEndsAt = self.drinkLeft ? now + self.drinkLeft : 0;
    inputState.weapon = selfWeaponId(self);
    inputState.scope = selfHand(self)?.att?.scope ?? null;
    inputState.throwSel = self.throwSel;
    if (!(self.throwables?.[self.throwSel] > 0)) inputState.grenadeMode = false;
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
      // Cayendo: solo Espacio (abrir el paracaídas antes)
      input.buttons &= this.deploying === 'fall' ? BUTTONS.JUMP : 0;
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
    if (sent.buttons & BUTTONS.GRENADE && this.self?.throwables?.[this.self.throwSel] > 0) sound.grenadeThrow();
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
    if (this.predictedMag <= 0 && now >= this.reloadEndsAt && now - (this.dryFireAt ?? 0) > 350) {
      this.dryFireAt = now;
      sound.dryFire();
    }
    if (now < this.localNextFire || now < this.reloadEndsAt || this.predictedMag <= 0) return;
    const id = selfWeaponId(this.self);
    // Retroceso previsto (el mismo cálculo que el servidor): abre la dispersión y la cámara salta
    this.localRecoil = Math.max(0, (this.localRecoil ?? 0) - ((now - (this.localRecoilAt ?? now)) / 1000) * RECOIL.recoverPerSec);
    const att = selfHand(this.self)?.att;
    const w = weaponWith(id, att, this.localRecoil);
    const step = (RECOIL.perShot[id] ?? 0.3) * (att?.stock ? RECOIL.stock : 1);
    this.localRecoil = Math.min(RECOIL.max, this.localRecoil + step);
    this.localRecoilAt = now;
    this.kick = Math.min(1, (this.kick ?? 0) + step);
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
    this.buffer.drainEvents(now, (snap) => snapshotEffects(snap, this.effects, this.lastShot, now, this.myId, !this.spectator, this.heardShot));
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
    const now = performance.now();
    updateBusHum(this.deploying === 'bus');
    const second = Math.floor(now / 1000);
    if (second !== this.audioSecond) {
      this.audioSecond = second;
      // Fuera de la zona: latido cada segundo
      const z = frame.zone;
      if (z?.length && this.alive && frame.me && !this.deploying && !insideZone({ cx: z[0], cy: z[1], p: z[2], q: z[3] }, frame.me.x, frame.me.y)) sound.zonePulse();
      // Elegir punto: los últimos 3 segundos
      const pickLeft = this.deployInfo?.pickUntil && this.deploying === 'bus' ? Math.ceil((this.deployInfo.pickUntil - now) / 1000) : 0;
      if (pickLeft > 0 && pickLeft <= 3) sound.countdown(pickLeft === 1);
      // Pregunta con el tiempo acabándose (últimos 5 s)
      for (const q of [this.question, this.ammoQuestion, this.transmission]) {
        if (!q?.timeLimitMs) continue;
        const left = (q.receivedAt + q.timeLimitMs - now) / 1000;
        if (left > 0 && left <= 5) sound.timeWarning();
      }
    }
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
    if (this.easy) return; // en modo fácil no se desbloquea nada
    for (const id of recordEvent(type, value)) {
      this.unlocks.push({ id, at: performance.now() });
      sound.achievement();
    }
  }

  answerTransmission(id, index) {
    this.socket.emit(EVENTS.TRANSMISSION_ANSWER, { id, index });
  }

  // Gulag con 3 aciertos: rifle o escopeta
  chooseGulagWeapon(weapon) {
    this.socket.emit(EVENTS.GULAG_CHOICE, weapon);
  }

  // Jugadores vivos que se pueden seguir con la cámara
  // Vivos para seguir con la cámara. gulag: true solo los que pelean en el Gulag (fuera del mapa),
  // false solo los de la partida, null todos
  followable(frame = this.lastFrame, gulag = null) {
    if (!frame) return [];
    return [...frame.others]
      .filter(([id, p]) => id !== this.myId && !(p.flags & PLAYER_FLAGS.DEAD) && (gulag === null || (Math.abs(p.x) > MAP_HALF) === gulag))
      .map(([id]) => id);
  }

  // ¿La cámara está siguiendo un combate del Gulag?
  get watchingGulag() {
    const p = this.lastFrame?.others.get(this.followId);
    return Boolean(p && Math.abs(p.x) > MAP_HALF);
  }

  // Cambia entre ver el Gulag y ver la partida
  watchGulag(on) {
    const ids = this.followable(this.lastFrame, on);
    if (ids.length) this.followId = ids[0];
  }

  // Cambia a quién sigue la cámara (+1 siguiente, −1 anterior), sin salir de la vista actual
  cycleFollow(step) {
    const ids = this.followable(this.lastFrame, this.watchingGulag);
    if (ids.length === 0) return;
    const i = ids.indexOf(this.followId);
    this.followId = ids[(i + step + ids.length) % ids.length];
  }

  // Tarjeta breve con el equipo recién recibido: icono, nombre y efecto (fase 25)
  showGear(items = []) {
    const gear = items.filter((id) => GEAR_INFO[id] || WEAPONS[id]);
    if (gear.length) this.gearCard = { items: gear, at: performance.now() };
  }

  // Inventario (fase 29): todo lo pide al servidor, que lo valida
  inventory(op) {
    this.socket.emit(EVENTS.INVENTORY, op);
  }

  switchWeaponSlot(slot) {
    this.socket.emit(EVENTS.WEAPON_SWITCH, slot);
  }

  takeLoot(lootId, extra = {}) {
    this.replacePrompt = null;
    this.socket.emit(EVENTS.INVENTORY, { op: 'take', lootId, ...extra });
  }

  chooseOffer(index) {
    this.socket.emit(EVENTS.CRATE_CHOOSE, index);
  }

  selectThrowable(item) {
    inputState.throwSel = item;
    this.socket.emit(EVENTS.INVENTORY, { op: 'select', item });
  }

  // Botín en el suelo (lo leen la escena y el aviso "Tomar …")
  get loot() {
    return this.lootStore.items;
  }

  get lootVersion() {
    return this.lootStore.version;
  }

  // Botín al alcance (el más cercano), para el aviso "Tomar …"
  nearestLoot(x, y) {
    let best = null;
    let bestDist = LOOT.pickupRadius;
    for (const e of this.loot.values()) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  // Venda, botiquín o bebida (el servidor decide si se puede)
  useItem(item) {
    if (this.alive && !this.self?.healing) this.socket.emit(EVENTS.USE_ITEM, item);
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
    updateBusHum(false);
    updateEngine(null);
    for (const [event, handler] of Object.entries(this.handlers)) this.socket.off(event, handler);
    actions.switchWeapon = () => {};
    actions.interact = () => {};
    actions.useItem = () => {};
    actions.phrase = () => {};
    actions.requestAmmo = () => {};
    actions.jump = () => {};
  }
}
