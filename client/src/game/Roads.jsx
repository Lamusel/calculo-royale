import { useMemo } from 'react';
import * as THREE from 'three';
import { ROADS } from '@calculo-royale/shared/mapLayout';
import { terrainHeight } from '@calculo-royale/shared/terrain';

// Carreteras principales: una cinta de asfalto que sigue el terreno, con textura generada en canvas
// (asfalto oscuro con grano y parches, bordes blancos y línea central amarilla discontinua).
// Caben dos vehículos. Las bermas de tierra se pintan en el terreno (MapMesh).

export const ROAD_WIDTH = 8.5;
const STEP = 3; // m entre cortes de la cinta
const TILE_LENGTH = 12; // la textura se repite cada 12 m (dos rayas de 3 m)
const LIFT = 0.12;

function roadTexture() {
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3b3c39';
  ctx.fillRect(0, 0, w, h);
  // Grano del asfalto
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const v = 50 + Math.floor(rand() * 22);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v - 3})`;
    ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1);
  }
  // Parches y desgaste suaves
  for (const [x, y, pw, ph, c] of [[10, 20, 18, 14, 'rgba(70, 70, 66, 0.55)'], [36, 78, 16, 22, 'rgba(45, 46, 43, 0.6)'], [6, 100, 12, 10, 'rgba(85, 82, 74, 0.35)']]) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, pw, ph);
  }
  // Bordes blancos gastados
  ctx.fillStyle = 'rgba(225, 222, 210, 0.75)';
  ctx.fillRect(2, 0, 2, h);
  ctx.fillRect(w - 4, 0, 2, h);
  // Línea central discontinua (3 m de raya, 3 m de espacio)
  ctx.fillStyle = '#e2b53a';
  for (const y0 of [0, h / 2]) ctx.fillRect(w / 2 - 1.5, y0, 3, h / 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Puntos de la polilínea cada STEP m (con la distancia acumulada)
function resample(line) {
  const out = [];
  let dist = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / STEP));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, d: dist + (len * k) / n });
    dist += len;
  }
  return out;
}

// Cinta de tres filas (borde, centro, borde) para seguir bien la curva del terreno
function roadGeometry() {
  const pos = [];
  const uv = [];
  const index = [];
  for (const line of ROADS) {
    const pts = resample(line);
    const base = pos.length / 3;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      for (const [s, u] of [[1, 0], [0, 0.5], [-1, 1]]) {
        const x = p.x + nx * s * (ROAD_WIDTH / 2);
        const y = p.y + ny * s * (ROAD_WIDTH / 2);
        pos.push(x, terrainHeight(x, y) + LIFT, -y);
        uv.push(u, p.d / TILE_LENGTH);
      }
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 3;
      const b = a + 3;
      index.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export default function Roads() {
  const geometry = useMemo(roadGeometry, []);
  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ map: roadTexture(), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, side: THREE.DoubleSide }),
    [],
  );
  return <mesh geometry={geometry} material={material} receiveShadow />;
}
