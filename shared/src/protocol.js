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
  INPUT: 'input', // C → S: [seq, mx, my, aim]
  STATE: 'state', // S → C: [tick, [[id, x, y, aim, lastSeq], ...]]
};
