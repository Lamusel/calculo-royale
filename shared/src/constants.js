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
// ~2,5 veces el área del mapa original (120): para 40 jugadores
export const MAP_SIZE = 280;
export const MAP_HALF = MAP_SIZE / 2;

// Terreno z = A·sin(x/k)·cos(y/k), solo interno. Colinas suaves: pendiente máxima ≈ A/k
export const TERRAIN = { amplitude: 2, scale: 10 };

// Velocidad según la pendiente: factor = 1 − k·(∇f·û), limitado a [min, max]
export const SLOPE_SPEED = { k: 0.7, min: 0.8, max: 1.15 };

// Radios de aparición
export const LOBBY_SPAWN_RADIUS = 6;
export const GAME_SPAWN_RADIUS = 40;

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
// Índice de cada arma en snapshots y killfeed (el orden no debe cambiar).
// 'zone', 'bomb' y 'jeep' solo aparecen en el killfeed (zona, bombardeo y atropello o explosión).
export const WEAPON_IDS = ['pistol', 'shotgun', 'rifle', 'sniper', 'grenade', 'zone', 'bomb', 'jeep'];

// intervalMs: tiempo entre disparos · spread: desviación máxima (rad) por bala
// o apertura total del abanico en la escopeta · range: alcance en unidades
// Munición: cargador y reserva limitada (también la pistola). Se consigue en cajas o con
// "Obtener balas" (pregunta rápida).
export const WEAPONS = {
  pistol: {
    name: 'Pistola', damage: 18, intervalMs: 300, magazine: 12, reserve: 36,
    reloadMs: 1200, spread: 0.03, pellets: 1, range: 24, auto: false,
  },
  shotgun: {
    name: 'Escopeta', damage: 11, intervalMs: 850, magazine: 5, reserve: 10,
    reloadMs: 2200, spread: 0.35, pellets: 8, range: 13, auto: false,
  },
  rifle: {
    name: 'Rifle de asalto', damage: 14, intervalMs: 100, magazine: 30, reserve: 60,
    reloadMs: 1800, spread: 0.06, pellets: 1, range: 30, auto: true,
  },
  sniper: {
    name: 'Francotirador', damage: 80, intervalMs: 1400, magazine: 5, reserve: 10,
    reloadMs: 2600, spread: 0, pellets: 1, range: 55, auto: false, releaseToFire: true,
  },
};

// Apuntado (cliente): zona de cancelación del joystick derecho (fracción del radio)
// y cuánto se desplaza la cámara hacia la mira del francotirador
export const AIM_CANCEL_ZONE = 0.3;
export const SNIPER_LOOK_AHEAD = 16;

export const GRENADE = {
  name: 'Granada',
  max: 2, // máximo en el inventario
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
  armor: 'Chaleco',
};

// Campo de entrenamiento: los blancos se regeneran tras este tiempo sin recibir daño
export const DUMMY_HP = 200;
export const DUMMY_REGEN_MS = 2000;

// --- Cajas de suministro y preguntas ---
// Temas del banco (slug → nombre). Provisionales hasta tener los temas del corte 3.
export const TOPICS = {
  integrales_dobles: 'Integrales dobles',
  integrales_triples: 'Integrales triples',
  cambio_orden: 'Cambio de orden de integración',
  polares: 'Coordenadas polares',
  cilindricas_esfericas: 'Coordenadas cilíndricas y esféricas',
  jacobiano: 'Jacobiano y cambio de variables',
  maximos_minimos: 'Máximos y mínimos',
  lagrange: 'Multiplicadores de Lagrange',
  gradiente_direccional: 'Gradiente y derivada direccional',
};

// Nombres de todos los temas que pueden aparecer en las estadísticas (los elegibles + el de las balas)
export const TOPIC_NAMES = { ...TOPICS, basicas: 'Derivadas y límites (balas)', facil: 'Aritmética (modo fácil)' };

// Opciones por pregunta según la dificultad: con 4 era demasiado en medio de un tiroteo
export const optionCount = (difficulty) => (difficulty <= 2 ? 2 : 3);

// "Obtener balas": pregunta rápida de dificultad 1 (te puedes mover pero no disparar)
export const AMMO = { questionMs: 15_000, failCooldownMs: 10_000, okCooldownMs: 1_500 };

