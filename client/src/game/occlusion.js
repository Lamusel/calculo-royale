// Qué objetos tapan al jugador desde la cámara. Todo en coordenadas del mapa (x, y) y altura z
// sobre el suelo del jugador.
//
// Con la posición real de la cámara (fase 24): un objeto tapa si el segmento cámara → pecho del
// jugador atraviesa su caja (agrandada un poco para que se aclare antes de taparlo del todo). Hace
// falta porque la cámara se adelanta hacia donde apunta el jugador y, cerca, ya no está justo al sur.
// Sin cámara (pruebas viejas, proyector): la cámara mira desde el sur (−y) con una inclinación de
// `pitchDeg` y tapa lo que está al sur a menos de (H − pecho) / tan(pitch).

const CHEST = 0.6;
const HALF_WIDTH = 1.1; // ancho del corredor entre el jugador y la cámara
const MARGIN = 0.6; // margen alrededor de la caja con la cámara real
const CHEST_REAL = 1.1;

// ¿El segmento a → b (3D) cruza la caja [min, max]? (método de las placas)
function segmentHitsBox(a, b, min, max) {
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) {
      if (a[k] < min[k] || a[k] > max[k]) return false;
      continue;
    }
    let ta = (min[k] - a[k]) / d;
    let tb = (max[k] - a[k]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

// items: [{ id, minX, maxX, minY, maxY, height }] · cam: { x, y, z } (opcional)
export function findOccluders(px, py, items, pitchDeg, out = new Set(), cam = null) {
  out.clear();
  if (cam) {
    const a = [cam.x, cam.y, cam.z];
    const b = [px, py, CHEST_REAL];
    for (const it of items) {
      // Lo que está al norte del jugador nunca tapa (la cámara mira desde el sur)
      if (it.minY > py + 0.3) continue;
      if (segmentHitsBox(a, b, [it.minX - MARGIN, it.minY - MARGIN, -1], [it.maxX + MARGIN, it.maxY + MARGIN, it.height + 0.3])) out.add(it.id);
    }
    return out;
  }
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
