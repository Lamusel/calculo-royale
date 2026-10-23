// Qué objetos tapan al jugador desde la cámara. La cámara mira desde el sur (−y) con una
// inclinación de `pitchDeg`: un objeto de altura H tapa al jugador si está al sur de él
// a menos de (H − altura del pecho) / tan(pitch). Todo en coordenadas del mapa (x, y).

const CHEST = 0.6;
const HALF_WIDTH = 1.1; // ancho del corredor entre el jugador y la cámara

// items: [{ id, minX, maxX, minY, maxY, height }]
export function findOccluders(px, py, items, pitchDeg, out = new Set()) {
  out.clear();
  const tan = Math.tan((pitchDeg * Math.PI) / 180);
  for (const it of items) {
    if (it.maxX < px - HALF_WIDTH || it.minX > px + HALF_WIDTH) continue;
    if (it.minY > py + 0.3) continue; // al norte del jugador: nunca tapa
    const reach = Math.max(0, (it.height - CHEST) / tan) + 0.8;
    if (it.maxY < py - reach) continue;
    out.add(it.id);
  }
  return out;
}

export function insideRect(px, py, r) {
  return px > r.minX && px < r.maxX && py > r.minY && py < r.maxY;
}
