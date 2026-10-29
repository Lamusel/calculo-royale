// Constantes de juego compartidas entre cliente y servidor.
// Se irán agregando por fase (rarezas, zona...).

// --- Red ---
export const SERVER_PORT = 3001;

// Ticks por segundo del loop autoritativo del servidor (y frecuencia de envío de inputs)
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

// Retraso con el que el cliente dibuja a los demás jugadores (interpolación)
export const INTERP_DELAY_MS = 100;

// Inputs que el servidor acepta en ráfaga; en promedio solo 1 por tick (anti speed hack)
export const MAX_INPUT_BURST = 3;

// Cuánto puede retroceder el servidor en el tiempo para validar un disparo (compensación de lag)
export const LAG_COMP_MAX_MS = 300;

// --- Salas ---
export const MAX_PLAYERS = 40;
export const ROOM_CODE_LENGTH = 4;
// Sin I ni O para no confundirlas con 1 y 0
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const NAME_MAX_LENGTH = 16;
// Tiempo que se guarda a un jugador desconectado para que pueda volver
export const RECONNECT_GRACE_MS = 60_000;

// --- Mapa ---
// Cuadrado centrado en el origen: x e y van de -MAP_HALF a MAP_HALF
// Fase 34: 1 km de lado. A pie (~8 m/s) se cruza en ~2 min y en vehículo en ~30 s
export const MAP_SIZE = 1000;
export const MAP_HALF = MAP_SIZE / 2;

// Terreno z = A·sin(x/k)·cos(y/k), solo interno. Colinas suaves: pendiente máxima ≈ A/k
export const TERRAIN = { amplitude: 2, scale: 10 };

// Velocidad según la pendiente: factor = 1 − k·(∇f·û), limitado a [min, max]
export const SLOPE_SPEED = { k: 0.7, min: 0.8, max: 1.15 };

// Radios de aparición
export const LOBBY_SPAWN_RADIUS = 6;
export const GAME_SPAWN_RADIUS = 140;

// --- Jugador ---
export const PLAYER_RADIUS = 0.6;
export const PLAYER_SPEED = 8; // unidades por segundo
// Factor de velocidad mientras apunta con el francotirador
export const AIM_MOVE_FACTOR = 0.5;
export const MAX_HP = 100;
// Daño que absorbe el chaleco según su nivel (0 = sin chaleco)
export const ARMOR_ABSORB = [0, 25, 50, 75];
export const RESPAWN_MS = 3000; // solo en el campo de entrenamiento
export const INTERACT_RADIUS = 2.2;

export const PLAYER_COLORS = [
  '#f97316', '#3b82f6', '#22c55e', '#eab308', '#ec4899', '#a855f7',
  '#14b8a6', '#ef4444', '#84cc16', '#06b6d4', '#f43f5e', '#8b5cf6',
];

// --- Armas ---
// --- Arsenal (fase 29) ---
// Categorías: munición por defecto, ranuras de accesorios compatibles y retroceso por disparo
const ALL_SLOTS = ['scope', 'mag', 'stock', 'muzzle'];
export const WEAPON_CATEGORIES = {
  pistol: { name: 'Pistola', ammo: '9mm', slots: ['scope', 'mag', 'muzzle'], recoil: 0.35, secondary: true },
  smg: { name: 'Subfusil', ammo: '9mm', slots: ALL_SLOTS, recoil: 0.18 },
  ar: { name: 'Rifle de asalto', ammo: '556', slots: ALL_SLOTS, recoil: 0.22 },
  shotgun: { name: 'Escopeta', ammo: '12g', slots: ['mag', 'stock'], recoil: 0.25 },
  dmr: { name: 'Rifle de tirador', ammo: '762', slots: ALL_SLOTS, recoil: 0.35 },
  sniper: { name: 'Francotirador', ammo: '300', slots: ['scope', 'muzzle'], recoil: 0.6 },
  lmg: { name: 'Ametralladora ligera', ammo: '556', slots: ['scope', 'stock'], recoil: 0.2 },
  special: { name: 'Especial', ammo: 'rocket', slots: [], recoil: 0.5 },
  melee: { name: 'Cuerpo a cuerpo', ammo: null, slots: [], recoil: 0, secondary: true },
};

