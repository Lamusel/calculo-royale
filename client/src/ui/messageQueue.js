import { RADIO_MAX_WAIT_MS, RADIO_MIN_SHOW_MS, RADIO_PRIORITY } from '@calculo-royale/shared/constants';

const priorityOf = (m) => RADIO_PRIORITY[m.kind] ?? 1;

// Qué mensaje del Mando se ve ahora. Función pura sobre los mensajes recibidos ({ kind, at, durationMs })
// para que el resultado sea el mismo en cada render: se simula la cola desde el primero.
// Devuelve { message, start, end } o null.
export function currentMessage(messages, now) {
  let active = null; // { message, start, end }
  const waiting = [];
  const advance = (t) => {
    while (active && active.end <= t) {
      const from = active.end;
      active = null;
      while (waiting.length && from - waiting[0].message.at > RADIO_MAX_WAIT_MS) waiting.shift();
      const next = waiting.shift();
      if (next) active = { message: next.message, start: from, end: from + next.left };
    }
  };
  for (const message of messages) {
    if (message.at > now) break;
    advance(message.at);
    if (!active) {
      active = { message, start: message.at, end: message.at + message.durationMs };
    } else if (priorityOf(message) > priorityOf(active.message)) {
      // Interrumpe; si el anterior casi no se vio, vuelve primero a la cola con lo que le faltaba
      if (message.at - active.start < RADIO_MIN_SHOW_MS) waiting.unshift({ message: active.message, left: active.end - message.at });
      active = { message, start: message.at, end: message.at + message.durationMs };
    } else {
      // Espera su turno, ordenado por prioridad (a igual prioridad, por llegada)
      const i = waiting.findIndex((w) => priorityOf(w.message) < priorityOf(message));
      waiting.splice(i < 0 ? waiting.length : i, 0, { message, left: message.durationMs });
    }
  }
  advance(now);
  return active;
}
