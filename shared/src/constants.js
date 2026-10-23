// Constantes de juego compartidas entre cliente y servidor.
// Se irán agregando por fase (armas, rarezas, zona...).

// --- Red ---
export const SERVER_PORT = 3001;

// Ticks por segundo del loop autoritativo del servidor (y frecuencia de envío de inputs)
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

// Retraso con el que el cliente dibuja a los demás jugadores (interpolación)
export const INTERP_DELAY_MS = 100;

// Inputs que el servidor acepta en ráfaga; en promedio solo 1 por tick (anti speed hack)
export const MAX_INPUT_BURST = 3;

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
// Separación de las líneas numeradas del plano cartesiano
export const GRID_STEP = 10;

// Terreno z = A·sin(x/k)·cos(y/k). Colinas suaves: pendiente máxima ≈ A/k
export const TERRAIN = { amplitude: 2, scale: 10 };
// Separación de las curvas de nivel dibujadas en el piso
export const CONTOUR_STEP = 0.5;

// Radios de aparición
export const LOBBY_SPAWN_RADIUS = 8;
export const GAME_SPAWN_RADIUS = 40;

// --- Jugador ---
export const PLAYER_RADIUS = 0.6;
export const PLAYER_SPEED = 8; // unidades por segundo

export const PLAYER_COLORS = [
  '#f97316', '#3b82f6', '#22c55e', '#eab308', '#ec4899', '#a855f7',
  '#14b8a6', '#ef4444', '#84cc16', '#06b6d4', '#f43f5e', '#8b5cf6',
];
