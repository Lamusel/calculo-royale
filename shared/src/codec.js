// Codificación compacta de mensajes frecuentes (arrays en vez de objetos con claves).

const round2 = (v) => Math.round(v * 100) / 100;

export function encodeInput({ seq, mx, my, aim }) {
  return [seq, round2(mx), round2(my), round2(aim)];
}

// Valida lo que llega del cliente: devuelve null si el mensaje no es válido
export function decodeInput(data) {
  if (!Array.isArray(data) || data.length < 4) return null;
  const [seq, mx, my, aim] = data;
  if (!Number.isInteger(seq) || seq < 1) return null;
  if (![mx, my, aim].every(Number.isFinite)) return null;
  return {
    seq,
    mx: Math.max(-1, Math.min(1, mx)),
    my: Math.max(-1, Math.min(1, my)),
    aim,
  };
}

export function encodePlayerState(p) {
  return [p.id, round2(p.x), round2(p.y), round2(p.aim), p.lastSeq];
}
