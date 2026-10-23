import { randomUUID } from 'node:crypto';
import { MAX_PLAYERS, PLAYER_COLORS, RECONNECT_GRACE_MS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { Game } from '../game/Game.js';
import { Player } from '../game/Player.js';
import { World } from '../game/World.js';

export class Room {
  constructor(code, io, onEmpty) {
    this.code = code;
    this.io = io;
    this.onEmpty = onEmpty;
    this.phase = 'lobby'; // 'lobby' | 'playing'
    this.hostId = null;
    this.players = new Map(); // id → Player
    this.nextId = 1;
    this.world = new World();
    this.game = new Game(this);
    this.game.start();
  }

  get isFull() {
    return this.players.size >= MAX_PLAYERS;
  }

  findByToken(token) {
    for (const player of this.players.values()) {
      if (player.token === token) return player;
    }
    return null;
  }

  addPlayer(socket, name) {
    const player = new Player({
      id: this.nextId++,
      name,
      color: this.pickColor(),
      token: randomUUID(),
    });
    const spawn = this.world.lobbySpawn();
    player.teleport(spawn.x, spawn.y);
    this.players.set(player.id, player);
    if (this.hostId === null) this.hostId = player.id;
    this.bind(socket, player);
    return player;
  }

  // Asocia un socket a un jugador (al unirse o al reconectar)
  bind(socket, player) {
    if (player.socketId && player.socketId !== socket.id) {
      const old = this.io.sockets.sockets.get(player.socketId);
      if (old) {
        old.emit(EVENTS.ROOM_KICKED, { reason: 'Abriste la partida en otra pestaña' });
        old.leave(this.code);
        old.data.roomCode = null;
        old.disconnect(true);
      }
    }
    clearTimeout(player.removeTimer);
    player.removeTimer = null;
    player.socketId = socket.id;
    player.connected = true;
    player.resetInputs();
    socket.data.roomCode = this.code;
    socket.data.playerId = player.id;
    socket.join(this.code);
    this.broadcastInfo();
  }

  // Desconexión involuntaria: se guarda el jugador un rato por si vuelve
  markDisconnected(player) {
    player.connected = false;
    player.socketId = null;
    player.removeTimer = setTimeout(() => this.removePlayer(player.id), RECONNECT_GRACE_MS);
    this.broadcastInfo();
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    clearTimeout(player.removeTimer);
    this.players.delete(id);
    if (this.hostId === id) {
      const next = [...this.players.values()].find((p) => p.connected) ?? this.players.values().next().value;
      this.hostId = next ? next.id : null;
    }
    if (this.players.size === 0) {
      this.destroy();
      return;
    }
    this.broadcastInfo();
  }

  start() {
    this.phase = 'playing';
    const players = [...this.players.values()];
    const spawns = this.world.gameSpawns(players.length);
    players.forEach((p, i) => p.teleport(spawns[i].x, spawns[i].y));
    this.broadcastInfo();
  }

  pickColor() {
    const used = new Set([...this.players.values()].map((p) => p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[this.nextId % PLAYER_COLORS.length];
  }

  info() {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      players: [...this.players.values()].map((p) => p.info()),
    };
  }

  broadcastInfo() {
    this.io.to(this.code).emit(EVENTS.ROOM_INFO, this.info());
  }

  broadcastState(snapshot) {
    // volatile: si un cliente va atrasado se descarta el snapshot viejo en vez de acumularlo
    this.io.to(this.code).volatile.emit(EVENTS.STATE, snapshot);
  }

  destroy() {
    this.game.stop();
    for (const player of this.players.values()) clearTimeout(player.removeTimer);
    this.players.clear();
    this.onEmpty(this);
  }
}