// [id, nombre, categoría, rareza (0 gris, 1 azul, 2 morado, 3 dorado), daño, ms entre disparos, cargador,
//  ms de recarga, dispersión (rad; en escopetas, apertura del abanico), perdigones, alcance, automática, extra]
const ARSENAL = [
  ['m1911', 'M1911', 'pistol', 0, 18, 300, 7, 1200, 0.03, 1, 24, false],
  ['glock17', 'Glock 17', 'pistol', 0, 13, 170, 17, 1300, 0.045, 1, 22, false],
  ['deagle', 'Desert Eagle dorada', 'pistol', 3, 42, 560, 7, 1500, 0.02, 1, 30, false],
  ['mp5', 'MP5', 'smg', 0, 12, 80, 30, 1700, 0.07, 1, 20, true],
  ['ump45', 'UMP-45', 'smg', 0, 15, 110, 25, 1800, 0.065, 1, 22, true],
  ['uzi', 'Uzi', 'smg', 0, 10, 60, 32, 1500, 0.1, 1, 16, true],
  ['m4a1', 'M4A1', 'ar', 1, 14, 95, 30, 1900, 0.05, 1, 32, true],
  ['ak47', 'AK-47', 'ar', 1, 18, 120, 30, 2100, 0.075, 1, 32, true, { ammo: '762' }],
  ['scarl', 'SCAR-L', 'ar', 1, 15, 100, 30, 2000, 0.055, 1, 32, true],
  ['aug', 'AUG', 'ar', 1, 15, 95, 30, 2200, 0.045, 1, 34, true],
  ['spas12', 'SPAS-12', 'shotgun', 1, 10, 800, 8, 2600, 0.35, 8, 12, false],
  ['m870', 'M870', 'shotgun', 1, 12, 950, 5, 2300, 0.32, 8, 13, false],
  ['dbarrel', 'Escopeta de doble cañón', 'shotgun', 1, 14, 300, 2, 2200, 0.38, 8, 11, false],
  ['sks', 'SKS', 'dmr', 2, 34, 280, 10, 2400, 0.02, 1, 45, false],
  ['mini14', 'Mini-14', 'dmr', 2, 28, 220, 20, 2300, 0.02, 1, 45, false, { ammo: '556' }],
  ['kar98k', 'Kar98k', 'sniper', 2, 80, 1400, 5, 2600, 0, 1, 55, false, { releaseToFire: true }],
  ['m24', 'M24', 'sniper', 2, 85, 1500, 5, 2800, 0, 1, 56, false, { releaseToFire: true }],
  ['awm', 'AWM', 'sniper', 3, 110, 1700, 5, 3000, 0, 1, 62, false, { releaseToFire: true }],
  ['m249', 'M249', 'lmg', 2, 13, 80, 100, 5200, 0.08, 1, 32, true],
  // Especiales legendarias (solo cajas doradas y lanzamientos aéreos)
  ['rpg', 'Lanzacohetes', 'special', 3, 110, 1500, 1, 3200, 0.01, 1, 50, false, { projectile: 'rocket', blast: 4.5 }],
  ['crossbow', 'Ballesta', 'special', 3, 75, 1200, 1, 1700, 0.005, 1, 45, false, { ammo: 'bolt', silent: true }],
  ['gl', 'Lanzagranadas', 'special', 3, 85, 900, 4, 3200, 0.03, 1, 22, false, { projectile: 'lob', blast: 3.8 }],
  // Gulag sin aciertos: golpe cuerpo a cuerpo (alcance corto, sin munición)
  ['fists', 'Puños', 'melee', 0, 24, 450, 999, 0, 0.2, 1, 2.2, false],
];
export const WEAPONS = Object.fromEntries(ARSENAL.map(([id, name, category, rarity, damage, intervalMs, magazine, reloadMs, spread, pellets, range, auto, extra = {}]) => [
  id,
  { name, category, rarity, damage, intervalMs, magazine, reloadMs, spread, pellets, range, auto, ammo: WEAPON_CATEGORIES[category].ammo, ...extra },
]));
export const weaponCategory = (id) => WEAPON_CATEGORIES[WEAPONS[id]?.category];
export const isSniper = (id) => WEAPONS[id]?.category === 'sniper';
export const START_WEAPON = 'm1911';
export const START_BULLETS = 3; // fase 29: se arranca con la pistola y solo 3 balas en total

