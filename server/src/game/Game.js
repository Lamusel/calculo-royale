import { TICK_MS } from '@calculo-royale/shared/constants';
import { encodePlayerState } from '@calculo-royale/shared/codec';

const DT = TICK_MS / 1000;

// Loop autoritativo de una sala. Corre también en el lobby (lobby jugable).
export class Game {
  constructor(room) {
    this.room = room;
    this.tick = 0;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.update(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  update() {
    this.tick++;
    for (const player of this.room.players.values()) {
      player.processInputs(DT);
    }
    this.room.broadcastState(this.snapshot());
  }

  snapshot() {
    const players = [];
    for (const player of this.room.players.values()) {
      players.push(encodePlayerState(player));
    }
    return [this.tick, players];
  }
}
