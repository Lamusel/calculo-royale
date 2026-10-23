import { TICK_MS } from '@calculo-royale/shared/constants';
import { EVENTS } from '@calculo-royale/shared/protocol';
import { encodeInput } from '@calculo-royale/shared/codec';
import { readInput } from '../input/inputState.js';
import { angleDiff, SnapshotBuffer } from './interpolation.js';
import { Predictor } from './prediction.js';

// Contador global: si se recrea el cliente sin recargar, las secuencias siguen creciendo
let seq = 0;

// Conecta la red con la escena: envía inputs a 20 Hz, guarda snapshots y predice al jugador propio.
export class GameClient {
  constructor(socket, myId) {
    this.socket = socket;
    this.myId = myId;
    this.buffer = new SnapshotBuffer();
    this.predictor = new Predictor();
    this.lastSentAim = null;
    this.liveAim = 0;
    this.latency = null;

    this.onState = ([tick, players]) => {
      this.buffer.push(tick, players);
      const me = players.find((p) => p[0] === this.myId);
      if (me) this.predictor.reconcile(me[1], me[2], me[4]);
    };
    this.onPong = ({ clientTime }) => {
      this.latency = Date.now() - clientTime;
    };
    socket.on(EVENTS.STATE, this.onState);
    socket.on(EVENTS.PONG, this.onPong);

    this.inputTimer = setInterval(() => this.sendInput(), TICK_MS);
    this.pingTimer = setInterval(() => socket.emit(EVENTS.PING, Date.now()), 2000);
    socket.emit(EVENTS.PING, Date.now());
  }

  sendInput() {
    const { mx, my, aim } = readInput();
    this.liveAim = aim;
    const now = performance.now();
    const moving = mx !== 0 || my !== 0;
    const aimChanged = this.lastSentAim === null || Math.abs(angleDiff(aim, this.lastSentAim)) > 0.02;
    // Quieto y sin girar: no hace falta enviar nada
    if (!moving && !aimChanged) {
      this.predictor.idle(now);
      return;
    }
    const packet = encodeInput({ seq: ++seq, mx, my, aim });
    // Se predice con los mismos valores redondeados que recibe el servidor
    this.predictor.step({ seq: packet[0], mx: packet[1], my: packet[2], aim: packet[3] }, now);
    this.lastSentAim = aim;
    this.socket.emit(EVENTS.INPUT, packet);
  }

  // Se llama una vez por cuadro; escribe en `frame` para no crear objetos nuevos
  frame(now, frame) {
    frame.me = this.predictor.render(now, readInput().aim);
    this.buffer.sample(now, frame.others);
  }

  dispose() {
    clearInterval(this.inputTimer);
    clearInterval(this.pingTimer);
    this.socket.off(EVENTS.STATE, this.onState);
    this.socket.off(EVENTS.PONG, this.onPong);
  }
}
