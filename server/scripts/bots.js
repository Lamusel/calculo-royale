// Bots de prueba: se unen a una sala y caminan al azar.
// Uso: npm run bots -- <CÓDIGO> [cantidad]   (ej. npm run bots -- ABCD 5)
// Variable opcional SERVER_URL (por defecto http://localhost:3001)
import { io } from 'socket.io-client';
import { SERVER_PORT, TICK_MS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { encodeInput } from '@calculo-royale/shared/codec';

const [code, countArg] = process.argv.slice(2);
const count = Number(countArg) || 5;
const url = process.env.SERVER_URL || `http://localhost:${SERVER_PORT}`;

if (!code) {
  console.error('Falta el código de la sala. Uso: npm run bots -- ABCD 5');
  process.exit(1);
}

function spawnBot(n) {
  const socket = io(url, { transports: ['websocket'] });
  let seq = 0;
  let dir = Math.random() * Math.PI * 2;
  let timer = null;

  socket.on('connect', () => {
    socket.emit(EVENTS.ROOM_JOIN, { code, name: `Bot ${n}` }, (res) => {
      if (!res.ok) {
        console.error(`Bot ${n}: ${res.error}`);
        socket.disconnect();
        return;
      }
      console.log(`Bot ${n} dentro de ${res.code} (id ${res.playerId})`);
      clearInterval(timer);
      timer = setInterval(() => {
        // Cambia de rumbo de vez en cuando y a veces se queda quieto
        if (Math.random() < 0.03) dir = Math.random() * Math.PI * 2;
        const moving = Math.random() > 0.05;
        socket.emit(
          EVENTS.INPUT,
          encodeInput({
            seq: ++seq,
            mx: moving ? Math.cos(dir) : 0,
            my: moving ? Math.sin(dir) : 0,
            aim: dir,
          }),
        );
      }, TICK_MS);
    });
  });

  socket.on('disconnect', () => clearInterval(timer));
  return socket;
}

const bots = Array.from({ length: count }, (_, i) => spawnBot(i + 1));

process.on('SIGINT', () => {
  bots.forEach((s) => s.disconnect());
  process.exit(0);
});
