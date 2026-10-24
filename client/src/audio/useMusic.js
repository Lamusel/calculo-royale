import { useEffect } from 'react';
import { musicMoment } from './mix.js';
import { setMusicMoment } from './sound.js';

// Elige la música según lo que pasa en la sala (2 veces por segundo) y la calla al salir
export function useMusic(client, room, myId) {
  useEffect(() => {
    if (!client) return undefined;
    const pick = () => {
      const zone = client.lastFrame?.zone;
      setMusicMoment(
        musicMoment({
          phase: room.phase,
          deploying: Boolean(client.deploying),
          duel: Boolean(client.duel),
          closing: Boolean(zone?.[10]),
          winner: myId !== null && client.results?.winnerId === myId,
          alive: client.alive,
        }),
      );
    };
    pick();
    const id = setInterval(pick, 500);
    return () => clearInterval(id);
  }, [client, room.phase, myId]);
  useEffect(() => () => setMusicMoment(null), []);
}