// Rareza = dificultad de la pregunta = calidad del botín. El índice es la dificultad − 1.
export const RARITIES = [
  { id: 'comun', name: 'Común', color: '#9ca3af', difficulty: 1, timeMs: 25_000, loot: ['Munición', 'Venda', 'Bebida', 'Granada'] },
  { id: 'raro', name: 'Raro', color: '#3b82f6', difficulty: 2, timeMs: 35_000, loot: ['Escopeta o rifle', 'Chaleco 2 y casco', 'Mochila 2', 'Mira 2x', 'Accesorios'] },
  { id: 'epico', name: 'Épico', color: '#a855f7', difficulty: 3, timeMs: 45_000, loot: ['Francotirador con mira 4x', 'Chaleco 3', 'Casco 3', 'Mochila 3', 'Silenciador'] },
  { id: 'legendario', name: 'Legendario', color: '#eab308', difficulty: 4, timeMs: 60_000, loot: ['Todo o nada: botín épico doble', 'Si fallas pierdes el chaleco'] },
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
// La inicial cubre todo el mapa (las esquinas están a 140·√2 ≈ 198).
export const ZONE_START = { cx: 0, cy: 0, p: 200, q: 200 };
// Cada fase: aviso (waitMs), cierre (shrinkMs), radio de la zona nueva y daño por segundo fuera.
// `ellipse` escala los semiejes (idea #3: una fase con elipse).
export const ZONE_PHASES = [
  // Mapa de 280 m (radios ×1,47 respecto del de 190): ~10 min de zona; con despliegue y duelo, 11–12 min
  { radius: 135, waitMs: 80_000, shrinkMs: 70_000, dps: 2 },
  { radius: 93, waitMs: 70_000, shrinkMs: 60_000, dps: 4 },
  { radius: 63, waitMs: 60_000, shrinkMs: 55_000, dps: 6, ellipse: [1.3, 0.75] },
  { radius: 35, waitMs: 55_000, shrinkMs: 45_000, dps: 9 },
  { radius: 13, waitMs: 50_000, shrinkMs: 40_000, dps: 14 },
];
// Daño fuera de la zona cuando ya terminó la última fase
export const ZONE_FINAL_DPS = 20;

// Lanzamiento aéreo: a mitad de partida cae una caja dorada en paracaídas
export const AIRDROP = { atMs: 320_000, fallMs: 20_000, rarity: 3 };

// Cuadrícula militar de sectores: 6 × 6 (A1 arriba a la izquierda)
export const SECTORS = 6;

// --- Operadores de radio (los caídos siguen jugando) ---
export const OPERATOR = {
  firstDelayMs: 2_000, // tras caer, primera transmisión
  questionMs: 30_000,
  gapMs: 2_500, // entre una transmisión y la siguiente
  reviveStreak: 3, // aciertos seguidos para reanimar
  revivePhases: 2, // solo si caíste en las fases 1 y 2 de la zona
  reviveHp: 75, // 50 de vida + la venda
};
export const BOMBING = { everyMs: 60_000, warningMs: 5_000, damage: 70, disabledAtAlive: 5 };
export const INTERCEPT = { everyMs: 120_000, questionMs: 20_000, winners: 5 };
// Puntaje final: puestos superados, bajas y aciertos (también de operador e intercepción)
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
  questionMs: 30_000,
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
  busSpeed: 15, // m/s
  busAltitude: 45, // m sobre el suelo
  busWaitMs: 4_000, // la ruta se ve antes de que el bus arranque
  routeMargin: 8, // el bus empieza y termina fuera del mapa
  routeCenterJitter: 0.3, // la ruta pasa a lo sumo a este tanto del semiancho del centro
  fallSpeed: 13, // caída libre (m/s)
  airSpeed: 11, // desplazamiento horizontal en caída libre
  chuteAltitude: 14, // se abre el paracaídas
  chuteSpeed: 4.5, // bajada con paracaídas
  chuteAirSpeed: 6,
  pickMs: 10_000, // modo elegir punto: tiempo para tocar el mapa
  pointAltitude: 30, // desde dónde se cae en paracaídas al elegir punto
  reviveAltitude: 24, // reanimación de operador: cae en paracaídas
};

// Cola de mensajes del Mando (cliente): el de mayor prioridad interrumpe al que se está mostrando;
// los demás esperan su turno (hasta RADIO_MAX_WAIT_MS) en lugar de pisarse
export const RADIO_PRIORITY = { bombing: 3, closing: 2, final: 2, zone: 2, duel: 2, airdrop: 1, intercept: 1, leader: 1, revive: 0 };
export const RADIO_MAX_WAIT_MS = 15000;
export const RADIO_MIN_SHOW_MS = 2500; // si lo interrumpen antes, vuelve a la cola con lo que le faltaba

