import { assignTeams } from '../game/teams.js';
import { randomUUID } from 'node:crypto';
import { BOTS, MAX_PLAYERS, PLAYER_COLORS, RECONNECT_GRACE_MS, SCORE } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { ALL_TOPICS } from '../questions/QuestionBank.js';
import { classStats } from '../game/radio.js';
import { buildRecord, recordToCsv, saveResults } from '../storage.js';
import { awardMedals } from '../game/medals.js';
import { resetBot } from '../game/bots.js';
import { pickWeather } from '../game/epic.js';

// Puntaje final: puestos superados + bajas + aciertos (también de operador e intercepción)
export function score(place, total, kills, correct) {
  return (total - place) * SCORE.place + kills * SCORE.kill + correct * SCORE.correct;
}
import { Game } from '../game/Game.js';
import { Player } from '../game/Player.js';
import { World } from '../game/World.js';

const INTEREST_RADIUS = 150; // m (la niebla y la cámara no muestran más lejos)
const INTEREST_EVERY = 5; // los lejanos a 4 Hz

export class Room {
  constructor(code, io, onEmpty) {
    this.code = code;
    this.io = io;
    this.onEmpty = onEmpty;
    this.phase = 'lobby'; // 'lobby' | 'playing' | 'results'
    this.hostId = null;
    this.topics = [...ALL_TOPICS]; // temas de las preguntas (los elige el host en el lobby)
    this.weatherChoice = 'aleatorio'; // lo elige el host; se resuelve al iniciar
    this.deployMode = 'bus'; // despliegue: 'bus' | 'punto' (lo elige el host)
    this.duration = 'normal'; // duración de la partida: 'corta' | 'normal' | 'larga' (lo elige el host)
    this.teamMode = 'solo'; // 'solo' | 'duos' | 'squads' (fase 33)
    this.weather = 'despejado';
    this.windAngle = 0;
    this.easy = false; // modo fácil: preguntas de aritmética (no cuenta para los logros; el CSV lo marca)
    this.players = new Map(); // id → Player
    this.nextId = 1;
    this.world = new World();
    this.game = new Game(this);
    this.game.start();
  }

  get isFull() {
    return this.players.size >= MAX_PLAYERS;
  }

  // Personas en la sala (sin contar bots)
  get humans() {
    return [...this.players.values()].filter((p) => !p.bot);
  }

  // Completar con bots hasta N jugadores en total (0 = quitarlos). Solo en el lobby.
  fillBots(target) {
    const goal = Math.max(0, Math.min(MAX_PLAYERS, Math.floor(Number(target) || 0)));
    for (const p of [...this.players.values()]) {
      if (p.bot && (goal === 0 || this.players.size > goal)) this.removePlayer(p.id);
    }
    let n = [...this.players.values()].filter((p) => p.bot).length;
    while (goal > 0 && this.players.size < goal && n < BOTS.max) {
      n++;
      const bot = new Player({ id: this.nextId++, name: `${BOTS.nameBase} ${n}`, color: this.pickColor(), token: randomUUID() });
      bot.bot = true;
      bot.connected = true;
      const spawn = this.world.lobbySpawn();
      bot.teleport(spawn.x, spawn.y);
      this.players.set(bot.id, bot);
    }
    this.broadcastInfo();
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
    this.game.resendSelf(player.id);
    socket.data.roomCode = this.code;
    socket.data.playerId = player.id;
    socket.join(this.code);
    this.broadcastInfo();
    // Reconexión durante los resultados: se los vuelve a mandar
    if (this.phase === 'results' && this.results) {
      socket.emit(EVENTS.GAME_OVER, this.results);
      this.sendPrivateResults(player);
      if (player.id === this.hostId && this.lastCsv) socket.emit(EVENTS.RESULTS_CSV, this.lastCsv);
    }
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
    this.game.forgetPlayer(id);
    if (this.hostId === id) {
      const next = this.humans.find((p) => p.connected) ?? this.humans[0];
      this.hostId = next ? next.id : null;
    }
    // Sin personas la sala se cierra (los bots no la mantienen viva)
    if (this.humans.length === 0) {
      this.destroy();
      return;
    }
    this.broadcastInfo();
  }

  // Todos empiezan iguales: lo que tomaron en el campo de entrenamiento no pasa a la partida
  start() {
    this.phase = 'playing';
    this.game.resetWorld();
    const players = [...this.players.values()];
    const spawns = this.world.gameSpawns(players.length);
    players.forEach((p, i) => {
      if (p.bot) resetBot(p);
      p.resetStats();
      p.resetCombat();
      p.teleport(spawns[i].x, spawns[i].y);
    });
    this.results = null;
    assignTeams(this);
    Object.assign(this, pickWeather(this.weatherChoice));
    this.game.startMatch();
    this.game.pickCrates();
    this.game.startDeploy(this.deployMode);
    this.broadcastInfo();
  }

