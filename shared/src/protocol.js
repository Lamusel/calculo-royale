// Nombres de eventos de Socket.io. Única fuente de verdad para cliente y servidor.

export const EVENTS = {
  // Medición de latencia
  PING: 'ping', // C → S: tiempo del cliente
  PONG: 'pong', // S → C: { clientTime, serverTime }

  // Salas (C → S con ack: { ok, code, playerId, token } o { ok: false, error })
  ROOM_CREATE: 'room:create', // { name }
  ROOM_JOIN: 'room:join', // { code, name, token? } — con token reconecta al mismo jugador
  ROOM_LEAVE: 'room:leave',
  // S → C: { code, phase, hostId, topics, weather, weatherChoice, windAngle, players: [{ id, name, color, skin, connected }] }
  ROOM_INFO: 'room:info',
  ROOM_KICKED: 'room:kicked', // S → C: { reason } (la sesión se abrió en otra pestaña)
  ROOM_TOPICS: 'room:topics', // C → S (solo host, en el lobby): [slug, ...] temas de la sala
  ROOM_WEATHER: 'room:weather', // C → S (solo host, en el lobby): 'aleatorio' o un clima de WEATHERS
  // C → S: { skin, unlocked: [ids de honor desbloqueadas] } — solo en el lobby
  PLAYER_SKIN: 'player:skin',

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

  // Cajas de suministro (se abren con INTERACT)
  // S → C: { crateId, rarity, tema, enunciado, opciones, timeLimitMs } — nunca la respuesta correcta
  CRATE_QUESTION: 'crate:question',
  CRATE_ANSWER: 'crate:answer', // C → S: { crateId, index }
  CRATE_CANCEL: 'crate:cancel', // C → S
  // S → C: { crateId, outcome: 'correct'|'wrong'|'timeout'|'cancelled', loot: [nombres], explicacion?, reason? }
  CRATE_RESULT: 'crate:result',

  // Transmisiones del centro de mando: { kind: 'zone'|'closing'|'airdrop'|..., title, text (LaTeX entre $), durationMs }
  RADIO_MESSAGE: 'radio:message',
  // Fin de la partida (a todos): { winnerId, ranking: [{ id, name, color, place, kills, correct, answered, score }] }
  GAME_OVER: 'game:over',
  // Resultados privados (solo al dueño): { byTopic, failed: [{ tema, enunciado, opciones, correcta, elegida, explicacion }] }
  RESULTS_SELF: 'results:self',

  // Operadores de radio e intercepciones
  // S → C: { id, kind: 'operator'|'intercept', tema, enunciado, opciones, timeLimitMs } (sin la respuesta)
  TRANSMISSION: 'radio:transmission',
  TRANSMISSION_ANSWER: 'radio:answer', // C → S: { id, index }
  // S → C: { id, kind, correct, explicacion, revived?, intel?: { cx, cy }, late? }
  TRANSMISSION_RESULT: 'radio:result',
  VOTE_SECTOR: 'radio:vote', // C → S: sector elegido para el bombardeo ('C3')
  // S → C (host y espectadores): { byTopic, alive, total, operators, votes }
  CLASS_STATS: 'class:stats',
  ROOM_SPECTATE: 'room:spectate', // C → S con ack: { code } (vista para proyector, sin jugador)
};

// Botones dentro del input (máscara de bits)
export const BUTTONS = {
  FIRE: 1, // disparar (mantener en armas automáticas)
  AUTO: 2, // con FIRE o GRENADE: el servidor apunta solo al enemigo visible más cercano
  RELOAD: 4,
  GRENADE: 8, // lanzar granada
  AIM: 16, // apuntando con el francotirador: camina más lento
};

// Banderas de cada jugador en el snapshot
export const PLAYER_FLAGS = {
  DEAD: 1,
  RELOADING: 2,
  ANSWERING: 4, // abriendo una caja: está quieto y expuesto
  IN_VEHICLE: 8, // va en un jeep (su posición es la del asiento)
  LEADER: 16, // líder con recompensa: corona y marca en el minimapa
};

// Estado de cada caja en el snapshot
export const CRATE_STATE = {
  CLOSED: 0,
  BUSY: 1, // alguien está respondiendo
  LOCKED: 2, // bloqueada tras un fallo
  OPEN: 3, // ya saqueada
  HIDDEN: 4, // no existe en esta fase (de práctica en partida, del mapa en el lobby)
};

// En COMBAT_HIT, los blancos de práctica se identifican con números negativos: −(índice + 1)
export const dummyTargetId = (index) => -(index + 1);

// Estado de cada jeep en el snapshot
export const VEHICLE_STATE = {
  LOCKED: 0, // motor apagado: hay que responder el código
  JAMMED: 1, // motor trabado tras fallar el código
  READY: 2, // encendido: se puede subir
  DESTROYED: 3,
};