// Tipos de munición: nombre y cuánto trae un paquete del suelo (correcciones 6.3: pocas balas; la forma
// normal de llenar la reserva es "Obtener balas")
export const AMMO_TYPES = {
  '9mm': { name: '9 mm', pack: 6 },
  556: { name: '5,56', pack: 8 },
  762: { name: '7,62', pack: 5 },
  '12g': { name: 'Calibre 12', pack: 2 },
  300: { name: '.300', pack: 2 },
  rocket: { name: 'Cohetes', pack: 1 },
  bolt: { name: 'Flechas', pack: 3 },
};

// Lanzables y equipo táctico (fase 29): máximo por tipo en la mochila (además del límite de la mochila)
export const THROWABLES = {
  frag: { name: 'Fragmentación', max: 4 },
  smoke: { name: 'Humo', max: 4, ms: 15_000, radius: 5 },
  flash: { name: 'Aturdidora', max: 4, radius: 11, ms: 3_000, slow: 0.6 },
  molotov: { name: 'Molotov', max: 3, ms: 8_000, radius: 3, maxRadius: 4.2, dps: 14, teamFactor: 0.5 },
  sensor: { name: 'Sensor de movimiento', max: 2, ms: 10_000, radius: 22, pulseMs: 1_000, hp: 30 },
  wall: { name: 'Granada muro', max: 3, ms: 25_000, hp: 260, arc: 3.2, pieces: 7, pieceRadius: 0.55 },
  uav: { name: 'UAV', max: 1, ms: 8_000, targets: 3, instant: true },
};
export const THROWABLE_IDS = Object.keys(THROWABLES);

// Índice de cada arma o lanzable en snapshots y killfeed. 'zone', 'bomb' y 'jeep' solo aparecen en el
// killfeed (zona, bombardeo retirado y atropello o explosión). Cliente y servidor se despliegan juntos.
export const WEAPON_IDS = [...Object.keys(WEAPONS), ...THROWABLE_IDS, 'zone', 'bomb', 'jeep'];

// Apuntado (cliente): zona de cancelación del joystick derecho (fracción del radio)
// y cuánto se desplaza la cámara hacia la mira del francotirador
export const AIM_CANCEL_ZONE = 0.3;
export const SNIPER_LOOK_AHEAD = 16;

export const GRENADE = {
  name: 'Granada de fragmentación',
  max: 4,
  fuseMs: 2000,
  flightMs: 800, // tiempo que tarda en llegar al punto apuntado
  minRange: 3,
  maxRange: 16,
  radius: 5, // radio de la explosión
  damage: 90, // en el centro; baja hasta 20 % en el borde
  intervalMs: 800,
};

// Nombres de los objetos del campo de entrenamiento
export const ITEM_NAMES = {
  ...Object.fromEntries(Object.entries(WEAPONS).map(([id, w]) => [id, w.name])),
  grenade: 'Granadas',
  frag: 'Granadas de fragmentación',
  armor: 'Chaleco',
};

// Campo de entrenamiento: los blancos se regeneran tras este tiempo sin recibir daño
export const DUMMY_HP = 200;
export const DUMMY_REGEN_MS = 2000;

// --- Cajas de suministro y preguntas ---
// Temas del banco (slug → nombre). Provisionales hasta tener los temas del corte 3.
// Temas reales del corte 3 (fase 28). El gradiente va dentro de derivadas direccionales; el cambio
// de orden de integración y las polares sencillas, dentro de integrales dobles.
export const TOPICS = {
  derivadas_direccionales: 'Derivadas direccionales',
  lagrange: 'Multiplicadores de Lagrange',
  integrales_dobles: 'Integrales dobles',
  maximos_minimos: 'Máximos y mínimos',
};

