import { useMemo } from 'react';
import * as THREE from 'three';
import { OBSTACLES } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { box, merge, modelMaterial, piece } from './models/build.js';

// Piezas de las zonas del anillo exterior (fase 18), construidas por código desde mapLayout:
// buses de la terminal, tribunas del estadio, puestos del mercado y paredes del cañón. Todo va
// en una sola geometría (no se mueven). La pista del aeródromo se pinta en el terreno (MapMesh).

const BUS_COLORS = ['#d6a226', '#2f7d4a', '#b8442e', '#2f5a7a'];
const AWNINGS = ['#c0392b', '#2e86c1', '#d4ac0d', '#27ae60', '#8e44ad'];

// Bus de costado: carrocería, franja de ventanas, ruedas
function busPieces(o, i) {
  const ground = terrainHeight(o.x, o.y);
  const long = o.vertical ? o.h : o.w;
  const wide = o.vertical ? o.w : o.h;
  const color = BUS_COLORS[i % BUS_COLORS.length];
  const rot = [0, o.vertical ? Math.PI / 2 : 0, 0];
  const at = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).applyEuler(new THREE.Euler(...rot));
    return [o.x + v.x, ground + v.y, -o.y + v.z];
  };
  const parts = [
    piece(box(long, 2.2, wide), color, { position: at(0, 1.5, 0), rotation: rot }),
    piece(box(long - 0.6, 0.7, wide + 0.04), '#2b3a44', { position: at(0.1, 1.95, 0), rotation: rot }),
    piece(box(long + 0.04, 0.2, wide + 0.04), '#e8e4da', { position: at(0, 1.2, 0), rotation: rot }),
  ];
  for (const sx of [-0.33, 0.33]) for (const sz of [-1, 1]) parts.push(piece(box(0.9, 0.9, 0.3), '#1c1c1a', { position: at(sx * long, 0.45, sz * (wide / 2)), rotation: rot }));
  return parts;
}

// Tribuna escalonada: gradas que suben alejándose de la cancha (`face` = hacia dónde mira)
function standPieces(o) {
  const ground = terrainHeight(o.x, o.y);
  const steps = 4;
  const parts = [];
  const alongX = o.face === 'n' || o.face === 's';
  const depth = alongX ? o.h : o.w;
  const length = alongX ? o.w : o.h;
  // Hacia la cancha: −1 o +1 en el eje corto
  const toward = { n: 1, s: -1, e: 1, w: -1 }[o.face];
  for (let k = 0; k < steps; k++) {
    const d = depth / steps;
    const offset = (depth / 2 - d / 2 - k * d) * toward; // la grada k queda más lejos de la cancha
    const h = (o.height / steps) * (k + 1);
    const color = k % 2 ? '#9c9a8e' : '#b5b2a4';
    const pos = alongX ? [o.x, ground + h / 2, -(o.y + offset)] : [o.x + offset, ground + h / 2, -o.y];
    const size = alongX ? [length, h, d] : [d, h, length];
    parts.push(piece(box(...size), color, { position: pos }));
    // Asientos de colores sobre cada grada
    const seat = alongX ? [length - 0.4, 0.12, d * 0.4] : [d * 0.4, 0.12, length - 0.4];
    parts.push(piece(box(...seat), k % 2 ? '#2e86c1' : '#c0392b', { position: [pos[0], ground + h + 0.06, pos[2]] }));
  }
  return parts;
}

// Puesto de mercado: mesa con mercancía y toldo de color sobre cuatro palos
function stallPieces(o, i) {
  const ground = terrainHeight(o.x, o.y);
  const [w, d] = [o.w, o.h];
  const awning = AWNINGS[i % AWNINGS.length];
  const parts = [
    piece(box(w, 0.9, d), '#7a5634', { position: [o.x, ground + 0.45, -o.y] }),
    piece(box(w - 0.3, 0.2, d - 0.3), '#d68a2c', { position: [o.x, ground + 1.0, -o.y] }),
    piece(box(w + 0.6, 0.08, d + 0.6), awning, { position: [o.x, ground + 2.3, -o.y] }),
  ];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(piece(box(0.08, 2.3, 0.08), '#4c3520', { position: [o.x + sx * (w / 2 + 0.2), ground + 1.15, -(o.y + sy * (d / 2 + 0.2))] }));
  return parts;
}

// Pared del cañón: bloque de roca con capas de color
function cliffPieces(o) {
  const ground = terrainHeight(o.x, o.y);
  const layers = ['#8a6b4f', '#9b7a5a', '#7d5f45'];
  return layers.map((color, k) => {
    const h = o.height / layers.length;
    const shrink = k * 0.35;
    return piece(box(Math.max(0.5, o.w - shrink), h, Math.max(0.5, o.h - shrink)), color, { position: [o.x, ground + h * (k + 0.5), -o.y] });
  });
}

const BUILDERS = { bus: busPieces, stand: standPieces, stall: stallPieces, cliff: cliffPieces };

export default function OuterRing() {
  const geometry = useMemo(() => {
    const counters = {};
    const parts = OBSTACLES.filter((o) => BUILDERS[o.kind]).flatMap((o) => {
      counters[o.kind] = (counters[o.kind] ?? 0) + 1;
      return BUILDERS[o.kind](o, counters[o.kind]);
    });
    return parts.length ? merge(parts) : null;
  }, []);
  return geometry && <mesh geometry={geometry} material={modelMaterial} castShadow receiveShadow />;
}
