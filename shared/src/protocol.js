// Nombres de eventos de Socket.io. Única fuente de verdad para cliente y servidor.

export const EVENTS = {
  // Medición de latencia
  PING: 'ping', // C → S: tiempo del cliente
  PONG: 'pong', // S → C: { clientTime, serverTime }

  // Salas (C → S con ack: { ok, code, playerId, token } o { ok: false, error })
  ROOM_CREATE: 'room:create', // { name }
  ROOM_JOIN: 'room:join', // { code, name, token? } — con token reconecta al mismo jugador
  ROOM_LEAVE: 'room:leave',
  ROOM_INFO: 'room:info', // S → C: { code, phase, hostId, players: [{ id, name, color, connected }] }
  ROOM_KICKED: 'room:kicked', // S → C: { reason } (la sesión se abrió en otra pestaña)

  // Partida
  GAME_START: 'game:start', // C → S (solo host), con ack
  GAME_RESET: 'game:reset', // C → S (solo host), con ack: todos vuelven al lobby
  INPUT: 'input', // C → S: ver codec.js
  STATE: 'state', // S → C: snapshot, ver codec.js

  // Combate
  WEAPON_SWITCH: 'weapon:switch', // C → S: ranura 1 (pistola) o 2 (principal)
  INTERACT: 'interact', // C → S: tomar lo que haya cerca (armeros; en la fase 4, cajas)
  // S → C (solo al dueño): vida, chaleco, munición; solo cuando cambia.
  // C → S: el cliente lo pide al arrancar (puede haberse perdido el primero)
  PLAYER_SELF: 'player:self',
  COMBAT_HIT: 'combat:hit', // S → C (solo a quien disparó): [objetivo, daño, x, y, mató]
  COMBAT_KILL: 'combat:kill', // S → C (a todos): [asesino, víctima, índice del arma]
};

// Botones dentro del input (máscara de bits)
export const BUTTONS = {
  FIRE: 1, // disparar (mantener en armas automáticas)
  AUTO: 2, // con FIRE o GRENADE: el servidor apunta solo al enemigo visible más cercano
  RELOAD: 4,
  GRENADE: 8, // lanzar granada
};

// Banderas de cada jugador en el snapshot
export const PLAYER_FLAGS = {
  DEAD: 1,
  RELOADING: 2,
};

// En COMBAT_HIT, los blancos de práctica se identifican con números negativos: −(índice + 1)
export const dummyTargetId = (index) => -(index + 1);
