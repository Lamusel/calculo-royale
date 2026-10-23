// Métricas del proceso para /health (prueba de carga y monitoreo): CPU desde la última
// consulta, memoria, duración del tick del juego y jugadores conectados.

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

let last = { cpu: process.cpuUsage(), at: performance.now() };
const ticks = { count: 0, totalMs: 0, maxMs: 0 };

// Lo llama cada sala tras su tick
export function recordTick(ms) {
  ticks.count++;
  ticks.totalMs += ms;
  ticks.maxMs = Math.max(ticks.maxMs, ms);
}

// Lee y reinicia las ventanas (CPU y ticks desde la consulta anterior)
export function readMetrics(rooms) {
  const now = performance.now();
  const cpu = process.cpuUsage(last.cpu);
  const elapsedMs = Math.max(1, now - last.at);
  last = { cpu: process.cpuUsage(), at: now };
  const mem = process.memoryUsage();
  let players = 0;
  for (const room of rooms.values()) for (const p of room.players.values()) if (p.connected) players++;
  const out = {
    cpuPercent: round(((cpu.user + cpu.system) / 1000 / elapsedMs) * 100),
    memoryMb: { rss: round(mem.rss / 1048576), heapUsed: round(mem.heapUsed / 1048576) },
    tick: { avgMs: ticks.count ? round(ticks.totalMs / ticks.count, 2) : 0, maxMs: round(ticks.maxMs, 2), count: ticks.count },
    players,
    windowSeconds: round(elapsedMs / 1000),
  };
  Object.assign(ticks, { count: 0, totalMs: 0, maxMs: 0 });
  return out;
}
