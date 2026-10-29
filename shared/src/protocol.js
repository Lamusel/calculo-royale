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
  ROOM_DEPLOY: 'room:deploy', // C → S (solo host, en el lobby): 'bus' | 'punto'
  ROOM_DURATION: 'room:duration', // C → S (solo host, en el lobby): 'corta' | 'normal' | 'larga'
  ROOM_TEAM_MODE: 'room:teamMode', // C → S (solo host): 'solo' | 'duos' | 'squads'
  ROOM_TEAM_JOIN: 'room:teamJoin', // C → S: número de equipo (0 = sin elegir)
  ROOM_TEAM_SHUFFLE: 'room:teamShuffle', // C → S (solo host): mezclar los equipos
  TEAM_PING: 'team:ping', // C → S { x, y } · S → C { id, x, y } (solo a su equipo)
  ROOM_WEATHER: 'room:weather', // C → S (solo host, en el lobby): 'aleatorio' o un clima de WEATHERS
  ROOM_EASY: 'room:easy', // C → S (solo host, en el lobby): true | false — preguntas de aritmética
  ROOM_BOTS: 'room:bots', // C → S (solo host, en el lobby): completar con bots hasta N jugadores (0 = quitarlos)
  QUICK_PHRASE: 'phrase:say', // C → S: índice en QUICK_PHRASES
  PHRASE: 'phrase', // S → C: { id, index }
  CHAT_SEND: 'chat:send', // C → S: { text, team } (team: solo a mi equipo)
  CHAT: 'chat', // S → C: { id, text, team }
  CLIENT_FPS: 'stats:fps', // C → S: FPS promedio de los últimos 10 s (estadísticas de balance)
  PROPS_BROKEN: 'props:broken', // S → C: destId de todo lo roto (cajas de madera, barriles, cercas)
  ROOM_CHAT: 'room:chat', // C → S (solo host): true | false — chat encendido
  RESULTS_CSV: 'results:csv', // S → C (host y proyector): { filename, csv }
  // C → S: { skin, unlocked: [ids de honor desbloqueadas] } — solo en el lobby
  PLAYER_SKIN: 'player:skin',

  // Partida
  GAME_START: 'game:start', // C → S (solo host), con ack
  GAME_RESET: 'game:reset', // C → S (solo host), con ack: todos vuelven al lobby
  INPUT: 'input', // C → S: ver codec.js
  STATE: 'state', // S → C: snapshot, ver codec.js

  // Combate
  WEAPON_SWITCH: 'weapon:switch', // C → S: ranura 1 o 2 (principales) o 3 (secundaria)
  // Inventario (fase 29). C → S: { op: 'drop'|'attach'|'detach'|'take'|'select', … } (lo valida el servidor)
  INVENTORY: 'inventory:op',
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

  // "Obtener balas": pregunta rápida (te puedes mover, no disparar)
  AMMO_REQUEST: 'ammo:request', // C → S
  AMMO_QUESTION: 'ammo:question', // S → C: { id, tema, enunciado, opciones, timeLimitMs } (sin la respuesta)
  AMMO_ANSWER: 'ammo:answer', // C → S: { id, index }
  AMMO_RESULT: 'ammo:result', // S → C: { id, correct, weapon?, explicacion?, cooldownMs?, timedOut?, cancelled? }
  // Botín en el suelo (fase 18). Cada objeto: [id, índice en LOOT_IDS (−1 = caja de botín), x, y, cantidad]
  LOOT_SYNC: 'loot:sync', // S → C: todos los objetos (al iniciar la partida o al reconectar)
  LOOT_ADD: 'loot:add', // S → C: objetos nuevos (soltados o caja de botín)
  LOOT_REMOVE: 'loot:remove', // S → C: ids tomados
  USE_ITEM: 'item:use', // C → S: 'bandage' | 'medkit' | 'drink'
  LOOT_TAKEN: 'loot:taken', // S → C (solo a quien tomó): { names: [...] } o { full: true } si no le cabía
  // S → C: { crateId, outcome: 'correct'|'wrong'|'timeout'|'cancelled', loot: [nombres], explicacion?, reason? }
  CRATE_RESULT: 'crate:result',
  CRATE_CHOOSE: 'crate:choose', // C → S: índice del premio elegido
  CRATE_CHOSEN: 'crate:chosen', // S → C: { loot: [nombres], items }

  // Transmisiones del centro de mando: { kind: 'zone'|'closing'|'airdrop'|..., title, text (LaTeX entre $), durationMs }
  RADIO_MESSAGE: 'radio:message',
  // Fin de la partida (a todos): { winnerId, ranking: [{ id, name, color, place, kills, correct, answered, score }] }
  GAME_OVER: 'game:over',
  // Despliegue al iniciar (a todos): { mode, route?: [x0, y0, x1, y1], departInMs?, durationMs?, pickMs? }
  MATCH_DEPLOY: 'match:deploy',
  // Modo elegir punto: dónde quiero caer (C → S): { x, y }
  DEPLOY_POINT: 'deploy:point',
  // Duelo final (a todos, al quedar 2 vivos): { ids: [a, b], introMs }
  MATCH_DUEL: 'match:duel',
  // Repetición de la mejor jugada (a todos, justo antes de game:over): { kind, title, focusId, keyTick, frames: [snapshot…] }
  MATCH_REPLAY: 'match:replay',
  // Resultados privados (solo al dueño): { byTopic, failed: [{ tema, enunciado, opciones, correcta, elegida, explicacion }] }
  RESULTS_SELF: 'results:self',

  // Operadores de radio e intercepciones
  // S → C: { id, kind: 'operator'|'gulag', tema, dificultad, enunciado, opciones, timeLimitMs } (sin la respuesta)
  TRANSMISSION: 'radio:transmission',
  TRANSMISSION_ANSWER: 'radio:answer', // C → S: { id, index }
  // S → C: { id, kind, correct, explicacion }
  TRANSMISSION_RESULT: 'radio:result',
  GULAG_CHOICE: 'gulag:choice', // C → S: 'rifle' | 'shotgun' (Gulag con 3 aciertos)
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
  JUMP: 32, // saltar del bus
  MELEE: 64, // golpe cuerpo a cuerpo (V)
};

// Banderas de cada jugador en el snapshot
export const PLAYER_FLAGS = {
  DEAD: 1,
  RELOADING: 2,
  ANSWERING: 4, // abriendo una caja: está quieto y expuesto
  IN_VEHICLE: 8, // va en un jeep (su posición es la del asiento)
  LEADER: 16, // líder con recompensa: corona y marca en el minimapa
  IN_BUS: 32, // va en el bus de despliegue (no se dibuja)
  FALLING: 64, // caída libre (la altura va en el índice 9 de su entrada)
  PARACHUTE: 128, // bajando en paracaídas
  ZIPLINE: 256, // colgado de una tirolina (la altura va en el índice 9)
  DOWNED: 512, // derribado (dúos y escuadras): se arrastra, un compañero lo puede levantar
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
