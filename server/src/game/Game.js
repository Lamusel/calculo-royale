import { DUMMY_HP, DUMMY_REGEN_MS, INTERACT_RADIUS, RESPAWN_MS, TICK_MS, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { encodePlayerState } from '@calculo-royale/shared/codec';
import { applyInput } from '@calculo-royale/shared/movement';
import { nearestRack, TRAINING } from '@calculo-royale/shared/mapLayout';
import { finishReload, fire, startReload, switchWeapon, throwGrenade, updateGrenades } from './combat.js';
import {
  answerCrate, cancelQuestion, crateStates, createCrates, nearestCrate, openCrate, resetCrates, updateCrates, pickMatchCrates,
} from './crates.js';
import { encodeAirdrop, startMatch, stopMatch, updateMatch } from './match.js';
import { answerTransmission, encodeBombing, onPlayerDeath, resetRadio, startRadio, updateRadio, voteSector } from './radio.js';
import { onLeaderDeath, updateLeader, windOf } from './epic.js';
import { answerAmmo, requestAmmo, updateAmmo } from './ammo.js';
import { recordTick } from '../metrics.js';
import { choosePoint, encodeBus, jump, startDeploy, updateDeploy } from './deploy.js';
import { checkDuel, duelFrozen, Recorder, scoreKill } from './cine.js';
import {
  answerEngine, cancelEngine, createVehicles, driveInput, encodeVehicles, exitVehicle, interactVehicle, nearestVehicle,
  resetVehicles, updateVehicles,
} from './vehicles.js';

const DT = TICK_MS / 1000;
const round2 = (v) => Math.round(v * 100) / 100;

// Loop autoritativo de una sala. Corre también en el lobby (campo de entrenamiento).
export class Game {
  constructor(room) {
    this.room = room;
    this.tick = 0;
    this.now = 0; // tiempo del juego en ms (tick × TICK_MS)
    this.timer = null;
    this.grenades = [];
    this.nextGrenadeId = 1;
    this.dummies = [];
    this.crates = createCrates();
    this.airdropCrate = this.crates[this.crates.length - 1];
    this.alarms = [];
    this.zone = null; // solo durante la partida
    this.vehicles = createVehicles();
    this.leaderId = null;
    this.wind = null;
    this.duel = null; // { ids, introEndsAt } al quedar 2 vivos
    this.deploy = null; // bus de despliegue o elegir punto (deploy.js)
    this.killTimes = new Map(); // id → momentos de sus bajas recientes (multi-baja)
    this.recorder = new Recorder();
    resetRadio(this);
    // Eventos del tick en curso (se vacían al empezar cada tick)
    this.shots = [];
    this.explosions = [];
    this.kills = [];
    this.selfCache = new Map(); // id → último estado privado enviado
    this.resetWorld();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const t0 = performance.now();
      this.update();
      recordTick(performance.now() - t0);
    }, TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // Al pasar del lobby a la partida (o volver)
  resetWorld() {
    this.grenades = [];
    this.leaderId = null;
    this.duel = null;
    this.deploy = null;
    this.killTimes?.clear();
    this.recorder?.reset();
    if (this.vehicles) resetVehicles(this);
    for (const p of this.room.players.values()) p.question = null;
    resetCrates(this);
    this.dummies = TRAINING.dummies.map((d) => ({ ...d, hp: DUMMY_HP, lastHitAt: 0 }));
  }

  handleInput(player, input) {
    // En el bus o cayendo: solo se puede saltar
    if (player.deploying) {
      if (input.buttons & BUTTONS.JUMP) jump(this, player);
      return;
    }
    // Respondiendo el código del motor: moverse cancela
    if (player.engineQuestion) {
      if (input.mx !== 0 || input.my !== 0) cancelEngine(this, player, 'Te moviste');
      return;
    }
    // El conductor maneja, no dispara
    if (player.seat === 'driver') return;
    // Respondiendo "Obtener balas": se mueve pero no dispara
    if (player.ammoQuestion) return;
    // Abriendo una caja: quieto; moverse cancela y no se puede disparar
    if (player.question) {
      if (input.mx !== 0 || input.my !== 0) cancelQuestion(this, player, 'Te moviste');
      return;
    }
    if (input.buttons & BUTTONS.RELOAD) startReload(this, player);
    if (input.buttons & BUTTONS.GRENADE) throwGrenade(this, player, input);
    else if (input.buttons & BUTTONS.FIRE) fire(this, player, input);
  }

  switchWeapon(player, slot) {
    if (player.alive) switchWeapon(this, player, slot);
  }

  // Dentro de un jeep: bajarse. Si no, lo más cercano entre armeros (lobby), cajas y jeeps.
  interact(player) {
    if (!player.alive || player.question || player.engineQuestion || player.deploying) return;
    if (player.vehicleId !== null) {
      exitVehicle(this, player);
      return;
    }
    const options = [];
    const rack = this.room.phase === 'lobby' ? nearestRack(player.x, player.y, INTERACT_RADIUS) : null;
    if (rack) options.push({ dist: Math.hypot(rack.x - player.x, rack.y - player.y), use: () => player.giveItem(rack.item) });
    const crate = nearestCrate(this, player.x, player.y);
    if (crate) options.push({ dist: crate.dist, use: () => openCrate(this, player, crate.crate) });
    const vehicle = nearestVehicle(this, player.x, player.y);
    if (vehicle) options.push({ dist: vehicle.dist, use: () => interactVehicle(this, player, vehicle.vehicle) });
    options.sort((a, b) => a.dist - b.dist);
    options[0]?.use();
  }

  startMatch() {
    this.wind = windOf(this.room);
    this.duel = null;
    this.killTimes.clear();
    this.recorder.reset();
    startMatch(this);
    startRadio(this);
  }

  stopMatch() {
    stopMatch(this);
    resetRadio(this);
  }

  onPlayerDeath(player) {
    if (player.vehicleId !== null) exitVehicle(this, player);
    if (player.engineQuestion) cancelEngine(this, player, 'Caíste en combate');
    onLeaderDeath(this, player);
    if (this.room.phase === 'playing') this.recorder.consider(scoreKill(this, player));
    onPlayerDeath(this, player);
  }

  answerTransmission(player, id, index) {
    answerTransmission(this, player, id, index);
  }

  voteSector(player, sector) {
    voteSector(this, player, sector);
  }

  answerCrate(player, crateId, index) {
    if (answerEngine(this, player, index)) return;
    answerCrate(this, player, crateId, index);
  }

  requestAmmo(player) {
    if (!player.deploying) requestAmmo(this, player);
  }

  // Cajas de esta partida (lo pide la sala; en las pruebas están todas)
  pickCrates(rand) {
    pickMatchCrates(this, rand);
  }

  // Despliegue al iniciar (lo pide la sala; las pruebas que arman escenarios lo omiten)
  startDeploy(mode) {
    startDeploy(this, mode);
  }

  chooseDeployPoint(player, x, y) {
    choosePoint(this, player, x, y);
  }

  answerAmmo(player, id, index) {
    answerAmmo(this, player, id, index);
  }

  cancelQuestion(player) {
    if (cancelEngine(this, player, 'Cancelaste')) return;
    cancelQuestion(this, player, 'Cancelaste');
  }

  update() {
    this.tick++;
    this.now = this.tick * TICK_MS;
    this.shots = [];
    this.explosions = [];
    this.kills = [];

    const players = [...this.room.players.values()];
    const frozen = duelFrozen(this);
    if (frozen) for (const v of this.vehicles) v.speed = 0;
    for (const p of players) {
      // Presentación del duelo final: nadie se mueve
      if (frozen) p.inputs.length = 0;
      p.processInputs(
        DT,
        (input) => this.handleInput(p, input),
        (pl, input, dt) => {
          // En el bus (o eligiendo punto) no se mueve por su cuenta: solo apunta
          if (pl.deploy && !pl.air) pl.aim = input.aim;
          else if (pl.vehicleId !== null) driveInput(this, pl, input, dt);
          else applyInput(pl, input, dt);
        },
      );
      p.recordHistory(this.tick);
      if (p.reloadUntil && this.now >= p.reloadUntil) finishReload(p);
    }
    updateDeploy(this, DT);
    updateGrenades(this, DT);
    updateCrates(this);
    updateMatch(this, DT);
    updateRadio(this);
    updateVehicles(this, DT);
    updateLeader(this);
    checkDuel(this);
    updateAmmo(this);

    if (this.room.phase === 'lobby') {
      for (const d of this.dummies) {
        if (d.hp < DUMMY_HP && this.now - d.lastHitAt >= DUMMY_REGEN_MS) d.hp = DUMMY_HP;
      }
      for (const p of players) {
        if (!p.alive && this.now - p.deathAt >= RESPAWN_MS) this.room.respawnInLobby(p);
      }
    }

    for (const kill of this.kills) this.room.broadcast(EVENTS.COMBAT_KILL, kill);
    const snapshot = this.snapshot(players);
    // La partida se graba (últimos segundos) para la repetición de la mejor jugada
    if (this.room.phase === 'playing') this.recorder.push(snapshot);
    this.room.broadcastState(snapshot);
    this.sendSelfStates(players);
  }

  snapshot(players) {
    const encoded = players.map((p) => {
      const flags =
        (p.alive ? 0 : PLAYER_FLAGS.DEAD) |
        (p.reloadUntil ? PLAYER_FLAGS.RELOADING : 0) |
        (p.question || p.engineQuestion ? PLAYER_FLAGS.ANSWERING : 0) |
        (p.vehicleId !== null ? PLAYER_FLAGS.IN_VEHICLE : 0) |
        (p.id === this.leaderId ? PLAYER_FLAGS.LEADER : 0) |
        (p.deploy && !p.air ? PLAYER_FLAGS.IN_BUS : 0) |
        (p.air === 'fall' ? PLAYER_FLAGS.FALLING : 0) |
        (p.air === 'chute' ? PLAYER_FLAGS.PARACHUTE : 0);
      return encodePlayerState(p, WEAPON_IDS.indexOf(p.weaponId), flags);
    });
    return [
      this.tick,
      encoded,
      this.grenades.map((g) => [g.id, round2(g.x), round2(g.y)]),
      this.room.phase === 'lobby' ? this.dummies.map((d) => Math.ceil(d.hp)) : [],
      this.shots,
      this.explosions,
      crateStates(this),
      this.alarms.map((a) => [a.x, a.y]),
      this.zone && this.room.phase === 'playing' ? this.zone.encode(this.now) : [],
      encodeAirdrop(this),
      encodeBombing(this),
      encodeVehicles(this),
      encodeBus(this),
    ];
  }

  // El estado privado (munición, vida exacta) se envía solo al dueño y solo si cambió
  sendSelfStates(players) {
    for (const p of players) {
      if (!p.connected) continue;
      // Los tiempos restantes cambian cada tick: solo cuenta si hay o no (el cliente lleva la cuenta)
      const { reloadLeft, ammoCooldownLeft, ...rest } = p.selfState(this.now);
      const key = JSON.stringify(rest) + (reloadLeft > 0) + (ammoCooldownLeft > 0);
      if (this.selfCache.get(p.id) === key) continue;
      this.selfCache.set(p.id, key);
      this.room.emitTo(p, EVENTS.PLAYER_SELF, { ...rest, reloadLeft, ammoCooldownLeft });
    }
  }

  forgetPlayer(id) {
    this.selfCache.delete(id);
  }

  // Tras reconectar, el cliente necesita su estado aunque no haya cambiado
  resendSelf(id) {
    this.selfCache.delete(id);
  }
}
