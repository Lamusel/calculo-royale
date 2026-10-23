// Bots de prueba: se unen a una sala y caminan al azar.
// Uso: npm run bots -- <CÓDIGO> [cantidad] [--armados | --cazar]   (ej. npm run bots -- ABCD 5 --armados)
// Con --armados disparan con pistola al jugador visible más cercano.
// Con --cazar además caminan hacia el jugador vivo más cercano (para probar combate solo).
// Con --skin=<id> usan esa skin; --skin=externas reparte las 5 externas (para probar skins).
// Variable opcional SERVER_URL (por defecto http://localhost:3001)
import { io } from 'socket.io-client';
import { SERVER_PORT, TICK_MS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { encodeInput } from '@calculo-royale/shared/codec';
import { findAutoTarget } from '@calculo-royale/shared/combat';
import { EXTERNAL_SKIN_IDS } from '@calculo-royale/shared/skins';

const args = process.argv.slice(2);
const hunt = args.includes('--cazar');
const armed = hunt || args.includes('--armados');
const [code, countArg] = args.filter((a) => !a.startsWith('--'));
const skinArg = args.find((a) => a.startsWith('--skin='))?.slice(7) ?? null;
const skinFor = (n) => (skinArg === 'externas' ? EXTERNAL_SKIN_IDS[(n - 1) % EXTERNAL_SKIN_IDS.length] : skinArg);
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
  // Munición finita: sin balas piden más y responden al azar (2 opciones) tras pensarlo un poco
  let self = null;
  let askedAt = 0;
  socket.on(EVENTS.PLAYER_SELF, (s) => (self = s));
  socket.on(EVENTS.AMMO_QUESTION, (q) =>
    setTimeout(() => socket.emit(EVENTS.AMMO_ANSWER, { id: q.id, index: Math.floor(Math.random() * q.opciones.length) }), 1500 + Math.random() * 2000),
  );

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

    const ammo = self && (self.slot === 2 && self.primary ? self.primary.mag + self.primary.reserve : self.pistolMag + self.pistolReserve);
    if (armed && self?.alive && ammo === 0 && Date.now() - askedAt > 3000) {
      askedAt = Date.now();
      socket.emit(EVENTS.AMMO_REQUEST);
    }

    if (armed && snapshot) {
      const [tick, players] = snapshot;
      const me = players.find((p) => p[0] === myId);
      if (me && !(me[8] & PLAYER_FLAGS.DEAD)) {
        const others = players
          .filter((p) => p[0] !== myId && !(p[8] & PLAYER_FLAGS.DEAD))
          .map((p) => ({ id: p[0], x: p[1], y: p[2] }));
        const target = findAutoTarget(me[1], me[2], BOT_RANGE, others);
        // Cazador: camina hacia el vivo más cercano, esté o no a la vista
        if (hunt && others.length) {
          const prey = others.reduce((a, b) => (Math.hypot(a.x - me[1], a.y - me[2]) < Math.hypot(b.x - me[1], b.y - me[2]) ? a : b));
          if (Math.hypot(prey.x - me[1], prey.y - me[2]) > 6) dir = Math.atan2(prey.y - me[2], prey.x - me[1]) + (Math.random() - 0.5) * 0.6;
        }
        if (target) {
          // Puntería imperfecta para que no sean imbatibles
          aim = Math.atan2(target.y - me[2], target.x - me[1]) + (Math.random() - 0.5) * 0.25;
          if (Math.random() < 0.5) buttons = BUTTONS.FIRE;
        }
      }
      viewTick = tick - 2;
    }

    // En el bus: saltan en un momento al azar después de que arranca
    const meNow = snapshot?.[1].find((p) => p[0] === myId);
    const bus = snapshot?.[12];
    if (meNow && meNow[8] & PLAYER_FLAGS.IN_BUS && bus?.length && bus[3] === 0 && Math.random() < 0.02) buttons |= BUTTONS.JUMP;

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
      if (skinFor(n)) socket.emit(EVENTS.PLAYER_SKIN, { skin: skinFor(n), unlocked: [] });
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