// --- Botín de battle royale (fase 18) ---
// Objetos del suelo y de las cajas. kind: weapon | ammo | heal | grenade | armor | helmet | backpack | attachment
// tier: 0 común, 1 raro (en el suelo solo hay común y raro; las cajas dan de raro en adelante)
export const LOOT_ITEMS = {
  shotgun: { name: 'Escopeta', kind: 'weapon', tier: 1 },
  rifle: { name: 'Rifle de asalto', kind: 'weapon', tier: 1 },
  sniper: { name: 'Francotirador', kind: 'weapon', tier: 2 },
  ammo: { name: 'Munición', kind: 'ammo', tier: 0 },
  bandage: { name: 'Venda', kind: 'heal', tier: 0 },
  medkit: { name: 'Botiquín', kind: 'heal', tier: 1 },
  drink: { name: 'Bebida energética', kind: 'heal', tier: 0 },
  grenade: { name: 'Granada', kind: 'grenade', tier: 0 },
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
// Índice fijo de cada objeto (eventos de botín); no cambiar el orden, solo agregar al final
export const LOOT_IDS = Object.keys(LOOT_ITEMS);

// Botín suelto en el suelo (fase 23): SOLO estos objetos. Todo lo demás (armas, granadas, miras,
// accesorios, mochilas, chalecos, cascos 2–3, botiquines y bebidas) sale de cajas con pregunta, de la
// caja de botín de un caído o del lanzamiento aéreo: el cálculo es la llave del poder.
export const LOOT_GROUND = ['ammo', 'bandage', 'helmet1'];

// Botín en el suelo por partida: cuántos por punto de zona y peso de cada objeto
export const LOOT = {
  perHouseRoom: 2, // objetos por cuarto de casa
  perArea: 14, // objetos sueltos por zona con nombre
  scattered: 40, // objetos sueltos por el campo abierto
  pickupRadius: 2.2,
  dropSpread: 1.2, // al soltar algo queda a esta distancia, alrededor del jugador
  deathBox: true,
  // Peso de cada objeto al sortear (los que no figuran pesan 1)
  weights: { ammo: 4, bandage: 3, helmet1: 1 },
};

// Curación con tiempo. Mientras cura se camina más lento; disparar o cambiar de arma la cancela.
// La bebida no se canaliza: suma vida de a poco durante durationMs y da algo de velocidad.
export const HEALING = {
  bandage: { useMs: 2_000, heal: 15 },
  medkit: { useMs: 6_000, heal: 100 },
  drink: { useMs: 1_000, heal: 40, durationMs: 10_000, speedBoost: 1.12 },
  moveFactor: 0.5,
};

// Mochila: cuánto se puede llevar de cada consumible (nivel 0 = sin mochila)
export const BACKPACK = [
  { bandage: 3, medkit: 1, drink: 1, grenade: 2, reserve: 2 },
  { bandage: 5, medkit: 2, drink: 2, grenade: 3, reserve: 2.5 },
  { bandage: 8, medkit: 3, drink: 3, grenade: 4, reserve: 3 },
  { bandage: 10, medkit: 4, drink: 4, grenade: 5, reserve: 4 },
];
// reserve: tope de munición de reserva = WEAPONS[arma].reserve × este valor

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

// --- Modo Profe Jefe Final (fase 21) ---
// Un jefe gigante en el estadio contra todos (sin fuego amigo). Su escudo matemático solo baja
// con aciertos del equipo ("Romper escudo"); 3 fases; los caídos vuelven a los 20 s si aciertan;
// a los 8 minutos sin derrotarlo, gana el jefe.
export const GAME_MODES = { royale: 'Battle royale', jefe: 'Profe Jefe Final' };
export const BOSS = {
  name: 'Profe Jefe Final',
  arena: { x: 114, y: -8 }, // centro de la cancha del estadio
  roam: 9, // se mueve dentro de este radio alrededor del centro
  radius: 2.4, // cuerpo (lo que reciben las balas sin escudo)
  shieldRadius: 3.8,
  speed: 2.2,
  range: 34,
  phases: [
    { hp: 700, shieldGoal: 3, fireMs: 1500, burst: 3, damage: 8, waveMs: 0 },
    { hp: 800, shieldGoal: 4, fireMs: 1200, burst: 4, damage: 10, waveMs: 9_000 },
    { hp: 900, shieldGoal: 5, fireMs: 900, burst: 5, damage: 12, waveMs: 6_500 },
  ],
  hpPerExtraPlayer: 0.2, // vida × (1 + 0,2 por cada jugador después del primero)
  goalEveryPlayers: 6, // la meta del escudo sube 1 cada 6 jugadores
  shieldDownMs: 15_000,
  spread: 0.12,
  waveRadius: 11,
  waveDamage: 22,
  waveWarnMs: 1_500,
  limitMs: 480_000,
  questionMs: 20_000,
  failCooldownMs: 6_000,
  reviveMs: 20_000,
  reviveRetryMs: 10_000,
  reviveHp: 75,
  spawnRadius: 15,
  loadout: { weapon: 'rifle', armor: 2, bandages: 3 },
};
// Id del jefe en disparos y killfeed (los jugadores empiezan en 1) y como blanco de las balas
export const BOSS_ID = 0;
export const BOSS_TARGET_ID = -999;

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
