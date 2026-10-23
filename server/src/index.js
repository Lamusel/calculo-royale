import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { SERVER_PORT } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';

const PORT = Number(process.env.PORT) || SERVER_PORT;
// En desarrollo se acepta cualquier origen (para probar desde el celular en la red local)
const origin = process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true;

const app = express();
app.use(cors({ origin }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin } });

io.on('connection', (socket) => {
  console.log(`[socket] conectado ${socket.id} (total: ${io.engine.clientsCount})`);

  socket.on(EVENTS.PING, (clientTime) => {
    socket.emit(EVENTS.PONG, { clientTime, serverTime: Date.now() });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] desconectado ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] escuchando en http://localhost:${PORT}`);
});