// Nombres de todos los temas que pueden aparecer en las estadísticas (los elegibles + el de las balas)
export const TOPIC_NAMES = { ...TOPICS, facil: 'Aritmética (modo fácil)' };

// Opciones por pregunta según la dificultad: con 4 era demasiado en medio de un tiroteo
export const optionCount = (difficulty) => (difficulty <= 2 ? 2 : 3);

// "Obtener balas": pregunta rápida de dificultad 1 (te puedes mover pero no disparar)
export const AMMO = { questionMs: 20_000, failCooldownMs: 10_000, okCooldownMs: 1_500 };

// Rareza = dificultad de la pregunta = calidad del botín. El índice es la dificultad − 1.
export const RARITIES = [
  { id: 'comun', name: 'Común', color: '#9ca3af', difficulty: 1, timeMs: 35_000, loot: ['Munición', 'Venda', 'Bebida', 'Granada'] },
  { id: 'raro', name: 'Raro', color: '#3b82f6', difficulty: 2, timeMs: 45_000, loot: ['Escopeta o rifle', 'Chaleco 2 y casco', 'Mochila 2', 'Mira 2x', 'Accesorios'] },
  { id: 'epico', name: 'Épico', color: '#a855f7', difficulty: 3, timeMs: 55_000, loot: ['Francotirador con mira 4x', 'Chaleco 3', 'Casco 3', 'Mochila 3', 'Silenciador'] },
  { id: 'legendario', name: 'Legendario', color: '#eab308', difficulty: 4, timeMs: 70_000, loot: ['Todo o nada: botín épico doble', 'Si fallas pierdes el chaleco'] },
];

// Cajas por partida: los puntos calientes siempre; de los demás, esta fracción al azar
export const CRATE_SPAWN = { inside: 0.75, open: 0.35 };

export const CRATE_LOCK_MS = 15_000; // caja bloqueada tras fallar
export const ALARM_MS = 3_000; // alarma visible para todos tras un fallo
export const PRACTICE_CRATE_RESET_MS = 4_000; // la caja de práctica se vuelve a cerrar
export const STREAK_FOR_RADAR = 3;
export const RADAR_MS = 10_000;

// --- Zona segura ---
// Todas las zonas son elipses (x − cx)²/p² + (y − cy)²/q² ≤ 1; el círculo es p = q.
// La inicial cubre todo el mapa (las esquinas están a 500·√2 ≈ 707).
export const ZONE_START = { cx: 0, cy: 0, p: 710, q: 710 };
// La primera zona se anuncia a los 3:30 de partida (bus ~1:30 + caída) y empieza a cerrarse 90 s
// después: unos 3 min tras aterrizar. Cada fase: aviso (waitMs), cierre (shrinkMs), radio y daño.
// `ellipse` escala los semiejes; `moving`: el centro se desplaza lejos (las dos últimas).
export const ZONE_FIRST_DELAY_MS = 210_000;
export const ZONE_PHASES = [
  // Mapa de 1 km: ~19 min de partida en duración normal (la primera solo deja fuera los bordes)
  { radius: 430, waitMs: 90_000, shrinkMs: 120_000, dps: 1 },
  { radius: 300, waitMs: 100_000, shrinkMs: 100_000, dps: 2 },
  { radius: 200, waitMs: 90_000, shrinkMs: 90_000, dps: 4, ellipse: [1.3, 0.75] },
  { radius: 120, waitMs: 75_000, shrinkMs: 70_000, dps: 7 },
  { radius: 60, waitMs: 55_000, shrinkMs: 60_000, dps: 11, moving: true },
  { radius: 22, waitMs: 40_000, shrinkMs: 50_000, dps: 16, moving: true },
];
// Daño fuera de la zona cuando ya terminó la última fase
export const ZONE_FINAL_DPS = 22;
// Duración elegible por el anfitrión: escala todos los tiempos de la zona y el lanzamiento aéreo
export const DURATIONS = {
  corta: { name: 'Corta (~12 min)', scale: 0.62 },
  normal: { name: 'Normal (~19 min)', scale: 1 },
  larga: { name: 'Larga (~24 min)', scale: 1.27 },
};

