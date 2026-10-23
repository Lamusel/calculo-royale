// Bots de prueba: se unen a una sala y caminan al azar.
// Uso: npm run bots -- <CÓDIGO> [cantidad] [--armados]   (ej. npm run bots -- ABCD 5 --armados)
// Con --armados disparan con pistola al jugador visible más cercano.
// Variable opcional SERVER_URL (por defecto http://localhost:3001)
import { io } from 'socket.io-client';
import { SERVER_PORT, TICK_MS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { encodeInput } from '@calculo-royale/shared/codec';
import { findAutoTarget } from '@calculo-royale/shared/combat';

const args = process.argv.slice(2);
const armed = args.includes('--armados');
const [code, countArg] = args.filter((a) => !a.startsWith('--'));
const count = Number(countArg) || 5;
const url = process.env.SERVER_URL || `http://localhost:${SERVER_PORT}`;

if (!code) {
  console.error('Falta el código de la sala. Uso: npm run bots -- ABCD 5 [--armados]');
  process.exit(1);
}

// Alcance con el que los bots armados empiezan a disparar
const BOT_RANGE = 16;

function spawnBot(n) {
  const socket = io(url, { transports: ['websocket'] });
  let seq = 0;
  let dir = Math.random() * Math.PI * 2;
  let timer = null;
  let myId = null;
  let snapshot = null;

  socket.on(EVENTS.STATE, (s) => (snapshot = s));

  const step = () => {
    // Cambia de rumbo de vez en cuando y a veces se queda quieto
    if (Math.random() < 0.03) dir = Math.random() * Math.PI * 2;
    const moving = Math.random() > 0.05;
    let aim = dir;
    let buttons = 0;
    let viewTick = 0;

    // Si quedó fuera de la zona, camina hacia su centro
    const zone = snapshot?.[8];
    const self = snapshot?.[1].find((p) => p[0] === myId);
    if (zone?.length && self) {
      const [cx, cy, p, q] = zone;
      const dx = (self[1] - cx) / p;
      const dy = (self[2] - cy) / q;
      if (dx * dx + dy * dy > 0.7) dir = Math.atan2(cy - self[2], cx - self[1]);
    }

    if (armed && snapshot) {
      const [tick, players] = snapshot;
      const me = players.find((p) => p[0] === myId);
      if (me && !(me[8] & PLAYER_FLAGS.DEAD)) {
        const others = players
          .filter((p) => p[0] !== myId && !(p[8] & PLAYER_FLAGS.DEAD))
          .map((p) => ({ id: p[0], x: p[1], y: p[2] }));
        const target = findAutoTarget(me[1], me[2], BOT_RANGE, others);
        if (target) {
          // Puntería imperfecta para que no sean imbatibles
          aim = Math.atan2(target.y - me[2], target.x - me[1]) + (Math.random() - 0.5) * 0.25;
          if (Math.random() < 0.5) buttons = BUTTONS.FIRE;
        }
      }
      viewTick = tick - 2;
    }

    socket.emit(
      EVENTS.INPUT,
      encodeInput({
        seq: ++seq,
        mx: moving ? Math.cos(dir) : 0,
        my: moving ? Math.sin(dir) : 0,
        aim,
        buttons,
        viewTick,
      }),
    );
  };

  socket.on('connect', () => {
    socket.emit(EVENTS.ROOM_JOIN, { code, name: `Bot ${n}` }, (res) => {
      if (!res.ok) {
        console.error(`Bot ${n}: ${res.error}`);
        socket.disconnect();
        return;
      }
      myId = res.playerId;
      console.log(`Bot ${n} dentro de ${res.code} (id ${res.playerId})${armed ? ' · armado' : ''}`);
      clearInterval(timer);
      timer = setInterval(step, TICK_MS);
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
