import { GAME_SPAWN_RADIUS, LOBBY_SPAWN_RADIUS } from '@calculo-royale/shared/constants';

// Mapa y puntos de aparición. Los obstáculos y colisiones llegan en la fase 2.
export class World {
  // Lobby: todos juntos cerca del origen
  lobbySpawn() {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * LOBBY_SPAWN_RADIUS;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  }

  // Inicio de partida: repartidos en un círculo, con un poco de azar
  gameSpawns(count) {
    const offset = Math.random() * Math.PI * 2;
    return Array.from({ length: count }, (_, i) => {
      const angle = offset + (i / count) * Math.PI * 2;
      const r = GAME_SPAWN_RADIUS * (0.85 + Math.random() * 0.15);
      return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
    });
  }
}