// Lanzamiento aéreo: a mitad de partida cae una caja dorada en paracaídas
export const AIRDROP = { atMs: 620_000, fallMs: 25_000, rarity: 3 };

// Cuadrícula militar de sectores: 10 × 10 (A1 arriba a la izquierda)
export const SECTORS = 10; // cuadrícula militar A1–J10 (sectores de 100 m)

// --- Operadores de radio (los caídos siguen jugando) ---
// Espectadores (caídos sin Gulag o que ya lo perdieron): preguntas de práctica que suman puntos
export const OPERATOR = {
  firstDelayMs: 2_000, // tras caer, primera pregunta
  questionMs: 30_000,
  gapMs: 2_500, // entre una pregunta y la siguiente
};
// Reanimación en equipo (dúos y escuadras): tiempo de la pregunta
export const TEAM_REVIVE = { questionMs: 20_000 };
// Gulag (fase 30): combates de 2 o 3 en arenas privadas fuera del mapa
export const GULAG = {
  untilPhase: 3, // se entra al caer mientras la zona esté en las fases 1 a 3 (índices 0 a 2)
  pairWaitMs: 10_000, // con 2 en cola, se pelea si en 10 s no llega un tercero
  botWaitMs: 45_000, // solo en cola 45 s: contra un bot del Gulag
  questionMs: 30_000, // 3 preguntas (dificultad 1, 2 y 3) antes del combate
  countdownMs: 3_000,
  fightMs: 60_000, // después, muerte súbita
  suddenMs: 20_000, // el círculo se cierra hasta el centro
  suddenDps: 12,
  suddenStartRadius: 20,
  returnAltitude: 30, // el ganador vuelve en paracaídas
  returnPickMs: 6_000, // tiempo para tocar en el mapa dónde caer
  returnBullets: 3, // si peleó a puños, vuelve con la pistola y estas balas
};
// Puntaje final: puestos superados, bajas y aciertos (también de espectador y Gulag)
export const SCORE = { place: 10, kill: 15, correct: 5 };
export const CLASS_STATS_MS = 2_000;

// --- Mecánicas épicas ---
// Recompensa al líder: desde esta fase de la zona (índice 1 = fase 2)
export const LEADER = { fromPhase: 1, checkMs: 1_000 };
// Puntos durante la partida (el puesto final solo se conoce al terminar)
export const LIVE_SCORE = { kill: 15, correct: 5 };

// Clima de la partida (el host lo elige o queda aleatorio)
export const WEATHERS = {
  despejado: 'Despejado',
  lluvia: 'Lluvia',
  niebla: 'Niebla densa',
  arena: 'Tormenta de arena',
  noche: 'Noche',
};
// Tormenta de arena: el viento acelera las granadas en vuelo (unidades/s²)
export const WIND_ACCEL = 3;
// De noche, disparar te muestra en el minimapa de todos este tiempo
export const NIGHT_REVEAL_MS = 2_000;

// Jeeps: física sencilla compartida (servidor y predicción del conductor)
export const JEEP = {
  radius: 1.4,
  maxSpeed: 15,
  accel: 12,
  brake: 22,
  turnRate: 2.4, // rad/s
  hp: 300,
  engineLockMs: 10_000, // motor trabado tras fallar el código
  questionMs: 25_000,
  enterRadius: 3,
  noiseRadius: 35, // con el motor encendido aparece en el minimapa de los cercanos
  runOverMinSpeed: 4,
  runOverDamagePerSpeed: 6,
  explosionRadius: 6,
  explosionDamage: 100,
};

// Duelo final: al quedar 2 vivos, presentación congelada y un último círculo
export const DUEL = { introMs: 4_000, radius: 9, shrinkMs: 25_000 };

// Repetición de la mejor jugada (se muestra antes de los resultados)
export const REPLAY = {
  bufferMs: 10_000, // historia de snapshots en memoria
  beforeMs: 4_500, // el clip empieza 4,5 s antes del momento clave…
  afterMs: 1_500, // …y termina 1,5 s después
  sendEvery: 2, // se envía a 10 Hz (los eventos del snapshot omitido pasan al siguiente)
  slowBeforeMs: 900, // cámara lenta alrededor del momento clave (clip de ~8 s reales)
  slowAfterMs: 300,
  slowSpeed: 0.35,
  multiKillMs: 5_000,
  sniperDistance: 30,
};

