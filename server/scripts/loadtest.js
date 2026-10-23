// Prueba de carga: crea una sala, conecta N clientes (anfitrión + bots que caminan, disparan,
// saltan del bus y piden balas), inicia la partida y mide latencia, ritmo de snapshots y
// las métricas de /health del servidor.
// Uso: npm run loadtest -- [cantidad] [segundos]   (ej. npm run loadtest -- 40 180)
// Variable SERVER_URL (por defecto http://localhost:3001)
import { io } from 'socket.io-client';
import { SERVER_PORT, TICK_MS } from '@calculo-royale/shared/constants';
import { BUTTONS, EVENTS, PLAYER_FLAGS } from '@calculo-royale/shared/protocol';
import { encodeInput } from '@calculo-royale/shared/codec';

const [countArg, secondsArg] = process.argv.slice(2);
const COUNT = Number(countArg) || 40;
const SECONDS = Number(secondsArg) || 180;
const url = process.env.SERVER_URL || `http://localhost:${SERVER_PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Máximo sin desplegar el arreglo (con cientos de miles de muestras, Math.max(...l) desborda la pila)
const maxOf = (list) => list.reduce((m, v) => (v > m ? v : m), -Infinity);
const pct = (list, p) => (list.length ? [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * p))] : null);

const rtts = [];
const gaps = [];
let disconnects = 0;
let errors = 0;

function client(name, { host = false } = {}) {
  const socket = io(url, { transports: ['websocket'], reconnection: false });
  const c = { socket, id: null, seq: 0, dir: Math.random() * Math.PI * 2, lastState: 0, snapshot: null };
  socket.on(EVENTS.STATE, (s) => {
    const now = performance.now();
    if (c.lastState) gaps.push(now - c.lastState);
    c.lastState = now;
    c.snapshot = s;
  });
  socket.on(EVENTS.PONG, ({ clientTime }) => rtts.push(Date.now() - clientTime));
  socket.on(EVENTS.AMMO_QUESTION, (q) => setTimeout(() => socket.emit(EVENTS.AMMO_ANSWER, { id: q.id, index: 0 }), 1500));
  socket.on('disconnect', () => disconnects++);
  socket.on('connect_error', () => errors++);
  c.ready = new Promise((resolve) => socket.on('connect', resolve));
  c.host = host;
  c.name = name;
  return c;
}

function step(c) {
  if (!c.id) return;
  if (Math.random() < 0.03) c.dir = Math.random() * Math.PI * 2;
  const me = c.snapshot?.[1]?.find((p) => p[0] === c.id);
  let buttons = Math.random() < 0.15 ? BUTTONS.FIRE : 0;
  if (me && me[8] & PLAYER_FLAGS.IN_BUS && Math.random() < 0.02) buttons |= BUTTONS.JUMP;
  c.socket.emit(EVENTS.INPUT, encodeInput({ seq: ++c.seq, mx: Math.cos(c.dir), my: Math.sin(c.dir), aim: c.dir, buttons, viewTick: (c.snapshot?.[0] ?? 2) - 2 }));
}

async function health() {
  try {
    return await (await fetch(`${url}/health`)).json();
  } catch (err) {
    return { error: err.message };
  }
}

console.log(`Prueba de carga: ${COUNT} clientes contra ${url} durante ${SECONDS} s`);
const before = await health();
console.log('health antes:', JSON.stringify(before));

const hostClient = client('Anfitrión de carga', { host: true });
await hostClient.ready;
const created = await new Promise((r) => hostClient.socket.emit(EVENTS.ROOM_CREATE, { name: 'Anfitrión de carga' }, r));
if (!created?.ok) throw new Error(`No se pudo crear la sala: ${created?.error}`);
hostClient.id = created.playerId;
const code = created.code;
console.log('sala', code);

const clients = [hostClient];
for (let i = 1; i < COUNT; i++) {
  const c = client(`Carga ${i}`);
  clients.push(c);
  await c.ready;
  const res = await new Promise((r) => c.socket.emit(EVENTS.ROOM_JOIN, { code, name: c.name }, r));
  if (res?.ok) c.id = res.playerId;
  else console.log(`cliente ${i}: ${res?.error}`);
  await wait(60);
}
console.log(`${clients.filter((c) => c.id).length} clientes en la sala`);

const inputTimer = setInterval(() => clients.forEach(step), TICK_MS);
const pingTimer = setInterval(() => clients.forEach((c) => c.socket.emit(EVENTS.PING, Date.now())), 2000);
await wait(3000);
const started = await new Promise((r) => hostClient.socket.emit(EVENTS.GAME_START, null, r));
console.log('inicio:', started?.ok ? 'ok' : started?.error);

const samples = [];
const startAt = performance.now();
while (performance.now() - startAt < SECONDS * 1000) {
  await wait(15000);
  const h = await health();
  samples.push(h);
  const recent = rtts.slice(-COUNT * 7);
  console.log(
    `t=${Math.round((performance.now() - startAt) / 1000)} s · CPU ${h.cpuPercent ?? '?'} % · RSS ${h.memoryMb?.rss ?? '?'} MB · tick ${h.tick?.avgMs ?? '?'} ms (máx ${h.tick?.maxMs ?? '?'}) · jugadores ${h.players ?? '?'} · ping p50 ${pct(recent, 0.5)} ms p95 ${pct(recent, 0.95)} ms`,
  );
}

clearInterval(inputTimer);
clearInterval(pingTimer);
const summary = {
  clientes: COUNT,
  segundos: SECONDS,
  ping: { p50: pct(rtts, 0.5), p95: pct(rtts, 0.95), max: maxOf(rtts) },
  snapshotsMs: { p50: Math.round(pct(gaps, 0.5)), p95: Math.round(pct(gaps, 0.95)), max: Math.round(maxOf(gaps)) },
  cpuPercent: { avg: Math.round(samples.reduce((t, s) => t + (s.cpuPercent ?? 0), 0) / samples.length), max: Math.max(...samples.map((s) => s.cpuPercent ?? 0)) },
  rssMb: Math.max(...samples.map((s) => s.memoryMb?.rss ?? 0)),
  tickMs: { avg: Math.round((samples.reduce((t, s) => t + (s.tick?.avgMs ?? 0), 0) / samples.length) * 100) / 100, max: Math.max(...samples.map((s) => s.tick?.maxMs ?? 0)) },
  desconexiones: disconnects,
  erroresDeConexion: errors,
};
console.log('RESUMEN', JSON.stringify(summary, null, 2));
clients.forEach((c) => c.socket.disconnect());
process.exit(0);
