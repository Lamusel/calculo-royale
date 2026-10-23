import { NAME_MAX_LENGTH, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@calculo-royale/shared/constants';
import { decodeInput } from '@calculo-royale/shared/codec';
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
    this.roomOf(socket)?.players.get(socket.data.playerId)?.queueInput(input);
  }
}