// Despliegue al iniciar la partida: bus volador o elegir punto (lo decide el anfitrión)
export const DEPLOY_MODES = { bus: 'Bus', punto: 'Elegir punto' };
export const DEPLOY = {
  busSpeed: 14, // m/s (una ruta de ~1,2 km dura ~1:30)
  busAltitude: 112, // m sobre el suelo (2,5 veces el de antes)
  busWaitMs: 5_000, // la ruta se ve antes de que el bus arranque
  routeMargin: 10, // el bus empieza y termina fuera del mapa
  routeCenterJitter: 0.55, // la ruta pasa a lo sumo a este tanto del semiancho del centro
  // Caída libre con planeo: inclinarse (empujar el joystick) cae más rápido y avanza más
  fallSpeed: 9, // m/s sin inclinarse
  fallLeanSpeed: 7, // m/s extra inclinado del todo
  airSpeed: 18, // desplazamiento horizontal inclinado del todo
  chuteAltitude: 22, // se abre solo a esta altura (mínima segura)
  chuteManualMs: 1_200, // tras saltar, desde cuándo se puede abrir a mano (Espacio otra vez)
  chuteSpeed: 3.6, // bajada con paracaídas: abrirlo antes llega más lejos pero más lento
  chuteAirSpeed: 9,
  pickMs: 10_000, // modo elegir punto: tiempo para tocar el mapa
  pointAltitude: 30, // desde dónde se cae en paracaídas al elegir punto
  reviveAltitude: 24, // reanimación de operador: cae en paracaídas
};

// Cola de mensajes del Mando (cliente): el de mayor prioridad interrumpe al que se está mostrando;
// los demás esperan su turno (hasta RADIO_MAX_WAIT_MS) en lugar de pisarse
export const RADIO_PRIORITY = { closing: 2, final: 2, zone: 2, duel: 2, airdrop: 1, leader: 1, gulag: 1 };
export const RADIO_MAX_WAIT_MS = 15000;
export const RADIO_MIN_SHOW_MS = 2500; // si lo interrumpen antes, vuelve a la cola con lo que le faltaba

// --- Botín de battle royale (fases 18 y 29) ---
// Objetos del suelo y de las cajas. kind: weapon | ammo | heal | throwable | armor | helmet | backpack | attachment
// tier: rareza para el color (0 gris, 1 azul, 2 morado, 3 dorado)
export const LOOT_ITEMS = {
  ...Object.fromEntries(Object.entries(WEAPONS).filter(([id]) => id !== 'fists').map(([id, w]) => [id, { name: w.name, kind: 'weapon', tier: w.rarity }])),
  ...Object.fromEntries(Object.entries(AMMO_TYPES).map(([id, a]) => [`ammo_${id}`, { name: `Munición ${a.name}`, kind: 'ammo', ammo: id, amount: a.pack, tier: id === 'rocket' || id === 'bolt' ? 3 : 0 }])),
  bandage: { name: 'Venda', kind: 'heal', tier: 0 },
  medkit: { name: 'Botiquín', kind: 'heal', tier: 1 },
  drink: { name: 'Bebida energética', kind: 'heal', tier: 0 },
  ...Object.fromEntries(Object.entries(THROWABLES).map(([id, t]) => [id, { name: t.name, kind: 'throwable', tier: id === 'uav' || id === 'sensor' ? 2 : 1 }])),
  armor1: { name: 'Chaleco 1', kind: 'armor', level: 1, tier: 0 },
  armor2: { name: 'Chaleco 2', kind: 'armor', level: 2, tier: 1 },
  armor3: { name: 'Chaleco 3', kind: 'armor', level: 3, tier: 2 },
  helmet1: { name: 'Casco 1', kind: 'helmet', level: 1, tier: 0 },
  helmet2: { name: 'Casco 2', kind: 'helmet', level: 2, tier: 1 },
  helmet3: { name: 'Casco 3', kind: 'helmet', level: 3, tier: 2 },
  backpack1: { name: 'Mochila 1', kind: 'backpack', level: 1, tier: 0 },
  backpack2: { name: 'Mochila 2', kind: 'backpack', level: 2, tier: 1 },
  backpack3: { name: 'Mochila 3', kind: 'backpack', level: 3, tier: 2 },
  reddot: { name: 'Mira de punto rojo', kind: 'attachment', slot: 'scope', tier: 0 },
  scope2x: { name: 'Mira 2x', kind: 'attachment', slot: 'scope', tier: 1 },
  scope4x: { name: 'Mira 4x', kind: 'attachment', slot: 'scope', tier: 2 },
  extmag: { name: 'Cargador ampliado', kind: 'attachment', slot: 'mag', tier: 1 },
  stock: { name: 'Culata', kind: 'attachment', slot: 'stock', tier: 1 },
  silencer: { name: 'Silenciador', kind: 'attachment', slot: 'muzzle', tier: 1 },
};
// Índice de cada objeto en los eventos de botín (cliente y servidor se despliegan juntos)
export const LOOT_IDS = Object.keys(LOOT_ITEMS);
export const TIER_COLORS = ['#9ca3af', '#3b82f6', '#a855f7', '#eab308'];

