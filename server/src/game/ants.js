import { LOOT_TABLES, bundleState } from './crates.js';
import { goldenBox } from './loot.js';
import { overlapsObstacle } from '@calculo-royale/shared/collision';
import { HOUSES, WALL_HEIGHT } from '@calculo-royale/shared/mapLayout';
import { AREAS, BRIDGES, RIVER, riverY, waterAt } from '@calculo-royale/shared/mapPlan';
import { EVENTS } from '@calculo-royale/shared/protocol';

// Hormigas culonas coleccionables (7A): 20 escondidas por partida entre ~50 escondites (techos, bajo los
// puentes, bosque, represa, cementerio, estadio, granja…). Cada una da 5 puntos; con 3 aparece una caja
// dorada cerca y con 6 otra más. Solo las toman las personas (los bots no las buscan).
export const ANT = { count: 20, radius: 2, points: 5, rewards: [3, 6] };

// Escondite válido: dentro del mapa, fuera del agua y sin chocar (se corre un poco si hace falta)
function fix(spot) {
  if (spot.z > 0) return spot; // en un techo: no importa lo de abajo
  for (const [dx, dy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [2.5, 2.5], [-2.5, -2.5]]) {
    const x = spot.x + dx;
    const y = spot.y + dy;
    if (!waterAt(x, y) && !overlapsObstacle(x, y, 0.4)) return { ...spot, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  return null;
}

function buildSpots() {
  const out = [];
  // Techos: la esquina de una de cada seis casas (repartidas por todo el mapa)
  HOUSES.forEach((h, i) => {
    if (i % 6 === 0) out.push({ x: h.x + h.w / 2 - 0.7, y: h.y + h.h / 2 - 0.7, z: WALL_HEIGHT * (h.floors ?? 1) + 0.2, where: 'techo' });
  });
  // Bajo los puentes, en las dos orillas
  for (const b of BRIDGES) for (const side of [-1, 1]) out.push({ x: b.x + 2.5, y: riverY(b.x) + side * (RIVER.halfWidth + 1.5), z: 0, where: 'puente' });
  // Dos rincones de cada zona con nombre (bosque, represa, cementerio, estadio, granja, aserradero…)
  for (const [id, a] of Object.entries(AREAS)) {
    if (!a.w || id === 'training') continue;
    out.push({ x: a.x + a.w * 0.38, y: a.y - a.h * 0.38, z: 0, where: id });
    if (a.size !== 'small') out.push({ x: a.x - a.w * 0.36, y: a.y + a.h * 0.34, z: 0, where: id });
  }
  return out.map(fix).filter(Boolean);
}
export const ANT_SPOTS = buildSpots();

const encode = (game) => game.ants.filter((a) => !a.taken).map((a) => [a.id, a.x, a.y, a.z]);

export function startAnts(game, rand = Math.random) {
  const pool = [...ANT_SPOTS];
  game.ants = [];
  while (game.ants.length < ANT.count && pool.length) {
    const spot = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    game.ants.push({ id: game.ants.length, ...spot, taken: false });
  }
  for (const p of game.room.players.values()) p.ants = 0;
  game.room.broadcast?.(EVENTS.ANTS, encode(game));
}

export function resetAnts(game) {
  const had = game.ants?.length;
  game.ants = [];
  if (had) game.room.broadcast?.(EVENTS.ANTS, []);
}

export const sendAnts = (game, player) => game.room.emitTo(player, EVENTS.ANTS, encode(game));

// Cada 5 ticks: ¿alguien está junto a una? (distancia en el plano: las del techo se toman desde abajo)
export function updateAnts(game) {
  if (game.room.phase !== 'playing' || !game.ants?.length || game.tick % 5 !== 0) return;
  let changed = false;
  for (const p of game.room.players.values()) {
    if (p.bot || !p.alive || p.deploying || p.arena != null) continue;
    for (const a of game.ants) {
      if (a.taken || Math.abs(a.x - p.x) > ANT.radius || Math.abs(a.y - p.y) > ANT.radius) continue;
      a.taken = true;
      changed = true;
      p.ants = (p.ants ?? 0) + 1;
      if (ANT.rewards.includes(p.ants)) reward(game, p);
    }
  }
  if (changed) game.room.broadcast(EVENTS.ANTS, encode(game));
}

// Caja dorada cerca: dos paquetes de la tabla dorada
function reward(game, p) {
  const table = [...LOOT_TABLES[3]];
  const items = [];
  for (let i = 0; i < 2 && table.length; i++) {
    const bundle = table.splice(Math.floor(Math.random() * table.length), 1)[0];
    for (const item of bundle) items.push({ item, state: bundleState(bundle, item) });
  }
  goldenBox(game, p.x + 1.5, p.y, items);
  game.room.emitTo(p, EVENTS.RADIO_MESSAGE, { kind: 'airdrop', title: 'Hormigas culonas', text: `¡${p.ants} hormigas! Una caja dorada apareció a tu lado.`, durationMs: 3500 });
}
