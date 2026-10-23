import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { SERVER_PORT } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { RoomManager } from './rooms/RoomManager.js';

const PORT = Number(process.env.PORT) || SERVER_PORT;
// En desarrollo se acepta cualquier origen (para probar desde el celular en la red local)
const origin = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true;

const app = express();
app.use(cors({ origin }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), rooms: rooms.rooms.size });
});

// URL del túnel (si npm run tunnel está activo) e IPs de la red local:
// el cliente las usa para armar el QR de la sala
const TUNNEL_FILE = fileURLToPath(new URL('../../.tunnel-url', import.meta.url));

app.get('/net-info', (_req, res) => {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  const publicUrl = existsSync(TUNNEL_FILE) ? readFileSync(TUNNEL_FILE, 'utf8').trim() : null;
  res.json({ addresses, publicUrl });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin } });
const rooms = new RoomManager(io);

// Responde por ack si el cliente lo pidió
const reply = (ack, result) => typeof ack === 'function' && ack(result);

io.on('connection', (socket) => {
  socket.on(EVENTS.PING, (clientTime) => {
    socket.emit(EVENTS.PONG, { clientTime, serverTime: Date.now() });
  });

  socket.on(EVENTS.ROOM_CREATE, (data, ack) => reply(ack, rooms.create(socket, data)));
  socket.on(EVENTS.ROOM_JOIN, (data, ack) => reply(ack, rooms.join(socket, data)));
  socket.on(EVENTS.ROOM_LEAVE, () => rooms.leave(socket));
  socket.on(EVENTS.GAME_START, (_data, ack) => reply(ack, rooms.start(socket)));
  socket.on(EVENTS.GAME_RESET, (_data, ack) => reply(ack, rooms.reset(socket)));
  socket.on(EVENTS.INPUT, (data) => rooms.input(socket, data));
  socket.on(EVENTS.WEAPON_SWITCH, (slot) => rooms.switchWeapon(socket, slot));
  socket.on(EVENTS.INTERACT, () => rooms.interact(socket));
  socket.on(EVENTS.PLAYER_SELF, () => rooms.requestSelf(socket));

  socket.on('disconnect', () => rooms.disconnect(socket));
});

httpServer.listen(PORT, () => {
  console.log(`[server] escuchando en http://localhost:${PORT}`);
});