// Botín suelto en el suelo (fase 23): SOLO munición, vendas y casco 1. Todo lo demás (armas, lanzables,
// miras, accesorios, mochilas, chalecos, cascos 2–3, botiquines y bebidas) sale de cajas con pregunta, de
// la caja de botín de un caído o del lanzamiento aéreo: el cálculo es la llave del poder.
export const LOOT_GROUND = ['ammo_9mm', 'ammo_556', 'ammo_762', 'ammo_12g', 'ammo_300', 'bandage', 'helmet1'];

// Botín en el suelo por partida: cuántos por punto de zona y peso de cada objeto
export const LOOT = {
  perHouseRoom: 2, // objetos por cuarto de casa
  perArea: { big: 24, mid: 14, small: 6 }, // objetos sueltos por zona con nombre, según su tamaño
  scattered: 220, // objetos sueltos por el campo abierto
  pickupRadius: 2.2,
  dropSpread: 1.2, // al soltar algo queda a esta distancia, alrededor del jugador
  deathBox: true,
  privateMs: 10_000, // lo que no elegiste de una caja es solo tuyo este tiempo
  // Armas de cajas o del botín: salen con esta fracción del cargador
  weaponMagFraction: 1 / 3,
  // Peso de cada objeto al sortear (los que no figuran pesan 1): la munición es escasa
  weights: { ammo_9mm: 1.5, ammo_556: 1, ammo_762: 0.7, ammo_12g: 0.7, ammo_300: 0.4, bandage: 4, helmet1: 1.5 },
};

// Curación con tiempo. Mientras cura se camina más lento; disparar o cambiar de arma la cancela.
// La bebida no se canaliza: suma vida de a poco durante durationMs y da algo de velocidad.
export const HEALING = {
  bandage: { useMs: 2_000, heal: 15 },
  medkit: { useMs: 6_000, heal: 100 },
  drink: { useMs: 1_000, heal: 40, durationMs: 10_000, speedBoost: 1.12 },
  moveFactor: 0.5,
};

// Mochila (nivel 0 = sin mochila): munición por tipo, consumibles, lanzables (en total) y accesorios
// sueltos. Cada lanzable tiene además su máximo propio (THROWABLES[id].max).
export const BACKPACK = [
  { ammo: { '9mm': 60, 556: 90, 762: 60, '12g': 20, 300: 15, rocket: 2, bolt: 6 }, bandage: 3, medkit: 1, drink: 1, throwables: 3, loose: 2 },
  { ammo: { '9mm': 90, 556: 135, 762: 90, '12g': 30, 300: 22, rocket: 3, bolt: 9 }, bandage: 5, medkit: 2, drink: 2, throwables: 5, loose: 3 },
  { ammo: { '9mm': 120, 556: 180, 762: 120, '12g': 40, 300: 30, rocket: 4, bolt: 12 }, bandage: 8, medkit: 3, drink: 3, throwables: 7, loose: 4 },
  { ammo: { '9mm': 180, 556: 270, 762: 180, '12g': 60, 300: 45, rocket: 6, bolt: 18 }, bandage: 10, medkit: 4, drink: 4, throwables: 9, loose: 6 },
];

