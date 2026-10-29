import { useEffect, useState } from 'react';
import { DESTRUCTIBLES } from '@calculo-royale/shared/mapLayout';

// Destrucción ligera (6.5) en el cliente: marca lo roto (sale de la colisión de la predicción igual que
// en el servidor) y avisa a la escena para esconderlo. Devuelve los recién rotos (para los trozos).
let version = 0;
const listeners = new Set();

export function applyBroken(ids) {
  const set = new Set(ids);
  const fresh = [];
  for (const o of DESTRUCTIBLES) {
    const broken = set.has(o.destId);
    if (broken && !o.broken) fresh.push(o);
    o.broken = broken;
  }
  version++;
  for (const fn of listeners) fn(version);
  return fresh;
}

export function useBrokenVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    return () => listeners.delete(setV);
  }, []);
  return v;
}
