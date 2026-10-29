import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { SERVER_PORT } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { parseOrigins } from './origins.js';
import { RoomManager } from './rooms/RoomManager.js';
import { readMetrics } from './metrics.js';

const PORT = Number(process.env.PORT) || SERVER_PORT;
// Vacío = cualquier origen (desarrollo y celular en la red local); en producción, la URL de Vercel
const origin = parseOrigins(process.env.CLIENT_ORIGIN);

const app = express();
app.use(cors({ origin }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), rooms: rooms.rooms.size, ...readMetrics(rooms.rooms) });
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
  socket.on(EVENTS.INTERACT, (kind) => rooms.interact(socket, kind));
  socket.on(EVENTS.PLAYER_SELF, () => rooms.requestSelf(socket));
  socket.on(EVENTS.ROOM_TOPICS, (topics) => rooms.setTopics(socket, topics));
  socket.on(EVENTS.PLAYER_SKIN, (data) => rooms.setSkin(socket, data));
  socket.on(EVENTS.ROOM_WEATHER, (choice) => rooms.setWeather(socket, choice));
  socket.on(EVENTS.ROOM_EASY, (easy) => rooms.setEasy(socket, easy));
  socket.on(EVENTS.ROOM_BOTS, (n) => rooms.setBots(socket, n));
  socket.on(EVENTS.QUICK_PHRASE, (index) => rooms.phrase(socket, index));
  socket.on(EVENTS.CHAT_SEND, (data) => rooms.chat(socket, data));
  socket.on(EVENTS.ROOM_CHAT, (on) => rooms.setChat(socket, on));
  socket.on(EVENTS.ROOM_DEPLOY, (mode) => rooms.setDeploy(socket, mode));
  socket.on(EVENTS.ROOM_DURATION, (duration) => rooms.setDuration(socket, duration));
  socket.on(EVENTS.ROOM_TEAM_MODE, (mode) => rooms.setTeamMode(socket, mode));
  socket.on(EVENTS.ROOM_TEAM_JOIN, (team) => rooms.joinTeam(socket, team));
  socket.on(EVENTS.ROOM_TEAM_SHUFFLE, () => rooms.shuffleTeams(socket));
  socket.on(EVENTS.TEAM_PING, (data) => rooms.teamPing(socket, data));
  socket.on(EVENTS.DEPLOY_POINT, (data) => rooms.deployPoint(socket, data));
  socket.on(EVENTS.CRATE_ANSWER, (data) => rooms.crateAnswer(socket, data));
  socket.on(EVENTS.CRATE_CANCEL, () => rooms.crateCancel(socket));
  socket.on(EVENTS.AMMO_REQUEST, () => rooms.ammoRequest(socket));
  socket.on(EVENTS.USE_ITEM, (item) => rooms.useItem(socket, item));
  socket.on(EVENTS.INVENTORY, (data) => rooms.inventory(socket, data));
  socket.on(EVENTS.CRATE_CHOOSE, (index) => rooms.crateChoose(socket, index));
  socket.on(EVENTS.AMMO_ANSWER, (data) => rooms.ammoAnswer(socket, data));
  socket.on(EVENTS.ROOM_SPECTATE, (data, ack) => reply(ack, rooms.spectate(socket, data)));
  socket.on(EVENTS.TRANSMISSION_ANSWER, (data) => rooms.transmissionAnswer(socket, data));
  socket.on(EVENTS.GULAG_CHOICE, (weapon) => rooms.gulagChoice(socket, weapon));

  socket.on('disconnect', () => rooms.disconnect(socket));
});

// Con node --watch, el proceso anterior a veces aún tiene el puerto: se reintenta unos segundos.
// Si sigue ocupado, casi siempre es otro `npm run dev` abierto.
let listenAttempts = 0;
httpServer.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  if (++listenAttempts <= 20) {
    setTimeout(() => httpServer.listen(PORT), 250);
    return;
  }
  console.error(`[server] El puerto ${PORT} ya está en uso. ¿Hay otro "npm run dev" abierto? Ciérralo y vuelve a intentar.`);
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`[server] escuchando en http://localhost:${PORT}`);
});