// Casco: fracción del daño que resta (después del chaleco)
export const HELMET = [0, 0.1, 0.16, 0.22];

// Accesorios del arma (valen para la que se tenga en mano)
export const ATTACHMENTS = {
  extmag: 1.5, // multiplica el cargador
  stock: 0.7, // multiplica la dispersión
  reddot: 0.85, // la mira de punto rojo también cierra un poco la dispersión
  silencerHearRadius: 12, // con silenciador solo lo oyen los muy cercanos (y no sale en su minimapa)
};
// Mira: cuánto se adelanta la cámara al apuntar (metros); el francotirador ya trae la suya
export const SCOPES = { none: 0, reddot: 3, scope2x: 8, scope4x: 14 };

// --- Modo presentación (fase 20) ---
// Bots del servidor ("Completar con bots hasta N"): puntería imperfecta y alcance de disparo
export const BOTS = { max: 39, range: 16, aimError: 0.3, fireChance: 0.45, ammoRefillMs: 8_000, nameBase: 'Bot' };
// Frases rápidas (índice fijo) y antispam: una cada 2,5 s y como mucho 4 cada 20 s
export const QUICK_PHRASES = ['¡Aquí!', '¡Cuidado!', 'Necesito balas', '¡Bien hecho!', 'Vamos a la zona', '¡Gracias!'];
export const PHRASE_LIMIT = { gapMs: 2_500, windowMs: 20_000, max: 4, showMs: 3_500 };
// Director de cámara del proyector: cuánto se queda en cada toma (mín. y máx.)
export const DIRECTOR = { minShotMs: 6_000, maxShotMs: 14_000, fightRadius: 18 };

// --- Cámara (fase 24) ---
// Antes: 30,5 m a 50°. Normal ahora a 16 m y 52° (mismo campo de visión de 40°): el soldado se ve
// ~1,9 veces más grande. Factores de la cámara dinámica (se aplican con transición suave).
export const CAMERA = {
  pitchDeg: 52,
  fov: 40,
  distances: { near: 13, normal: 16, far: 21 },
  insideFactor: 0.85, // dentro de un edificio, algo más cerca
  runFactor: 1.1, // corriendo en campo abierto, un poco más lejos
  runSpeed: 5, // m/s desde los que cuenta como "corriendo"
  jeepFactor: 1.3, // en jeep, más lejos
  touchShift: 2.2, // celular horizontal: el soldado queda un poco por debajo del centro (m hacia adelante)
  projectorDistance: 26, // el proyector, siguiendo a alguien, un poco más lejos
  deployDistance: 30.5, // en el bus y cayendo: la vista amplia de siempre (se ve dónde caer)
  lookScaleFrom: 30.5, // la mira y el francotirador se ajustaron con la cámara a 30,5 m: se escalan
};

// --- Accesorios que se notan (fase 25) ---
// Retroceso: cada disparo abre la dispersión (multiplicador 1 + retroceso) y se recupera con el tiempo.
// La culata reduce lo que sube por disparo. La cámara del que dispara "salta" en proporción.
export const RECOIL = {
  perShot: Object.fromEntries(Object.entries(WEAPONS).map(([id, w]) => [id, WEAPON_CATEGORIES[w.category].recoil])),
  max: 2.2, // dispersión hasta ×3,2 disparando seguido
  recoverPerSec: 2.5,
  stock: 0.5, // con culata, la mitad por disparo
};
// Casco contra el francotirador (además de HELMET para todo lo demás)
export const HELMET_SNIPER = [0, 0.25, 0.4, 0.55];
// Mira al apuntar: la cámara se aleja este factor (más alcance visible) además de adelantarse
export const SCOPE_ZOOM = { none: 1, reddot: 1, scope2x: 1.25, scope4x: 1.45 };
