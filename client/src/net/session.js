import { EVENTS } from '@calculo-royale/shared/protocol';
import { socket } from './socket.js';

// La sesión (sala + token) vive en sessionStorage: es por pestaña, así dos pestañas
// son dos jugadores distintos, y recargar la página devuelve al mismo jugador.
const SESSION_KEY = 'cr-session';
const NAME_KEY = 'cr-name';

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function saveSession(code, token) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, token }));
  } catch {
    // Sin almacenamiento solo se pierde la reconexión automática
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // nada que limpiar
  }
}

export function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // es solo una comodidad
  }
}

function request(event, data) {
  return new Promise((resolve) => {
    socket.timeout(5000).emit(event, data, (err, res) => {
      resolve(err ? { ok: false, error: 'El servidor no respondió' } : res);
    });
  });
}

async function enter(event, data) {
  const res = await request(event, data);
  if (res.ok) saveSession(res.code, res.token);
  return res;
}

export function createRoom(name) {
  return enter(EVENTS.ROOM_CREATE, { name });
}

export function joinRoom(code, name) {
  return enter(EVENTS.ROOM_JOIN, { code, name });
}

// Vuelve a la sala guardada (recarga o reconexión). null si no hay sesión.
export async function resumeRoom() {
  const session = loadSession();
  if (!session) return null;
  const res = await enter(EVENTS.ROOM_JOIN, { ...session, name: loadName() });
  if (!res.ok) clearSession();
  return res;
}

export function leaveRoom() {
  socket.emit(EVENTS.ROOM_LEAVE);
  clearSession();
}

export function startGame() {
  return request(EVENTS.GAME_START);
}

export function resetGame() {
  return request(EVENTS.GAME_RESET);
}
