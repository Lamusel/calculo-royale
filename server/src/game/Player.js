import { MAX_INPUT_BURST } from '@calculo-royale/shared/constants';
import { applyInput } from '@calculo-royale/shared/movement';

export class Player {
  constructor({ id, name, color, token }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.token = token;

    this.x = 0;
    this.y = 0;
    this.aim = 0;

    this.inputs = [];
    this.lastQueuedSeq = 0;
    this.lastSeq = 0; // último input aplicado (el cliente lo usa para reconciliar)
    this.inputBudget = MAX_INPUT_BURST;

    this.socketId = null;
    this.connected = false;
    this.removeTimer = null;
  }

  queueInput(input) {
    if (input.seq <= this.lastQueuedSeq) return;
    this.lastQueuedSeq = input.seq;
    this.inputs.push(input);
    if (this.inputs.length > MAX_INPUT_BURST * 2) this.inputs.shift();
  }

  // Aplica los inputs en cola. El presupuesto sube 1 por tick: en promedio
  // nadie se mueve más rápido que un input por tick aunque envíe más.
  processInputs(dt) {
    this.inputBudget = Math.min(this.inputBudget + 1, MAX_INPUT_BURST);
    while (this.inputs.length > 0 && this.inputBudget >= 1) {
      const input = this.inputs.shift();
      applyInput(this, input, dt);
      this.lastSeq = input.seq;
      this.inputBudget -= 1;
    }
  }

  // Al reconectar, el cliente reinicia su contador de secuencia
  resetInputs() {
    this.inputs = [];
    this.lastQueuedSeq = 0;
    this.lastSeq = 0;
  }

  teleport(x, y) {
    this.x = x;
    this.y = y;
    this.inputs = [];
  }

  info() {
    return { id: this.id, name: this.name, color: this.color, connected: this.connected };
  }
}