  // Último en pie: ranking para todos y resultados privados (preguntas falladas) a cada uno
  finishMatch(winnerId) {
    this.phase = 'results';
    const players = [...this.players.values()];
    const winner = this.players.get(winnerId);
    if (winner) winner.place = 1;
    const ranking = players
      .map((p) => {
        const place = p.place ?? players.length;
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          place,
          kills: p.kills,
          correct: p.stats.correct,
          answered: p.stats.answered,
          score: score(place, players.length, p.kills, p.stats.correct),
          bot: p.bot || undefined,
          team: p.team ?? undefined,
        };
      })
      .sort((a, b) => b.score - a.score || a.place - b.place);
    this.results = { winnerId, ranking, medals: awardMedals(players), easy: this.easy || undefined };
    // Primero la repetición de la mejor jugada: el cliente la muestra antes de los resultados
    const replay = this.game.recorder.take();
    if (replay) this.broadcast(EVENTS.MATCH_REPLAY, replay);
    this.broadcast(EVENTS.GAME_OVER, this.results);
    for (const p of players) this.sendPrivateResults(p);
    this.broadcastInfo();
    const stats = classStats(this.game);
    this.sendClassStats(stats);
    const record = buildRecord(this, stats);
    // CSV para el profe (sin Supabase): al anfitrión y al proyector
    const csv = { filename: `calculo-royale-${this.code}-${record.fecha.slice(0, 16).replace(/[:T]/g, '-')}.csv`, csv: recordToCsv(record), json: JSON.stringify(record, null, 2) };
    this.lastCsv = csv;
    const host = this.players.get(this.hostId);
    if (host) this.emitTo(host, EVENTS.RESULTS_CSV, csv);
    this.io.to(`spec:${this.code}`).emit(EVENTS.RESULTS_CSV, csv);
    saveResults(record)
      .then((r) => console.log(`[sala ${this.code}] resultados guardados (${r.where}${r.file ? `: ${r.file}` : ''})`))
      .catch((err) => console.error('[resultados] no se pudieron guardar:', err));
  }

  // Estadísticas de la clase en vivo: al host y a las vistas de proyector
  sendClassStats(stats) {
    const host = this.players.get(this.hostId);
    if (host) this.emitTo(host, EVENTS.CLASS_STATS, stats);
    this.io.to(`spec:${this.code}`).emit(EVENTS.CLASS_STATS, stats);
  }

  sendPrivateResults(player) {
    this.emitTo(player, EVENTS.RESULTS_SELF, { byTopic: player.stats.byTopic, failed: player.stats.failed });
  }

  // El host devuelve a todos al campo de entrenamiento
  reset() {
    this.phase = 'lobby';
    this.results = null;
    this.game.stopMatch();
    this.game.resetWorld();
    for (const p of this.players.values()) this.respawnInLobby(p);
    this.broadcastInfo();
  }

  respawnInLobby(player) {
    player.resetCombat();
    const spawn = this.world.lobbySpawn();
    player.teleport(spawn.x, spawn.y);
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
      topics: this.topics,
      weather: this.weather,
      weatherChoice: this.weatherChoice,
      deployMode: this.deployMode,
      duration: this.duration,
      teamMode: this.teamMode,
      easy: this.easy,
      chatOff: this.chatOff || undefined,
      windAngle: this.windAngle,
      players: [...this.players.values()].map((p) => p.info()),
    };
  }

  broadcastInfo() {
    this.io.to(this.code).emit(EVENTS.ROOM_INFO, this.info());
  }

  broadcast(event, data) {
    this.io.to(this.code).emit(event, data);
  }

  emitTo(player, event, data) {
    if (player.socketId) this.io.to(player.socketId).emit(event, data);
  }

  broadcastState(snapshot) {
    // volatile: si un cliente va atrasado se descarta el snapshot viejo en vez de acumularlo
    // Interés por cercanía (6.5): en partida, a cada jugador en el suelo los que están a más de
    // INTEREST_RADIUS le llegan solo 1 de cada INTEREST_EVERY snapshots (el cliente los mantiene).
    // El proyector y los que caen, esperan o están en el Gulag reciben todo.
    if (this.phase !== 'playing' || snapshot[0] % INTEREST_EVERY === 0) {
      this.io.to(this.code).volatile.emit(EVENTS.STATE, snapshot);
      return;
    }
    const filtered = [];
    for (const p of this.players.values()) {
      if (!p.socketId || !p.connected || !p.alive || p.deploying || p.arena != null) continue;
      const near = snapshot[1].filter((e) => e[0] === p.id || (Math.abs(e[1] - p.x) < INTEREST_RADIUS && Math.abs(e[2] - p.y) < INTEREST_RADIUS) || (p.team != null && this.players.get(e[0])?.team === p.team));
      this.io.to(p.socketId).volatile.emit(EVENTS.STATE, [snapshot[0], near, ...snapshot.slice(2)]);
      filtered.push(p.socketId);
    }
    this.io.to(this.code).except(filtered).volatile.emit(EVENTS.STATE, snapshot);
  }

  destroy() {
    this.game.stop();
    for (const player of this.players.values()) clearTimeout(player.removeTimer);
    this.players.clear();
    this.onEmpty(this);
  }
}
