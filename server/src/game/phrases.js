import { PHRASE_LIMIT, QUICK_PHRASES } from '@calculo-royale/shared/constants';
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
