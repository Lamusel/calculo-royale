import { CHAT, PHRASE_LIMIT, QUICK_PHRASES } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';

// Frases rápidas (fase 20): solo las de la lista (índice) y con antispam: una cada gapMs y
// como mucho `max` por ventana. Devuelve true si se dijo.
export function sayPhrase(room, player, index, now) {
  if (!Number.isInteger(index) || index < 0 || index >= QUICK_PHRASES.length) return false;
  if (room.phase === 'playing' && !player.alive) return false;
  player.phrases = (player.phrases ?? []).filter((t) => now - t < PHRASE_LIMIT.windowMs);
  const last = player.phrases.at(-1);
  if ((last !== undefined && now - last < PHRASE_LIMIT.gapMs) || player.phrases.length >= PHRASE_LIMIT.max) return false;
  player.phrases.push(now);
  room.broadcast(EVENTS.PHRASE, { id: player.id, index });
  return true;
}

// Chat de texto (6.5): máximo 80 caracteres, uno cada 2 s, filtro básico de groserías; "Equipo" solo
// llega a los compañeros (en solitario, todo va a Todos). El anfitrión lo puede apagar.
const BAD = /(?<![\p{L}\d])(put[oa]s?|pendej[oa]s?|cabr[oó]n(es)?|mierda|verga|chingad[oa]|chinga|culer[oa]|maric[oó]n|idiota|imb[eé]cil|est[uú]pid[oa]|joder|co[ñn]o|hdp|ptm|mrd)(?![\p{L}\d])/giu;
export const cleanChat = (text) =>
  String(text ?? '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, CHAT.maxLength)
    .replace(BAD, (w) => '*'.repeat(w.length));

export function sayChat(room, player, data, now) {
  if (room.chatOff) return false;
  const text = cleanChat(data?.text);
  if (!text || now - (player.chatAt ?? -Infinity) < CHAT.gapMs) return false;
  player.chatAt = now;
  const team = Boolean(data?.team) && player.team != null;
  const msg = { id: player.id, text, team };
  if (!team) room.broadcast(EVENTS.CHAT, msg);
  else for (const q of room.players.values()) if (q.team === player.team) room.emitTo(q, EVENTS.CHAT, msg);
  return true;
}
