import { DUMMY_HP, DUMMY_REGEN_MS, INTERACT_RADIUS, RESPAWN_MS, TICK_MS, WEAPON_IDS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { encodePlayerState } from '@calculo-royale/shared/codec';
import { nearestRack, TRAINING } from '@calculo-royale/shared/mapLayout';
import { finishReload, fire, startReload, switchWeapon, throwGrenade, updateGrenades } from './combat.js';
import {
  answerCrate, cancelQuestion, crateStates, createCrates, nearestCrate, openCrate, resetCrates, updateCrates,
} from './crates.js';
import { encodeAirdrop, startMatch, stopMatch, updateMatch } from './match.js';

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
    // Eventos del tick en curso (se vacían al empezar cada tick)
    this.shots = [];
    this.explosions = [];
    this.kills = [];
    this.selfCache = new Map(); // id → último estado privado enviado
    this.resetWorld();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.update(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // Al pasar del lobby a la partida (o volver)
  resetWorld() {
    this.grenades = [];
    for (const p of this.room.players.values()) p.question = null;
    resetCrates(this);
    this.dummies = TRAINING.dummies.map((d) => ({ ...d, hp: DUMMY_HP, lastHitAt: 0 }));
  }

  handleInput(player, input) {
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

  // Lo más cercano entre armeros (solo en el lobby) y cajas de suministro
  interact(player) {
    if (!player.alive || player.question) return;
    const rack = this.room.phase === 'lobby' ? nearestRack(player.x, player.y, INTERACT_RADIUS) : null;
    const crate = nearestCrate(this, player.x, player.y);
    const rackDist = rack ? Math.hypot(rack.x - player.x, rack.y - player.y) : Infinity;
    if (crate && crate.dist < rackDist) openCrate(this, player, crate.crate);
    else if (rack) player.giveItem(rack.item);
  }

  startMatch() {
    startMatch(this);
  }

  stopMatch() {
    stopMatch(this);
  }

  answerCrate(player, crateId, index) {
    answerCrate(this, player, crateId, index);
  }

  cancelQuestion(player) {
    cancelQuestion(this, player, 'Cancelaste');
  }

  update() {
    this.tick++;
    this.now = this.tick * TICK_MS;
    this.shots = [];
    this.explosions = [];
    this.kills = [];

    const players = [...this.room.players.values()];
    for (const p of players) {
      p.processInputs(DT, (input) => this.handleInput(p, input));
      p.recordHistory(this.tick);
      if (p.reloadUntil && this.now >= p.reloadUntil) finishReload(p);
    }
    updateGrenades(this, DT);
    updateCrates(this);
    updateMatch(this, DT);

    if (this.room.phase === 'lobby') {
      for (const d of this.dummies) {
        if (d.hp < DUMMY_HP && this.now - d.lastHitAt >= DUMMY_REGEN_MS) d.hp = DUMMY_HP;
      }
      for (const p of players) {
        if (!p.alive && this.now - p.deathAt >= RESPAWN_MS) this.room.respawnInLobby(p);
      }
    }

    for (const kill of this.kills) this.room.broadcast(EVENTS.COMBAT_KILL, kill);
    this.room.broadcastState(this.snapshot(players));
    this.sendSelfStates(players);
  }

  snapshot(players) {
    const encoded = players.map((p) => {
      const flags =
        (p.alive ? 0 : PLAYER_FLAGS.DEAD) |
        (p.reloadUntil ? PLAYER_FLAGS.RELOADING : 0) |
        (p.question ? PLAYER_FLAGS.ANSWERING : 0);
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
    ];
  }

  // El estado privado (munición, vida exacta) se envía solo al dueño y solo si cambió
  sendSelfStates(players) {
    for (const p of players) {
      if (!p.connected) continue;
      const { reloadLeft, ...rest } = p.selfState(this.now);
      const key = JSON.stringify(rest) + (reloadLeft > 0);
      if (this.selfCache.get(p.id) === key) continue;
      this.selfCache.set(p.id, key);
      this.room.emitTo(p, EVENTS.PLAYER_SELF, { ...rest, reloadLeft });
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
