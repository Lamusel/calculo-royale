import { useFifty } from '../game/crates.js';
import { shuffleTeams, teamPing } from '../game/teams.js';
import { DEPLOY_MODES, DURATIONS, HATS, NAME_MAX_LENGTH, TEAM_MODES, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, TOPICS, WEATHERS } from '@calculo-royale/shared/constants';
import { decodeInput } from '@calculo-royale/shared/codec';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { canUseSkin } from '@calculo-royale/shared/skins';
import { sayChat, sayPhrase } from '../game/phrases.js';
import { Room } from './Room.js';

const fail = (error) => ({ ok: false, error });

function cleanName(name) {
  const clean = String(name ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return clean || 'Jugador';
}

function cleanCode(code) {
  return String(code ?? '').toUpperCase().replace(/[^A-Z]/g, '');
}

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // código → Room
  }

  generateCode() {
    let code;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  roomOf(socket) {
    return this.rooms.get(socket.data.roomCode) ?? null;
  }

  create(socket, data) {
    this.leave(socket);
    const room = new Room(this.generateCode(), this.io, (r) => this.rooms.delete(r.code));
    this.rooms.set(room.code, room);
    const player = room.addPlayer(socket, cleanName(data?.name));
    console.log(`[sala ${room.code}] creada por ${player.name}`);
    return { ok: true, code: room.code, playerId: player.id, token: player.token };
  }

  join(socket, data) {
    const code = cleanCode(data?.code);
    const room = this.rooms.get(code);
    if (!room) return fail('No existe una sala con ese código');

    // Reconexión: mismo jugador si el token coincide
    const existing = data?.token ? room.findByToken(data.token) : null;
    if (existing) {
      if (socket.data.roomCode !== code) this.leave(socket);
      room.bind(socket, existing);
      return { ok: true, code, playerId: existing.id, token: existing.token };
    }

    if (room.phase !== 'lobby') return fail('La partida ya empezó');
    if (room.isFull) return fail('La sala está llena');
    this.leave(socket);
    const player = room.addPlayer(socket, cleanName(data?.name));
    return { ok: true, code, playerId: player.id, token: player.token };
  }

  // Salida voluntaria: se elimina al jugador de inmediato
  leave(socket) {
    const room = this.roomOf(socket);
    if (!room) return;
    socket.leave(room.code);
    socket.data.roomCode = null;
    room.removePlayer(socket.data.playerId);
  }

  disconnect(socket) {
    const room = this.roomOf(socket);
    const player = room?.players.get(socket.data.playerId);
    if (player && player.socketId === socket.id) room.markDisconnected(player);
  }

  start(socket) {
    const room = this.roomOf(socket);
    if (!room) return fail('No estás en una sala');
    if (room.hostId !== socket.data.playerId) return fail('Solo el anfitrión puede iniciar');
    if (room.phase !== 'lobby') return fail('La partida ya empezó');
    room.start();
    console.log(`[sala ${room.code}] partida iniciada con ${room.players.size} jugadores`);
    return { ok: true };
  }

  input(socket, data) {
    const input = decodeInput(data);
    if (!input) return;
    this.playerOf(socket)?.queueInput(input);
  }

  reset(socket) {
    const room = this.roomOf(socket);
    if (!room) return fail('No estás en una sala');
    if (room.hostId !== socket.data.playerId) return fail('Solo el anfitrión puede reiniciar');
    room.reset();
    return { ok: true };
  }

  switchWeapon(socket, slot) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.switchWeapon(player, Number(slot));
  }

  interact(socket, kind) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.interact(player, typeof kind === 'string' ? kind : null);
  }

  // El host elige los temas en el lobby (al menos uno)
  setTopics(socket, topics) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby' || !Array.isArray(topics)) return;
    const valid = [...new Set(topics.filter((t) => TOPICS[t]))];
    if (valid.length === 0) return;
    room.topics = valid;
    room.broadcastInfo();
  }

  // Despliegue de la próxima partida (solo el host, en el lobby)
  setDeploy(socket, mode) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby' || !DEPLOY_MODES[mode]) return;
    room.deployMode = mode;
    room.broadcastInfo();
  }

  // Equipos (fase 33): modo (host), unirse a un equipo y mezclar (host)
  setTeamMode(socket, mode) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby' || !TEAM_MODES[mode]) return;
    room.teamMode = mode;
    for (const p of room.players.values()) p.teamChoice = null;
    room.broadcastInfo();
  }

  joinTeam(socket, team) {
    const room = this.roomOf(socket);
    const player = this.playerOf(socket);
    const n = Math.floor(Number(team));
    if (!room || !player || room.phase !== 'lobby' || !(n >= 0 && n <= 20)) return;
    player.teamChoice = n || null;
    room.broadcastInfo();
  }

  shuffleTeams(socket) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby') return;
    shuffleTeams(room);
    room.broadcastInfo();
  }

  teamPing(socket, data) {
    const player = this.playerOf(socket);
    if (player) teamPing(this.roomOf(socket).game, player, Number(data?.x), Number(data?.y));
  }

  // Duración de la próxima partida (solo el host, en el lobby)
  setDuration(socket, duration) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby' || !DURATIONS[duration]) return;
    room.duration = duration;
    room.broadcastInfo();
  }

  deployPoint(socket, data) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.chooseDeployPoint(player, Number(data?.x), Number(data?.y));
  }

  // Modo fácil (solo el host, en el lobby)
  fifty(socket) {
    const player = this.playerOf(socket);
    if (player) useFifty(this.roomOf(socket).game, player);
  }

  fps(socket, fps) {
    const player = this.playerOf(socket);
    const n = Number(fps);
    if (!player || !(n > 0 && n < 500)) return;
    player.fps = { sum: (player.fps?.sum ?? 0) + n, n: (player.fps?.n ?? 0) + 1 };
  }

  chat(socket, data) {
    const room = this.roomOf(socket);
    const player = this.playerOf(socket);
    if (room && player) sayChat(room, player, data, Date.now());
  }

  // Chat encendido o apagado (solo el host, en cualquier momento)
  setChat(socket, on) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId) return;
    room.chatOff = !on;
    room.broadcastInfo();
  }

  setEasy(socket, easy) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby') return;
    room.easy = Boolean(easy);
    room.broadcastInfo();
  }

  // Completar con bots hasta N (solo el host, en el lobby)
  setBots(socket, target) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby') return;
    room.fillBots(target);
  }

  // Frase rápida con antispam
  phrase(socket, index) {
    const room = this.roomOf(socket);
    const player = this.playerOf(socket);
    if (room && player) sayPhrase(room, player, index, Date.now());
  }

  // Clima de la próxima partida (solo el host, en el lobby)
  setWeather(socket, choice) {
    const room = this.roomOf(socket);
    if (!room || room.hostId !== socket.data.playerId || room.phase !== 'lobby') return;
    if (choice !== 'aleatorio' && !WEATHERS[choice]) return;
    room.weatherChoice = choice;
    room.broadcastInfo();
  }

  // Skin del jugador: solo en el lobby y solo del catálogo (las de honor, si las desbloqueó)
  setSkin(socket, data) {
    const room = this.roomOf(socket);
    const player = this.playerOf(socket);
    if (!room || !player || room.phase !== 'lobby') return;
    const unlocked = Array.isArray(data?.unlocked) ? data.unlocked.map(String) : [];
    const hat = HATS[data?.hat] ? data.hat : null;
    if (!canUseSkin(data?.skin, unlocked) || (player.skin === data.skin && (player.hat ?? null) === hat)) return;
    player.skin = data.skin;
    player.hat = hat;
    room.broadcastInfo();
  }

  crateAnswer(socket, data) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.answerCrate(player, data?.crateId, data?.index);
  }

  // Curarse: venda, botiquín o bebida (el servidor valida que tenga y pueda)
  // Inventario (fase 29) y premio elegido de una caja
  inventory(socket, data) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.inventoryOp(player, data);
  }

  crateChoose(socket, index) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.chooseOffer(player, Number(index));
  }

  useItem(socket, item) {
    const player = this.playerOf(socket);
    if (player && typeof item === 'string') this.roomOf(socket).game.useItem(player, item);
  }

  ammoRequest(socket) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.requestAmmo(player);
  }

  ammoAnswer(socket, data) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.answerAmmo(player, data?.id, data?.index);
  }

  crateCancel(socket) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.cancelQuestion(player);
  }

  // Vista para proyector: recibe todo lo de la sala sin ser jugador
  spectate(socket, data) {
    const room = this.rooms.get(cleanCode(data?.code));
    if (!room) return fail('No existe una sala con ese código');
    socket.join(room.code);
    socket.join(`spec:${room.code}`);
    socket.data.spectating = room.code;
    socket.emit(EVENTS.ROOM_INFO, room.info());
    if (room.phase === 'results' && room.results) socket.emit(EVENTS.GAME_OVER, room.results);
    return { ok: true, code: room.code };
  }

  transmissionAnswer(socket, data) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.answerTransmission(player, data?.id, data?.index);
  }

  // Gulag con 3 aciertos: rifle o escopeta
  gulagChoice(socket, weapon) {
    const player = this.playerOf(socket);
    if (player) this.roomOf(socket).game.chooseGulagWeapon(player, String(weapon));
  }

  requestSelf(socket) {
    const player = this.playerOf(socket);
    if (!player) return;
    const { game } = this.roomOf(socket);
    game.resendSelf(player.id);
    // El cliente se (re)creó: necesita el botín que hay en el suelo
    game.syncLoot(player);
  }

  playerOf(socket) {
    return this.roomOf(socket)?.players.get(socket.data.playerId) ?? null;
  }
}
