import { DIRECTOR } from '@calculo-royale/shared/constants';
import { PLAYER_FLAGS } from '@calculo-royale/shared/protocol';

// Director de cámara del proyector (fase 20): elige a quién seguir. Puntaje de cada jugador vivo:
// acaba de hacer una baja (5), está en una pelea (4 + rivales cerca), dispara (2), es el líder (3).
// Cada toma dura al menos minShotMs (salvo que muera su protagonista) y a lo sumo maxShotMs;
// en medio, cambia solo si aparece algo claramente mejor. En el lobby o sin vivos: plano general.

// state: { phase, players: Map id → { x, y, flags }, killfeed: [{ killer, at }], lastShot: Map id → ms }
export function scorePlayers({ players, killfeed = [], lastShot = new Map() }, now) {
  const alive = [...players].filter(([, p]) => !(p.flags & PLAYER_FLAGS.DEAD) && !(p.flags & PLAYER_FLAGS.IN_BUS));
  return alive.map(([id, p]) => {
    let score = 1;
    if (killfeed.some((k) => k.killer === id && now - k.at < 4000)) score += 5;
    const shotAgo = now - (lastShot.get(id) ?? -1e9);
    if (shotAgo < 1500) score += 2;
    const rivals = alive.filter(([other, q]) => other !== id && Math.hypot(q.x - p.x, q.y - p.y) < DIRECTOR.fightRadius).length;
    if (rivals > 0 && shotAgo < 3000) score += 4 + rivals;
    if (p.flags & PLAYER_FLAGS.LEADER) score += 3;
    return { id, score };
  });
}

// shot: { id, since } toma actual (o null). Devuelve la toma nueva o la misma.
export function direct(state, shot, now, rand = Math.random) {
  if (state.phase !== 'playing') return null;
  const scores = scorePlayers(state, now);
  if (!scores.length) return null;
  const current = shot && scores.find((s) => s.id === shot.id);
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const age = shot ? now - shot.since : Infinity;
  if (current && age < DIRECTOR.minShotMs) return shot;
  if (current && age < DIRECTOR.maxShotMs && best.score < current.score + 3) return shot;
  // Toma nueva: la mejor; si está empatada con otras, una de ellas al azar (sin repetir la actual si se puede)
  const top = scores.filter((s) => s.score === best.score && s.id !== shot?.id);
  const pick = top.length ? top[Math.floor(rand() * top.length)] : best;
  return { id: pick.id, since: now };
}
