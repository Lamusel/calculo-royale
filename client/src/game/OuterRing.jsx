import { useMemo } from 'react';
import * as THREE from 'three';
import { OBSTACLES } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';
import { box, cylinder, merge, modelMaterial, piece } from './models/build.js';
import { Chunked } from './chunks.js';

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

// --- Piezas del mapa de 1 km (fase 34) ---
// Silo: cilindro metálico con anillos y techo cónico
function siloPieces(o) {
  const ground = terrainHeight(o.x, o.y);
  const parts = [piece(cylinder(o.r, o.r, o.height, 12), '#b9bcb6', { position: [o.x, ground + o.height / 2, -o.y] })];
  for (let k = 1; k < 4; k++) parts.push(piece(cylinder(o.r + 0.05, o.r + 0.05, 0.18, 12), '#8b8f89', { position: [o.x, ground + (o.height / 4) * k, -o.y] }));
  parts.push(piece(new THREE.ConeGeometry(o.r + 0.2, 1.8, 12), '#8f3b2c', { position: [o.x, ground + o.height + 0.9, -o.y] }));
  return parts;
}

// Antena de radio: torre roja y blanca (punto de referencia desde lejos)
function antennaPieces(o) {
  const ground = terrainHeight(o.x, o.y);
  const parts = [];
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    const h = o.height / steps;
    const w = 1.6 - k * 0.15;
    parts.push(piece(box(w, h, w), k % 2 ? '#e8e4da' : '#c0392b', { position: [o.x, ground + h * (k + 0.5), -o.y] }));
  }
  parts.push(piece(box(2.6, 0.2, 0.2), '#555555', { position: [o.x, ground + o.height * 0.8, -o.y] }));
  parts.push(piece(cylinder(0.08, 0.08, 4, 5), '#555555', { position: [o.x, ground + o.height + 2, -o.y] }));
  return parts;
}

// Muro de la represa: concreto con borde claro (baja hasta el agua)
function damPieces(o) {
  const ground = terrainHeight(o.x, o.y);
  return [
    piece(box(o.w, o.height + 3, o.h), '#a3a097', { position: [o.x, ground + (o.height + 3) / 2 - 3, -o.y] }),
    piece(box(o.w + 0.2, 0.3, o.h + 0.2), '#c9c6bc', { position: [o.x, ground + o.height + 0.15, -o.y] }),
  ];
}

// Lápida con su losa
function tombPieces(o) {
  const ground = terrainHeight(o.x, o.y);
  return [
    piece(box(o.w, o.height, 0.3), '#9c9a94', { position: [o.x, ground + o.height / 2, -(o.y + o.h / 2 - 0.15)] }),
    piece(box(o.w, 0.12, o.h), '#7e7c76', { position: [o.x, ground + 0.06, -o.y] }),
  ];
}

// Pila de troncos: tres abajo y dos arriba
function logPieces(o) {
  const ground = terrainHeight(o.x, o.y);
  const long = o.vertical ? o.h : o.w;
  const rot = o.vertical ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2];
  return [[-0.75, 0.4], [0, 0.4], [0.75, 0.4], [-0.38, 1.1], [0.38, 1.1]].map(([k, lift]) =>
    piece(cylinder(0.38, 0.38, long, 7), k ? '#7a5634' : '#6b4a2c', { position: o.vertical ? [o.x + k, ground + lift, -o.y] : [o.x, ground + lift, -(o.y + k)], rotation: rot }),
  );
}

const BUILDERS = {
  bus: busPieces, stand: standPieces, stall: stallPieces, cliff: cliffPieces, silo: siloPieces, antenna: antennaPieces, dam: damPieces, tomb: tombPieces, logs: logPieces,
};
const RING_ITEMS = OBSTACLES.filter((o) => BUILDERS[o.kind]);

function RingChunk({ items }) {
  const geometry = useMemo(() => merge(items.flatMap((o) => BUILDERS[o.kind](o, Math.abs(Math.round(o.x + o.y))))), [items]);
  return <mesh geometry={geometry} material={modelMaterial} castShadow receiveShadow />;
}

// Por bloques: solo los cercanos a la cámara
export default function OuterRing() {
  return <Chunked items={RING_ITEMS} render={(list) => <RingChunk items={list} />} />;
}
