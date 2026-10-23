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
export const MAP_SIZE = 120;
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
// Índice de cada arma en snapshots y killfeed (el orden no debe cambiar)
export const WEAPON_IDS = ['pistol', 'shotgun', 'rifle', 'sniper', 'grenade'];

// intervalMs: tiempo entre disparos · spread: desviación máxima (rad) por bala
// o apertura total del abanico en la escopeta · range: alcance en unidades
export const WEAPONS = {
  pistol: {
    name: 'Pistola', damage: 18, intervalMs: 300, magazine: 12, reserve: Infinity,
    reloadMs: 1200, spread: 0.03, pellets: 1, range: 24, auto: false,
  },
  shotgun: {
    name: 'Escopeta', damage: 11, intervalMs: 850, magazine: 5, reserve: 20,
    reloadMs: 2200, spread: 0.35, pellets: 8, range: 13, auto: false,
  },
  rifle: {
    name: 'Rifle de asalto', damage: 14, intervalMs: 100, magazine: 30, reserve: 90,
    reloadMs: 1800, spread: 0.06, pellets: 1, range: 30, auto: true,
  },
  sniper: {
    name: 'Francotirador', damage: 80, intervalMs: 1400, magazine: 5, reserve: 15,
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

// Rareza = dificultad de la pregunta = calidad del botín. El índice es la dificultad − 1.
export const RARITIES = [
  { id: 'comun', name: 'Común', color: '#9ca3af', difficulty: 1, timeMs: 25_000, loot: ['Munición', 'Venda', 'Granada'] },
  { id: 'raro', name: 'Raro', color: '#3b82f6', difficulty: 2, timeMs: 35_000, loot: ['Escopeta', 'Rifle de asalto', 'Chaleco 1–2', 'Munición'] },
  { id: 'epico', name: 'Épico', color: '#a855f7', difficulty: 3, timeMs: 45_000, loot: ['Francotirador', 'Chaleco 3', 'Botiquín'] },
  { id: 'legendario', name: 'Legendario', color: '#eab308', difficulty: 4, timeMs: 60_000, loot: ['Todo o nada: botín épico doble', 'Si fallas pierdes el chaleco'] },
];

export const CRATE_LOCK_MS = 15_000; // caja bloqueada tras fallar
export const ALARM_MS = 3_000; // alarma visible para todos tras un fallo
export const PRACTICE_CRATE_RESET_MS = 4_000; // la caja de práctica se vuelve a cerrar
export const STREAK_FOR_RADAR = 3;
export const RADAR_MS = 10_000;
export const BANDAGE_HEAL = 25;
