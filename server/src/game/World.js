import { GAME_SPAWN_RADIUS, LOBBY_SPAWN_RADIUS, PLAYER_RADIUS } from '@calculo-royale/shared/constants';
import { overlapsObstacle } from '@calculo-royale/shared/collision';

// Puntos de aparición. Los obstáculos y colisiones viven en shared (mapLayout y collision).
export class World {
  // Lobby: todos juntos en el campo de entrenamiento
  lobbySpawn() {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * LOBBY_SPAWN_RADIUS;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  }

  // Inicio de partida: repartidos en un círculo, con un poco de azar y fuera de los obstáculos
  gameSpawns(count) {
    const offset = Math.random() * Math.PI * 2;
    return Array.from({ length: count }, (_, i) => {
      const base = offset + (i / count) * Math.PI * 2;
      for (let attempt = 0; attempt < 30; attempt++) {
        const angle = base + (attempt % 2 ? 1 : -1) * attempt * 0.02;
        const r = GAME_SPAWN_RADIUS * (0.8 + Math.random() * 0.2);
        const pos = { x: r * Math.cos(angle), y: r * Math.sin(angle) };
        if (!overlapsObstacle(pos.x, pos.y, PLAYER_RADIUS + 0.5)) return pos;
      }
      return { x: GAME_SPAWN_RADIUS * Math.cos(base) * 0.5, y: GAME_SPAWN_RADIUS * Math.sin(base) * 0.5 };
    });
  }
}
